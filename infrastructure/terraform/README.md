# Terraform Configuration

**Status: PSM 2 Sprint 4 — VPC, subnets, security groups, NACLs, RDS, KMS, ALB, EC2, CloudTrail, CloudWatch monitoring implemented**

## Module Structure

```
terraform/
  main.tf                     # Root module — calls all sub-modules
  variables.tf                # Input variables
  outputs.tf                  # Output values (ALB DNS, RDS endpoint, etc.)
  versions.tf                 # Terraform + provider version locks
  backend.tf                  # Remote state (S3 + DynamoDB)
  terraform.tfvars.example    # Placeholder values only — copy to terraform.tfvars (git-ignored)
  modules/
    kms/          # Customer-managed KMS CMK (RDS, EBS, SSM, S3, CloudTrail encryption)
    vpc/          # VPC, 6 subnets across 2 AZs, IGW, NAT GW, route tables, NACLs, VPC Flow Logs
    security/     # alb-sg, ec2-sg, rds-sg (Table 4.2)
    rds/          # RDS PostgreSQL, DB subnet group, parameter group, credentials in SSM Parameter Store
    alb/          # Application Load Balancer, HTTPS listener, target group, access log bucket
    ec2/          # Launch template, Auto Scaling Group, IAM instance role (SSM-only access)
    cloudtrail/   # CloudTrail trail, encrypted S3 bucket, CloudWatch Logs integration
    monitoring/   # App log group + failed-login/ALB-5xx-rate/RDS-CPU alarms + dashboard (Sprint 4, chapter-4 §4.3.8.6)
```

Frontend delivery (S3 + CloudFront) and application container deployment are implemented in Sprint 3 alongside the Node.js/Express backend and React frontend.

## Usage

```bash
terraform init
cp terraform.tfvars.example terraform.tfvars   # fill in real values, this file is git-ignored
terraform plan  -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

## Security gate (must pass before every commit)

```bash
checkov -d infrastructure/terraform --framework terraform
```

Zero CRITICAL findings required. See `docs/psm2/reports/` for the latest scan output.

Note: `*.tfvars` and `*.tfstate` are git-ignored. Never commit secrets. RDS master credentials are generated at apply time (`random_password`) and stored only in AWS SSM Parameter Store as `SecureString` values — they are never written to a Terraform output or a committed file.
