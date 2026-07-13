output "key_id" {
  description = "KMS CMK key ID."
  value       = aws_kms_key.cmk.key_id
}

output "key_arn" {
  description = "KMS CMK key ARN."
  value       = aws_kms_key.cmk.arn
}

output "alias_name" {
  description = "KMS CMK alias name."
  value       = aws_kms_alias.cmk.name
}
