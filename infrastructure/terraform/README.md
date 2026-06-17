# Terraform Configuration

**Status: PSM 2 — Not yet implemented**

## Planned Module Structure

```
terraform/
  main.tf           # Root module — calls all sub-modules
  variables.tf      # Input variables
  outputs.tf        # Output values (ALB DNS, RDS endpoint, etc.)
  versions.tf       # Terraform + provider version locks
  backend.tf        # Remote state (S3 + DynamoDB)
  modules/
    networking/     # VPC, subnets, IGW, NAT, route tables
    compute/        # EC2, ALB, security groups, NACLs
    database/       # RDS PostgreSQL, subnet group
    cdn/            # S3 + CloudFront
    iam/            # Instance profiles, roles, policies
    security/       # KMS, ACM, Secrets Manager
    monitoring/     # CloudTrail, CloudWatch
```

## Usage

```bash
terraform init
terraform plan -var-file="prod.tfvars"
terraform apply -var-file="prod.tfvars"
```

Note: `*.tfvars` and `*.tfstate` are git-ignored. Never commit secrets.
