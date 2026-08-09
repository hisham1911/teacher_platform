#!/usr/bin/env bash
set -Eeuo pipefail

if (( $# != 2 )); then
  echo "Usage: restore-postgres.sh <backup.dump.age> <new_database_name>" >&2
  exit 64
fi

encrypted_backup="$(realpath "$1")"
target_database="$2"
checksum_file="${encrypted_backup}.sha256"
identity_file="${BACKUP_AGE_IDENTITY_FILE:-}"

if [[ ! "$target_database" =~ ^[a-zA-Z][a-zA-Z0-9_]{2,62}$ ]]; then
  echo "Target database name is invalid." >&2
  exit 64
fi
if [[ "$target_database" != *_restore* && "${ALLOW_NON_RESTORE_DATABASE_NAME:-false}" != "true" ]]; then
  echo "Target database must contain '_restore' unless ALLOW_NON_RESTORE_DATABASE_NAME=true." >&2
  exit 64
fi
if [[ ! -f "$encrypted_backup" || ! -f "$checksum_file" ]]; then
  echo "Encrypted backup or adjacent checksum file is missing." >&2
  exit 66
fi
if [[ -z "$identity_file" || ! -f "$identity_file" ]]; then
  echo "BACKUP_AGE_IDENTITY_FILE must point to the age identity file." >&2
  exit 66
fi

for executable in age sha256sum pg_restore createdb psql; do
  command -v "$executable" >/dev/null 2>&1 || {
    echo "Required executable is missing: $executable" >&2
    exit 69
  }
done

(
  cd "$(dirname "$encrypted_backup")"
  sha256sum --check "$(basename "$checksum_file")"
)

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/teacher-platform-restore.XXXXXX")"
trap 'rm -rf -- "$temporary_directory"' EXIT
plain_dump="$temporary_directory/database.dump"
age --decrypt --identity "$identity_file" --output "$plain_dump" "$encrypted_backup"
pg_restore --list "$plain_dump" >/dev/null

database_exists="$(psql --dbname=postgres --tuples-only --no-align \
  --command="SELECT 1 FROM pg_database WHERE datname = '$target_database';")"
if [[ "$database_exists" == "1" ]]; then
  echo "Target database already exists; restore requires a new database." >&2
  exit 73
fi

createdb --template=template0 --encoding=UTF8 "$target_database"
if ! pg_restore --exit-on-error --no-owner --no-acl --dbname="$target_database" "$plain_dump"; then
  echo "Restore failed. The newly created database was left in place for inspection." >&2
  exit 1
fi

psql --dbname="$target_database" --tuples-only --no-align \
  --command='SELECT COUNT(*) FROM "__EFMigrationsHistory";'
echo "Restore completed into new database: $target_database"
