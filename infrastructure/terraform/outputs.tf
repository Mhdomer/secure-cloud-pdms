output "vpc_id" {
  value = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "Public DNS name of the ALB — the only internet-facing endpoint."
  value       = module.alb.alb_dns_name
}

output "rds_endpoint" {
  description = "RDS endpoint (host:port). Credentials are never output — read them from SSM Parameter Store."
  value       = module.rds.db_endpoint
}

output "cloudtrail_bucket" {
  value = module.cloudtrail.trail_bucket_name
}

output "kms_key_arn" {
  value = module.kms.key_arn
}

output "ssm_db_credentials_path" {
  description = "SSM Parameter Store path prefix where the EC2 app role reads DB credentials."
  value       = local.ssm_db_prefix
}
