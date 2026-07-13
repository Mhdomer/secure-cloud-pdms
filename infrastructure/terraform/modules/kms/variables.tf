variable "project_name" {
  description = "Project name used for resource naming and tagging."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. prod, staging)."
  type        = string
}

variable "key_administrator_arns" {
  description = "IAM principal ARNs allowed to administer the CMK (key policy management). Must be explicit — never a wildcard."
  type        = list(string)
}

variable "key_user_arns" {
  description = "IAM principal ARNs (roles) allowed to use the CMK for encrypt/decrypt operations (RDS, EC2 role, CloudTrail, SSM)."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Common resource tags."
  type        = map(string)
  default     = {}
}
