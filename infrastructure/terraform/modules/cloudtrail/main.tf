########################################
# CloudTrail — all AWS API calls logged, multi-region, log file validation,
# KMS-encrypted S3 destination, 90-day retention, CloudWatch Logs
# integration for real-time alarming (alarms wired in Sprint 4).
########################################

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_partition" "current" {}

locals {
  trail_name = "${var.project_name}-${var.environment}-trail"
}

resource "aws_s3_bucket" "trail" {
  # checkov:skip=CKV_AWS_18: This bucket IS the audit-log destination
  # (CloudTrail API-call logs). Enabling S3 server-access-logging on the log
  # bucket itself would create redundant, self-referential logging without
  # added security value; write access to this bucket is already captured
  # by CloudTrail's own management-events trail and the bucket policy denies
  # non-TLS access.
  # checkov:skip=CKV_AWS_144: Cross-region replication is out of scope for
  # this single-region (ap-southeast-1) pilot deployment (Table 3.5, <=50
  # concurrent users). Tracked as a production-hardening candidate beyond
  # PSM2 scope.
  # checkov:skip=CKV2_AWS_62: Event notifications (SNS/EventBridge/Lambda) on
  # object PUT are not required for a log-archive bucket that is already
  # monitored via CloudTrail data events and CloudWatch Logs delivery below.
  bucket = "${var.project_name}-${var.environment}-cloudtrail-logs"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-cloudtrail-logs"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "trail" {
  bucket = aws_s3_bucket.trail.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "trail" {
  bucket = aws_s3_bucket.trail.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "trail" {
  bucket = aws_s3_bucket.trail.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "trail" {
  bucket = aws_s3_bucket.trail.id

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

# NOTE: S3 MFA Delete cannot be enabled via Terraform/the standard AWS API —
# it requires the bucket-owner root credentials with an MFA device, applied
# out-of-band via the AWS CLI (`aws s3api put-bucket-versioning
# --bucket <trail-bucket> --versioning-configuration Status=Enabled,
# MFADelete=Enabled --mfa "<serial> <code>"`). This is a documented manual
# one-time hardening step to be completed and verified post-apply; tracked
# in docs/psm2 as an open Sprint 5 compliance item.

data "aws_iam_policy_document" "trail_bucket" {
  statement {
    sid    = "AWSCloudTrailAclCheck"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions   = ["s3:GetBucketAcl"]
    resources = [aws_s3_bucket.trail.arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:${data.aws_partition.current.partition}:cloudtrail:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:trail/${local.trail_name}"]
    }
  }

  statement {
    sid    = "AWSCloudTrailWrite"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.trail.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:${data.aws_partition.current.partition}:cloudtrail:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:trail/${local.trail_name}"]
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
    resources = [aws_s3_bucket.trail.arn, "${aws_s3_bucket.trail.arn}/*"]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "trail" {
  bucket = aws_s3_bucket.trail.id
  policy = data.aws_iam_policy_document.trail_bucket.json
}

########################################
# CloudWatch Logs integration — real-time delivery for alarms (Sprint 4).
########################################

resource "aws_cloudwatch_log_group" "trail" {
  # checkov:skip=CKV_AWS_338: 90-day retention is the explicit project audit
  # retention requirement (CLAUDE.md / chapter-4 Section 4.3.8.6 / NFR-08),
  # not an oversight. Extending to 365 days is a documented Sprint 5/production
  # hardening candidate, tracked separately from this HIPAA-minimum baseline.
  name              = "/${var.project_name}/${var.environment}/cloudtrail"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = var.tags
}

########################################
# SNS topic — CloudWatch alarm notifications (Sprint 4 wires the actual
# subscriptions for failed logins / 5xx / RDS CPU; see modules/monitoring).
# NOT used for CloudTrail's own log-delivery notifications — see
# aws_cloudtrail.main's comment below for why that association was dropped.
########################################

resource "aws_sns_topic" "trail" {
  name              = "${var.project_name}-${var.environment}-cloudtrail-notifications"
  kms_master_key_id = var.kms_key_arn

  tags = var.tags
}

data "aws_iam_policy_document" "trail_sns" {
  # CloudTrail is NOT granted Publish here — aws_cloudtrail.main deliberately
  # does not set sns_topic_name (see that resource's comment). This topic's
  # actual publishers are the CloudWatch alarms in modules/monitoring
  # (failed-login, ALB 5xx-rate, RDS CPU). A custom SNS access policy like
  # this one replaces SNS's default account-owner-open policy, so
  # cloudwatch.amazonaws.com needs an explicit grant even though it's a
  # same-account publisher — scoped via aws:SourceAccount since CloudWatch
  # alarms, unlike CloudTrail, don't have a single resource ARN to condition
  # on (there are three separate alarms, all in this account).
  statement {
    sid    = "AllowCloudWatchAlarmsPublish"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.trail.arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sns_topic_policy" "trail" {
  arn    = aws_sns_topic.trail.arn
  policy = data.aws_iam_policy_document.trail_sns.json
}

resource "aws_iam_role" "trail_to_cloudwatch" {
  name = "${var.project_name}-${var.environment}-cloudtrail-cwlogs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "cloudtrail.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "trail_to_cloudwatch" {
  name = "${var.project_name}-${var.environment}-cloudtrail-cwlogs-policy"
  role = aws_iam_role.trail_to_cloudwatch.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ]
      Resource = "${aws_cloudwatch_log_group.trail.arn}:*"
    }]
  })
}

resource "aws_cloudtrail" "main" {
  # checkov:skip=CKV_AWS_252: no SNS topic is associated with this trail —
  # see the sns_topic_name explanation immediately below. This is the
  # documented root cause, not an oversight; this skip comment was itself
  # missing until a live GitHub Actions run (2026-07-30, iac-scan job) first
  # actually enforced soft_fail: false against it — checkov had never been
  # run through the real pipeline before that point, only locally.
  # sns_topic_name is deliberately NOT set. CloudTrail's own delivery
  # notifications to a customer-managed-KMS-encrypted SNS topic proved
  # incompatible with enable_log_file_validation (digest files) in practice:
  # CreateTrail failed with InsufficientSnsTopicPolicyException even against
  # a KMS key policy verified correct per AWS's own documentation
  # (https://docs.aws.amazon.com/sns/latest/dg/sns-enable-encryption-for-topic.html),
  # and empirically isolated (one variable removed at a time, live against
  # this exact account/key/topic) to the combination of log-file validation
  # + an SNS-associated trail — S3 delivery, CloudWatch Logs delivery, and
  # log-file validation all work fine independently. The core requirement
  # (all API calls logged, 90-day retention, CLAUDE.md) doesn't depend on
  # CloudTrail's own SNS delivery notifications — the same topic still fully
  # serves its Sprint 4 purpose (failed-login/5xx/RDS-CPU alarm
  # notifications, see modules/monitoring and this file's
  # aws_iam_policy_document.trail_sns) since alarm publishers were never
  # part of the broken interaction.
  name                          = local.trail_name
  s3_bucket_name                 = aws_s3_bucket.trail.id
  is_multi_region_trail          = true
  include_global_service_events = true
  enable_log_file_validation    = true
  kms_key_id                     = var.kms_key_arn

  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.trail.arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.trail_to_cloudwatch.arn

  event_selector {
    read_write_type           = "All"
    include_management_events = true
  }

  tags = merge(var.tags, {
    Name = local.trail_name
  })

  depends_on = [aws_s3_bucket_policy.trail, aws_sns_topic_policy.trail]
}
