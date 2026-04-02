#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# convert-role-assets.sh
#
# Converts all source files in the Keep folder to web-ready assets:
#   PNG / JPG  →  WebP  (lossless, to public/role-room-assets/)
#   MP4 / MOV  →  MP4   (H.264, faststart, no audio, to public/role-room-assets/)
#
# Usage:
#   bash scripts/convert-role-assets.sh            # convert everything
#   bash scripts/convert-role-assets.sh --force    # overwrite existing outputs
#
# Run from VS Code: Terminal > Run Task > "Convert Role Room Assets"
# ─────────────────────────────────────────────────────────────────────────────

set -e

KEEP="src/components/role-room/components/icons/Keep"
OUT="public/role-room-assets"
FORCE=0

for arg in "$@"; do
  [[ "$arg" == "--force" ]] && FORCE=1
done

# ── resolve script directory so the script works from any cwd ─────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
KEEP="$CLIENT_DIR/src/components/role-room/components/icons/Keep"
OUT="$CLIENT_DIR/public/role-room-assets"

mkdir -p "$OUT"

# ── ffmpeg: prefer /tmp/ffmpeg (static build), fall back to system ─────────
FFMPEG=""
if [[ -x /tmp/ffmpeg ]]; then
  FFMPEG=/tmp/ffmpeg
elif command -v ffmpeg &>/dev/null; then
  FFMPEG=ffmpeg
else
  echo "⬇  ffmpeg not found — downloading static build..."
  curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz \
    | tar -xJ --strip-components=1 -C /tmp "*/ffmpeg" 2>/dev/null || \
  curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
    | tar -xJ --strip-components=1 -C /tmp "*/ffmpeg" 2>/dev/null
  chmod +x /tmp/ffmpeg
  FFMPEG=/tmp/ffmpeg
  echo "✓  ffmpeg ready at /tmp/ffmpeg"
fi

# ── image conversion (PNG/JPG → WebP via Python Pillow) ───────────────────
convert_images() {
  local files=()
  while IFS= read -r -d '' f; do files+=("$f"); done < \
    <(find "$KEEP" -maxdepth 1 \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) -print0 | sort -z)

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "  (no images found in Keep)"
    return
  fi

  python3 - "$FORCE" "$KEEP" "$OUT" "${files[@]}" <<'PYEOF'
import sys, os
from PIL import Image

force   = sys.argv[1] == "1"
keep    = sys.argv[2]
out_dir = sys.argv[3]
files   = sys.argv[4:]

for src in files:
    name = os.path.splitext(os.path.basename(src))[0]
    dest = os.path.join(out_dir, name + ".webp")
    if os.path.exists(dest) and not force:
        print(f"  — skip (exists): {os.path.basename(dest)}")
        continue
    img = Image.open(src).convert("RGBA")
    img.save(dest, "WEBP", lossless=True, quality=100, method=6)
    kb = os.path.getsize(dest) // 1024
    print(f"  ✓ {os.path.basename(src)} → {os.path.basename(dest)} ({kb}KB)")
PYEOF
}

# ── video conversion (MP4/MOV → web-optimised MP4 via ffmpeg) ─────────────
convert_videos() {
  local count=0
  while IFS= read -r -d '' src; do
    base=$(basename "$src")
    name="${base%.*}"
    dest="$OUT/${name,,}.mp4"           # lowercase output name
    lower_name="${name,,}"
    local -a ffmpeg_video_args=(
      -c:v libx264
      -preset fast
      -crf 23
      -movflags +faststart
      -pix_fmt yuv420p
      -an
    )

    # The landing intro is shown full-screen with object-fit: cover, so it
    # needs a denser web master than the rest of the short role clips.
    if [[ "$lower_name" == "the_role_room_intro" ]]; then
      ffmpeg_video_args=(
        -vf "scale=1080:1080:flags=lanczos,unsharp=5:5:0.8:3:3:0.4"
        -c:v libx264
        -preset slow
        -crf 18
        -movflags +faststart
        -pix_fmt yuv420p
        -an
      )
    fi

    if [[ -f "$dest" && "$FORCE" -eq 0 ]]; then
      echo "  — skip (exists): $(basename "$dest")"
      continue
    fi

    echo "  ⟳  converting: $base → $(basename "$dest")"
    "$FFMPEG" -y -i "$src" \
      "${ffmpeg_video_args[@]}" \
      "$dest" 2>/dev/null
    kb=$(du -k "$dest" | cut -f1)
    echo "  ✓ done: $(basename "$dest") (${kb}KB)"
    (( count++ )) || true
  done < <(find "$KEEP" -maxdepth 1 \( -iname "*.mp4" -o -iname "*.mov" \) -print0 | sort -z)

  [[ $count -eq 0 ]] && echo "  (no new videos to convert)"
}

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Role Room Asset Converter                  ║"
echo "╚══════════════════════════════════════════════╝"
echo "  Source : $KEEP"
echo "  Output : $OUT"
[[ $FORCE -eq 1 ]] && echo "  Mode   : FORCE (overwrite existing)"
echo ""

echo "▸ Images (PNG/JPG → WebP)"
convert_images
echo ""

echo "▸ Videos (MP4/MOV → H.264 MP4)"
convert_videos
echo ""

echo "✅  Done."
