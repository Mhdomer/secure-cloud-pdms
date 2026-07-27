########################################
# Application Load Balancer — the only internet-facing entry point.
# HTTPS only (TLS 1.2+) is the default and intended design (CLAUDE.md /
# chapter-4): the HTTP listener exists solely to 301-redirect to HTTPS.
# var.enable_https = false is a deliberate, temporary override (no domain/
# ACM cert provisioned yet) that instead forwards HTTP directly — see that
# variable's description and infrastructure/terraform/variables.tf's
# project-level default for the justification. Access logs delivered to a
# dedicated, encrypted, private S3 bucket regardless of which path is active.
########################################

data "aws_elb_service_account" "main" {}

resource "aws_s3_bucket" "alb_logs" {
  # checkov:skip=CKV_AWS_145: ALB access log delivery requires SSE-S3; the ELB
  # log delivery service cannot write to an SSE-KMS S3 bucket. AWS service
  # limitation, not an oversight — see AWS ELB access logging documentation.
  # checkov:skip=CKV_AWS_18: This bucket IS the ALB access-log destination.
  # Enabling S3 server-access-logging on the log bucket itself would create
  # redundant, self-referential logging without added security value.
  # checkov:skip=CKV_AWS_144: Cross-region replication is out of scope for
  # this single-region (ap-southeast-1) pilot deployment (Table 3.5, <=50
  # concurrent users). Tracked as a production-hardening candidate beyond
  # PSM2 scope.
  # checkov:skip=CKV2_AWS_62: Event notifications are not required for a
  # log-archive bucket already monitored via CloudTrail data events.
  bucket = "${var.project_name}-${var.environment}-alb-access-logs"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-alb-access-logs"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "expire-after-retention"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    expiration {
      days = var.log_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.log_retention_days
    }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = data.aws_iam_policy_document.alb_logs.json
}

data "aws_iam_policy_document" "alb_logs" {
  statement {
    sid    = "AllowELBLogDelivery"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [data.aws_elb_service_account.main.arn]
    }
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.alb_logs.arn}/alb/*"]
  }

  statement {
    sid    = "AllowELBLogDeliveryLogsService"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["delivery.logs.amazonaws.com"]
    }
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.alb_logs.arn}/alb/*"]
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
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
    resources = [aws_s3_bucket.alb_logs.arn, "${aws_s3_bucket.alb_logs.arn}/*"]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_lb" "main" {
  # checkov:skip=CKV2_AWS_76: This ALB is associated with aws_wafv2_web_acl.alb
  # (see aws_wafv2_web_acl_association.alb below), which includes the
  # "aws-managed-known-bad-inputs" rule (AWSManagedRulesKnownBadInputsRuleSet).
  # AWS has shipped Log4Shell (CVE-2021-44228) detection as part of that rule
  # group since December 2021 — there is no separate AWS-managed "Log4j" rule
  # group to attach independently.
  # checkov:skip=CKV2_AWS_20: Only fails while var.enable_https = false — a
  # deliberate, temporary exception (no domain/ACM cert registered yet; see
  # that variable's description in modules/alb/variables.tf and the
  # project-level override in infrastructure/terraform/variables.tf). When
  # enable_https = true (the intended state), aws_lb_listener.http_redirect
  # exists and this check passes normally.
  name                       = "${var.project_name}-${var.environment}-alb"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [var.alb_security_group_id]
  subnets                    = var.public_subnet_ids
  drop_invalid_header_fields = true
  enable_deletion_protection = true

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-alb"
  })

  depends_on = [aws_s3_bucket_policy.alb_logs]
}

resource "aws_lb_target_group" "app" {
  # checkov:skip=CKV_AWS_378: This target group's HTTP protocol is normal
  # ALB architecture regardless of enable_https (TLS terminates at the ALB;
  # the ALB-to-backend hop inside the VPC is plain HTTP in both modes — see
  # aws_lb_listener.https above, which forwards to this same target group
  # over HTTPS on the client-facing side). This check only fires while
  # var.enable_https = false, because aws_lb_listener.http_forward then
  # connects a client-facing HTTP listener directly to this group — the
  # actual, documented exception (see that resource's checkov:skip comment
  # below), not an issue with this target group's own configuration.
  name        = "${var.project_name}-${var.environment}-app-tg"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "instance"

  health_check {
    path                = var.health_check_path
    protocol            = "HTTP"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = var.tags
}

resource "aws_lb_listener" "https" {
  count = var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port                = 443
  protocol            = "HTTPS"
  ssl_policy          = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn     = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  lifecycle {
    precondition {
      condition     = var.certificate_arn != ""
      error_message = "certificate_arn must be a real, issued ACM certificate ARN when enable_https = true."
    }
  }
}

resource "aws_lb_listener" "http_redirect" {
  count = var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port                = 80
  protocol            = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "http_forward" {
  # checkov:skip=CKV_AWS_2: Deliberate, temporary exception, not an oversight
  # — see var.enable_https's description (modules/alb/variables.tf) and the
  # project-level override + justification in
  # infrastructure/terraform/variables.tf. No domain/ACM certificate is
  # provisioned yet (budget + pending stakeholder go/no-go decision, per
  # docs/psm2/sprints/sprint-4-summary.md); this listener only exists while
  # enable_https = false and must not be the state this system is in once it
  # holds real patient data.
  # checkov:skip=CKV_AWS_103: same root cause as CKV_AWS_2 — this listener
  # has no TLS at all (plain HTTP), by design, only while enable_https =
  # false. Re-enabling HTTPS is a single variable flip: this listener
  # (count = 0 when enable_https = true) is replaced by aws_lb_listener.https,
  # which already enforces TLS 1.2+ via
  # ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06".
  count = var.enable_https ? 0 : 1

  load_balancer_arn = aws_lb.main.arn
  port               = 80
  protocol           = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

########################################
# AWS WAFv2 — internet-facing ALB protected by managed rule groups
# (common exploits, known bad inputs, SQL injection) before traffic ever
# reaches the application tier.
########################################

resource "aws_wafv2_web_acl" "alb" {
  # Log4Shell (CVE-2021-44228) protection is included in the
  # "aws-managed-known-bad-inputs" rule below (AWSManagedRulesKnownBadInputsRuleSet).
  # See the CKV2_AWS_76 checkov:skip on aws_lb.main below — that is the
  # resource Checkov's Log4j check actually targets.
  name        = "${var.project_name}-${var.environment}-alb-waf"
  description = "WAF for the internet-facing ALB — blocks common web exploits and SQL injection before traffic reaches the app tier"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "aws-managed-common-rule-set"
    priority = 0

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-common-rule-set"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-managed-known-bad-inputs"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-managed-sqli"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-sqli"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit-per-ip"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-${var.environment}-alb-waf"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.alb.arn
}

# WAF logging destination — CloudWatch Logs group name MUST start with the
# AWS-required "aws-waf-logs-" prefix.
resource "aws_cloudwatch_log_group" "waf" {
  # checkov:skip=CKV_AWS_338: 90-day retention is the explicit project audit
  # retention requirement (CLAUDE.md / chapter-4 Section 4.3.8.6 / NFR-08).
  name              = "aws-waf-logs-${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = var.tags
}

resource "aws_wafv2_web_acl_logging_configuration" "alb" {
  resource_arn            = aws_wafv2_web_acl.alb.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
}
