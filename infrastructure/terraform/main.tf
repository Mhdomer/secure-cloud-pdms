########################################
# Root module — Secure Cloud PDMS (Alamin Clinic)
# Three-tier AWS architecture: ALB (public) -> EC2 (private app) -> RDS (isolated db)
# Design reference: docs/report/chapter-4-requirement-design.md Section 4.3
########################################

locals {
  common_tags = {
    Project     = "secure-cloud-pdms"
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = "alamin-clinic-fyp"
  }

  ssm_db_prefix  = "/${var.project_name}/${var.environment}/db"
  ssm_app_prefix = "/${var.project_name}/${var.environment}/app"
}

########################################
# KMS — customer-managed key for RDS, EBS, SSM, S3, CloudTrail
########################################

module "kms" {
  source = "./modules/kms"

  project_name           = var.project_name
  environment            = var.environment
  key_administrator_arns = var.kms_key_administrator_arns
  tags                   = local.common_tags
}

########################################
# ECR — backend container image repository (Sprint 4 follow-up: rollout
# automation). See modules/ecr/main.tf.
########################################

module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
  kms_key_arn  = module.kms.key_arn
  tags         = local.common_tags
}

########################################
# VPC — 6 subnets across 2 AZs, NAT GW, route tables, NACLs, flow logs
########################################

module "vpc" {
  source = "./modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  availability_zones = var.availability_zones
  kms_key_arn        = module.kms.key_arn
  tags               = local.common_tags
}

########################################
# Security Groups — alb-sg, ec2-sg, rds-sg
########################################

module "security" {
  source = "./modules/security"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
  app_port     = var.app_port
  tags         = local.common_tags
}

########################################
# RDS — isolated db-subnet-a/b, KMS-encrypted, Multi-AZ, force SSL
########################################

module "rds" {
  source = "./modules/rds"

  project_name            = var.project_name
  environment             = var.environment
  db_subnet_ids           = module.vpc.db_subnet_ids
  rds_security_group_id   = module.security.rds_sg_id
  kms_key_arn             = module.kms.key_arn
  db_name                 = var.db_name
  db_username             = var.db_username
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  engine_version          = var.db_engine_version
  multi_az                = var.db_multi_az
  deletion_protection     = var.db_deletion_protection
  skip_final_snapshot     = var.db_skip_final_snapshot
  backup_retention_period = var.db_backup_retention_period
  ssm_parameter_prefix    = local.ssm_db_prefix
  tags                    = local.common_tags
}

########################################
# ALB — internet-facing, forwards to EC2 target group.
# HTTPS-only is the design (chapter-4); var.enable_https's project-level
# default below is the sole, documented exception to that.
########################################

module "alb" {
  source = "./modules/alb"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  alb_security_group_id = module.security.alb_sg_id
  app_port              = var.app_port
  certificate_arn       = var.acm_certificate_arn
  enable_https          = var.enable_https
  health_check_path     = var.health_check_path
  kms_key_arn           = module.kms.key_arn
  log_retention_days    = var.log_retention_days
  tags                  = local.common_tags
}

########################################
# Frontend — S3 + CloudFront (Sprint 4 follow-up: was documented in
# CLAUDE.md's tech stack but never built). Also the single HTTPS origin
# for /api/* — see modules/frontend/main.tf's header comment.
########################################

module "frontend" {
  source = "./modules/frontend"

  project_name           = var.project_name
  environment            = var.environment
  kms_key_arn            = module.kms.key_arn
  alb_origin_domain_name = module.alb.alb_dns_name
  enable_https           = var.enable_https
  tags                   = local.common_tags
}

########################################
# EC2 — private app-subnet only, ASG behind the ALB, SSM-only access
########################################

module "ec2" {
  source = "./modules/ec2"

  project_name             = var.project_name
  environment              = var.environment
  app_subnet_ids           = module.vpc.app_subnet_ids
  ec2_security_group_id    = module.security.ec2_sg_id
  target_group_arn         = module.alb.target_group_arn
  app_port                 = var.app_port
  ecr_repository_arn       = module.ecr.repository_arn
  ecr_repository_url       = module.ecr.repository_url
  ssm_app_parameter_prefix = local.ssm_app_prefix
  cloudfront_domain_name   = module.frontend.distribution_domain_name
  instance_type            = var.ec2_instance_type
  ami_id                   = var.ec2_ami_id
  kms_key_arn              = module.kms.key_arn
  ssm_parameter_prefix     = local.ssm_db_prefix
  min_size                 = var.ec2_min_size
  max_size                 = var.ec2_max_size
  desired_capacity         = var.ec2_desired_capacity
  tags                     = local.common_tags
}

########################################
# CloudTrail — all API calls logged, 90-day retention
########################################

module "cloudtrail" {
  source = "./modules/cloudtrail"

  project_name       = var.project_name
  environment        = var.environment
  kms_key_arn        = module.kms.key_arn
  log_retention_days = var.log_retention_days
  tags               = local.common_tags
}

########################################
# Monitoring — application log group, failed-login/5xx-rate/RDS-CPU alarms,
# and the security dashboard. Notifies the CloudTrail module's SNS topic.
########################################

module "monitoring" {
  source = "./modules/monitoring"

  project_name              = var.project_name
  environment               = var.environment
  kms_key_arn               = module.kms.key_arn
  log_retention_days        = var.log_retention_days
  alarm_sns_topic_arn       = module.cloudtrail.sns_topic_arn
  alb_arn_suffix            = module.alb.alb_arn_suffix
  target_group_arn_suffix   = module.alb.target_group_arn_suffix
  rds_instance_id           = module.rds.db_instance_id
  cloudtrail_log_group_name = module.cloudtrail.cloudwatch_log_group_name
  tags                      = local.common_tags
}

########################################
# GitHub OIDC — federated deploy role for .github/workflows/deploy.yml.
# See modules/github-oidc/main.tf's header comment for the manual bootstrap
# step this module requires before CI can use it.
########################################

module "github_oidc" {
  source = "./modules/github-oidc"

  project_name            = var.project_name
  environment             = var.environment
  github_repository       = var.github_repository
  github_oidc_environment = var.github_oidc_environment
  kms_key_arn             = module.kms.key_arn
  terraform_state_bucket  = var.terraform_state_bucket
  terraform_state_key     = var.terraform_state_key
  terraform_lock_table    = var.terraform_lock_table
  tags                    = local.common_tags

  ecr_repository_arn          = module.ecr.repository_arn
  ssm_app_parameter_prefix    = local.ssm_app_prefix
  cloudfront_distribution_arn = module.frontend.distribution_arn
}
