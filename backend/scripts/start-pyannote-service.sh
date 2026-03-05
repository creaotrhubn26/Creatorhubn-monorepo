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

resolve_python_bin() {
  if [[ -n "${PYANNOTE_PYTHON_BIN:-}" ]]; then
    echo "${PYANNOTE_PYTHON_BIN}"
    return
  fi

  local candidates=(
    "${PY_SERVICE_DIR}/venv_py310/bin/python"
    "${PY_SERVICE_DIR}/venv/bin/python"
    "${PY_SERVICE_DIR}/venv_storyarc2/bin/python"
    "${PY_SERVICE_DIR}/venv_storyarc/bin/python"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return
    fi
  done

  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return
  fi

  echo ""
}

PYTHON_BIN="$(resolve_python_bin)"
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "No Python interpreter found for pyannote service." >&2
  echo "Set PYANNOTE_PYTHON_BIN or create backend/python-services/venv_py310." >&2
  exit 1
fi

echo "Using pyannote python interpreter: ${PYTHON_BIN}"
exec "${PYTHON_BIN}" "${PY_SERVICE_DIR}/pyannote_diarization_service.py"
