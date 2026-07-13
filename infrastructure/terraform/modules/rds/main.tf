########################################
# RDS PostgreSQL — isolated db-subnet-a/b, KMS-encrypted, Multi-AZ,
# never publicly accessible, forced SSL, automated backups.
# Credentials generated at apply time and stored only in SSM Parameter
# Store (SecureString, CMK-encrypted) — never in a literal, output, or
# .tfvars value.
########################################

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = var.db_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  })
}

resource "aws_db_parameter_group" "main" {
  name   = "${var.project_name}-${var.environment}-pg16"
  family = "postgres16"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "immediate"
  }

  tags = var.tags
}

resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%^&*()-_=+[]{}<>:?"
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-${var.environment}-rds"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  db_name  = var.db_name
  username = var.db_username
  password = random_password.master.result

  allocated_storage     = var.allocated_storage
  storage_type           = "gp3"
  storage_encrypted      = true
  kms_key_id              = var.kms_key_arn

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_security_group_id]
  parameter_group_name   = aws_db_parameter_group.main.name

  publicly_accessible = false
  multi_az             = var.multi_az

  backup_retention_period = var.backup_retention_period
  backup_window            = var.backup_window
  maintenance_window       = var.maintenance_window
  copy_tags_to_snapshot    = true

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project_name}-${var.environment}-rds-final-snapshot"

  auto_minor_version_upgrade = true

  monitoring_interval = var.monitoring_interval
  monitoring_role_arn  = var.monitoring_interval > 0 ? aws_iam_role.rds_enhanced_monitoring[0].arn : null

  performance_insights_enabled    = true
  performance_insights_kms_key_id = var.kms_key_arn

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(var.tags, {
    Name             = "${var.project_name}-${var.environment}-rds"
    DataClassification = "PHI"
  })

  lifecycle {
    ignore_changes = [password]
  }

  # checkov:skip=CKV_AWS_161: IAM database authentication is intentionally
  # not used. Per chapter-4 Section 4.3.5, the EC2 instance role has no
  # RDS-related IAM permissions by design — DB access is enforced at the
  # network layer (rds-sg, accepting only ec2-sg) and the application layer
  # via a connection string sourced from SSM Parameter Store, not IAM auth.
}

resource "aws_iam_role" "rds_enhanced_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0
  name  = "${var.project_name}-${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "monitoring.rds.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  count      = var.monitoring_interval > 0 ? 1 : 0
  role       = aws_iam_role.rds_enhanced_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

########################################
# Credentials in SSM Parameter Store — SecureString, CMK-encrypted.
# EC2 instance role is granted ssm:GetParameter scoped to this exact path
# (see modules/ec2), never broader.
########################################

resource "aws_ssm_parameter" "db_host" {
  name   = "${var.ssm_parameter_prefix}/host"
  type   = "SecureString"
  key_id = var.kms_key_arn
  value  = aws_db_instance.main.address
  tags   = var.tags
}

resource "aws_ssm_parameter" "db_port" {
  name   = "${var.ssm_parameter_prefix}/port"
  type   = "SecureString"
  key_id = var.kms_key_arn
  value  = tostring(aws_db_instance.main.port)
  tags   = var.tags
}

resource "aws_ssm_parameter" "db_name" {
  name   = "${var.ssm_parameter_prefix}/dbname"
  type   = "SecureString"
  key_id = var.kms_key_arn
  value  = var.db_name
  tags   = var.tags
}

resource "aws_ssm_parameter" "db_username" {
  name   = "${var.ssm_parameter_prefix}/username"
  type   = "SecureString"
  key_id = var.kms_key_arn
  value  = var.db_username
  tags   = var.tags
}

resource "aws_ssm_parameter" "db_password" {
  name   = "${var.ssm_parameter_prefix}/password"
  type   = "SecureString"
  key_id = var.kms_key_arn
  value  = random_password.master.result
  tags   = var.tags

  lifecycle {
    ignore_changes = [value]
  }
}
