#!/usr/bin/env bash
set -Eeuo pipefail

base_url="${1:-${HEALTH_BASE_URL:-}}"
if [[ -z "$base_url" || "$base_url" != https://* ]]; then
  echo "Usage: verify-deployment.sh https://api.example.com" >&2
  exit 64
fi

for endpoint in /health/live /health/ready; do
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 5 --max-time 20 "${base_url%/}${endpoint}")"
  if [[ "$status" != "200" ]]; then
    echo "Health check failed: $endpoint returned $status" >&2
    exit 1
  fi
done

echo "Deployment health checks passed: ${base_url%/}"
