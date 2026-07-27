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

output "monitoring_dashboard_name" {
  description = "CloudWatch dashboard name — failed logins, ALB 5xx rate, RDS CPU, CloudTrail volume."
  value       = module.monitoring.dashboard_name
}

output "github_deploy_role_arn" {
  description = "ARN to store as the AWS_DEPLOY_ROLE_ARN GitHub Actions secret (see .github/workflows/deploy.yml)."
  value       = module.github_oidc.deploy_role_arn
}
