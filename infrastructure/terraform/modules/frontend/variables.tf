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
