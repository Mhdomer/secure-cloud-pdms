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
  description = "ALB security group - HTTPS/HTTP from internet, forwards to app tier only"
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
  description = "EC2 application-tier security group - accepts only from ALB, talks only to RDS and outbound HTTPS"
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
  description = "RDS security group - accepts only from EC2 application tier, no outbound permitted"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  })
}

########################################
# alb-sg rules
#
# CloudFront is the intended sole entry point for this application
# (docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md
# Decision 1): the browser only ever talks to the CloudFront distribution,
# which serves the React build from S3 and proxies /api/* to this ALB as a
# second origin. So the ALB's own ingress is scoped to AWS's managed
# prefix list of CloudFront origin-facing servers rather than the whole
# internet — otherwise anyone could bypass CloudFront and hit the backend
# directly over plain HTTP with no Origin header (which
# src/backend/src/utils/corsValidator.js deliberately allows, for
# non-browser clients).
#
# BEFORE YOU FLIP enable_https TO true, REQUEST A QUOTA INCREASE FIRST.
# The CloudFront managed prefix list has a "weight" of 55: each rule that
# references it counts as 55 rules against the security group's rules
# quota, whose AWS default is 60 per security group ("AWS-managed prefix
# list weight", Amazon VPC User Guide).
#
#   enable_https = false (today): only the :80 rule exists — the :443 rule
#   below is gated off by count, because modules/alb's
#   aws_lb_listener.https doesn't exist either and nothing listens on 443.
#   Weight 55 of 60. No quota action needed.
#
#   enable_https = true: both rules exist at once. Weight 110 of 60, and
#   `terraform apply` fails with a rules-per-security-group limit error.
#   Request a Service Quotas increase on "Inbound or outbound rules per
#   security group" to at least 110 in ap-southeast-1 and wait for it to be
#   granted BEFORE applying that flip — same class of pre-apply prerequisite
#   as having a real issued ACM certificate (see
#   infrastructure/terraform/variables.tf's enable_https comment).
#
# Port 80's rule is deliberately NOT gated: it is always active, either as
# the redirect-to-443 listener (aws_lb_listener.http_redirect when
# enable_https = true) or as the direct app-forward listener
# (aws_lb_listener.http_forward when enable_https = false).
########################################

data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  # Only exists when there is an HTTPS listener to reach — see the
  # prefix-list weight note above for why this gating is load-bearing and
  # not just tidiness.
  count = var.enable_https ? 1 : 0

  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from CloudFront origin-facing servers only (AWS managed prefix list) - not the open internet"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "alb_http_redirect" {
  # checkov:skip=CKV_AWS_260: Intentional per design (Table 4.2) — port 80
  # exists so the ALB HTTP listener can issue a 301 redirect to HTTPS
  # (modules/alb aws_lb_listener.http_redirect) when var.enable_https = true
  # (the intended long-term state). While the project-level enable_https
  # override in infrastructure/terraform/variables.tf is false (no domain/
  # ACM cert yet — temporary, documented exception), this same port instead
  # carries real application traffic via aws_lb_listener.http_forward. The
  # port number is identical either way; what did change is the source —
  # this is no longer open to 0.0.0.0/0 but scoped to the CloudFront
  # origin-facing prefix list, so the plaintext-port exposure that
  # enable_https = false implies is now reachable only through CloudFront,
  # which itself terminates TLS at the viewer. See enable_https's
  # description for the remaining trade-off (CloudFront-to-ALB is still
  # plaintext inside AWS's network until a domain/ACM cert exists).
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from CloudFront origin-facing servers only (AWS managed prefix list) - 443 redirect when enable_https=true, direct app forward when enable_https=false (see infrastructure/terraform/variables.tf)"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
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
  description        = "Outbound HTTPS via NAT Gateway - AWS API (SSM, CloudWatch) and package endpoints only"
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
