#!/usr/bin/env bash
set -Eeuo pipefail

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Required environment variable is missing: $name" >&2
    exit 64
  fi
}

for name in PGHOST PGPORT PGDATABASE PGUSER BACKUP_ROOT BACKUP_AGE_RECIPIENT; do
  require_var "$name"
done

for executable in pg_dump pg_restore age sha256sum; do
  command -v "$executable" >/dev/null 2>&1 || {
    echo "Required executable is missing: $executable" >&2
    exit 69
  }
done

backup_root="$(realpath -m "$BACKUP_ROOT")"
if [[ "$backup_root" == "/" ]]; then
  echo "BACKUP_ROOT must not resolve to /." >&2
  exit 64
fi

retention_days="${BACKUP_RETENTION_DAYS:-14}"
if [[ ! "$retention_days" =~ ^[0-9]+$ ]] || (( retention_days < 1 )); then
  echo "BACKUP_RETENTION_DAYS must be a positive integer." >&2
  exit 64
fi

umask 077
mkdir -p "$backup_root"
temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/teacher-platform-backup.XXXXXX")"
trap 'rm -rf -- "$temporary_directory"' EXIT

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base_name="teacher-platform-${PGDATABASE}-${timestamp}.dump.age"
plain_dump="$temporary_directory/database.dump"
encrypted_backup="$backup_root/$base_name"
partial_backup="$encrypted_backup.partial"
checksum_file="$encrypted_backup.sha256"

pg_dump --format=custom --compress=6 --no-owner --no-acl --file="$plain_dump"
pg_restore --list "$plain_dump" >/dev/null
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$partial_backup" "$plain_dump"
mv -- "$partial_backup" "$encrypted_backup"
(
  cd "$backup_root"
  sha256sum "$base_name" > "${base_name}.sha256"
)

if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
  command -v rclone >/dev/null 2>&1 || {
    echo "BACKUP_RCLONE_REMOTE is set but rclone is missing." >&2
    exit 69
  }
  rclone copyto "$encrypted_backup" "${BACKUP_RCLONE_REMOTE%/}/$base_name"
  rclone copyto "$checksum_file" "${BACKUP_RCLONE_REMOTE%/}/${base_name}.sha256"
fi

find "$backup_root" -maxdepth 1 -type f \
  \( -name 'teacher-platform-*.dump.age' -o -name 'teacher-platform-*.dump.age.sha256' \) \
  -mtime "+$retention_days" -delete

echo "Encrypted backup created: $encrypted_backup"
