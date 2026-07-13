variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "db_subnet_ids" {
  description = "The two isolated db-subnet IDs (db-subnet-a, db-subnet-b)."
  type        = list(string)
}

variable "rds_security_group_id" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "db_name" {
  type    = string
  default = "pdms"
}

variable "db_username" {
  description = "Master username for RDS PostgreSQL. Never hardcode — supplied via CI/CD secret or a git-ignored tfvars file."
  type        = string
  default     = "pdms_admin"
}

variable "instance_class" {
  description = "RDS instance class — db.t3.micro per Table 3.5 minimum server-side requirements."
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "engine_version" {
  description = "PostgreSQL major.minor engine version."
  type        = string
  default     = "16.4"
}

variable "multi_az" {
  description = "Deploy RDS primary + standby across db-subnet-a/b (Figure 4.2)."
  type        = bool
  default     = true
}

variable "backup_retention_period" {
  description = "Automated backup retention in days."
  type        = number
  default     = 7
}

variable "backup_window" {
  type    = string
  default = "17:00-18:00" # 01:00-02:00 MYT (UTC+8)
}

variable "maintenance_window" {
  type    = string
  default = "sun:18:00-sun:19:00"
}

variable "deletion_protection" {
  description = "Prevent accidental deletion via the AWS API/console. Terraform can still destroy with deletion_protection first disabled — RTO drill procedure documents this."
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Should be false in any environment holding real PHI. May be true only for ephemeral RTO-drill/test environments."
  type        = bool
  default     = false
}

variable "monitoring_interval" {
  description = "Enhanced monitoring granularity in seconds (0 disables)."
  type        = number
  default     = 60
}

variable "ssm_parameter_prefix" {
  description = "SSM Parameter Store path prefix under which DB credentials are stored, e.g. /pdms/prod/db"
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
