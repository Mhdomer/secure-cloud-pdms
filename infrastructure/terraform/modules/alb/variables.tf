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
  description = "ACM certificate ARN for the HTTPS listener. Must be issued/validated before apply — see docs/psm2 for ACM DNS validation steps."
  type        = string
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
