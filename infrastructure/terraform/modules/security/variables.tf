variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "app_port" {
  description = "Port the Node.js/Express application listens on."
  type        = number
  default     = 5000
}

variable "db_port" {
  description = "PostgreSQL port."
  type        = number
  default     = 5432
}

variable "enable_https" {
  description = "Mirrors the project-level enable_https override (infrastructure/terraform/variables.tf) — gates the alb-sg :443 ingress rule, since modules/alb's aws_lb_listener.https only exists when this is true and nothing listens on 443 otherwise. This module only consumes the decision, it never sets its own independent default."
  type        = bool
}

variable "tags" {
  type    = map(string)
  default = {}
}
