output "alb_arn" {
  value = aws_lb.main.arn
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

output "waf_web_acl_arn" {
  value = aws_wafv2_web_acl.alb.arn
}
