variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "app_subnet_ids" {
  type = list(string)
}

variable "ec2_security_group_id" {
  type = string
}

variable "target_group_arn" {
  type = string
}

variable "instance_type" {
  description = "EC2 instance type — t3.small per Table 3.5 minimum server-side requirements."
  type        = string
  default     = "t3.small"
}

variable "ami_id" {
  description = "AMI ID for the application instances (Amazon Linux 2023, hardened). Supply explicitly — never resolve an unpinned 'latest' AMI in a HIPAA workload."
  type        = string
}

variable "kms_key_arn" {
  description = "KMS CMK ARN used to encrypt the EC2 root EBS volume."
  type        = string
}

variable "ssm_parameter_prefix" {
  description = "SSM Parameter Store path prefix the instance role is allowed to read (DB credentials), e.g. /pdms/prod/db"
  type        = string
}

variable "min_size" {
  type    = number
  default = 2
}

variable "max_size" {
  type    = number
  default = 4
}

variable "desired_capacity" {
  type    = number
  default = 2
}

variable "root_volume_size" {
  type    = number
  default = 20
}

variable "tags" {
  type    = map(string)
  default = {}
}
