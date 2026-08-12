#!/usr/bin/env bash
set -Eeuo pipefail

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Required environment variable is missing: $name" >&2
    exit 64
  fi
}

for name in MONITOR_API_BASE_URL PGHOST PGPORT PGDATABASE PGUSER BACKUP_ROOT; do
  require_var "$name"
done

for executable in curl psql find sort head date realpath; do
  command -v "$executable" >/dev/null 2>&1 || {
    echo "Required executable is missing: $executable" >&2
    exit 69
  }
done

max_backup_age_hours="${MONITOR_MAX_BACKUP_AGE_HOURS:-36}"
if [[ ! "$max_backup_age_hours" =~ ^[0-9]+$ ]] || (( max_backup_age_hours < 1 )); then
  echo "MONITOR_MAX_BACKUP_AGE_HOURS must be a positive integer." >&2
  exit 64
fi

api_base_url="${MONITOR_API_BASE_URL%/}"
if [[ "$api_base_url" != https://* && "$api_base_url" != http://127.0.0.1:* ]]; then
  echo "MONITOR_API_BASE_URL must use HTTPS, except for loopback checks." >&2
  exit 64
fi

curl --fail --silent --show-error --max-time 10 "$api_base_url/health/live" >/dev/null
curl --fail --silent --show-error --max-time 10 "$api_base_url/health/ready" >/dev/null

backup_root="$(realpath -m "$BACKUP_ROOT")"
if [[ "$backup_root" == "/" ]]; then
  echo "BACKUP_ROOT must not resolve to /." >&2
  exit 64
fi

latest_backup_line="$(find "$backup_root" -maxdepth 1 -type f -name 'teacher-platform-*.dump.age' -printf '%T@ %p\n' | sort -nr | head -n 1)"
if [[ -z "$latest_backup_line" ]]; then
  echo "No encrypted PostgreSQL backup exists in $backup_root." >&2
  exit 1
fi

latest_backup_epoch="${latest_backup_line%% *}"
latest_backup_epoch="${latest_backup_epoch%%.*}"
now_epoch="$(date -u +%s)"
backup_age_seconds="$((now_epoch - latest_backup_epoch))"
max_backup_age_seconds="$((max_backup_age_hours * 3600))"
if (( backup_age_seconds > max_backup_age_seconds )); then
  echo "Latest encrypted PostgreSQL backup is older than ${max_backup_age_hours}h." >&2
  exit 1
fi

delayed_outbox_count="$(psql --no-password --tuples-only --no-align --command \
  "SELECT count(*) FROM \"OutboxMessages\" WHERE \"ProcessedAt\" IS NULL AND \"NextAttemptAt\" < NOW() - INTERVAL '1 hour';")"
if [[ ! "$delayed_outbox_count" =~ ^[0-9]+$ ]]; then
  echo "Outbox health query returned an unexpected value." >&2
  exit 1
fi
if (( delayed_outbox_count > 0 )); then
  echo "Outbox has $delayed_outbox_count message(s) delayed by more than one hour." >&2
  exit 1
fi

echo "Operational health check passed: API ready, backup current, outbox current."
