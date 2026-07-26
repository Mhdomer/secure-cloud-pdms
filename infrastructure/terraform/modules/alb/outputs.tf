output "alb_arn" {
  value = aws_lb.main.arn
}

output "alb_arn_suffix" {
  description = "Short-form ARN suffix (e.g. app/pdms-prod-alb/50dc6c495c0c9188) — required as the CloudWatch metric dimension for AWS/ApplicationELB metrics; the full ARN does not work as a dimension value."
  value       = aws_lb.main.arn_suffix
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "alb_zone_id" {
  value = aws_lb.main.zone_id
}

output "target_group_arn" {
  value = aws_lb_target_group.app.arn
}

output "target_group_arn_suffix" {
  description = "Short-form ARN suffix — required as the CloudWatch metric dimension alongside alb_arn_suffix for target-group-scoped AWS/ApplicationELB metrics."
  value       = aws_lb_target_group.app.arn_suffix
}

output "waf_web_acl_arn" {
  value = aws_wafv2_web_acl.alb.arn
}
