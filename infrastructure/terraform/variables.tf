variable "project_name" {
  description = "Short project identifier used in resource naming/tagging."
  type        = string
  default     = "pdms"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "Primary AWS region — ap-southeast-1 (Singapore) per infrastructure/README.md."
  type        = string
  default     = "ap-southeast-1"
}

variable "availability_zones" {
  description = "Two Availability Zones the six subnets are spread across."
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b"]
}

########################################
# KMS
########################################

variable "kms_key_administrator_arns" {
  description = "IAM principal ARNs (humans/CI role) allowed to administer the project CMK. Supply via a git-ignored *.tfvars file or CI secret — never commit real ARNs of production principals if they are considered sensitive by policy."
  type        = list(string)
}

########################################
# RDS
########################################

variable "db_name" {
  type    = string
  default = "pdms"
}

variable "db_username" {
  description = "RDS master username. Overridable via tfvars/CI — never the password, which is generated at apply time."
  type        = string
  default     = "pdms_admin"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_engine_version" {
  type    = string
  default = "16.4"
}

variable "db_multi_az" {
  type    = bool
  default = true
}

variable "db_deletion_protection" {
  description = "Set to false only for a disposable RTO-drill environment; must be true for any environment holding real PHI."
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  type    = bool
  default = false
}

########################################
# ALB
########################################

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the ALB HTTPS listener. Must already be issued and validated (DNS validation against the clinic's domain) before apply."
  type        = string
}

variable "app_port" {
  type    = number
  default = 5000
}

variable "health_check_path" {
  type    = string
  default = "/api/health"
}

########################################
# EC2
########################################

variable "ec2_ami_id" {
  description = "AMI ID for application instances (Amazon Linux 2023, x86_64/arm64, latest security patches applied). Pin explicitly — do not resolve an unpinned 'latest' AMI for a HIPAA workload."
  type        = string
}

variable "ec2_instance_type" {
  type    = string
  default = "t3.small"
}

variable "ec2_min_size" {
  type    = number
  default = 2
}

variable "ec2_max_size" {
  type    = number
  default = 4
}

variable "ec2_desired_capacity" {
  type    = number
  default = 2
}

########################################
# CloudTrail / logging
########################################

variable "log_retention_days" {
  description = "Audit log retention — 90 days per CLAUDE.md / chapter-4 Section 4.3.8.6."
  type        = number
  default     = 90
}
