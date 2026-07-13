########################################
# Security Groups — alb-sg, ec2-sg, rds-sg (Table 4.2)
# Each SG created with NO inline ingress/egress blocks; every rule is a
# separate aws_vpc_security_group_*_rule resource referencing SG IDs
# (never CIDRs) between tiers, so Terraform never attaches the AWS default
# "allow all egress" rule and every allow path is explicit and auditable.
########################################

resource "aws_security_group" "alb" {
  # checkov:skip=CKV2_AWS_5: attached to the ALB in modules/alb
  # (aws_lb.main.security_groups). Cross-module attachment via a passed-in
  # SG ID is not resolved by Checkov's single-run graph check, producing a
  # false "unattached" positive.
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "ALB security group — HTTPS/HTTP from internet, forwards to app tier only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  })
}

resource "aws_security_group" "ec2" {
  # checkov:skip=CKV2_AWS_5: attached to the EC2 launch template in
  # modules/ec2 (aws_launch_template.app.network_interfaces.security_groups).
  # Same cross-module graph-resolution limitation as aws_security_group.alb.
  name        = "${var.project_name}-${var.environment}-ec2-sg"
  description = "EC2 application-tier security group — accepts only from ALB, talks only to RDS and outbound HTTPS"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-ec2-sg"
  })
}

resource "aws_security_group" "rds" {
  # checkov:skip=CKV2_AWS_5: attached to the RDS instance in modules/rds
  # (aws_db_instance.main.vpc_security_group_ids). Same cross-module
  # graph-resolution limitation as aws_security_group.alb above.
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "RDS security group — accepts only from EC2 application tier, no outbound permitted"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  })
}

########################################
# alb-sg rules
########################################

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description        = "HTTPS from internet"
  cidr_ipv4          = "0.0.0.0/0"
  ip_protocol        = "tcp"
  from_port          = 443
  to_port             = 443
}

resource "aws_vpc_security_group_ingress_rule" "alb_http_redirect" {
  # checkov:skip=CKV_AWS_260: Intentional per design (Table 4.2) — port 80
  # exists solely so the ALB HTTP listener (modules/alb
  # aws_lb_listener.http_redirect) can issue a 301 redirect to HTTPS. No
  # target group is ever attached to the HTTP listener, so no plaintext
  # application traffic is ever forwarded.
  security_group_id = aws_security_group.alb.id
  description        = "HTTP from internet — listener rule redirects to 443, no plaintext app traffic accepted"
  cidr_ipv4          = "0.0.0.0/0"
  ip_protocol        = "tcp"
  from_port          = 80
  to_port             = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_to_ec2" {
  security_group_id           = aws_security_group.alb.id
  description                  = "Forward application traffic to EC2 app tier only"
  referenced_security_group_id = aws_security_group.ec2.id
  ip_protocol                  = "tcp"
  from_port                    = var.app_port
  to_port                      = var.app_port
}

########################################
# ec2-sg rules
########################################

resource "aws_vpc_security_group_ingress_rule" "ec2_from_alb" {
  security_group_id           = aws_security_group.ec2.id
  description                  = "Accept application traffic only from the ALB"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = var.app_port
  to_port                      = var.app_port
}

resource "aws_vpc_security_group_egress_rule" "ec2_to_rds" {
  security_group_id           = aws_security_group.ec2.id
  description                  = "Connect to PostgreSQL on RDS"
  referenced_security_group_id = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = var.db_port
  to_port                      = var.db_port
}

resource "aws_vpc_security_group_egress_rule" "ec2_https_outbound" {
  security_group_id = aws_security_group.ec2.id
  description        = "Outbound HTTPS via NAT Gateway — AWS API (SSM, CloudWatch) and package endpoints only"
  cidr_ipv4          = "0.0.0.0/0"
  ip_protocol        = "tcp"
  from_port          = 443
  to_port             = 443
}

########################################
# rds-sg rules — ingress from ec2-sg only, NO egress rules at all.
########################################

resource "aws_vpc_security_group_ingress_rule" "rds_from_ec2" {
  security_group_id           = aws_security_group.rds.id
  description                  = "Accept PostgreSQL connections only from the EC2 application tier"
  referenced_security_group_id = aws_security_group.ec2.id
  ip_protocol                  = "tcp"
  from_port                    = var.db_port
  to_port                      = var.db_port
}

# Intentionally no aws_vpc_security_group_egress_rule for rds-sg.
# Per design (Table 4.2): rds-sg Outbound = None. Because the SG is
# created here with no inline egress block and no separate egress rule
# resource, Terraform actively revokes the AWS-default "allow all egress"
# rule, leaving rds-sg with zero outbound rules.
