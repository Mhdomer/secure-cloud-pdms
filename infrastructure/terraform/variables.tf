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
  description = "ACM certificate ARN for the ALB HTTPS listener. Must already be issued and validated (DNS validation against the clinic's domain) before apply. Only required when enable_https = true; safe to leave as the default empty string otherwise."
  type        = string
  default     = ""
}

# TEMPORARY PROJECT-LEVEL OVERRIDE — chapter-4's design (and CLAUDE.md's
# "Key Design Decisions" list) specifies HTTPS-only. This default is
# deliberately false, not true, because no domain is registered yet: ACM
# certificates require DNS validation against a domain the project doesn't
# own, and registering one is being held off pending either presentation
# funding or the stakeholder's go/no-go decision on continuing the system
# (see docs/psm2/sprints/sprint-4-summary.md for the dated note). Flip this
# to true, and set acm_certificate_arn to a real issued certificate, once a
# domain exists — never leave this false for a deployment holding real
# patient data. The alb module's own default (modules/alb/variables.tf) is
# still `true`, i.e. secure-by-default; this root override is the one place
# that knowingly opts out, so the exception stays visible and easy to revert.
variable "enable_https" {
  type    = bool
  default = false
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

########################################
# GitHub OIDC (Sprint 4 deploy pipeline)
########################################

variable "github_repository" {
  description = "GitHub repository allowed to assume the CI/CD deploy role, as \"owner/repo\". Sole scope of the OIDC trust condition in modules/github-oidc."
  type        = string
  default     = "Mhdomer/secure-cloud-pdms"
}

variable "github_oidc_environment" {
  description = "GitHub Environment name that must be declared on the calling workflow job (deploy.yml's terraform-apply job) for its OIDC token to be trusted."
  type        = string
  default     = "production"
}

variable "terraform_state_bucket" {
  description = "S3 bucket holding Terraform remote state. Must match backend.tf's `bucket`."
  type        = string
  default     = "pdms-terraform-state-730077843716"
}

variable "terraform_state_key" {
  description = "S3 object key for the state file. Must match backend.tf's `key`."
  type        = string
  default     = "prod/terraform.tfstate"
}

variable "terraform_lock_table" {
  description = "DynamoDB table used for state locking. Must match backend.tf's `dynamodb_table`."
  type        = string
  default     = "pdms-terraform-locks"
}
