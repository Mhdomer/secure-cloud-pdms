variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "kms_key_arn" {
  description = "KMS CMK ARN used to encrypt image layers at rest."
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
