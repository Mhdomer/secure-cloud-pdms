#!/bin/bash
set -euo pipefail
dnf update -y
dnf install -y docker
systemctl enable docker
systemctl start docker

# ec2_ami_id is pinned to the AL2023 *Minimal* AMI (smaller attack surface
# for a HIPAA workload — see variables.tf's ec2_ami_id description). Unlike
# the standard AL2023 AMI, the Minimal edition does not ship
# amazon-ssm-agent preinstalled (confirmed against AWS's own AL2023 package
# comparison docs), so instances built from it never register with Systems
# Manager. SSM Session Manager is this project's only remote-access path —
# SSH is never opened (modules/security/main.tf) — so the agent must be
# installed explicitly rather than assumed present.
dnf install -y amazon-ssm-agent
systemctl enable --now amazon-ssm-agent

mkdir -p /opt/pdms
echo "${deploy_script_b64}" | base64 -d > /opt/pdms/deploy.sh
chmod +x /opt/pdms/deploy.sh

# Best-effort at boot — a fresh/replaced instance should come up running
# whatever was last successfully deployed. Does not block instance
# bootstrap if this fails (e.g. nothing deployed yet); the log is enough
# to diagnose from CloudWatch/SSM if needed.
/opt/pdms/deploy.sh >> /var/log/pdms-deploy.log 2>&1 || true
