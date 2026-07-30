# Backend Deploy Automation, Frontend Hosting, HTTPS-Safe Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Sprint 4's two deferred items (ECR + SSM-based backend rollout; S3 + CloudFront
frontend hosting) and wire them together so the deployed app is actually reachable end-to-end over
HTTPS, before Sprint 5 (security evaluation) starts.

**Architecture:** One CloudFront distribution with two origins — S3 (frontend, via OAC) as default
behavior, the ALB as a second origin behind an `/api/*` behavior — so the browser's view of the
whole app is a single HTTPS origin (resolves mixed content without touching `sameSite: 'strict'` or
`VITE_API_BASE_URL`). A new `modules/ecr` holds the backend image; a single `deploy.sh`, written to
every EC2 instance by `user_data` and re-invoked on demand via SSM `AWS-RunShellScript`, pulls the
tag recorded in a new SSM parameter and health-checks it locally before swapping it in.

**Tech Stack:** Terraform (AWS provider `~> 5.60`), GitHub Actions, bash, Node/Express (unchanged),
React/Vite (unchanged, no code changes needed).

**Design reference:** `docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md`
(approved). This plan implements that spec's three decisions exactly as written, including the two
review-round follow-ups (ECR KMS assumption unverified until live; SSM polling needs a bounded
timeout).

## Global Constraints

- `checkov -d infrastructure/terraform --framework terraform` must show **zero unsuppressed
  findings** after every task that touches `.tf` files. Any new exception is an inline
  `# checkov:skip=<ID>: <reason>` comment on the exact statement/resource, never a broader
  suppression (CLAUDE.md, established by every existing module).
- `terraform fmt -check` and `terraform init -backend=false && terraform validate` (no AWS
  credentials required) must pass after every `.tf` change.
- KMS encryption via the project's single CMK (`module.kms.key_arn`) on everything, unless AWS
  itself forces a different mechanism for a specific service (documented exception, not a default).
- IAM statements are resource-scoped with an explanatory comment on every statement; `Resource: "*"`
  is only ever used where the AWS API genuinely has no resource-level ARN for that action, and is
  always `checkov:skip`-commented explaining why (see `modules/github-oidc/main.tf` for the
  established style this plan follows throughout).
- No SSH: port 22 is never opened anywhere. All instance access/control stays SSM-only.
- Terraform provider pins: `aws ~> 5.60`, `random ~> 3.6` (`infrastructure/terraform/versions.tf`) —
  do not introduce a new provider.
- **This plan's tasks never run `terraform apply` or `terraform destroy`, and never trigger an
  actual GitHub Actions run against `deploy.yml`.** `terraform plan` (read-only, credentials are
  already configured in this environment — confirmed via `aws sts get-caller-identity`) is allowed
  without further sign-off per the spec's verification plan; an actual `apply`/`destroy`/live CI run
  requires stopping and asking first, exactly as the original task's constraints state.
- **Commit cap:** CLAUDE.md caps commits at 3/day; this plan has 9 tasks, each ending in its own
  commit. Flag this to the user before starting execution and get an explicit one-time override for
  this work (mirrors a prior session's precedent for exactly this situation — atomic, independently
  revertable commits for a large infra change) rather than batching unrelated tasks into one commit
  to stay under the cap.
- Tool paths specific to this Windows environment (only needed if `checkov`/the right `python` isn't
  on `PATH` in whatever shell runs a task): checkov —
  `C:\Users\md3om\AppData\Roaming\Python\Python313\Scripts\checkov.cmd`; PyYAML-capable Python —
  `C:\Python313\python.exe`.

---

### Task 1: Fix the ALB health-check path bug

Standalone, no dependencies on anything else in this plan. Blocks the entire goal of this work
regardless of how correctly the rest is built: the ASG can never register healthy against a 404'ing
health-check path.

**Files:**
- Modify: `infrastructure/terraform/variables.tf:130-133`

**Interfaces:**
- Produces: `var.health_check_path` now defaults to `/health` (was `/api/health`), consumed by
  `module.alb`'s target group health check (`infrastructure/terraform/main.tf:101`, unchanged).

- [ ] **Step 1: Re-confirm the bug directly against the current source**

Run:
```bash
grep -n "app.get('/health'" "src/backend/src/app.js"
grep -rn "'/health'\|\"/health\"" "src/backend/src/routes/"
```
Expected: the first command matches `src/backend/src/app.js:26` (`app.get('/health', ...)`, mounted
at root, no `/api` prefix); the second command returns **no matches** — confirms there is no
`/api/health` route anywhere in `src/routes/`.

- [ ] **Step 2: Fix the default**

In `infrastructure/terraform/variables.tf`, replace:
```hcl
variable "health_check_path" {
  type    = string
  default = "/api/health"
}
```
with:
```hcl
variable "health_check_path" {
  description = "ALB target group health check path. Must match a real unauthenticated route in src/backend/src/app.js — currently only app.get('/health', ...) at root (app.js:26), no /api prefix. There is no /api/health route anywhere in src/backend/src/routes/; the previous default here would have 404'd forever and kept the ASG unhealthy indefinitely."
  type        = string
  default     = "/health"
}
```

- [ ] **Step 3: Verify**

Run:
```bash
cd infrastructure/terraform
terraform fmt -check
terraform init -backend=false
terraform validate
```
Expected: `fmt -check` prints nothing (already formatted); `validate` prints `Success! The
configuration is valid.`

- [ ] **Step 4: Commit**

```bash
git add infrastructure/terraform/variables.tf
git commit -m "fix ALB health check path to match the real /health route"
```

---

### Task 2: `modules/ecr` — backend image repository

**Files:**
- Create: `infrastructure/terraform/modules/ecr/main.tf`
- Create: `infrastructure/terraform/modules/ecr/variables.tf`
- Create: `infrastructure/terraform/modules/ecr/outputs.tf`
- Modify: `infrastructure/terraform/main.tf` (new `module "ecr"` block)
- Modify: `infrastructure/terraform/outputs.tf` (new `ecr_repository_url`/`ecr_repository_arn` outputs)

**Interfaces:**
- Consumes: `module.kms.key_arn` (existing output, `infrastructure/terraform/main.tf:23` area).
- Produces: `module.ecr.repository_url` (string, e.g.
  `730077843716.dkr.ecr.ap-southeast-1.amazonaws.com/pdms-prod-backend`) and
  `module.ecr.repository_arn` (string) — both consumed by Task 4 (`modules/ec2`) and Task 5
  (`modules/github-oidc`).

- [ ] **Step 1: Write `modules/ecr/variables.tf`**

```hcl
variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "kms_key_arn" {
  description = "KMS CMK ARN used to encrypt image layers at rest."
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

- [ ] **Step 2: Write `modules/ecr/main.tf`**

```hcl
########################################
# ECR — backend container image repository. IMMUTABLE tags so the exact
# image Trivy-scanned in CI (security-scan.yml's container-scan job) is the
# exact image that ever gets pulled to an EC2 instance; a tag can never be
# silently repointed after the fact. KMS-encrypted with the project CMK via
# the existing generic AllowServiceUsage statement in modules/kms —
# ecr.amazonaws.com is not one of the three services (CloudWatch Logs, SNS,
# CloudTrail) that turned out to need a dedicated EncryptionContext
# statement during Sprint 4's live deployment, but that is an inference,
# not yet verified against a live account. If the first real `docker push`
# fails with a KMS access-denied-style error, add a dedicated
# AllowEcrUsage statement to modules/kms/main.tf the same way the other
# three were added — see
# docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md's
# carried-forward item #1.
########################################

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-${var.environment}-backend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-backend"
  })
}

# Cost control (this project runs on a free-tier AWS account, same
# motivation as the RDS backup-retention override in root variables.tf):
# expire any untagged image (a failed or superseded multi-step push) after
# 1 day, and keep only the most recent 10 images overall regardless of tag.
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only the most recent 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}
```

- [ ] **Step 3: Write `modules/ecr/outputs.tf`**

```hcl
output "repository_url" {
  description = "docker push/pull target, e.g. <account>.dkr.ecr.<region>.amazonaws.com/pdms-prod-backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "repository_arn" {
  value = aws_ecr_repository.backend.arn
}
```

- [ ] **Step 4: Wire into root `main.tf`**

In `infrastructure/terraform/main.tf`, insert immediately after the closing `}` of `module "kms"`
(before the `module "vpc"` block):

```hcl
########################################
# ECR — backend container image repository (Sprint 4 follow-up: rollout
# automation). See modules/ecr/main.tf.
########################################

module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
  kms_key_arn  = module.kms.key_arn
  tags         = local.common_tags
}
```

- [ ] **Step 5: Add outputs to root `outputs.tf`**

Append to `infrastructure/terraform/outputs.tf`:

```hcl
output "ecr_repository_url" {
  description = "Push backend images here: docker push <this>:<tag>"
  value       = module.ecr.repository_url
}

output "ecr_repository_arn" {
  value = module.ecr.repository_arn
}
```

- [ ] **Step 6: Verify**

```bash
cd infrastructure/terraform
terraform fmt -check
terraform init -backend=false
terraform validate
```
Expected: `Success! The configuration is valid.` Then run checkov (full path if not on `PATH`):
```bash
checkov -d infrastructure/terraform --framework terraform
```
Expected: `Failed checks: 0`, no new findings against `modules/ecr/*` beyond what already existed
before this task.

- [ ] **Step 7: Commit**

```bash
git add infrastructure/terraform/modules/ecr infrastructure/terraform/main.tf infrastructure/terraform/outputs.tf
git commit -m "add ECR repository module for backend container images"
```

---

### Task 3: `modules/frontend` — S3 + CloudFront (frontend hosting + `/api/*` proxy) + KMS statement

Implements Decision 1 (single distribution, two origins) and Decision 3 (frontend hosting) of the
spec together, since the `/api/*` behavior only makes sense as part of the same distribution the
frontend is served from.

**Files:**
- Create: `infrastructure/terraform/modules/frontend/main.tf`
- Create: `infrastructure/terraform/modules/frontend/variables.tf`
- Create: `infrastructure/terraform/modules/frontend/outputs.tf`
- Modify: `infrastructure/terraform/modules/kms/main.tf` (new `AllowCloudFrontUsage` statement)
- Modify: `infrastructure/terraform/main.tf` (new `module "frontend"` block)
- Modify: `infrastructure/terraform/outputs.tf` (new frontend/CloudFront outputs)

**Interfaces:**
- Consumes: `module.kms.key_arn`, `module.alb.alb_dns_name` (existing output,
  `infrastructure/terraform/modules/alb/outputs.tf:10`), `var.enable_https` (root variable).
- Produces: `module.frontend.bucket_name`, `module.frontend.distribution_id`,
  `module.frontend.distribution_arn`, `module.frontend.distribution_domain_name` (string, the
  `*.cloudfront.net` domain) — all consumed by Task 4, Task 5, and Task 7 (CI).

- [ ] **Step 1: Write `modules/frontend/variables.tf`**

```hcl
variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "kms_key_arn" {
  description = "KMS CMK ARN used to encrypt the frontend S3 bucket."
  type        = string
}

variable "alb_origin_domain_name" {
  description = "ALB DNS name — the second CloudFront origin, for the /api/* behavior."
  type        = string
}

variable "enable_https" {
  description = "Mirrors the project-level enable_https override (infrastructure/terraform/variables.tf) — controls whether CloudFront talks to the ALB origin over HTTP or HTTPS. This module only consumes the decision, it never sets its own independent default."
  type        = bool
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

- [ ] **Step 2: Write `modules/frontend/main.tf`**

```hcl
########################################
# Frontend delivery — private S3 bucket (React build output) behind
# CloudFront, fronted by Origin Access Control (never a public bucket
# policy). CloudFront's own *.cloudfront.net domain already serves HTTPS
# with no custom cert needed — no domain/ACM cert exists yet (see
# infrastructure/terraform/variables.tf's enable_https comment), so this is
# the only HTTPS surface this project has today.
#
# Also proxies /api/* to the ALB as a second origin on the SAME
# distribution, so the browser's view of the whole app is one HTTPS
# origin. This is not a style choice — see
# docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md
# Decision 1: src/frontend/src/lib/api.ts's relative '/api' baseURL and
# src/backend/src/utils/session.js's sameSite: 'strict' auth cookie both
# only work if the frontend and the API are same-origin from the browser's
# perspective. A separate-domain ALB origin would break both silently.
########################################

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-${var.environment}-frontend"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-frontend"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

########################################
# Origin Access Control — CloudFront reads the bucket via a signed
# service-principal request, never a public bucket policy. Unlike the
# legacy Origin Access Identity, OAC supports SSE-KMS origins (confirmed
# via the AWS CloudFront skill), so this bucket stays KMS-encrypted like
# every other bucket in this project instead of being downgraded to
# AES256 the way the ALB access-log bucket had to be (that was a
# different, ELB-log-delivery-specific AWS limitation, not a CloudFront
# one — see modules/alb/main.tf's CKV_AWS_145 comment).
########################################

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-${var.environment}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "frontend_bucket" {
  statement {
    sid    = "AllowCloudFrontServicePrincipalReadOnly"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }

  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.frontend.arn, "${aws_s3_bucket.frontend.arn}/*"]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_bucket.json
}

########################################
# Managed CloudFront policies, looked up by name rather than a hardcoded
# ID — resilient to any per-partition ID differences, self-documenting,
# and a wrong name fails loudly at `terraform plan` time instead of only
# surfacing at apply.
########################################

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

data "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "Managed-SecurityHeadersPolicy"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.project_name}-${var.environment}-frontend"

  origin {
    origin_id                = "s3-frontend"
    domain_name               = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Second origin — the ALB, proxied under /api/*. HTTP while
  # enable_https = false; wired to the same variable so this flips to
  # HTTPS automatically once a real domain/cert exists, no follow-up
  # change to this module needed later.
  origin {
    origin_id   = "alb-backend"
    domain_name = var.alb_origin_domain_name

    custom_origin_config {
      http_port                = 80
      https_port                = 443
      origin_protocol_policy   = var.enable_https ? "https-only" : "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods              = ["GET", "HEAD"]
    target_origin_id            = "s3-frontend"
    viewer_protocol_policy      = "redirect-to-https"
    compress                    = true
    cache_policy_id             = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
  }

  # /api/* — CachingDisabled + AllViewer forwards cookies/headers/query
  # strings to the ALB unmodified; this path is never cached, matching how
  # the backend already works (session cookie, per-request auth state).
  ordered_cache_behavior {
    path_pattern              = "/api/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods              = ["GET", "HEAD"]
    target_origin_id            = "alb-backend"
    viewer_protocol_policy      = "redirect-to-https"
    compress                    = true
    cache_policy_id             = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # SPA routing — an OAC-fronted private bucket returns 403 (not 404) for
  # a missing key, so both must map to index.html for client-side routing
  # (react-router) to work on a hard refresh of a deep link.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-frontend"
  })
}
```

- [ ] **Step 3: Write `modules/frontend/outputs.tf`**

```hcl
output "bucket_name" {
  value = aws_s3_bucket.frontend.id
}

output "distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.frontend.arn
}

output "distribution_domain_name" {
  description = "The *.cloudfront.net domain — already HTTPS with no custom cert needed. The backend's CLOUDFRONT_ORIGIN/FRONTEND_URL env vars (see modules/ec2) are derived from this."
  value       = aws_cloudfront_distribution.frontend.domain_name
}
```

- [ ] **Step 4: Add the CloudFront KMS statement to `modules/kms/main.tf`**

In `infrastructure/terraform/modules/kms/main.tf`, insert the following statement inside
`data "aws_iam_policy_document" "cmk"`, immediately before the block's closing `}` (i.e. after the
existing `EnableCloudTrailLogDecryptPermissions` statement, still inside the `data` block):

```hcl

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
```

- [ ] **Step 5: Wire into root `main.tf`**

In `infrastructure/terraform/main.tf`, insert immediately after the closing `}` of `module "alb"`
(before the `module "ec2"` block, since the frontend module needs `module.alb.alb_dns_name`):

```hcl
########################################
# Frontend — S3 + CloudFront (Sprint 4 follow-up: was documented in
# CLAUDE.md's tech stack but never built). Also the single HTTPS origin
# for /api/* — see modules/frontend/main.tf's header comment.
########################################

module "frontend" {
  source = "./modules/frontend"

  project_name            = var.project_name
  environment              = var.environment
  kms_key_arn              = module.kms.key_arn
  alb_origin_domain_name  = module.alb.alb_dns_name
  enable_https             = var.enable_https
  tags                     = local.common_tags
}
```

- [ ] **Step 6: Add outputs to root `outputs.tf`**

Append to `infrastructure/terraform/outputs.tf`:

```hcl
output "cloudfront_distribution_id" {
  description = "For cache invalidation: aws cloudfront create-invalidation --distribution-id <this>"
  value       = module.frontend.distribution_id
}

output "cloudfront_distribution_arn" {
  value = module.frontend.distribution_arn
}

output "cloudfront_domain_name" {
  description = "The live HTTPS URL for the whole application (frontend + /api/* proxy to the ALB)."
  value       = module.frontend.distribution_domain_name
}

output "frontend_bucket_name" {
  value = module.frontend.bucket_name
}
```

- [ ] **Step 7: Verify**

```bash
cd infrastructure/terraform
terraform fmt -check
terraform init -backend=false
terraform validate
checkov -d infrastructure/terraform --framework terraform
```
Expected: `terraform validate` → `Success!`; checkov → `Failed checks: 0`. Pay particular attention
to any finding on `aws_s3_bucket_policy.frontend` or `aws_cloudfront_distribution.frontend` — if
checkov flags something not already covered by an existing skip pattern elsewhere in this repo,
that's a real new finding to fix, not to skip.

- [ ] **Step 8: Commit**

```bash
git add infrastructure/terraform/modules/frontend infrastructure/terraform/modules/kms/main.tf infrastructure/terraform/main.tf infrastructure/terraform/outputs.tf
git commit -m "add S3+CloudFront frontend hosting with single-origin API proxy"
```

---

### Task 4: `modules/ec2` — SSM-based rollout mechanism

**Files:**
- Create: `infrastructure/terraform/modules/ec2/templates/deploy.sh.tpl`
- Create: `infrastructure/terraform/modules/ec2/templates/user_data.sh.tpl`
- Modify: `infrastructure/terraform/modules/ec2/variables.tf`
- Modify: `infrastructure/terraform/modules/ec2/main.tf`
- Modify: `infrastructure/terraform/main.tf` (new args on the existing `module "ec2"` block, new
  `local.ssm_app_prefix`)

**Interfaces:**
- Consumes: `module.ecr.repository_arn`, `module.ecr.repository_url` (Task 2),
  `module.frontend.distribution_domain_name` (Task 3), existing `var.app_port` (root variable,
  already `5000` by default).
- Produces: nothing new consumed by later Terraform tasks. Consumed operationally by Task 7 (CI)
  via the SSM parameter names `/{project}/{environment}/app/image_tag` and
  `/{project}/{environment}/app/previous_image_tag` (plain strings, not a Terraform interface, but
  the exact paths CI must read/write).

- [ ] **Step 1: Write `modules/ec2/templates/deploy.sh.tpl`**

This is rendered via Terraform's `templatefile()` (Step 5 below) — every `${...}` in this file is a
**Terraform** interpolation except the two explicitly double-dollar-escaped bash array expansions
(`$${ENV_ARGS[@]}`), which Terraform passes through literally so bash sees `${ENV_ARGS[@]}`.

```bash
#!/bin/bash
set -uo pipefail
# Pull-and-restart rollout script for the backend container. Invoked twice:
# once at instance boot (via user_data.sh.tpl, below) and again on-demand
# by .github/workflows/deploy.yml's publish-backend-image job via SSM
# AWS-RunShellScript. One script, not duplicated logic — see
# docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md
# Decision 2.
#
# Health-check-before-swap: every instance runs this independently, so a
# genuinely broken image never gets swapped in anywhere — the fleet-wide
# result of a bad deploy is "still running the last-good version
# everywhere," not a partial or fleet-wide outage. No cross-instance
# orchestration needed for this reason.

AWS_REGION="${aws_region}"
ECR_REPOSITORY_URL="${ecr_repository_url}"
APP_PORT="${app_port}"
SSM_APP_PREFIX="${ssm_app_prefix}"
SSM_DB_PREFIX="${ssm_db_prefix}"
CLOUDFRONT_ORIGIN="${cloudfront_origin}"

log() { echo "[deploy.sh] $*"; }

IMAGE_TAG=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_APP_PREFIX/image_tag" --query 'Parameter.Value' --output text)

if [ "$IMAGE_TAG" = "none" ] || [ -z "$IMAGE_TAG" ]; then
  log "No image deployed yet (image_tag=none) — nothing to do."
  exit 0
fi

log "Target image tag: $IMAGE_TAG"

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REPOSITORY_URL"

IMAGE="$ECR_REPOSITORY_URL:$IMAGE_TAG"
docker pull "$IMAGE"

JWT_SECRET=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_APP_PREFIX/jwt_secret" --with-decryption --query 'Parameter.Value' --output text)
DB_HOST=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/host" --with-decryption --query 'Parameter.Value' --output text)
DB_PORT=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/port" --with-decryption --query 'Parameter.Value' --output text)
DB_NAME=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/dbname" --with-decryption --query 'Parameter.Value' --output text)
DB_USER=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/username" --with-decryption --query 'Parameter.Value' --output text)
DB_PASSWORD=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/password" --with-decryption --query 'Parameter.Value' --output text)

ENV_ARGS=(
  -e "NODE_ENV=production"
  -e "PORT=$APP_PORT"
  -e "JWT_SECRET=$JWT_SECRET"
  -e "JWT_EXPIRES_IN=15m"
  -e "DB_HOST=$DB_HOST"
  -e "DB_PORT=$DB_PORT"
  -e "DB_NAME=$DB_NAME"
  -e "DB_USER=$DB_USER"
  -e "DB_PASSWORD=$DB_PASSWORD"
  -e "DB_SSL=true"
  -e "CLOUDFRONT_ORIGIN=$CLOUDFRONT_ORIGIN"
  -e "FRONTEND_URL=$CLOUDFRONT_ORIGIN"
  -e "COOKIE_SECURE=true"
  -e "AWS_REGION=$AWS_REGION"
  -e "LOG_LEVEL=info"
)

log "Starting candidate container on 127.0.0.1:5001"
docker rm -f pdms-backend-candidate >/dev/null 2>&1 || true
docker run -d --name pdms-backend-candidate -p 127.0.0.1:5001:"$APP_PORT" $${ENV_ARGS[@]} "$IMAGE"

HEALTHY=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:5001/health" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
  log "Candidate never became healthy after 30s — leaving current deployment in place."
  docker rm -f pdms-backend-candidate >/dev/null 2>&1 || true
  exit 1
fi

log "Candidate healthy — swapping in as pdms-backend"
docker rm -f pdms-backend-candidate >/dev/null 2>&1 || true
docker stop pdms-backend >/dev/null 2>&1 || true
docker rm pdms-backend >/dev/null 2>&1 || true
docker run -d --name pdms-backend --restart unless-stopped -p "$APP_PORT":"$APP_PORT" $${ENV_ARGS[@]} "$IMAGE"

log "Deploy complete: $IMAGE"
```

- [ ] **Step 2: Write `modules/ec2/templates/user_data.sh.tpl`**

```bash
#!/bin/bash
set -euo pipefail
dnf update -y
dnf install -y docker
systemctl enable docker
systemctl start docker

mkdir -p /opt/pdms
echo "${deploy_script_b64}" | base64 -d > /opt/pdms/deploy.sh
chmod +x /opt/pdms/deploy.sh

# Best-effort at boot — a fresh/replaced instance should come up running
# whatever was last successfully deployed. Does not block instance
# bootstrap if this fails (e.g. nothing deployed yet); the log is enough
# to diagnose from CloudWatch/SSM if needed.
/opt/pdms/deploy.sh >> /var/log/pdms-deploy.log 2>&1 || true
```

- [ ] **Step 3: Add new variables to `modules/ec2/variables.tf`**

Append:

```hcl
variable "app_port" {
  description = "Port the backend container listens on — deploy.sh binds the container here."
  type        = number
}

variable "ecr_repository_arn" {
  description = "ECR repository ARN the instance role may pull the backend image from."
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL (registry/repo, no tag) deploy.sh pulls images from."
  type        = string
}

variable "ssm_app_parameter_prefix" {
  description = "SSM Parameter Store path prefix for app-level (non-DB) runtime config — JWT secret, deployed image tag. e.g. /pdms/prod/app"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "modules/frontend's CloudFront distribution domain — becomes the backend's CLOUDFRONT_ORIGIN/FRONTEND_URL env vars so the single-origin design resolves to a real value."
  type        = string
}
```

- [ ] **Step 4: Add the `random` provider's password resource + SSM parameters to `modules/ec2/main.tf`**

Insert after the closing `}` of `resource "aws_iam_instance_profile" "ec2"` (before the
`########################################` "Launch Template" section header):

```hcl
########################################
# App runtime config in SSM — mirrors modules/rds's own "generate +
# store" pattern exactly (random_password + SecureString +
# ignore_changes = [value]) for jwt_secret. image_tag/previous_image_tag
# are mutated outside Terraform by .github/workflows/deploy.yml on every
# deploy; ignore_changes here is required for the same reason as
# db_password — without it, the next terraform-apply (which runs on every
# merge to main, not just Terraform changes) would silently reset the
# running app back to whatever tag Terraform's own default declares.
########################################

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "jwt_secret" {
  name   = "${var.ssm_app_parameter_prefix}/jwt_secret"
  type   = "SecureString"
  key_id = var.kms_key_arn
  value  = random_password.jwt_secret.result
  tags   = var.tags

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "image_tag" {
  name  = "${var.ssm_app_parameter_prefix}/image_tag"
  type  = "String"
  value = "none"
  tags  = var.tags

  lifecycle {
    ignore_changes = [value]
  }
}

# Read only by .github/workflows/deploy.yml (manual-rollback lever) — the
# EC2 role below is deliberately not granted read access to this one.
resource "aws_ssm_parameter" "previous_image_tag" {
  name  = "${var.ssm_app_parameter_prefix}/previous_image_tag"
  type  = "String"
  value = "none"
  tags  = var.tags

  lifecycle {
    ignore_changes = [value]
  }
}
```

- [ ] **Step 5: Add new IAM statements to `modules/ec2/main.tf`**

Inside `resource "aws_iam_role_policy" "app_permissions"`'s `Statement` array, append after the
existing `DecryptSsmSecureStringsWithProjectCmk` statement (before the array's closing `]`):

```hcl
      {
        Sid    = "PullBackendImageFromEcr"
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchCheckLayerAvailability",
        ]
        Resource = var.ecr_repository_arn
      },
      {
        # checkov:skip=CKV_AWS_355: ecr:GetAuthorizationToken has no
        # resource-level ARN in the AWS API — it authenticates the caller
        # to the ECR registry as a whole, not to one repository. AWS's own
        # example IAM policies for ECR pull access grant this action on
        # Resource: "*" for exactly this reason.
        Sid      = "AuthenticateToEcr"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        # Explicit two-entry list, not a "${var.ssm_app_parameter_prefix}/*"
        # wildcard — deploy.sh never reads previous_image_tag (that one
        # exists solely for the CI-side manual-rollback path), and an
        # explicit list is what this codebase already reaches for when a
        # wildcard would grant more than is actually used (see
        # modules/github-oidc's local.other_project_role_arns doing the
        # same thing for a stronger reason).
        Sid    = "ReadAppConfigFromSsm"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_app_parameter_prefix}/jwt_secret",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_app_parameter_prefix}/image_tag",
        ]
      },
```

- [ ] **Step 6: Replace `user_data` in `resource "aws_launch_template" "app"`**

Replace the existing `user_data = base64encode(<<-EOF ... EOF)` block (currently the "install
Docker only" bootstrap, with its "Sprint 3/Sprint 4" comment above it) with:

```hcl
  # Renders modules/ec2/templates/deploy.sh.tpl with this module's actual
  # config, then embeds it (base64) into user_data.sh.tpl so the instance
  # writes it to disk and runs it once at boot. See that template's header
  # comment and
  # docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md
  # Decision 2 for why this is one script invoked in two places, not
  # duplicated logic.
  user_data = base64encode(templatefile("${path.module}/templates/user_data.sh.tpl", {
    deploy_script_b64 = base64encode(templatefile("${path.module}/templates/deploy.sh.tpl", {
      aws_region         = data.aws_region.current.name
      ecr_repository_url = var.ecr_repository_url
      app_port           = var.app_port
      ssm_app_prefix      = var.ssm_app_parameter_prefix
      ssm_db_prefix       = var.ssm_parameter_prefix
      cloudfront_origin   = "https://${var.cloudfront_domain_name}"
    }))
  }))
```

- [ ] **Step 7: Wire new args into root `main.tf`'s `module "ec2"` block**

In `infrastructure/terraform/main.tf`, in the existing `module "ec2"` block, add these lines
(anywhere inside the block; suggested right after `target_group_arn = module.alb.target_group_arn`):

```hcl
  app_port                  = var.app_port
  ecr_repository_arn        = module.ecr.repository_arn
  ecr_repository_url        = module.ecr.repository_url
  ssm_app_parameter_prefix  = local.ssm_app_prefix
  cloudfront_domain_name    = module.frontend.distribution_domain_name
```

Then, in the same file's `locals` block, add the new prefix alongside the existing one:

```hcl
  ssm_db_prefix  = "/${var.project_name}/${var.environment}/db"
  ssm_app_prefix = "/${var.project_name}/${var.environment}/app"
```

(Replaces the single existing `ssm_db_prefix = ...` line — keep it, add `ssm_app_prefix` next to
it.)

- [ ] **Step 8: Verify template rendering does not leak a stray Terraform interpolation error**

The `$${ENV_ARGS[@]}` escaping in Step 1 is easy to get wrong (a single `$` there is a hard
`terraform validate`/`plan` failure, not a silent bug). Confirm directly:

```bash
cd infrastructure/terraform
terraform init -backend=false
terraform console <<'EOC'
templatefile("./modules/ec2/templates/deploy.sh.tpl", {
  aws_region         = "ap-southeast-1"
  ecr_repository_url = "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/pdms-prod-backend"
  app_port           = 5000
  ssm_app_prefix     = "/pdms/prod/app"
  ssm_db_prefix      = "/pdms/prod/db"
  cloudfront_origin  = "https://d111111abcdef8.cloudfront.net"
})
EOC
```
Expected: prints the fully rendered script with **no Terraform errors**, and the two `docker run`
lines contain literal `${ENV_ARGS[@]}` (not `[@]` alone, not an error about an undefined variable
`ENV_ARGS`).

- [ ] **Step 9: Verify Terraform validity and checkov**

```bash
terraform fmt -check
terraform validate
checkov -d infrastructure/terraform --framework terraform
```
Expected: `validate` → `Success!`; checkov → `Failed checks: 0`.

- [ ] **Step 10: Commit**

```bash
git add infrastructure/terraform/modules/ec2 infrastructure/terraform/main.tf
git commit -m "add SSM-based pull-and-restart rollout mechanism to EC2 module"
```

---

### Task 5: `modules/github-oidc` — CI/CD IAM additions

**Files:**
- Modify: `infrastructure/terraform/modules/github-oidc/variables.tf`
- Modify: `infrastructure/terraform/modules/github-oidc/main.tf`
- Modify: `infrastructure/terraform/main.tf` (new args on the existing `module "github_oidc"` block)

**Interfaces:**
- Consumes: `module.ecr.repository_arn` (Task 2), `local.ssm_app_prefix` (Task 4, Step 7),
  `module.frontend.distribution_arn` (Task 3).
- Produces: nothing new consumed by later Terraform tasks — this is the last module-level task.
  Consumed operationally by Task 7 (CI), which relies on this role actually having these
  permissions when `deploy.yml` runs for real.

- [ ] **Step 1: Add new variables to `modules/github-oidc/variables.tf`**

Append:

```hcl
variable "ecr_repository_arn" {
  description = "ECR repository ARN the deploy role may push the backend image to."
  type        = string
}

variable "ssm_app_parameter_prefix" {
  description = "SSM Parameter Store path prefix for app-level runtime config (image_tag, previous_image_tag). Must match modules/ec2's var.ssm_app_parameter_prefix."
  type        = string
}

variable "cloudfront_distribution_arn" {
  description = "modules/frontend's CloudFront distribution ARN — scopes the deploy role's cache-invalidation permission to exactly this distribution."
  type        = string
}
```

- [ ] **Step 2: Add a new IAM policy resource to `modules/github-oidc/main.tf`**

Insert after the closing `}` of `resource "aws_iam_role_policy" "manage_project_iam"` (before the
"Guardrail" section header):

```hcl
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
        # Scoped via the exact tag every instance in modules/ec2's launch
        # template already carries (tag_specifications: Name =
        # "${project}-${environment}-app"), not Resource: "*" on its own —
        # this IAM condition's correctness against a live account is
        # unverified until the first real SSM RunCommand call; verify at
        # the same time as the ECR KMS assumption (Task 2's comment).
        Sid    = "TriggerBackendRollout"
        Effect = "Allow"
        Action = ["ssm:SendCommand"]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}::document/AWS-RunShellScript",
          "arn:aws:ec2:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:instance/*",
        ]
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
```

- [ ] **Step 3: Wire new args into root `main.tf`'s `module "github_oidc"` block**

In `infrastructure/terraform/main.tf`, in the existing `module "github_oidc"` block, add:

```hcl
  ecr_repository_arn            = module.ecr.repository_arn
  ssm_app_parameter_prefix      = local.ssm_app_prefix
  cloudfront_distribution_arn   = module.frontend.distribution_arn
```

- [ ] **Step 4: Verify**

```bash
cd infrastructure/terraform
terraform fmt -check
terraform init -backend=false
terraform validate
checkov -d infrastructure/terraform --framework terraform
```
Expected: `validate` → `Success!`; checkov → `Failed checks: 0` (the two `checkov:skip` comments
above should produce two new *skipped*, not failed, checks — confirm the skip count increased by
exactly 2 and the failed count is still 0).

- [ ] **Step 5: Commit**

```bash
git add infrastructure/terraform/modules/github-oidc infrastructure/terraform/main.tf
git commit -m "grant CI deploy role ECR push, SSM rollout, and CloudFront invalidation permissions"
```

---

### Task 6: Full-stack `terraform plan` verification

Pure verification, no file changes. This is the strongest available pre-apply check — confirms the
whole module graph (all five preceding tasks together) actually resolves against the live account:
no cycles, no missing/misnamed managed-policy data sources, no invalid ARNs.

**Files:** none.

**Interfaces:** none — reads the outputs/graph produced by Tasks 1–5.

- [ ] **Step 1: Confirm credentials and `terraform.tfvars` are present**

```bash
aws sts get-caller-identity
ls infrastructure/terraform/terraform.tfvars
```
Expected: both succeed (credentials configured, tfvars file exists locally — confirmed present in
this environment as of this plan's writing; git-ignored, see
`infrastructure/terraform/terraform.tfvars.example` if it needs recreating).

- [ ] **Step 2: Run a real plan**

```bash
cd infrastructure/terraform
terraform init -input=false
terraform plan -var-file="terraform.tfvars" -out=/tmp/verify.tfplan
```
Expected: plan succeeds with no errors. Since nothing from this stack is currently deployed (Sprint
4 tore everything down after its own live verification), expect the plan to show **creates for the
full ~110+ resource stack**, not just the handful this plan added — that's normal, not a sign
something is wrong. What matters here is the absence of errors: no "Error: Reference to undeclared
resource", no "Error: Unsupported argument", no data-source-not-found for the CloudFront managed
policies, no cycle error.

- [ ] **Step 3: Spot-check the new resources in the plan output**

```bash
terraform show /tmp/verify.tfplan | grep -A2 "aws_ecr_repository.backend\|aws_cloudfront_distribution.frontend\|aws_ssm_parameter.jwt_secret\|aws_ssm_parameter.image_tag"
```
Expected: all four appear as planned creates, confirming the module wiring from Tasks 2–5 actually
reached the root plan (not orphaned in an unreferenced module).

- [ ] **Step 4: Clean up the plan file (contains no secrets, but no reason to keep it)**

```bash
rm -f /tmp/verify.tfplan
```

- [ ] **Step 5: No commit** — this task produced no file changes. Report the plan's create/change/
  destroy counts and confirm zero errors before moving to Task 7.

---

### Task 7: `deploy.yml` — publish-backend-image and publish-frontend jobs

Implements the CI/CD wiring half of the spec's Decision 2 and Decision 3, including the bounded
polling timeout flagged in spec review (not present in earlier drafts — required here).

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes (at runtime, not Terraform-time): root Terraform outputs `ecr_repository_url`,
  `frontend_bucket_name`, `cloudfront_distribution_id` (all from Tasks 2–3); SSM parameter paths
  `/pdms/prod/app/image_tag` and `/pdms/prod/app/previous_image_tag` (Task 4); the EC2 instance tag
  `Name=pdms-prod-app` (already set by the existing launch template).

- [ ] **Step 1: Add the `publish-backend-image` job**

In `.github/workflows/deploy.yml`, append after the closing of the existing `terraform-apply` job
(same indentation level, i.e. a sibling job under `jobs:`):

```yaml
  publish-backend-image:
    name: Publish Backend Image & Roll Out
    # Infrastructure (the ECR repo, the IAM statements it needs, the
    # tagged EC2 instances) must exist before anything can push to it or
    # target it — hence needs: terraform-apply, not just scan.
    needs: [scan, terraform-apply]
    # Explicit, provable guard (matches terraform-apply's own comment above)
    # against needs: alone ever being silently relied on instead.
    if: needs.scan.result == 'success' && needs.terraform-apply.result == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: production
    permissions:
      contents: read
      id-token: write
    defaults:
      run:
        working-directory: infrastructure/terraform
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ap-southeast-1

      - name: Set up Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.5"

      - name: Terraform init
        run: terraform init -input=false

      - name: Read Terraform outputs
        id: tf
        run: |
          echo "ecr_repository_url=$(terraform output -raw ecr_repository_url)" >> "$GITHUB_OUTPUT"

      - name: Log in to ECR
        run: |
          aws ecr get-login-password --region ap-southeast-1 \
            | docker login --username AWS --password-stdin "${{ steps.tf.outputs.ecr_repository_url }}"

      - name: Build backend image
        working-directory: .
        run: |
          docker build -t "${{ steps.tf.outputs.ecr_repository_url }}:${{ github.sha }}" \
            -f src/backend/Dockerfile src/backend

      - name: Push backend image
        run: docker push "${{ steps.tf.outputs.ecr_repository_url }}:${{ github.sha }}"

      - name: Record previous tag and set new tag
        env:
          SSM_APP_PREFIX: /pdms/prod/app
        run: |
          CURRENT_TAG=$(aws ssm get-parameter --name "$SSM_APP_PREFIX/image_tag" --query 'Parameter.Value' --output text)
          aws ssm put-parameter --name "$SSM_APP_PREFIX/previous_image_tag" --value "$CURRENT_TAG" --type String --overwrite
          aws ssm put-parameter --name "$SSM_APP_PREFIX/image_tag" --value "${{ github.sha }}" --type String --overwrite

      - name: Trigger rollout via SSM
        id: rollout
        run: |
          COMMAND_ID=$(aws ssm send-command \
            --document-name "AWS-RunShellScript" \
            --targets "Key=tag:Name,Values=pdms-prod-app" \
            --parameters 'commands=["/opt/pdms/deploy.sh"]' \
            --query 'Command.CommandId' --output text)
          echo "command_id=$COMMAND_ID" >> "$GITHUB_OUTPUT"

      - name: Wait for rollout result
        # Bounded two ways, deliberately: the loop's own accounting
        # (MAX_ATTEMPTS * sleep) matches this step's timeout-minutes, so
        # the loop is expected to report a clear failure reason in the
        # normal case; timeout-minutes is the hard backstop for a truly
        # wedged call (e.g. a hung aws CLI invocation that never returns
        # at all). Matches every other gate in this pipeline — no step
        # anywhere hangs indefinitely instead of failing loudly.
        timeout-minutes: 8
        run: |
          COMMAND_ID="${{ steps.rollout.outputs.command_id }}"
          INSTANCE_IDS=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=pdms-prod-app" "Name=instance-state-name,Values=running" \
            --query 'Reservations[].Instances[].InstanceId' --output text)

          MAX_ATTEMPTS=24  # 24 * 20s = 8 minutes, matching this step's own timeout-minutes above
          for INSTANCE_ID in $INSTANCE_IDS; do
            ATTEMPTS=0
            STATUS="Pending"
            while [ "$STATUS" = "Pending" ] || [ "$STATUS" = "InProgress" ]; do
              ATTEMPTS=$((ATTEMPTS + 1))
              if [ "$ATTEMPTS" -gt "$MAX_ATTEMPTS" ]; then
                echo "Timed out waiting for rollout on $INSTANCE_ID after ${MAX_ATTEMPTS} checks"
                exit 1
              fi
              sleep 20
              STATUS=$(aws ssm get-command-invocation \
                --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
                --query 'Status' --output text)
            done
            if [ "$STATUS" != "Success" ]; then
              echo "Rollout failed on $INSTANCE_ID: $STATUS"
              exit 1
            fi
            echo "Rollout succeeded on $INSTANCE_ID"
          done
```

- [ ] **Step 2: Add the `publish-frontend` job**

Append, as another sibling job under `jobs:`:

```yaml
  publish-frontend:
    name: Build & Publish Frontend
    needs: [scan, terraform-apply]
    if: needs.scan.result == 'success' && needs.terraform-apply.result == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment: production
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ap-southeast-1

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: src/frontend/package-lock.json

      - name: Install dependencies
        working-directory: src/frontend
        run: npm ci

      - name: Build
        working-directory: src/frontend
        run: npm run build

      - name: Set up Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.5"

      - name: Read Terraform outputs
        id: tf
        working-directory: infrastructure/terraform
        run: |
          terraform init -input=false
          echo "bucket=$(terraform output -raw frontend_bucket_name)" >> "$GITHUB_OUTPUT"
          echo "distribution_id=$(terraform output -raw cloudfront_distribution_id)" >> "$GITHUB_OUTPUT"

      - name: Sync to S3
        run: aws s3 sync src/frontend/dist "s3://${{ steps.tf.outputs.bucket }}" --delete

      - name: Invalidate CloudFront
        run: aws cloudfront create-invalidation --distribution-id "${{ steps.tf.outputs.distribution_id }}" --paths "/*"
```

- [ ] **Step 3: Validate YAML syntax**

```bash
"/c/Python313/python.exe" -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('valid')"
```
Expected: `valid`, no exception.

- [ ] **Step 4: Sanity-check job structure manually**

Re-read the full file and confirm: both new jobs are siblings of `terraform-apply` (not nested
inside it), both declare `environment: production` and `permissions: id-token: write` exactly like
`terraform-apply` does, and `concurrency: group: deploy-main` at the workflow's top level (already
present, unchanged) still covers these new jobs since it's workflow-scoped, not job-scoped —
confirms a rapid double-merge still can't interleave an image push/rollout with a Terraform apply of
the same infrastructure.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "add backend image publish/rollout and frontend publish jobs to deploy pipeline"
```

---

### Task 8: Documentation updates — `security-scan.yml` comment, both module READMEs

**Files:**
- Modify: `.github/workflows/security-scan.yml` (comment only, no behavior change)
- Modify: `.github/workflows/README.md`
- Modify: `infrastructure/terraform/README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update the stale scope-boundary comment in `security-scan.yml`**

In `.github/workflows/security-scan.yml`, in the `container-scan` job's `Build backend image` step,
replace the comment:

```yaml
      - name: Build backend image
        # Built and scanned only — never pushed to a registry from this
        # workflow. Publishing a scanned image (ECR) and rolling it out to
        # the EC2 Auto Scaling Group via SSM is tracked as a follow-up item
        # (docs/psm2/sprints/sprint-4-summary.md) and intentionally out of
        # this sprint's scope, which chapter-3/chapter-5 define as the CI/CD
        # pipeline + CloudWatch + CloudTrail, not container registry
        # provisioning.
```

with:

```yaml
      - name: Build backend image
        # Built and scanned only — still never pushed from this job. This
        # job is called by both ci.yml (every PR) and deploy.yml (every
        # merge), and deliberately has no AWS credentials — only a job
        # declaring environment: production gets an OIDC token this
        # project's deploy role trusts (see modules/github-oidc/main.tf's
        # header comment). Publishing now happens in deploy.yml's
        # publish-backend-image job instead, which rebuilds this exact
        # commit's image under that trust boundary after this scan has
        # already passed. See
        # docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md.
```

(Leave the rest of the step — `uses: docker/build-push-action@v6`, `push: false`, `load: true`, the
`tags:` line — completely unchanged. Only the comment above the step changes.)

- [ ] **Step 2: Update `.github/workflows/README.md`**

Replace the "Deliberately out of scope for Sprint 4" bullet about ECR/rollout:

```markdown
- **Container registry (ECR) and automated EC2 rollout.** `container-scan` builds and Trivy-scans the backend image but never pushes it anywhere — chapter-3/chapter-5's Sprint 4 scope is the CI/CD pipeline plus CloudWatch and CloudTrail, not container registry provisioning. Publishing the scanned image and rolling it out to the EC2 Auto Scaling Group (via SSM `RunShellScript` — port 22 is never open) is a documented follow-up, not implemented here. Confirmed live: hitting the ALB DNS name returns a 503, since nothing is deployed to the instances yet.
```

with:

```markdown
- ~~Container registry (ECR) and automated EC2 rollout~~ — **built**, see
  `docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md` and
  `docs/psm2/sprints/sprint-5-prep-summary.md`. `deploy.yml`'s `publish-backend-image` job pushes to
  ECR and rolls out via SSM `RunShellScript` (port 22 still never open) after this workflow's scans
  pass and `terraform-apply` succeeds.
```

- [ ] **Step 3: Update `infrastructure/terraform/README.md`**

Replace:

```markdown
    github-oidc/  # GitHub Actions OIDC provider + least-privilege deploy role for deploy.yml (Sprint 4)
```

with:

```markdown
    github-oidc/  # GitHub Actions OIDC provider + least-privilege deploy role for deploy.yml (Sprint 4)
    ecr/          # Backend container image repository, IMMUTABLE tags (Sprint 4 follow-up)
    frontend/     # S3 + CloudFront frontend hosting, also proxies /api/* to the ALB (Sprint 4 follow-up)
```

And replace the line:

```markdown
Frontend delivery (S3 + CloudFront) and application container deployment are implemented in Sprint 3 alongside the Node.js/Express backend and React frontend.
```

with:

```markdown
Frontend delivery (S3 + CloudFront, `modules/frontend`) and backend deployment automation
(`modules/ecr` + SSM-based rollout in `modules/ec2`) were built as a Sprint 4 follow-up — see
`docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md` and
`docs/psm2/sprints/sprint-5-prep-summary.md`.
```

- [ ] **Step 4: Verify**

```bash
"/c/Python313/python.exe" -c "import yaml; yaml.safe_load(open('.github/workflows/security-scan.yml')); print('valid')"
git diff --stat .github/workflows/security-scan.yml
```
Expected: `valid`; the diff stat shows only comment lines changed (no `push:`/`load:`/`tags:` lines
in the diff).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/security-scan.yml .github/workflows/README.md infrastructure/terraform/README.md
git commit -m "update docs to reflect ECR/rollout and frontend hosting no longer being out of scope"
```

---

### Task 9: Sprint-5-prep summary doc

Same pattern as `docs/psm2/sprints/sprint-4-summary.md` — the durable record of what this plan
actually built, what was verified vs. what still needs a live apply, and what's still open.

**Files:**
- Create: `docs/psm2/sprints/sprint-5-prep-summary.md`
- Modify: `CLAUDE.md` (References section — add one line pointing at the new doc; Sprint 4 row's
  "Not covered by this sprint" note no longer applies verbatim)

**Interfaces:** none — documentation only, final task.

- [ ] **Step 1: Write `docs/psm2/sprints/sprint-5-prep-summary.md`**

```markdown
# Sprint 5 Prep — Summary
## Backend Deploy Automation, Frontend Hosting, HTTPS-Safe Wiring

---

## What Was Implemented

Closes the two items Sprint 4 explicitly deferred (`sprint-4-summary.md`'s "Deliberately out of
scope" / "Still genuinely open" sections): ECR + an SSM-based pull-and-restart rollout mechanism for
the backend, and S3 + CloudFront frontend hosting — plus the application-level wiring needed to make
the two work together over HTTPS without hitting browser mixed-content blocking.

Full design rationale: `docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md`.
Implementation plan: `docs/superpowers/plans/2026-07-30-post-sprint4-deploy-and-frontend-hosting.md`.

---

## Mixed content — resolved via one CloudFront distribution, two origins

`modules/frontend`'s CloudFront distribution serves the React build (S3 origin, OAC) as its default
behavior and proxies `/api/*` to the ALB as a second origin. The browser's view of the whole app is
therefore a single HTTPS origin — confirmed necessary, not just convenient, by re-reading the actual
code: `src/frontend/src/lib/api.ts`'s relative `/api` baseURL and
`src/backend/src/utils/session.js`'s `sameSite: 'strict'` auth cookie both only work when the
frontend and API are same-origin from the browser's perspective. Zero frontend code changes.

---

## Backend deployment automation

New `modules/ecr` (IMMUTABLE tags, KMS-encrypted, `scan_on_push`, lifecycle policy capping stored
images at 10). A single `deploy.sh`, rendered via `templatefile()` and written to disk by the
launch template's `user_data`, runs at instance boot and again on-demand via SSM
`AWS-RunShellScript` from `.github/workflows/deploy.yml`'s new `publish-backend-image` job.

**Rollback**: health-check-before-swap on every instance independently — a broken image never gets
swapped in anywhere (every instance detects the same failure identically, so the fleet-wide result
of a bad deploy is "still running the last version everywhere," not a partial outage). For a subtly
broken image that passes the shallow `/health` check, CI records the previous tag to
`/pdms/prod/app/previous_image_tag` before overwriting `image_tag`, giving an explicit manual
rollback lever.

**Bug found and fixed, unrelated to but blocking this work**: `variables.tf`'s `health_check_path`
defaulted to `/api/health`, which does not exist anywhere in `src/backend/src/routes/` — only
`app.js:26`'s root-mounted `/health`. Invisible in Sprint 4 because no application was ever actually
running against it; would have kept the ASG unhealthy forever regardless of how correctly the rest
of this rollout worked.

**CI/CD**: `security-scan.yml`'s `container-scan` job is unchanged (still `push: false` — it has no
AWS credentials by design, and stays that way). `deploy.yml` gained `publish-backend-image` (rebuild
+ push + SSM rollout, blocking on result with a bounded 8-minute poll — flagged as a required
follow-up during spec review, not present in the original draft) and `publish-frontend` (build +
`aws s3 sync` + CloudFront invalidation), both gated on `needs: [scan, terraform-apply]` and
`environment: production`, same OIDC trust boundary as the existing `terraform-apply` job.

---

## Frontend hosting

`modules/frontend`: private, KMS-encrypted, versioned S3 bucket; CloudFront with Origin Access
Control (not a public bucket policy — confirmed via the AWS CloudFront skill that OAC, unlike the
legacy OAI, supports SSE-KMS origins); SPA routing via `custom_error_response` (403 and 404, both →
`index.html` at 200 — an OAC-fronted private bucket returns 403 for a missing key, not 404); the
managed `SecurityHeadersPolicy` on the default behavior.

**KMS**: the CloudFront service-principal grant in `modules/kms` is scoped via `aws:SourceAccount`
(this account), not an exact distribution ARN — CloudFront distribution IDs are AWS-generated at
creation time, unlike the CloudTrail statement's human-chosen, precomputable trail name, so there is
no equivalent deterministic string to reference without creating a module cycle. Narrower than the
general service-usage statement, without fabricating a precision the module graph can't back up.

---

## Two items flagged during spec review, carried forward as still-open

Not fixed here — genuinely require a live account to resolve, consistent with this project's
existing "verify empirically, don't assume" pattern from Sprint 4's own live-deployment bug list:

1. **ECR's KMS encryption** is assumed sufficient via the existing generic `AllowServiceUsage`
   statement (`ecr.amazonaws.com` is not one of the three services — CloudWatch Logs, SNS,
   CloudTrail — that needed a dedicated `EncryptionContext` statement last time). Unverified until
   the first real `docker push`. If it fails with a KMS access-denied-style error, add a dedicated
   `AllowEcrUsage` statement to `modules/kms/main.tf` the same way the other three were added.
2. **The `ssm:resourceTag/Name` condition** on the deploy role's `TriggerBackendRollout` statement
   is unverified against a live `ssm:SendCommand` call until the first real rollout.

---

## Security gate

```
checkov -d infrastructure/terraform --framework terraform
  → [fill in actual Passed/Failed/Skipped counts from Task 5's Step 4 output before committing this doc]

terraform plan (Task 6, full stack, against the live account) → 0 errors, N to add / 0 to change / 0 to destroy
```

**Not yet live-verified**: this plan deliberately never ran `terraform apply`, `terraform destroy`,
or an actual GitHub Actions run against `deploy.yml` — all three require explicit sign-off before
spending AWS budget or provisioning real resources, per this task's own constraints. Static checks
(`checkov`, `terraform validate`, and a real read-only `terraform plan`) all passed; a live apply is
the next step, pending that sign-off.

## Files changed

- New: `infrastructure/terraform/modules/ecr/`, `infrastructure/terraform/modules/frontend/`,
  `infrastructure/terraform/modules/ec2/templates/`
- Modified: `infrastructure/terraform/modules/ec2/{main,variables}.tf`,
  `infrastructure/terraform/modules/github-oidc/{main,variables}.tf`,
  `infrastructure/terraform/modules/kms/main.tf`, `infrastructure/terraform/{main,variables,outputs}.tf`
- Modified: `.github/workflows/deploy.yml`, `.github/workflows/security-scan.yml` (comment only)
- Modified: `.github/workflows/README.md`, `infrastructure/terraform/README.md`, `CLAUDE.md`
```

(The bracketed placeholder in the "Security gate" section is intentional — fill in the real numbers
from this plan's own Task 5 Step 4 checkov run and Task 6 Step 2 plan run before committing; do not
commit the literal bracketed text.)

- [ ] **Step 2: Update `CLAUDE.md`'s References section**

Add one line, alphabetically near the other Sprint 4 entries:

```markdown
- Backend deploy automation (ECR/SSM rollout) + frontend hosting (S3/CloudFront) + HTTPS-safe API wiring, built as a Sprint 4 follow-up (2026-07-30): `docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md`, `docs/psm2/sprints/sprint-5-prep-summary.md`
```

Also update the Sprint 4 row's note — replace:

```markdown
Not covered by this sprint: an app actually running on the EC2 instances (ECR/SSM rollout, tracked separately) and HTTPS (`enable_https` deliberately `false` pending a domain)
```

with:

```markdown
Not covered by this sprint: HTTPS (`enable_https` deliberately `false` pending a domain). ECR/SSM rollout and frontend hosting, both originally tracked separately here, were built as a follow-up — see the References entry above.
```

- [ ] **Step 3: Fill in the real checkov/plan numbers from Tasks 5 and 6**

Replace the bracketed placeholder in the doc written in Step 1 with the actual output captured
earlier in this plan's execution.

- [ ] **Step 4: Commit**

```bash
git add docs/psm2/sprints/sprint-5-prep-summary.md CLAUDE.md
git commit -m "document Sprint 5 prep: deploy automation, frontend hosting, HTTPS wiring"
```

---

## Explicitly out of scope for this plan (unchanged from the spec)

HTTPS/ACM for the ALB (`enable_https` stays `false`), Twilio/WhatsApp secrets, the `uploads/` → S3
migration, and any actual `terraform apply`/`destroy`/live GitHub Actions run — all deferred pending
separate, explicit sign-off.
