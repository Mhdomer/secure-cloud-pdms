# Architecture Design

## Status: In Progress

This section documents the three-tier AWS architecture for the Secure Cloud PDMS.

## Planned Documents

- [ ] `vpc-design.md` — VPC CIDR blocks, subnet layout, availability zones
- [ ] `network-diagram.md` — Traffic flow: Internet → ALB → EC2 → RDS
- [ ] `aws-services.md` — Service selection and justification
- [ ] `iac-structure.md` — Terraform module breakdown

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    AWS VPC                          │
│                                                     │
│  ┌─────────────────┐     ┌──────────────────────┐  │
│  │  Public Subnet  │     │  Public Subnet (AZ-B) │  │
│  │  ALB / NAT GW   │     │  ALB (standby)        │  │
│  └────────┬────────┘     └──────────┬───────────┘  │
│           │                         │               │
│  ┌────────▼─────────────────────────▼────────────┐  │
│  │           Private App Subnet                  │  │
│  │           EC2 (Backend — Flask/Node.js)        │  │
│  └────────────────────────┬──────────────────────┘  │
│                           │                         │
│  ┌────────────────────────▼──────────────────────┐  │
│  │           Private DB Subnet                   │  │
│  │           RDS (MySQL/PostgreSQL)               │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Multi-AZ subnets | High availability; no single point of failure |
| RDS in isolated subnet | DB unreachable from internet; only app tier can connect |
| NAT Gateway (not public EC2) | Backend initiates outbound traffic without public IP exposure |
| ALB as entry point | Centralised TLS termination; enables future auto-scaling |
