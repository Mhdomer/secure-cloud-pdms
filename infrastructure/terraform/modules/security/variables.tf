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

variable "tags" {
  type    = map(string)
  default = {}
}
