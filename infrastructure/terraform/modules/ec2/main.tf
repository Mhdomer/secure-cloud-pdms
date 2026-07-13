########################################
# EC2 application tier — private app-subnet only, no public IP, no SSH.
# Access exclusively via AWS Systems Manager Session Manager.
# IAM instance role limited to CloudWatch log writes + scoped SSM reads.
# Deployed as an Auto Scaling Group behind the ALB target group.
########################################

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

########################################
# IAM instance role — least privilege per chapter-4 Section 4.3.5.
# Explicitly NO rds:* / rds-db:connect permissions: DB access is controlled
# at the network layer (security groups) and via the connection string
# read from SSM, never via IAM database authentication.
########################################

resource "aws_iam_role" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

# Enables SSM Session Manager (no inbound SSH port required anywhere).
resource "aws_iam_role_policy_attachment" "ssm_managed_instance_core" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "app_permissions" {
  name = "${var.project_name}-${var.environment}-ec2-app-policy"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogsWrite"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/${var.project_name}/${var.environment}/*"
      },
      {
        Sid    = "ReadOwnDbCredentialsFromSsm"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
        ]
        Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_parameter_prefix}/*"
      },
      {
        Sid      = "DecryptSsmSecureStringsWithProjectCmk"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = var.kms_key_arn
      },
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-instance-profile"
  role = aws_iam_role.ec2.name

  tags = var.tags
}

########################################
# Launch Template — IMDSv2 enforced, encrypted root volume, no public IP.
########################################

resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-${var.environment}-app-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.ec2.arn
  }

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [var.ec2_security_group_id]
    delete_on_termination       = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                  = "required" # IMDSv2 only
    http_put_response_hop_limit = 1
  }

  monitoring {
    enabled = true
  }

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = var.root_volume_size
      volume_type            = "gp3"
      encrypted               = true
      kms_key_id              = var.kms_key_arn
      delete_on_termination   = true
    }
  }

  # No key_name — no SSH key pair issued. Instance access is exclusively
  # via SSM Session Manager (see aws_iam_role_policy_attachment.ssm_managed_instance_core).

  # Application container deployment (Docker pull, env bootstrap from SSM)
  # is implemented in Sprint 3 alongside the Node.js/Express backend build.
  # This bootstrap only installs the SSM agent prerequisites and Docker
  # runtime so Sprint 3 can layer the container deployment on top.
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -euo pipefail
    dnf update -y
    dnf install -y docker
    systemctl enable docker
    systemctl start docker
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = merge(var.tags, {
      Name = "${var.project_name}-${var.environment}-app"
    })
  }

  tags = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-${var.environment}-app-asg"
  vpc_zone_identifier = var.app_subnet_ids
  target_group_arns   = [var.target_group_arn]
  health_check_type          = "ELB"
  health_check_grace_period = 60

  min_size         = var.min_size
  max_size         = var.max_size
  desired_capacity = var.desired_capacity

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  dynamic "tag" {
    for_each = merge(var.tags, { Name = "${var.project_name}-${var.environment}-app" })
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}
