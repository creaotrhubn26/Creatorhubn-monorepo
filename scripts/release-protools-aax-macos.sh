#!/usr/bin/env bash

set -euo pipefail

readonly DEFAULT_WRAPTOOL="/Applications/PACEAntiPiracy/Eden/Fusion/Versions/6/bin/wraptool"
readonly DEFAULT_INPUT="/Library/Application Support/Avid/Audio/Plug-Ins/CreatorHub Review Console.aaxplugin"

usage() {
  cat <<'USAGE'
Usage:
  scripts/release-protools-aax-macos.sh identity [input.aaxplugin]
  scripts/release-protools-aax-macos.sh check [input.aaxplugin]
  scripts/release-protools-aax-macos.sh wrap <input.aaxplugin> <output.aaxplugin>

The identity and check commands are read-only. The wrap command requires:
  PACE_ACCOUNT_ID
  PACE_WRAP_CONFIG_GUID
  APPLE_SIGNING_IDENTITY

Optional:
  PACE_WRAPTOOL=/absolute/path/to/wraptool

Passwords are never accepted by this script. Authenticate once with
`wraptool sync --account ...` so PACE can use the macOS Keychain.
USAGE
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

note() {
  printf 'OK: %s\n' "$*"
}

warn() {
  printf 'WARNING: %s\n' "$*" >&2
}

cleanup_stage() {
  local temp_root="${TMPDIR:-/tmp}"
  if [[ -n "${AAX_RELEASE_STAGE_DIR:-}" \
    && "$AAX_RELEASE_STAGE_DIR" == "$temp_root"/creatorhub-aax-release.* \
    && -d "$AAX_RELEASE_STAGE_DIR" ]]; then
    rm -rf -- "$AAX_RELEASE_STAGE_DIR"
  fi
}

require_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || fail "AAX wrapping must run on macOS."
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command is missing: $1"
}

bundle_executable() {
  local bundle="$1"
  local executable_name
  executable_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$bundle/Contents/Info.plist" 2>/dev/null || true)"
  [[ -n "$executable_name" ]] || fail "CFBundleExecutable is missing from $bundle."
  printf '%s/Contents/MacOS/%s\n' "$bundle" "$executable_name"
}

require_universal_bundle() {
  local bundle="$1"
  local executable architectures
  executable="$(bundle_executable "$bundle")"
  [[ -f "$executable" ]] || fail "AAX executable is missing: $executable"
  architectures="$(lipo -archs "$executable" 2>/dev/null || true)"
  [[ " $architectures " == *" arm64 "* ]] || fail "AAX executable is missing arm64: $architectures"
  [[ " $architectures " == *" x86_64 "* ]] || fail "AAX executable is missing x86_64: $architectures"
  note "Universal AAX binary contains arm64 and x86_64."
}

require_ilok() {
  if ! ioreg -p IOUSB -l -w 0 2>/dev/null | grep -q '"USB Product Name" = "iLok"'; then
    fail "No physical iLok USB is connected."
  fi
  note "Physical iLok USB is connected."
}

require_pace_service() {
  local service_state
  service_state="$(launchctl print system/com.paceap.eden.licensed 2>/dev/null || true)"
  grep -q 'state = running' <<<"$service_state" || fail "PACE License Support service is not running."
  note "PACE License Support service is running."
}

require_apple_signature() {
  local bundle="$1"
  codesign --verify --deep --strict --verbose=2 "$bundle" >/dev/null 2>&1 \
    || fail "The input bundle does not have a valid Apple code signature: $bundle"
  note "Input bundle has a valid Apple code signature."
}

inspect_release_identity() {
  local bundle="$1"
  local manifest="$bundle/Contents/Resources/CreatorHubAAXIdentity.plist"
  local approved approval_reference manufacturer_id product_id mono_id stereo_id

  RELEASE_IDENTITY_ERROR=""
  if [[ ! -f "$manifest" ]]; then
    RELEASE_IDENTITY_ERROR="The bundle is missing CreatorHubAAXIdentity.plist; rebuild it with the current release configuration."
    warn "$RELEASE_IDENTITY_ERROR"
    return
  fi

  approved="$(/usr/libexec/PlistBuddy -c 'Print :AvidApproved' "$manifest" 2>/dev/null || true)"
  approval_reference="$(/usr/libexec/PlistBuddy -c 'Print :AvidApprovalReference' "$manifest" 2>/dev/null || true)"
  manufacturer_id="$(/usr/libexec/PlistBuddy -c 'Print :ManufacturerID' "$manifest" 2>/dev/null || true)"
  product_id="$(/usr/libexec/PlistBuddy -c 'Print :ProductID' "$manifest" 2>/dev/null || true)"
  mono_id="$(/usr/libexec/PlistBuddy -c 'Print :MonoNativeID' "$manifest" 2>/dev/null || true)"
  stereo_id="$(/usr/libexec/PlistBuddy -c 'Print :StereoNativeID' "$manifest" 2>/dev/null || true)"

  if [[ -z "$manufacturer_id" || -z "$product_id" || -z "$mono_id" || -z "$stereo_id" ]]; then
    RELEASE_IDENTITY_ERROR="The embedded AAX identity manifest is incomplete."
    warn "$RELEASE_IDENTITY_ERROR"
    return
  fi

  note "Embedded AAX IDs: manufacturer=$manufacturer_id product=$product_id mono=$mono_id stereo=$stereo_id."
  if [[ "$approved" != "true" ]]; then
    RELEASE_IDENTITY_ERROR="The embedded AAX IDs are marked as development-only. Rebuild with the IDs approved by Avid and -DCREATORHUB_AAX_IDS_AVID_APPROVED=ON."
    warn "$RELEASE_IDENTITY_ERROR"
  else
    if [[ -z "$approval_reference" ]]; then
      RELEASE_IDENTITY_ERROR="The embedded AAX IDs are marked as approved but have no Avid approval reference."
      warn "$RELEASE_IDENTITY_ERROR"
      return
    fi
    note "Embedded AAX IDs are explicitly marked as Avid-approved (reference: $approval_reference)."
  fi
}

require_pace_license() {
  local bundle="$1"
  local probe_output probe_status
  set +e
  probe_output="$("$WRAPTOOL" info --in "$bundle" 2>&1)"
  probe_status=$?
  set -e

  if grep -q 'MissingFusionToolsLicense\|No valid license found' <<<"$probe_output"; then
    fail "The iLok account/device is missing the active PACE Licensing tool license. Open iLok License Manager, activate it to the physical iLok, and run this check again."
  fi

  if [[ $probe_status -eq 0 ]]; then
    note "PACE Licensing tool license is available and the bundle is already wrapped."
  else
    note "PACE Licensing tool license is available; the input bundle is not wrapped yet."
  fi
}

require_wrap_config() {
  local cache_listing
  cache_listing="$("$WRAPTOOL" list 2>&1)" || fail "PACE wrapper cache could not be read. Run wraptool sync first."
  if [[ -n "${PACE_WRAP_CONFIG_GUID:-}" ]] && ! grep -Fqi "$PACE_WRAP_CONFIG_GUID" <<<"$cache_listing"; then
    fail "PACE_WRAP_CONFIG_GUID is not present in the local wrapper cache."
  fi
  note "PACE wrapper cache is available."
}

require_signing_identity() {
  [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]] || fail "APPLE_SIGNING_IDENTITY is required for wrapping."
  security find-identity -v -p codesigning 2>/dev/null | grep -Fq "$APPLE_SIGNING_IDENTITY" \
    || fail "Apple signing identity is not available in the current keychain: $APPLE_SIGNING_IDENTITY"
  note "Apple Developer ID signing identity is available."
}

preflight() {
  local input="$1"
  require_macos
  require_command codesign
  require_command ditto
  require_command ioreg
  require_command lipo
  [[ -x "$WRAPTOOL" ]] || fail "PACE wraptool is missing or not executable: $WRAPTOOL"
  [[ -d "$input" ]] || fail "AAX bundle does not exist: $input"
  [[ "$input" == *.aaxplugin ]] || fail "Input must be an .aaxplugin bundle."
  note "PACE wraptool: $("$WRAPTOOL" --version 2>&1 | head -n 1)"
  require_ilok
  require_pace_service
  require_wrap_config
  require_universal_bundle "$input"
  require_apple_signature "$input"
  inspect_release_identity "$input"
  require_pace_license "$input"
  [[ -z "$RELEASE_IDENTITY_ERROR" ]] || fail "$RELEASE_IDENTITY_ERROR"
}

wrap_bundle() {
  local input="$1"
  local output="$2"
  local stage_dir staged_input staged_output

  [[ -n "${PACE_ACCOUNT_ID:-}" ]] || fail "PACE_ACCOUNT_ID is required for wrapping."
  [[ -n "${PACE_WRAP_CONFIG_GUID:-}" ]] || fail "PACE_WRAP_CONFIG_GUID is required for wrapping."
  require_signing_identity
  [[ "$output" == *.aaxplugin ]] || fail "Output must be an .aaxplugin bundle."
  [[ ! -e "$output" ]] || fail "Refusing to overwrite existing output: $output"

  stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/creatorhub-aax-release.XXXXXX")"
  AAX_RELEASE_STAGE_DIR="$stage_dir"
  trap cleanup_stage EXIT
  staged_input="$stage_dir/input.aaxplugin"
  staged_output="$stage_dir/output.aaxplugin"
  ditto "$input" "$staged_input"

  "$WRAPTOOL" wrap \
    --account "$PACE_ACCOUNT_ID" \
    --wcguid "$PACE_WRAP_CONFIG_GUID" \
    --signid "$APPLE_SIGNING_IDENTITY" \
    --dsigharden \
    --timestampretry 600 \
    --in "$staged_input" \
    --out "$staged_output"

  "$WRAPTOOL" verify --in "$staged_output"
  codesign --verify --deep --strict --verbose=2 "$staged_output"
  [[ -f "$staged_output/Contents/Resources/__Pace_Eden/Signatures/codesign.dsig" ]] \
    || fail "PACE proprietary signature was not produced."

  mkdir -p "$(dirname "$output")"
  ditto "$staged_output" "$output"
  note "Wrapped and verified AAX bundle: $output"
  shasum -a 256 "$output/Contents/MacOS/$(basename "$(bundle_executable "$output")")"
}

MODE="${1:-check}"
WRAPTOOL="${PACE_WRAPTOOL:-$DEFAULT_WRAPTOOL}"
RELEASE_IDENTITY_ERROR=""

case "$MODE" in
  identity)
    INPUT="${2:-$DEFAULT_INPUT}"
    [[ -d "$INPUT" ]] || fail "AAX bundle does not exist: $INPUT"
    [[ "$INPUT" == *.aaxplugin ]] || fail "Input must be an .aaxplugin bundle."
    inspect_release_identity "$INPUT"
    [[ -z "$RELEASE_IDENTITY_ERROR" ]] || fail "$RELEASE_IDENTITY_ERROR"
    ;;
  check)
    INPUT="${2:-$DEFAULT_INPUT}"
    preflight "$INPUT"
    ;;
  wrap)
    [[ $# -eq 3 ]] || { usage >&2; exit 64; }
    INPUT="$2"
    OUTPUT="$3"
    preflight "$INPUT"
    wrap_bundle "$INPUT" "$OUTPUT"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 64
    ;;
esac
