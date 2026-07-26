output "app_log_group_name" {
  value = aws_cloudwatch_log_group.app.name
}

output "app_log_group_arn" {
  value = aws_cloudwatch_log_group.app.arn
}

output "dashboard_name" {
  value = aws_cloudwatch_dashboard.main.dashboard_name
}

output "failed_logins_alarm_arn" {
  value = aws_cloudwatch_metric_alarm.failed_logins.arn
}

output "alb_5xx_rate_alarm_arn" {
  value = aws_cloudwatch_metric_alarm.alb_5xx_rate.arn
}

output "rds_cpu_alarm_arn" {
  value = aws_cloudwatch_metric_alarm.rds_cpu.arn
}
