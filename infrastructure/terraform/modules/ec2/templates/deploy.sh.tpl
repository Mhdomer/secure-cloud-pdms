#!/bin/bash
set -uo pipefail
# Pull-and-restart rollout script for the backend container. Invoked twice:
# once at instance boot (via user_data.sh.tpl, below) and again on-demand
# by .github/workflows/deploy.yml's publish-backend-image job via SSM
# AWS-RunShellScript. One script, not duplicated logic — see
# docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md
# Decision 2.
#
# Health-check-before-swap: every instance runs this independently, so a
# genuinely broken image never gets swapped in anywhere — the fleet-wide
# result of a bad deploy is "still running the last-good version
# everywhere," not a partial or fleet-wide outage. No cross-instance
# orchestration needed for this reason.

AWS_REGION="${aws_region}"
ECR_REPOSITORY_URL="${ecr_repository_url}"
APP_PORT="${app_port}"
SSM_APP_PREFIX="${ssm_app_prefix}"
SSM_DB_PREFIX="${ssm_db_prefix}"
CLOUDFRONT_ORIGIN="${cloudfront_origin}"

log() { echo "[deploy.sh] $*"; }

# Single-flight lock. This script is invoked from two independent places
# (user_data at instance boot, and SSM AWS-RunShellScript from CI), which
# can overlap on a freshly-launched instance — both would then be creating
# and destroying the same pdms-backend / pdms-backend-candidate container
# names at once. Whoever gets the lock finishes; the other exits 0 rather
# than failing the SSM command, since "a deploy is already running" is not
# a deploy failure.
exec 200>/var/lock/pdms-deploy.lock
flock -n 200 || { echo "[deploy.sh] another deploy is already in progress, exiting"; exit 0; }

IMAGE_TAG=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_APP_PREFIX/image_tag" --with-decryption --query 'Parameter.Value' --output text)

if [ "$IMAGE_TAG" = "none" ] || [ -z "$IMAGE_TAG" ]; then
  log "No image deployed yet (image_tag=none) — nothing to do."
  exit 0
fi

log "Target image tag: $IMAGE_TAG"

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REPOSITORY_URL"

IMAGE="$ECR_REPOSITORY_URL:$IMAGE_TAG"
docker pull "$IMAGE"

# This script runs under `set -uo pipefail` but deliberately not `-e` (the
# docker rm/stop lines below are expected to fail on a first boot). That
# means a failed `aws ssm get-parameter` would otherwise just leave the
# variable empty and let the container start with a blank secret or DB
# host, so every read below fails loudly instead.
JWT_SECRET=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_APP_PREFIX/jwt_secret" --with-decryption --query 'Parameter.Value' --output text) || { log "Failed to read jwt_secret from SSM"; exit 1; }
DB_HOST=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/host" --with-decryption --query 'Parameter.Value' --output text) || { log "Failed to read db host from SSM"; exit 1; }
DB_PORT=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/port" --with-decryption --query 'Parameter.Value' --output text) || { log "Failed to read db port from SSM"; exit 1; }
DB_NAME=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/dbname" --with-decryption --query 'Parameter.Value' --output text) || { log "Failed to read db dbname from SSM"; exit 1; }
DB_USER=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/username" --with-decryption --query 'Parameter.Value' --output text) || { log "Failed to read db username from SSM"; exit 1; }
DB_PASSWORD=$(aws ssm get-parameter --region "$AWS_REGION" --name "$SSM_DB_PREFIX/password" --with-decryption --query 'Parameter.Value' --output text) || { log "Failed to read db password from SSM"; exit 1; }

ENV_ARGS=(
  -e "NODE_ENV=production"
  -e "PORT=$APP_PORT"
  -e "JWT_SECRET=$JWT_SECRET"
  -e "JWT_EXPIRES_IN=15m"
  -e "DB_HOST=$DB_HOST"
  -e "DB_PORT=$DB_PORT"
  -e "DB_NAME=$DB_NAME"
  -e "DB_USER=$DB_USER"
  -e "DB_PASSWORD=$DB_PASSWORD"
  -e "DB_SSL=true"
  -e "CLOUDFRONT_ORIGIN=$CLOUDFRONT_ORIGIN"
  -e "FRONTEND_URL=$CLOUDFRONT_ORIGIN"
  -e "COOKIE_SECURE=true"
  -e "AWS_REGION=$AWS_REGION"
  -e "LOG_LEVEL=info"
)

# The ENV_ARGS expansion below must stay double-quoted. modules/rds's
# random_password.master sets override_special to a charset that includes
# the bash glob metacharacters * ? [ and ], so an unquoted expansion would
# subject DB_PASSWORD to pathname expansion and could silently replace the
# argument with matching filenames from the working directory.
# (This is a templatefile() source, so the literal below is written
# "$${ENV_ARGS[@]}" — Terraform's $$ escape renders to a single $.)
log "Starting candidate container on 127.0.0.1:5001"
docker rm -f pdms-backend-candidate >/dev/null 2>&1 || true
docker run -d --name pdms-backend-candidate -p 127.0.0.1:5001:"$APP_PORT" "$${ENV_ARGS[@]}" "$IMAGE"

HEALTHY=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:5001/health" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
  log "Candidate never became healthy after 30s — leaving current deployment in place."
  docker rm -f pdms-backend-candidate >/dev/null 2>&1 || true
  exit 1
fi

log "Candidate healthy — swapping in as pdms-backend"
docker rm -f pdms-backend-candidate >/dev/null 2>&1 || true
docker stop pdms-backend >/dev/null 2>&1 || true
docker rm pdms-backend >/dev/null 2>&1 || true
docker run -d --name pdms-backend --restart unless-stopped -p "$APP_PORT":"$APP_PORT" "$${ENV_ARGS[@]}" "$IMAGE"

log "Deploy complete: $IMAGE"
