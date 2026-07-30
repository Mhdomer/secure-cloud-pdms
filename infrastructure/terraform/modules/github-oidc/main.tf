########################################
# GitHub Actions OIDC federation — Sprint 4 (chapter-4 Section 4.3.6, Stage 6:
# Terraform Apply). Lets .github/workflows/deploy.yml assume an AWS role via
# short-lived web-identity tokens instead of long-lived IAM access keys
# stored as GitHub secrets.
#
# BOOTSTRAP NOTE: this module cannot create the credentials it grants access
# through. The first `terraform apply` that creates these resources must be
# run manually with the operator's own AWS credentials (console or local
# CLI with an admin/break-glass identity) — see infrastructure/README.md.
# After that, deploy.yml's terraform-apply job authenticates as
# aws_iam_role.deploy for every subsequent apply.
########################################

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # No thumbprint_list: for GitHub (and Auth0/GitLab/Google/S3-hosted JWKS
  # issuers), AWS validates the OIDC certificate chain against its own
  # trusted root CAs rather than a configured thumbprint — the
  # thumbprint_list argument on aws_iam_openid_connect_provider is only
  # load-bearing for issuers outside that trusted-CA set (terraform-provider-aws
  # docs, resource: aws_iam_openid_connect_provider).

  tags = var.tags
}

resource "aws_iam_role" "deploy" {
  name = "${var.project_name}-${var.environment}-deploy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "GitHubActionsOidcFederation"
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # GitHub emits the `repo:OWNER/REPO:environment:NAME` form of the
          # `sub` claim for any job that declares an `environment:` key,
          # which supersedes the ref/branch-based form for that job. This is
          # deploy.yml's terraform-apply job, and it is the ONLY job across
          # ci.yml/deploy.yml/security-scan.yml that requests AWS
          # credentials — every other job (SAST, image scan, IaC scan) runs
          # with no `permissions: id-token: write` and cannot mint a token
          # this role would even accept.
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:${var.github_oidc_environment}"
        }
      }
    }]
  })

  tags = var.tags
}

########################################
# Deploy-role permissions — scoped to this project's resources wherever the
# underlying AWS API supports resource-level ARNs; Resource: "*" only where
# the service genuinely does not (documented per-statement below). The real
# access boundary is WHO can assume this role at all (the OIDC trust
# condition above, scoped to one exact repo + one exact GitHub Environment),
# not resource-ARN restriction on APIs that don't offer it.
########################################

resource "aws_iam_role_policy" "terraform_backend" {
  name = "${var.project_name}-${var.environment}-deploy-backend-policy"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "TerraformStateObject"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "arn:aws:s3:::${var.terraform_state_bucket}/${var.terraform_state_key}"
      },
      {
        Sid      = "TerraformStateBucketList"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${var.terraform_state_bucket}"
      },
      {
        Sid      = "TerraformStateLock"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        Resource = "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.terraform_lock_table}"
      },
    ]
  })
}

resource "aws_iam_role_policy" "manage_project_resources" {
  name = "${var.project_name}-${var.environment}-deploy-resources-policy"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ManageProjectKmsKey"
        Effect   = "Allow"
        Action   = ["kms:*"]
        Resource = var.kms_key_arn
        # Scoped to this project's single CMK ARN, not "*". The key's own
        # resource policy (modules/kms/main.tf, EnableRootAccountFullAccess
        # statement) is what actually turns this identity-policy grant into
        # usable access — KMS evaluates key policy AND identity policy, so
        # this is the intersection of two independently-scoped policies.
      },
      {
        Sid    = "ManageProjectS3Buckets"
        Effect = "Allow"
        Action = ["s3:*"]
        Resource = [
          "arn:aws:s3:::${var.project_name}-${var.environment}-*",
          "arn:aws:s3:::${var.project_name}-${var.environment}-*/*",
        ]
        # Every project-managed bucket (cloudtrail logs today; any future
        # frontend/static-hosting bucket) follows this exact naming
        # convention — see modules/cloudtrail/main.tf's `bucket` argument.
        # The separate, unprefixed Terraform state bucket is granted above
        # in terraform_backend, scoped to only the two actions apply needs.
      },
      {
        Sid    = "ManageProjectRds"
        Effect = "Allow"
        Action = ["rds:*"]
        Resource = [
          "arn:aws:rds:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:db:${var.project_name}-${var.environment}-*",
          "arn:aws:rds:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:subgrp:${var.project_name}-${var.environment}-*",
          "arn:aws:rds:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:pg:${var.project_name}-${var.environment}-*",
        ]
      },
      {
        Sid    = "ManageProjectLogs"
        Effect = "Allow"
        Action = ["logs:*"]
        Resource = [
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/${var.project_name}/${var.environment}*",
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/${var.project_name}/${var.environment}*:*",
          # modules/alb's WAF log group must start with AWS's mandated
          # "aws-waf-logs-" prefix, so it can never match the
          # /${project}/${environment}* pattern above no matter how that
          # wildcard is placed — a genuinely different naming scheme, not
          # an oversight in the pattern itself. Same discovery pass as
          # ManageProjectWaf below.
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:aws-waf-logs-${var.project_name}-${var.environment}*",
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:aws-waf-logs-${var.project_name}-${var.environment}*:*",
        ]
      },
      {
        # checkov:skip=CKV_AWS_355: logs:DescribeLogGroups has no usable
        # resource-level scoping in practice — confirmed live, not assumed:
        # a resource-scoped ManageProjectLogs statement (above) was not
        # sufficient. Terraform's own aws_cloudwatch_log_group read/refresh
        # path calls this API, and it failed AccessDenied against every one
        # of this project's own log groups despite the scoped grant already
        # covering them by ARN, found via the first real terraform-apply to
        # reach this far (2026-07-30).
        # checkov:skip=CKV_AWS_356: same false positive as CKV_AWS_355 — the
        # access boundary for this role is the OIDC trust condition, not a
        # resource-ARN restriction this specific Describe API doesn't honor.
        Sid      = "DescribeProjectLogGroups"
        Effect   = "Allow"
        Action   = ["logs:DescribeLogGroups"]
        Resource = "*"
      },
      {
        Sid      = "ManageProjectSns"
        Effect   = "Allow"
        Action   = ["sns:*"]
        Resource = "arn:aws:sns:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${var.project_name}-${var.environment}-*"
      },
      {
        Sid      = "ManageProjectCloudTrail"
        Effect   = "Allow"
        Action   = ["cloudtrail:*"]
        Resource = "arn:aws:cloudtrail:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:trail/${var.project_name}-${var.environment}-*"
      },
      {
        # checkov:skip=CKV_AWS_355: EC2/VPC (subnets, route tables, NAT/IGW,
        # NACLs, security groups, launch templates), Auto Scaling, and ELBv2
        # control-plane APIs overwhelmingly do not support resource-level
        # ARNs for the Create/Describe/Modify actions `terraform apply` needs
        # (see each service's page in the AWS "Actions, resources, and
        # condition keys" reference) — Resource: "*" is the only expressible
        # grant. CloudWatch metric/alarm/dashboard APIs have the same gap.
        # checkov:skip=CKV_AWS_356: same false positive as CKV_AWS_355 — see
        # the module-level comment above: the access boundary for this role
        # is the OIDC trust condition (one repo, one GitHub Environment), not
        # a resource-ARN restriction these specific APIs don't offer.
        # checkov:skip=CKV_AWS_287: not a credentials-exposure grant — ec2:*/
        # autoscaling:*/elasticloadbalancing:*/cloudwatch:* contain no
        # sts:*, secretsmanager:*, or ssm:GetParameter*(WithDecryption)
        # action; this project's actual credential reads are scoped
        # separately and tightly (modules/ec2's ReadOwnDbCredentialsFromSsm
        # statement, not this one).
        # checkov:skip=CKV_AWS_289: same false positive as CKV_AWS_355/356 —
        # flagged for the "*" resource these specific APIs require, not for
        # an actual unconstrained permissions-management grant (no iam:*
        # action appears in this statement at all).
        # checkov:skip=CKV_AWS_290: same false positive as CKV_AWS_355/356/289
        # — "write access without constraints" here means "without a
        # resource-ARN constraint", which these specific Create/Modify APIs
        # do not support; the constraint that exists is WHO can assume this
        # role (OIDC trust condition), not a resource ARN.
        Sid    = "ManageProjectComputeNetworking"
        Effect = "Allow"
        Action = [
          "ec2:*",
          "autoscaling:*",
          "elasticloadbalancing:*",
          "cloudwatch:*",
        ]
        Resource = "*"
      },
      {
        Sid      = "ManageProjectEcr"
        Effect   = "Allow"
        Action   = ["ecr:*"]
        Resource = var.ecr_repository_arn
        # Management-level (create/describe/delete the repository, its
        # lifecycle policy and encryption config) — distinct from the
        # runtime push permissions in publish_and_rollout's
        # PublishBackendImageToEcr statement below, which only cover a
        # docker push. `terraform apply` needs both.
      },
      {
        # checkov:skip=CKV_AWS_355: CloudFront distributions do support
        # resource-level ARNs for most actions, but the four data-source
        # lookups modules/frontend/main.tf performs (aws_cloudfront_cache_policy
        # x2, aws_cloudfront_origin_request_policy,
        # aws_cloudfront_response_headers_policy) call List*/Get*-by-name
        # APIs that have no resource-level ARN — same category of AWS API
        # gap as the other Resource:"*" statements already accepted in this
        # file (see ManageProjectComputeNetworking above).
        # checkov:skip=CKV_AWS_356: same false positive as CKV_AWS_355 — the
        # access boundary for this role is the OIDC trust condition (one
        # repo, one GitHub Environment), not a resource-ARN restriction
        # these specific by-name lookup APIs don't offer.
        Sid      = "ManageProjectCloudFront"
        Effect   = "Allow"
        Action   = ["cloudfront:*"]
        Resource = "*"
      },
      {
        Sid    = "ManageProjectSsmParameters"
        Effect = "Allow"
        Action = ["ssm:*"]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/*",
        ]
        # Covers modules/rds's existing /pdms/prod/db/* parameters (a
        # pre-existing gap this same statement now also closes — Sprint 4's
        # live apply used operator credentials, not this role, so the gap
        # never surfaced) and this plan's new /pdms/prod/app/* parameters.
      },
      {
        # checkov:skip=CKV_AWS_355: ssm:DescribeParameters has no
        # resource-level ARN in the AWS API (confirmed live: it AccessDenied
        # against arn:...:parameter/pdms/prod/db/* despite that exact path
        # being granted in ManageProjectSsmParameters above — the action
        # genuinely does not support resource scoping, this isn't a pattern
        # bug). Terraform's own aws_ssm_parameter read path calls this to
        # populate description/tier/allowed_pattern/key_id, which
        # GetParameter's response doesn't include. Found via the first real
        # terraform-apply to reach this far (2026-07-30) — flagged as an
        # unverified risk in the Sprint 5 prep summary before this exact
        # failure happened.
        # checkov:skip=CKV_AWS_356: same false positive as CKV_AWS_355 — the
        # access boundary for this role is the OIDC trust condition, not a
        # resource-ARN restriction this specific Describe API doesn't offer.
        Sid      = "DescribeSsmParameterMetadata"
        Effect   = "Allow"
        Action   = ["ssm:DescribeParameters"]
        Resource = "*"
      },
      {
        # checkov:skip=CKV_AWS_355: wafv2:Create*/Update* actions have no
        # resource-level ARN (same category of AWS API gap as
        # ManageProjectComputeNetworking above — Create actions can't be
        # scoped to the ARN of a resource that doesn't exist yet).
        # checkov:skip=CKV_AWS_356: same false positive as CKV_AWS_355 — the
        # access boundary for this role is the OIDC trust condition, not a
        # resource-ARN restriction these specific Create/Update APIs don't
        # offer.
        Sid      = "ManageProjectWaf"
        Effect   = "Allow"
        Action   = ["wafv2:*"]
        Resource = "*"
        # modules/alb creates aws_wafv2_web_acl.alb, its association to the
        # ALB, and its CloudWatch logging configuration — none of which this
        # role had any permission for until this statement. Predates this
        # plan's own 9 tasks (modules/alb was never touched by any of them);
        # found live via the first real terraform-apply attempt reaching
        # this far (2026-07-30) after every other gate finally passed,
        # exactly the class of gap ManageProjectEcr/CloudFront/SsmParameters
        # above already closed for ECR/CloudFront/SSM.
      },
    ]
  })
}

locals {
  # Explicit enumeration, not a `${project}-${environment}-*` wildcard.
  # aws_iam_role.deploy's own name also matches that wildcard shape, so a
  # wildcard Resource here would let the deploy role reach its own IAM
  # role/policies via iam:PutRolePolicy/iam:AttachRolePolicy (neither of
  # which the guardrail policy below denies, since ordinary policy
  # iteration must stay self-service via CI) — and from there rewrite the
  # guardrail itself over a couple of `terraform apply` runs, eventually
  # reaching iam:UpdateAssumeRolePolicy despite that guardrail. Listing the
  # exact other roles this stack creates closes that path structurally:
  # the deploy role is never a member of the set it's permitted to manage.
  other_project_role_names = [
    "${var.project_name}-${var.environment}-ec2-role",               # modules/ec2
    "${var.project_name}-${var.environment}-rds-monitoring-role",    # modules/rds
    "${var.project_name}-${var.environment}-cloudtrail-cwlogs-role", # modules/cloudtrail
    "${var.project_name}-${var.environment}-vpc-flow-logs-role",     # modules/vpc
    # vpc-flow-logs-role was missing from this list entirely — the deploy
    # role could create it (iam:CreateRole isn't scoped by this list) but
    # never read it back afterward, so every apply after the first would
    # AccessDeny on iam:GetRole. Same root cause class as
    # DescribeSsmParameterMetadata/DescribeProjectLogGroups above: found via
    # the first real terraform-apply to reach this far (2026-07-30).
  ]
  other_project_role_arns = [
    for name in local.other_project_role_names :
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${name}"
  ]
  other_project_instance_profile_arns = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:instance-profile/${var.project_name}-${var.environment}-ec2-instance-profile", # modules/ec2
  ]
}

resource "aws_iam_role_policy" "manage_project_iam" {
  name = "${var.project_name}-${var.environment}-deploy-iam-policy"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ManageOtherProjectIamRoles"
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListInstanceProfilesForRole",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:ListAttachedRolePolicies",
          "iam:CreateInstanceProfile",
          "iam:DeleteInstanceProfile",
          "iam:GetInstanceProfile",
          "iam:AddRoleToInstanceProfile",
          "iam:RemoveRoleFromInstanceProfile",
          "iam:TagInstanceProfile",
        ]
        Resource = concat(local.other_project_role_arns, local.other_project_instance_profile_arns)
        # Deliberately excludes iam:UpdateAssumeRolePolicy — no role this
        # deploy role manages should ever have its trust policy changed by
        # `terraform apply`; every trust policy in this stack is set once
        # at create time. And see local.other_project_role_names above for
        # why this is an explicit list, not this role's own name-prefix.
      },
      {
        Sid      = "PassOtherProjectRolesToTheirOwningService"
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = local.other_project_role_arns
        Condition = {
          StringEquals = {
            "iam:PassedToService" = ["ec2.amazonaws.com", "cloudtrail.amazonaws.com", "monitoring.rds.amazonaws.com"]
          }
        }
        # Closes the classic PassRole-to-compute privilege-escalation path
        # (aws-iam skill: PassRole with Resource:"*" + a compute create/update
        # action = escalation to any passable role): scoped to the three
        # explicit other-project role ARNs AND to only the service each is
        # ever passed to. Note iam:PassedToService matches the PASSED ROLE's
        # own trust-policy principal, not the API caller's service —
        # modules/rds/main.tf's rds_enhanced_monitoring role trusts
        # monitoring.rds.amazonaws.com, not rds.amazonaws.com, even though
        # it's set via an rds:* API call.
      },
    ]
  })
}

########################################
# Backend image publishing + rollout trigger + frontend cache
# invalidation — the two new deploy.yml jobs
# (publish-backend-image, publish-frontend) added alongside
# terraform-apply. Same OIDC trust boundary as every other statement in
# this module: only a job declaring environment: production ever presents
# a token this role's trust policy accepts.
########################################

resource "aws_iam_role_policy" "publish_and_rollout" {
  name = "${var.project_name}-${var.environment}-deploy-publish-policy"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PublishBackendImageToEcr"
        Effect = "Allow"
        Action = [
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:BatchCheckLayerAvailability",
        ]
        Resource = var.ecr_repository_arn
      },
      {
        # checkov:skip=CKV_AWS_355: same AWS API limitation as the
        # equivalent statement in modules/ec2 — ecr:GetAuthorizationToken
        # has no resource-level ARN.
        Sid      = "AuthenticateToEcr"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        # Deliberately excludes jwt_secret — CI has no reason to read or
        # write that parameter; only modules/ec2's instance role does.
        Sid    = "ManageAppDeploySsmParameters"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:PutParameter",
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_app_parameter_prefix}/image_tag",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_app_parameter_prefix}/previous_image_tag",
        ]
      },
      {
        # Deliberately TWO statements, not one. ssm:SendCommand authorizes
        # every resource it references — the document AND each target
        # instance — so a single statement listing both resources under one
        # tag Condition fails the document half of that check: the
        # AWS-owned AWS-RunShellScript document carries no Name tag, and
        # StringEquals on an absent key evaluates false. This split (an
        # unconditioned statement for the document, a tag-conditioned one
        # for the instances) is AWS's own documented pattern — Systems
        # Manager user guide, "Restricting access to Run Command based on
        # tags". Do not merge these back together.
        Sid      = "AuthorizeRunShellScriptDocument"
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = "arn:aws:ssm:${data.aws_region.current.name}::document/AWS-RunShellScript"
      },
      {
        # Scoped via the exact tag every instance in modules/ec2's launch
        # template already carries (tag_specifications: Name =
        # "${project}-${environment}-app"), not Resource: "*" on its own —
        # this IAM condition's correctness against a live account is
        # unverified until the first real SSM RunCommand call; verify at
        # the same time as the ECR KMS assumption (Task 2's comment).
        Sid      = "TriggerBackendRolloutOnTaggedInstances"
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = "arn:aws:ec2:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:instance/*"
        Condition = {
          StringEquals = {
            "ssm:resourceTag/Name" = "${var.project_name}-${var.environment}-app"
          }
        }
      },
      {
        # checkov:skip=CKV_AWS_355: ssm:GetCommandInvocation has no
        # resource-level ARN in the AWS API — it reads a command's
        # execution result by command-id + instance-id, not a resource
        # this role manages.
        Sid      = "PollBackendRolloutResult"
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation"]
        Resource = "*"
      },
      {
        Sid      = "InvalidateFrontendDistribution"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
        Resource = var.cloudfront_distribution_arn
      },
    ]
  })
}

########################################
# Guardrail — defense-in-depth, not the sole control. The real protection is
# structural: manage_project_iam above grants IAM actions only against the
# explicit local.other_project_role_arns list, which never includes this
# role's own ARN (see the comment on that local), so this role has no
# Allow-granted path to its own policies at all, and none of its Allow
# statements anywhere grant iam:UpdateAssumeRolePolicy or an
# OIDC-provider-modifying action — IAM's default-deny already blocks all of
# this on its own. This policy is the explicit backstop in case a future
# edit ever widens one of those Allow statements back to a wildcard that
# happens to catch this role too. Widening this role's trust, or
# re-pointing the OIDC provider, must always be a manual `terraform apply`
# with the operator's own elevated credentials — never something a GitHub
# Actions run can grant itself.
########################################

resource "aws_iam_role_policy" "deny_self_trust_escalation" {
  name = "${var.project_name}-${var.environment}-deploy-guardrail-policy"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "DenyModifyingOwnTrustBoundary"
        Effect   = "Deny"
        Action   = ["iam:UpdateAssumeRolePolicy", "iam:DeleteRole"]
        Resource = aws_iam_role.deploy.arn
      },
      {
        Sid    = "DenyModifyingOidcProvider"
        Effect = "Deny"
        Action = [
          "iam:UpdateOpenIDConnectProviderThumbprint",
          "iam:DeleteOpenIDConnectProvider",
          "iam:AddClientIDToOpenIDConnectProvider",
          "iam:RemoveClientIDFromOpenIDConnectProvider",
        ]
        Resource = aws_iam_openid_connect_provider.github.arn
      },
    ]
  })
}
