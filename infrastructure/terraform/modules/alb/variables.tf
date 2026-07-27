variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "app_port" {
  type    = number
  default = 5000
}

variable "certificate_arn" {
  description = "ACM certificate ARN for the HTTPS listener. Required (must be issued/validated before apply — see docs/psm2 for ACM DNS validation steps) only when enable_https = true; ignored otherwise."
  type        = string
  default     = ""
}

variable "enable_https" {
  description = "Whether to provision the HTTPS listener (443, ACM cert) with an HTTP->HTTPS redirect. When false, provisions a direct HTTP (port 80) forward instead, with no ACM cert required. This is a deliberate, temporary exception path for environments without a domain/cert yet — never the intended state once real patient data is involved. See infrastructure/terraform/variables.tf's project-level enable_https default for why this project currently overrides it."
  type        = bool
  default     = true
}

variable "health_check_path" {
  type    = string
  default = "/api/health"
}

variable "kms_key_arn" {
  description = "KMS CMK ARN used to encrypt the WAF CloudWatch Logs group. NOT used for the ALB access-log S3 bucket — ELB log delivery only supports SSE-S3 (AES256), see the checkov:skip justification on aws_s3_bucket.alb_logs in main.tf."
  type        = string
}

variable "log_retention_days" {
  type    = number
  default = 90
}

variable "tags" {
  type    = map(string)
  default = {}
}
