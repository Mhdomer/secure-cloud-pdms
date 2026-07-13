variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "log_retention_days" {
  description = "CloudTrail audit log retention — 90 days per CLAUDE.md / chapter-4 Section 4.3.8.6."
  type        = number
  default     = 90
}

variable "tags" {
  type    = map(string)
  default = {}
}
