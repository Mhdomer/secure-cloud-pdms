output "iam_role_arn" {
  value = aws_iam_role.ec2.arn
}

output "iam_role_name" {
  value = aws_iam_role.ec2.name
}

output "autoscaling_group_name" {
  value = aws_autoscaling_group.app.name
}

output "launch_template_id" {
  value = aws_launch_template.app.id
}
