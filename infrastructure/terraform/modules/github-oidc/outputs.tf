output "deploy_role_arn" {
  description = "ARN to supply as the AWS_DEPLOY_ROLE_ARN GitHub Actions secret (deploy.yml's OIDC role-to-assume)."
  value       = aws_iam_role.deploy.arn
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}
