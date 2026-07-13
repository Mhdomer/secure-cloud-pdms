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

  # AWS services that need to encrypt on our behalf (RDS, SSM, S3, CloudTrail, CloudWatch Logs).
  statement {
    sid    = "AllowServiceUsage"
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = [
        "rds.amazonaws.com",
        "ssm.amazonaws.com",
        "s3.amazonaws.com",
        "cloudtrail.amazonaws.com",
        "logs.${data.aws_region.current.name}.amazonaws.com",
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
