#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
package_dir="$script_dir/post-agent-resolve"
output_path="${1:-$script_dir/dist/PostAgentResolve.mcpb}"
temporary_path="${output_path}.tmp"

mkdir -p "$(dirname "$output_path")"
rm -f "$temporary_path"

(
  cd "$package_dir"
  /usr/bin/zip -X -q -r "$temporary_path" manifest.json package.json LICENSE icon.svg server
)

/usr/bin/unzip -tq "$temporary_path" >/dev/null
mv "$temporary_path" "$output_path"
echo "$output_path"
