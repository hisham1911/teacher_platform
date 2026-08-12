#!/usr/bin/env bash
set -Eeuo pipefail

if (( $# != 2 )); then
  echo "Usage: deploy-release.sh <release.tar.gz> <40-character-git-sha>" >&2
  exit 64
fi

artifact="$(realpath "$1")"
release_sha="$2"
install_root="/opt/teacher-platform"
environment_file="/etc/teacher-platform/teacher-platform.env"
backup_environment_file="/etc/teacher-platform/backup.env"

if [[ ! "$release_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Release SHA is invalid." >&2
  exit 64
fi
if [[ ! -f "$artifact" || ! -f "$environment_file" || ! -f "$backup_environment_file" ]]; then
  echo "Release artifact or a production environment file is missing." >&2
  exit 66
fi
if ! grep --fixed-strings --line-regexp --quiet 'ASPNETCORE_ENVIRONMENT=Production' "$environment_file"; then
  echo "Production environment file must set ASPNETCORE_ENVIRONMENT=Production." >&2
  exit 78
fi
command -v systemd-run >/dev/null 2>&1 || {
  echo "Required executable is missing: systemd-run" >&2
  exit 69
}

release_directory="$install_root/releases/$release_sha"
if [[ -e "$release_directory" ]]; then
  echo "Release directory already exists: $release_directory" >&2
  exit 73
fi

mkdir -p "$release_directory"
tar --extract --gzip --file "$artifact" --directory "$release_directory"
test -f "$release_directory/backend/TeacherPlatform.Api.dll"
test -x "$release_directory/backend/efbundle"
test -x "$release_directory/scripts/backup-postgres.sh"
test -x "$release_directory/scripts/check-operational-health.sh"
test -x "$release_directory/scripts/restore-postgres.sh"

# A deploy cannot proceed without a fresh, encrypted database backup. Transient
# units let systemd parse EnvironmentFile values without evaluating secrets as shell.
systemd-run --quiet --wait --collect --pipe \
  --unit="teacher-platform-predeploy-backup-${release_sha}" \
  --property=Type=exec \
  --property=User=teacher-platform \
  --property=Group=teacher-platform \
  --property="EnvironmentFile=$backup_environment_file" \
  "$release_directory/scripts/backup-postgres.sh"

systemd-run --quiet --wait --collect --pipe \
  --unit="teacher-platform-migrate-${release_sha}" \
  --property=Type=exec \
  --property=User=teacher-platform \
  --property=Group=teacher-platform \
  --property="WorkingDirectory=$release_directory/backend" \
  --property="EnvironmentFile=$environment_file" \
  "$release_directory/backend/efbundle"

previous_release="$(readlink -f "$install_root/current" || true)"
ln -s "$release_directory" "$install_root/current.next"
mv -Tf "$install_root/current.next" "$install_root/current"
systemctl restart teacher-platform.service

ready=false
for _ in $(seq 1 30); do
  if curl --silent --fail --max-time 5 http://127.0.0.1:5000/health/ready >/dev/null; then
    ready=true
    break
  fi
  sleep 2
done

if [[ "$ready" != "true" ]]; then
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -s "$previous_release" "$install_root/current.next"
    mv -Tf "$install_root/current.next" "$install_root/current"
    systemctl restart teacher-platform.service
  fi
  echo "New release failed readiness; application symlink was rolled back." >&2
  exit 1
fi

echo "Release active: $release_sha"
