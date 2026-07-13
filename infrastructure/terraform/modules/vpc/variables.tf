variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Two Availability Zones the subnets are spread across."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "app_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.3.0/24", "10.0.4.0/24"]
}

variable "db_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.5.0/24", "10.0.6.0/24"]
}

variable "flow_log_retention_days" {
  description = "CloudWatch Logs retention for VPC Flow Logs, aligned with 90-day audit retention policy."
  type        = number
  default     = 90
}

variable "kms_key_arn" {
  description = "KMS CMK ARN used to encrypt the VPC Flow Logs CloudWatch Log Group."
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
