########################################
# KMS Customer Managed Key (CMK)
# Used for: RDS storage, RDS Performance Insights, EBS volumes,
#           SSM Parameter Store (DB credentials), S3 (CloudTrail + frontend logs)
# Rotation enabled, no wildcard principals, least-privilege key policy.
########################################

data "aws_caller_identity" "current" {}

locals {
  key_alias = "alias/${var.project_name}-${var.environment}-cmk"
}

data "aws_iam_policy_document" "cmk" {
  # checkov:skip=CKV_AWS_109: This is a KMS *key policy* (resource-based), not
  # an identity-based IAM policy. "Resource: *" in a key policy statement is
  # the AWS-documented, required syntax — it refers only to the CMK this
  # policy is attached to, not a wildcard across all AWS resources.
  # Principals are explicitly scoped (account root, named administrator ARNs,
  # named service principals with an account-ID condition).
  # checkov:skip=CKV_AWS_111: same key-policy false positive as CKV_AWS_109 —
  # "write access" here is KMS key administration constrained to explicitly
  # named principals, not an open write grant.
  # checkov:skip=CKV_AWS_356: same key-policy false positive — Resource: "*"
  # is required/self-referential syntax for AWS KMS key policies and cannot
  # be scoped further; principals are the actual constraint here.

  # Root account retains administrative control so the key is never orphaned.
  statement {
    sid    = "EnableRootAccountFullAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  # Explicit named key administrators only — never a wildcard principal.
  statement {
    sid    = "AllowKeyAdministration"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = var.key_administrator_arns
    }
    actions = [
      "kms:Create*",
      "kms:Describe*",
      "kms:Enable*",
      "kms:List*",
      "kms:Put*",
      "kms:Update*",
      "kms:Revoke*",
      "kms:Disable*",
      "kms:Get*",
      "kms:Delete*",
      "kms:TagResource",
      "kms:UntagResource",
      "kms:ScheduleKeyDeletion",
      "kms:CancelKeyDeletion",
      "kms:RotateKeyOnDemand",
    ]
    resources = ["*"]
  }

  # Named application roles allowed to use the key for encrypt/decrypt only.
  dynamic "statement" {
    for_each = length(var.key_user_arns) > 0 ? [1] : []
    content {
      sid    = "AllowKeyUsageByApplicationRoles"
      effect = "Allow"
      principals {
        type        = "AWS"
        identifiers = var.key_user_arns
      }
      actions = [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:DescribeKey",
      ]
      resources = ["*"]
    }
  }

  # AWS services that need to encrypt on our behalf (RDS, SSM, S3, EC2/EBS).
  # CloudWatch Logs, SNS, and CloudTrail are deliberately NOT in this list —
  # each needs its own statement below with a service-specific
  # EncryptionContext condition; a plain kms:CallerAccount grant like this
  # one is not sufficient for any of the three (confirmed empirically against
  # this exact key, one service at a time, before writing these statements —
  # see each one's comment for the specific error it fixed).
  statement {
    sid    = "AllowServiceUsage"
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = [
        "rds.amazonaws.com",
        "ssm.amazonaws.com",
        "s3.amazonaws.com",
        "ec2.amazonaws.com",
      ]
    }
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:DescribeKey",
      "kms:CreateGrant",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:CallerAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }

  # CloudWatch Logs — AWS's documented pattern
  # (https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html)
  # scopes this grant via an EncryptionContext condition on the log group's
  # own ARN rather than kms:CallerAccount. Confirmed empirically against this
  # exact key: a direct kms:GenerateDataKey call by an AdministratorAccess
  # principal succeeded instantly, while `aws logs create-log-group
  # --kms-key-id ...` failed with "the specified KMS key ... is not allowed
  # to be used with Arn <log-group-arn>" until this statement was added.
  # Scoped to log groups in this account/region rather than one exact log
  # group, since multiple modules (vpc, alb, cloudtrail, monitoring) each
  # create their own log group against this shared CMK.
  statement {
    sid    = "AllowCloudWatchLogsUsage"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["logs.${data.aws_region.current.name}.amazonaws.com"]
    }
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:DescribeKey",
      "kms:CreateGrant",
    ]
    resources = ["*"]
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:*"]
    }
  }

  # SNS (modules/cloudtrail's aws_sns_topic.trail, SSE-KMS with this CMK) —
  # AWS's SNS encryption docs
  # (https://docs.aws.amazon.com/sns/latest/dg/sns-enable-encryption-for-topic.html)
  # require an EncryptionContext condition scoped to the topic's own ARN, not
  # a plain service grant. Confirmed empirically: CreateTrail failed with
  # InsufficientSnsTopicPolicyException ("the specified KMS key ... does not
  # allow access to CloudTrail") against a plain sns.amazonaws.com +
  # kms:CallerAccount grant, and succeeded once this statement was added.
  # Hardcodes the one topic name modules/cloudtrail creates (not a wildcard
  # pattern) since only that single topic in this project is ever
  # KMS-encrypted with this key.
  statement {
    sid    = "AllowSnsUsage"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKey*",
      "kms:Encrypt",
      "kms:DescribeKey",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:EncryptionContext:aws:sns:topicArn"
      values   = ["arn:aws:sns:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${var.project_name}-${var.environment}-cloudtrail-notifications"]
    }
  }

  # CloudTrail — the three statements AWS's own documentation says are the
  # minimum required KMS key policy elements for a trail
  # (https://docs.aws.amazon.com/awscloudtrail/latest/userguide/create-kms-key-policy-for-cloudtrail.html):
  # encrypt, decrypt, and DescribeKey. Confirmed empirically that a plain
  # cloudtrail.amazonaws.com + kms:CallerAccount grant (i.e. the same shape
  # as AllowServiceUsage above) is NOT sufficient — CreateTrail failed with
  # InsufficientEncryptionPolicyException until these exact statements,
  # including the aws:cloudtrail:arn EncryptionContext condition, were added.
  # References modules/cloudtrail's trail-naming convention
  # (`${project}-${environment}-trail`) directly since a KMS key policy
  # cannot depend on that module's own resource output without creating a
  # module cycle (this key is created before cloudtrail, not after).
  statement {
    sid    = "AllowCloudTrailEncryptLogs"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions   = ["kms:GenerateDataKey*"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudtrail:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:trail/${var.project_name}-${var.environment}-trail"]
    }
    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:aws:cloudtrail:arn"
      values   = ["arn:aws:cloudtrail:*:${data.aws_caller_identity.current.account_id}:trail/*"]
    }
  }

  statement {
    sid    = "AllowCloudTrailDecryptTrail"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions   = ["kms:Decrypt"]
    resources = ["*"]
  }

  statement {
    sid    = "AllowCloudTrailDescribeKey"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions   = ["kms:DescribeKey"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudtrail:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:trail/${var.project_name}-${var.environment}-trail"]
    }
  }

  # Lets the named key administrators (the humans who'd actually need to
  # audit CloudTrail logs) decrypt them — without this, encrypt permission
  # above has no corresponding read path for anyone. Matches AWS's
  # documented EnableCloudTrailLogDecryptPermissions pattern: the Null
  # condition matches any object encrypted with CloudTrail's own
  # EncryptionContext, not just one exact trail.
  statement {
    sid    = "EnableCloudTrailLogDecryptPermissions"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = var.key_administrator_arns
    }
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "Null"
      variable = "kms:EncryptionContext:aws:cloudtrail:arn"
      values   = ["false"]
    }
  }

  # CloudFront (modules/frontend's OAC-fronted, SSE-KMS-encrypted S3
  # bucket) — scoped via aws:SourceAccount (this account), not an exact
  # distribution ARN. The CloudTrail statements above scope to an exact
  # trail ARN because trail names are human-chosen and deterministic ahead
  # of creation; CloudFront distribution IDs are AWS-generated at creation
  # time, so there is no equivalent string to precompute here without
  # creating a kms -> frontend -> kms module cycle (frontend's bucket
  # depends on this key; this key cannot also depend on frontend's
  # not-yet-created distribution ID). Account-scoping is narrower than the
  # general AllowServiceUsage statement above (still requires the request
  # to originate from a CloudFront distribution in this exact account)
  # without fabricating a precision the module dependency graph can't
  # actually back up. See
  # docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md
  # Decision 3.
  statement {
    sid    = "AllowCloudFrontUsage"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_region" "current" {}

resource "aws_kms_key" "cmk" {
  description             = "${var.project_name} ${var.environment} customer-managed key — RDS, EBS, SSM, S3, CloudTrail encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.cmk.json

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-cmk"
  })
}

resource "aws_kms_alias" "cmk" {
  name          = local.key_alias
  target_key_id = aws_kms_key.cmk.key_id
}
