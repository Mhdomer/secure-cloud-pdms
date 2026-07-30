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
  # checkov:skip=CKV_AWS_18: Bucket is private (block_public_acls/policy
  # below) and readable only by the CloudFront service principal via OAC
  # (see aws_s3_bucket_policy.frontend's AllowCloudFrontServicePrincipalReadOnly
  # statement). Skipped as a low-value target for this FYP pilot, not
  # because some other layer already provides equivalent visibility —
  # this bucket holds only public, non-sensitive static build artifacts
  # (the compiled React app; no PHI, no credentials, no per-user data), so
  # request-level object-read logging has little security value here.
  # This is a genuine observability gap, not a duplicate: CloudFront
  # access logging on this same distribution is also skipped (see
  # CKV_AWS_86 below, for unrelated cost/ACL reasons), and CloudTrail's
  # management-events trail only covers bucket-level control-plane calls
  # (e.g. PutBucketPolicy, CreateBucket) — it does not capture
  # object-level GetObject reads either way.
  # checkov:skip=CKV_AWS_144: Cross-region replication is out of scope for
  # this single-region (ap-southeast-1) pilot deployment (Table 3.5, <=50
  # concurrent users) — same rationale as modules/alb/main.tf and
  # modules/cloudtrail/main.tf's identical skip on their own S3 buckets.
  # Tracked as a production-hardening candidate beyond PSM2 scope.
  # checkov:skip=CKV2_AWS_62: Event notifications are not required for a
  # static build-artifact bucket (React production build output) with no
  # event-driven processing in this design.
  bucket = "${var.project_name}-${var.environment}-frontend"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-frontend"
  })
}

# Old build versions accumulate on every deploy since versioning is
# enabled above; only noncurrent (superseded) versions are ever expired
# here — the current/live version that CloudFront and the bucket policy
# serve is never touched by this rule.
resource "aws_s3_bucket_lifecycle_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
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
  # checkov:skip=CKV_AWS_86: Standard CloudFront access logging needs a
  # dedicated target bucket with S3 ACLs re-enabled for the
  # awslogsdelivery canonical user, which conflicts with the
  # block-all-ACLs posture used on every bucket in this project (see
  # aws_s3_bucket_public_access_block.frontend above, and the equivalent
  # blocks on the alb_logs/cloudtrail-trail buckets). Request-level
  # visibility instead comes from CloudTrail's management-events trail
  # plus the ALB's own access logs once /api/* traffic reaches the ALB
  # origin. Tracked as a follow-up if CloudFront-layer request logs are
  # needed beyond PSM2 scope.
  # checkov:skip=CKV_AWS_310: Origin failover needs a second, redundant
  # origin of the same kind as an existing one (e.g. a cross-region S3
  # replica, or a second ALB). Neither exists in this single-region pilot
  # — the s3-frontend origin has no cross-region replica (see this
  # module's CKV_AWS_144 skip on aws_s3_bucket.frontend above) and
  # alb-backend is the one ALB this project provisions. Not
  # architecturally available yet, not an oversight.
  # checkov:skip=CKV_AWS_374: Deliberate design choice, not an omission —
  # restriction_type = "none" below is set on purpose. Alamin Clinic's
  # patients, doctors, and diaspora family members reasonably access the
  # system from outside Saudi Arabia (travel, remote consults), so no
  # geographic allow/deny list is desired for this application.
  # checkov:skip=CKV_AWS_174: Inherent to using CloudFront's own
  # *.cloudfront.net default certificate (viewer_certificate below) — AWS
  # does not allow setting minimum_protocol_version while
  # cloudfront_default_certificate = true; a TLS 1.2 floor requires a
  # custom ACM certificate bound to a real domain, and no domain/ACM cert
  # is provisioned yet (same already-accepted, documented constraint as
  # modules/alb/main.tf's CKV_AWS_2 skip and
  # infrastructure/terraform/variables.tf's enable_https comment). The
  # default certificate still forces HTTPS end-to-end — see this module's
  # header comment.
  # checkov:skip=CKV2_AWS_42: Same root cause as CKV_AWS_174 above — a
  # custom SSL certificate requires a real domain with an ACM certificate,
  # neither of which is provisioned yet. viewer_certificate below uses
  # CloudFront's own default certificate deliberately (see this module's
  # header comment); flip to a custom ACM cert once a domain exists, same
  # trigger as flipping var.enable_https back to true.
  # checkov:skip=CKV_AWS_68: No WAFv2 Web ACL attached to this
  # distribution yet. The ALB already has one (modules/alb's
  # aws_wafv2_web_acl.alb) covering /api/* once CloudFront forwards a
  # request to it; a second Web ACL in front of CloudFront itself is an
  # additional, billed-per-distribution cost this pilot's budget does not
  # currently cover (see CLAUDE.md's Sprint 4 free-tier cost note).
  # Tracked as a follow-up, not a gap introduced carelessly.
  # checkov:skip=CKV2_AWS_47: Depends on CKV_AWS_68 directly above — no
  # WAFv2 Web ACL is attached to this distribution at all yet, so there is
  # no Web ACL to configure an AMR rule group on. Same tracked follow-up.
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.project_name}-${var.environment}-frontend"

  origin {
    origin_id                = "s3-frontend"
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
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
      https_port               = 443
      origin_protocol_policy   = var.enable_https ? "https-only" : "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-frontend"
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
  }

  # /api/* — CachingDisabled + AllViewer forwards cookies/headers/query
  # strings to the ALB unmodified; this path is never cached, matching how
  # the backend already works (session cookie, per-request auth state).
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "alb-backend"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
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
