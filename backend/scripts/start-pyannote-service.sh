#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY_SERVICE_DIR="${ROOT_DIR}/python-services"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/.env"
  set +a
fi

if [[ -f "${ROOT_DIR}/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/.env.local"
  set +a
fi

export PORT="${PYANNOTE_PORT:-5501}"

exec "${PY_SERVICE_DIR}/venv/bin/python" "${PY_SERVICE_DIR}/pyannote_diarization_service.py"
