#!/bin/bash
set -euo pipefail
dnf update -y
dnf install -y docker
systemctl enable docker
systemctl start docker

mkdir -p /opt/pdms
echo "${deploy_script_b64}" | base64 -d > /opt/pdms/deploy.sh
chmod +x /opt/pdms/deploy.sh

# Best-effort at boot — a fresh/replaced instance should come up running
# whatever was last successfully deployed. Does not block instance
# bootstrap if this fails (e.g. nothing deployed yet); the log is enough
# to diagnose from CloudWatch/SSM if needed.
/opt/pdms/deploy.sh >> /var/log/pdms-deploy.log 2>&1 || true
