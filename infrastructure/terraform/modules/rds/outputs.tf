output "db_instance_id" {
  value = aws_db_instance.main.id
}

output "db_endpoint" {
  description = "RDS connection endpoint (host:port) — not a secret by itself, but never combine with credentials in one output."
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  value = aws_db_instance.main.address
}

output "ssm_parameter_prefix" {
  value = var.ssm_parameter_prefix
}

output "db_subnet_group_name" {
  value = aws_db_subnet_group.main.name
}
