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
  description = "Application log retention — 90 days per CLAUDE.md / chapter-4 Section 4.3.8.6."
  type        = number
  default     = 90
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic alarms publish to — reuses modules/cloudtrail's aws_sns_topic.trail rather than provisioning a second topic."
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB short-form ARN suffix (modules/alb output alb_arn_suffix) — CloudWatch metric dimension value."
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Target group short-form ARN suffix (modules/alb output target_group_arn_suffix) — CloudWatch metric dimension value."
  type        = string
}

variable "rds_instance_id" {
  description = "RDS DB instance identifier (modules/rds output db_instance_id) — CloudWatch metric dimension value."
  type        = string
}

variable "cloudtrail_log_group_name" {
  description = "CloudTrail's CloudWatch Logs group name (modules/cloudtrail output cloudwatch_log_group_name) — used by the dashboard's API-call-volume widget."
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
