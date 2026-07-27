# Sprint 2 — Summary
## Terraform Infrastructure: VPC, Security, RDS, EC2, ALB, CloudTrail, KMS

---

## What Was Implemented

Full three-tier AWS infrastructure provisioned via Terraform.
All resources in `infrastructure/terraform/` as root module calling 6 child modules.

Remote state: S3 `pdms-terraform-state-730077843716` / key `prod/terraform.tfstate` / region `ap-southeast-1`
State lock: DynamoDB `pdms-terraform-locks`

---

## Modules Built

### KMS — `modules/kms`
Customer-managed key (CMK) for RDS, EBS, SSM, S3, CloudTrail. Annual rotation enabled.

### VPC — `modules/vpc`
CIDR `10.0.0.0/16`, 6 subnets across 2 AZs (ap-southeast-1a/b):

| Subnet | CIDR | Purpose |
|---|---|---|
| public-subnet-a | 10.0.1.0/24 | ALB, NAT Gateway |
| public-subnet-b | 10.0.2.0/24 | ALB (multi-AZ) |
| app-subnet-a | 10.0.3.0/24 | EC2 Node.js |
| app-subnet-b | 10.0.4.0/24 | EC2 Node.js |
| db-subnet-a | 10.0.5.0/24 | RDS Primary |
| db-subnet-b | 10.0.6.0/24 | RDS Standby |

Internet Gateway, NAT Gateway, route tables, VPC Flow Logs (KMS), NACLs per tier.

### Security Groups — `modules/security`
- `alb-sg`: inbound 443/80 from internet; outbound 5000 → ec2-sg
- `ec2-sg`: inbound 5000 from alb-sg only; outbound 5432 → rds-sg
- `rds-sg`: inbound 5432 from ec2-sg only; no outbound

### RDS — `modules/rds`
PostgreSQL 16, db.t3.micro, Multi-AZ. `publicly_accessible=false`. KMS-encrypted. `rds.force_ssl=1`.
7-day backups, Enhanced Monitoring, Performance Insights. Deletion protection on.

Credentials in SSM Parameter Store (SecureString, KMS-encrypted):

| SSM Path | Value |
|---|---|
| `/pdms/prod/db/host` | RDS endpoint |
| `/pdms/prod/db/port` | 5432 |
| `/pdms/prod/db/dbname` | pdms |
| `/pdms/prod/db/username` | pdms_admin |
| `/pdms/prod/db/password` | 32-char auto-generated (never printed) |

### ALB — `modules/alb`
Internet-facing, public subnets, HTTPS-only (TLS 1.3/1.2). HTTP 80 redirects to 443.
Forwards to EC2 target group on port 5000. ACM cert via `acm_certificate_arn` var.

### EC2 — `modules/ec2`
ASG: min 2 / max 4 / desired 2 × t3.small. Private subnets only. No public IP.
SSM Session Manager access only — no SSH. Instance role scoped to `/pdms/prod/db/*` SSM only.

### CloudTrail — `modules/cloudtrail`
All-region API logging. S3 (KMS, MFA-delete). 90-day CloudWatch retention. Log validation on.

---

## Security Gate
Checkov: zero CRITICAL findings.
Intentional skip: `CKV_AWS_161` (IAM DB auth) — documented in `modules/rds/main.tf`.

---

## Sprint 3 Reference

### Key values
| What | Value |
|---|---|
| DB name | `pdms` |
| DB username | `pdms_admin` |
| DB password | `aws ssm get-parameter --name /pdms/prod/db/password --with-decryption` |
| RDS endpoint | `aws ssm get-parameter --name /pdms/prod/db/host --with-decryption` |
| App port | `5000` |
| AWS region | `ap-southeast-1` |

### SSM fetch pattern for Node.js backend
```javascript
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const ssm = new SSMClient({ region: 'ap-southeast-1' });

async function getDbConfig() {
  const get = (name) => ssm.send(new GetParameterCommand({
    Name: `/pdms/prod/db/${name}`, WithDecryption: true
  })).then(r => r.Parameter.Value);
  return {
    host: await get('host'), port: parseInt(await get('port')),
    database: await get('dbname'), user: await get('username'),
    password: await get('password'), ssl: { rejectUnauthorized: true }
  };
}
```

### Critical notes
- RDS is in a private subnet — unreachable from local machine. Use local PostgreSQL for dev.
- No SSH into EC2 — SSM Session Manager only.
- DB password is never known by any human — Terraform generated it, only SSM has it.
- ACM certificate must be issued in ap-southeast-1 before ALB HTTPS works.
