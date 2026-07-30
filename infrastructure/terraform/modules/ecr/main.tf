########################################
# ECR — backend container image repository. IMMUTABLE tags so the exact
# image Trivy-scanned in CI (security-scan.yml's container-scan job) is the
# exact image that ever gets pulled to an EC2 instance; a tag can never be
# silently repointed after the fact. KMS-encrypted with the project CMK via
# the existing generic AllowServiceUsage statement in modules/kms —
# ecr.amazonaws.com is not one of the three services (CloudWatch Logs, SNS,
# CloudTrail) that turned out to need a dedicated EncryptionContext
# statement during Sprint 4's live deployment, but that is an inference,
# not yet verified against a live account. If the first real `docker push`
# fails with a KMS access-denied-style error, add a dedicated
# AllowEcrUsage statement to modules/kms/main.tf the same way the other
# three were added — see
# docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md's
# carried-forward item #1.
########################################

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-${var.environment}-backend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-backend"
  })
}

# Cost control (this project runs on a free-tier AWS account, same
# motivation as the RDS backup-retention override in root variables.tf):
# expire any untagged image (a failed or superseded multi-step push) after
# 1 day, and keep only the most recent 10 images overall regardless of tag.
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only the most recent 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}
