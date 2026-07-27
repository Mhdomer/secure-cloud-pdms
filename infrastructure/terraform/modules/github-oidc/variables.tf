variable "project_name" {
  description = "Short project identifier used in resource naming/tagging."
  type        = string
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository allowed to assume the deploy role, as \"owner/repo\" (e.g. \"Mhdomer/secure-cloud-pdms\"). This is the sole scope of the OIDC trust condition — no other repository's Actions runs can ever assume this role."
  type        = string
}

variable "github_oidc_environment" {
  description = "GitHub Environment name (repo Settings > Environments) whose jobs are trusted. Must match the `environment:` key on deploy.yml's terraform-apply job exactly — GitHub emits the `repo:OWNER/REPO:environment:NAME` form of the OIDC `sub` claim only for jobs that declare that key, and this module trusts that exact string."
  type        = string
  default     = "production"
}

variable "kms_key_arn" {
  description = "ARN of the project's KMS CMK (modules/kms) — the deploy role is granted kms:* scoped to this single key ARN, not a wildcard."
  type        = string
}

variable "terraform_state_bucket" {
  description = "S3 bucket holding Terraform remote state. Must match backend.tf's `bucket` — Terraform cannot read its own backend block's values, so this is a second, manually-kept-in-sync copy of the same literal."
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

variable "tags" {
  type = map(string)
}
