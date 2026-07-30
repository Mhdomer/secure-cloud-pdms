output "repository_url" {
  description = "docker push/pull target, e.g. <account>.dkr.ecr.<region>.amazonaws.com/pdms-prod-backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "repository_arn" {
  value = aws_ecr_repository.backend.arn
}
