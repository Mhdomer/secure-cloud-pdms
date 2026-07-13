output "trail_arn" {
  value = aws_cloudtrail.main.arn
}

output "trail_bucket_name" {
  value = aws_s3_bucket.trail.id
}

output "cloudwatch_log_group_name" {
  value = aws_cloudwatch_log_group.trail.name
}

output "sns_topic_arn" {
  description = "SNS topic for CloudTrail delivery notifications — Sprint 4 subscribes CloudWatch alarms to this topic."
  value       = aws_sns_topic.trail.arn
}
