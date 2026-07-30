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

output "ecr_repository_url" {
  description = "Push backend images here: docker push <this>:<tag>"
  value       = module.ecr.repository_url
}

output "ecr_repository_arn" {
  value = module.ecr.repository_arn
}

output "cloudfront_distribution_id" {
  description = "For cache invalidation: aws cloudfront create-invalidation --distribution-id <this>"
  value       = module.frontend.distribution_id
}

output "cloudfront_distribution_arn" {
  value = module.frontend.distribution_arn
}

output "cloudfront_domain_name" {
  description = "The live HTTPS URL for the whole application (frontend + /api/* proxy to the ALB)."
  value       = module.frontend.distribution_domain_name
}

output "frontend_bucket_name" {
  value = module.frontend.bucket_name
}
