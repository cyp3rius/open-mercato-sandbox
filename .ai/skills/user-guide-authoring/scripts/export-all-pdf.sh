#!/usr/bin/env bash
# Export all Polish user guide MDX files to PDF.
# Usage: export-all-pdf.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORT_ONE="$SCRIPT_DIR/export-pdf.sh"
PL_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)/apps/docs/docs/user-guide/pl"

if [[ ! -x "$EXPORT_ONE" ]]; then
  echo "Missing export-pdf.sh at $EXPORT_ONE" >&2
  exit 1
fi

shopt -s nullglob
files=("$PL_DIR"/*.mdx)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No MDX files in $PL_DIR" >&2
  exit 1
fi

failed=0
for f in "${files[@]}"; do
  base="$(basename "$f" .mdx)"
  if [[ "$base" == "overview" || "$base" == "accounting" ]]; then
    continue
  fi
  echo "Exporting: $base"
  if ! "$EXPORT_ONE" "$base"; then
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo "Some exports failed (is pandoc installed?)." >&2
  exit 1
fi

echo "All exports completed."

"$SCRIPT_DIR/merge-pdf.sh"
