########################################
# VPC — single VPC, 6 subnets across 2 AZs (public / app / db tiers)
# Per chapter-4 Section 4.3.2 (Table 4.1) and Section 4.3.4 (NACLs, Table 4.3)
########################################

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-vpc"
  })
}

# Lock down the default security group created implicitly with the VPC —
# it must never be attached to any resource, so strip all rules.
resource "aws_default_security_group" "locked_down" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-default-sg-locked"
  })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-igw"
  })
}

########################################
# Subnets
########################################

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-public-subnet-${count.index == 0 ? "a" : "b"}"
    Tier = "public"
  })
}

resource "aws_subnet" "app" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.app_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-app-subnet-${count.index == 0 ? "a" : "b"}"
    Tier = "private-app"
  })
}

resource "aws_subnet" "db" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.db_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-db-subnet-${count.index == 0 ? "a" : "b"}"
    Tier = "isolated-db"
  })
}

########################################
# NAT Gateway — single NAT in public-subnet-a for app-tier outbound only.
# Documented tradeoff: a single NAT GW is a cost-optimised choice for a
# pilot deployment (Table 3.5, ≤50 concurrent users). It is a single point
# of failure for app-tier outbound internet access only — it is NOT in the
# request path for inbound traffic (ALB handles that) and does not affect
# RTO, since NAT GW is recreated automatically on `terraform apply`.
########################################

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-nat-eip"
  })

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-nat-gw"
  })

  depends_on = [aws_internet_gateway.main]
}

########################################
# Route Tables
########################################

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-public-rt"
  })
}

resource "aws_route_table" "app" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-app-rt"
  })
}

# DB route table intentionally has NO route beyond the implicit local VPC
# route (10.0.0.0/16) — no IGW, no NAT. Fully isolated from the internet.
resource "aws_route_table" "db" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-db-rt"
  })
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "app" {
  count          = 2
  subnet_id      = aws_subnet.app[count.index].id
  route_table_id = aws_route_table.app.id
}

resource "aws_route_table_association" "db" {
  count          = 2
  subnet_id      = aws_subnet.db[count.index].id
  route_table_id = aws_route_table.db.id
}

########################################
# Network ACLs — defence-in-depth, stateless subnet boundary (Table 4.3)
########################################

resource "aws_network_acl" "public" {
  # checkov:skip=CKV2_AWS_1: subnet_ids is set below via a splat expression
  # (aws_subnet.public[*].id) referencing all 2 public subnets — Checkov's
  # graph check does not always resolve dynamic splat associations,
  # producing a false "unattached" positive. Confirmed attached: terraform
  # plan shows aws_network_acl.public.subnet_ids = [public-subnet-a, public-subnet-b].
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.public[*].id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-public-nacl"
  })
}

resource "aws_network_acl_rule" "public_in_https" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 100
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 443
  to_port        = 443
}

resource "aws_network_acl_rule" "public_in_http" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 110
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 80
  to_port        = 80
}

resource "aws_network_acl_rule" "public_in_ephemeral" {
  # checkov:skip=CKV_AWS_231: This is the standard stateless-NACL ephemeral
  # response-port range (1024-65535) required so return traffic for the
  # ALB's own outbound connections is not blocked — it is not an RDP allow
  # rule. No instance in any public subnet listens on 3389; the only
  # resources in public-subnet-a/b are the ALB and the NAT Gateway, neither
  # of which exposes RDP.
  network_acl_id = aws_network_acl.public.id
  rule_number    = 120
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 1024
  to_port        = 65535
}

resource "aws_network_acl_rule" "public_out_all" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 100
  egress         = true
  protocol       = "-1"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 0
  to_port        = 0
}

resource "aws_network_acl" "app" {
  # checkov:skip=CKV2_AWS_1: subnet_ids set via splat expression below —
  # same false-positive pattern as aws_network_acl.public, confirmed attached.
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.app[*].id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-app-nacl"
  })
}

resource "aws_network_acl_rule" "app_in_from_public_a" {
  network_acl_id = aws_network_acl.app.id
  rule_number     = 100
  egress          = false
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.public_subnet_cidrs[0]
  from_port       = 5000
  to_port         = 5000
}

resource "aws_network_acl_rule" "app_in_from_public_b" {
  network_acl_id = aws_network_acl.app.id
  rule_number     = 110
  egress          = false
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.public_subnet_cidrs[1]
  from_port       = 5000
  to_port         = 5000
}

resource "aws_network_acl_rule" "app_in_ephemeral_from_db_a" {
  network_acl_id = aws_network_acl.app.id
  rule_number     = 120
  egress          = false
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.db_subnet_cidrs[0]
  from_port       = 1024
  to_port         = 65535
}

resource "aws_network_acl_rule" "app_in_ephemeral_from_db_b" {
  network_acl_id = aws_network_acl.app.id
  rule_number     = 130
  egress          = false
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.db_subnet_cidrs[1]
  from_port       = 1024
  to_port         = 65535
}

resource "aws_network_acl_rule" "app_in_ephemeral_return" {
  # Ephemeral return traffic from NAT Gateway / internet responses to app-tier outbound calls.
  # checkov:skip=CKV_AWS_231: Ephemeral response-port range for the app
  # tier's own outbound calls via the NAT Gateway (AWS API, SSM, package
  # endpoints) — not an RDP allow rule. No instance in app-subnet-a/b
  # listens on 3389; ec2-sg (the stateful, primary control) only accepts
  # inbound 5000 from alb-sg. This NACL rule is the stateless companion
  # for outbound-initiated response traffic only.
  network_acl_id = aws_network_acl.app.id
  rule_number     = 140
  egress          = false
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = "0.0.0.0/0"
  from_port       = 1024
  to_port         = 65535
}

resource "aws_network_acl_rule" "app_out_to_db_a" {
  network_acl_id = aws_network_acl.app.id
  rule_number     = 100
  egress          = true
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.db_subnet_cidrs[0]
  from_port       = 5432
  to_port         = 5432
}

resource "aws_network_acl_rule" "app_out_to_db_b" {
  network_acl_id = aws_network_acl.app.id
  rule_number     = 110
  egress          = true
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.db_subnet_cidrs[1]
  from_port       = 5432
  to_port         = 5432
}

resource "aws_network_acl_rule" "app_out_to_public" {
  network_acl_id = aws_network_acl.app.id
  rule_number     = 120
  egress          = true
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = "0.0.0.0/0"
  from_port       = 1024
  to_port         = 65535
}

resource "aws_network_acl_rule" "app_out_https" {
  # Outbound HTTPS via NAT Gateway (AWS API calls, SSM, package updates).
  network_acl_id = aws_network_acl.app.id
  rule_number     = 130
  egress          = true
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = "0.0.0.0/0"
  from_port       = 443
  to_port         = 443
}

resource "aws_network_acl" "db" {
  # checkov:skip=CKV2_AWS_1: subnet_ids set via splat expression below —
  # same false-positive pattern as aws_network_acl.public, confirmed attached.
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.db[*].id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-db-nacl"
  })
}

resource "aws_network_acl_rule" "db_in_from_app_a" {
  network_acl_id = aws_network_acl.db.id
  rule_number     = 100
  egress          = false
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.app_subnet_cidrs[0]
  from_port       = 5432
  to_port         = 5432
}

resource "aws_network_acl_rule" "db_in_from_app_b" {
  network_acl_id = aws_network_acl.db.id
  rule_number     = 110
  egress          = false
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.app_subnet_cidrs[1]
  from_port       = 5432
  to_port         = 5432
}

resource "aws_network_acl_rule" "db_out_ephemeral_to_app_a" {
  network_acl_id = aws_network_acl.db.id
  rule_number     = 100
  egress          = true
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.app_subnet_cidrs[0]
  from_port       = 1024
  to_port         = 65535
}

resource "aws_network_acl_rule" "db_out_ephemeral_to_app_b" {
  network_acl_id = aws_network_acl.db.id
  rule_number     = 110
  egress          = true
  protocol        = "tcp"
  rule_action     = "allow"
  cidr_block      = var.app_subnet_cidrs[1]
  from_port       = 1024
  to_port         = 65535
}

# NOTE: db-nacl deliberately has NO rule referencing 0.0.0.0/0 in either
# direction. Every inbound/outbound rule is scoped to the app-subnet CIDRs
# only. This is the defence-in-depth backstop for rds-sg (see modules/security).

########################################
# VPC Flow Logs — full network audit trail, CloudWatch Logs destination,
# KMS-encrypted log group, 90-day retention (aligned with CloudTrail policy).
########################################

resource "aws_iam_role" "flow_logs" {
  name = "${var.project_name}-${var.environment}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "flow_logs" {
  name = "${var.project_name}-${var.environment}-vpc-flow-logs-policy"
  role = aws_iam_role.flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
      ]
      Resource = "${aws_cloudwatch_log_group.flow_logs.arn}:*"
    }]
  })
}

resource "aws_cloudwatch_log_group" "flow_logs" {
  # checkov:skip=CKV_AWS_338: 90-day retention is the explicit project audit
  # retention requirement (CLAUDE.md / chapter-4 Section 4.3.8.6 / NFR-08),
  # not an oversight. Extending to 365 days is a documented Sprint 5/production
  # hardening candidate, tracked separately from this HIPAA-minimum baseline.
  name              = "/${var.project_name}/${var.environment}/vpc-flow-logs"
  retention_in_days = var.flow_log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = var.tags
}

resource "aws_flow_log" "main" {
  iam_role_arn    = aws_iam_role.flow_logs.arn
  log_destination = aws_cloudwatch_log_group.flow_logs.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-vpc-flow-log"
  })
}
