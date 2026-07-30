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
        # No logs:CreateLogGroup — the application log group is exclusively
        # Terraform-managed (modules/monitoring/main.tf), never
        # auto-created by the app/CloudWatch Logs agent. If the EC2 role
        # could create it, an instance booting before (or during) a
        # monitoring-module apply could create the group first, and the
        # subsequent Terraform apply of aws_cloudwatch_log_group.app would
        # then fail with ResourceAlreadyExistsException since the group
        # exists outside Terraform's state. Least-privilege side benefit:
        # the role can only write to a group that already exists.
        Sid    = "CloudWatchLogsWrite"
        Effect = "Allow"
        Action = [
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
      {
        Sid    = "PullBackendImageFromEcr"
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchCheckLayerAvailability",
        ]
        Resource = var.ecr_repository_arn
      },
      {
        # checkov:skip=CKV_AWS_355: ecr:GetAuthorizationToken has no
        # resource-level ARN in the AWS API — it authenticates the caller
        # to the ECR registry as a whole, not to one repository. AWS's own
        # example IAM policies for ECR pull access grant this action on
        # Resource: "*" for exactly this reason.
        Sid      = "AuthenticateToEcr"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        # Explicit two-entry list, not a "${var.ssm_app_parameter_prefix}/*"
        # wildcard — deploy.sh never reads previous_image_tag (that one
        # exists solely for the CI-side manual-rollback path), and an
        # explicit list is what this codebase already reaches for when a
        # wildcard would grant more than is actually used (see
        # modules/github-oidc's local.other_project_role_arns doing the
        # same thing for a stronger reason).
        Sid    = "ReadAppConfigFromSsm"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_app_parameter_prefix}/jwt_secret",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_app_parameter_prefix}/image_tag",
        ]
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
# App runtime config in SSM — mirrors modules/rds's own "generate +
# store" pattern exactly (random_password + SecureString +
# ignore_changes = [value]) for jwt_secret. image_tag/previous_image_tag
# are mutated outside Terraform by .github/workflows/deploy.yml on every
# deploy; ignore_changes here is required for the same reason as
# db_password — without it, the next terraform-apply (which runs on every
# merge to main, not just Terraform changes) would silently reset the
# running app back to whatever tag Terraform's own default declares.
########################################

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "jwt_secret" {
  name   = "${var.ssm_app_parameter_prefix}/jwt_secret"
  type   = "SecureString"
  key_id = var.kms_key_arn
  value  = random_password.jwt_secret.result
  tags   = var.tags

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "image_tag" {
  name   = "${var.ssm_app_parameter_prefix}/image_tag"
  type   = "SecureString"
  key_id = var.kms_key_arn
  value  = "none"
  tags   = var.tags

  lifecycle {
    ignore_changes = [value]
  }
}

# Read only by .github/workflows/deploy.yml (manual-rollback lever) — the
# EC2 role below is deliberately not granted read access to this one.
resource "aws_ssm_parameter" "previous_image_tag" {
  name   = "${var.ssm_app_parameter_prefix}/previous_image_tag"
  type   = "SecureString"
  key_id = var.kms_key_arn
  value  = "none"
  tags   = var.tags

  lifecycle {
    ignore_changes = [value]
  }
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
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 1
  }

  monitoring {
    enabled = true
  }

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = var.root_volume_size
      volume_type           = "gp3"
      encrypted             = true
      kms_key_id            = var.kms_key_arn
      delete_on_termination = true
    }
  }

  # No key_name — no SSH key pair issued. Instance access is exclusively
  # via SSM Session Manager (see aws_iam_role_policy_attachment.ssm_managed_instance_core).

  # Renders modules/ec2/templates/deploy.sh.tpl with this module's actual
  # config, then embeds it (base64) into user_data.sh.tpl so the instance
  # writes it to disk and runs it once at boot. See that template's header
  # comment and
  # docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md
  # Decision 2 for why this is one script invoked in two places, not
  # duplicated logic.
  user_data = base64encode(templatefile("${path.module}/templates/user_data.sh.tpl", {
    deploy_script_b64 = base64encode(templatefile("${path.module}/templates/deploy.sh.tpl", {
      aws_region         = data.aws_region.current.name
      ecr_repository_url = var.ecr_repository_url
      app_port           = var.app_port
      ssm_app_prefix     = var.ssm_app_parameter_prefix
      ssm_db_prefix      = var.ssm_parameter_prefix
      cloudfront_origin  = "https://${var.cloudfront_domain_name}"
    }))
  }))

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
  health_check_type   = "ELB"

  # 600s, not the 60s this started at. Boot is no longer "install Docker
  # and stop": user_data now runs dnf update -y, installs and starts
  # Docker, reads six SSM parameters, does an ECR docker login, pulls a
  # full image over the NAT Gateway, polls a candidate container for up to
  # 30s, then swaps it in (see templates/deploy.sh.tpl). On a small
  # instance type that is realistically several minutes. With
  # health_check_type = "ELB", a 60s grace period would let the ASG mark
  # instances unhealthy and terminate them mid-boot, so the fleet could
  # never converge to healthy.
  health_check_grace_period = 600

  # Still "0" today, but for a narrower reason than this comment used to
  # give. What is known to be true right now: aws_ssm_parameter.image_tag
  # above is created with value "none" and only ever changed outside
  # Terraform by .github/workflows/deploy.yml, so until the first real CI
  # deploy runs, deploy.sh reads "none", no-ops, and no container is ever
  # started — nothing can pass the ELB health check regardless of the
  # grace period, and Terraform's default 10-minute capacity wait would
  # time out on every apply. (The older claim that user_data "only
  # bootstraps Docker" is no longer true — it does pull and run the
  # backend image.)
  #
  # Once a real image tag has been deployed, instances are expected to
  # come up healthy within the grace period above and this "0" could
  # reasonably become a real wait. Whether it should is a live-behavior
  # question — how long a first boot actually takes on this instance type
  # has never been measured — so this is left as-is rather than guessed at,
  # and is worth revisiting after the first real deploy.
  wait_for_capacity_timeout = "0"

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
