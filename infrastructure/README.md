# Infrastructure — Terraform IaC

**Status: PSM 2 — Not yet implemented**

All AWS infrastructure is defined as code. No manual console provisioning.

## Planned Resources (~35 total)

| Category | Resources |
|---|---|
| Networking | VPC, 3 subnets (Public/App/DB), Route Tables, IGW, NAT Gateway |
| Compute | EC2 (App), ALB, Target Group, Security Groups, NACLs |
| Database | RDS PostgreSQL (Multi-AZ), DB Subnet Group, Parameter Group |
| Storage | S3 (frontend static), S3 (Terraform remote state) |
| CDN | CloudFront distribution |
| IAM | EC2 Instance Profile, RDS access role, S3 bucket policy |
| Security | KMS keys (RDS + EBS + Secrets Manager), ACM certificate |
| Audit | CloudTrail, CloudWatch Log Groups + Alarms |
| Recovery | DynamoDB (state lock), remote state backend |
| Secrets | AWS Secrets Manager (DB credentials, JWT secret) |

## Remote State
- S3 bucket: `pdms-terraform-state`
- DynamoDB table: `pdms-terraform-locks`
- Region: `ap-southeast-1` (Singapore)

## Recovery Time Objective
Target: **< 15 minutes** from `terraform destroy` to healthy system.  
Test procedure: destroy test environment → `terraform apply` → health check on ALB → record time.
