output "bucket_name" {
  value = aws_s3_bucket.frontend.id
}

output "distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.frontend.arn
}

output "distribution_domain_name" {
  description = "The *.cloudfront.net domain — already HTTPS with no custom cert needed. The backend's CLOUDFRONT_ORIGIN/FRONTEND_URL env vars (see modules/ec2) are derived from this."
  value       = aws_cloudfront_distribution.frontend.domain_name
}
