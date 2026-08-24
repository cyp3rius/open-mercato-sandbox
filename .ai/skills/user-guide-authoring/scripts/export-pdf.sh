#!/usr/bin/env bash
# Export a Polish user guide MDX file to PDF via pandoc.
# Usage: export-pdf.sh <module-slug>
# Example: export-pdf.sh cases
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
SLUG="${1:-}"

if [[ -z "$SLUG" ]]; then
  echo "Usage: $0 <module-slug>" >&2
  echo "Example: $0 cases" >&2
  exit 1
fi

INPUT="$REPO_ROOT/apps/docs/docs/user-guide/pl/${SLUG}.mdx"
OUTPUT_DIR="$REPO_ROOT/apps/docs/static/manuals/pl"
OUTPUT="$OUTPUT_DIR/${SLUG}.pdf"

if [[ ! -f "$INPUT" ]]; then
  echo "Input not found: $INPUT" >&2
  exit 1
fi

if ! command -v pandoc >/dev/null 2>&1; then
  echo "pandoc is required. Install: https://pandoc.org/installing.html" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Strip MDX frontmatter and JSX-only lines for pandoc markdown input
TMP="$(mktemp "${TMPDIR:-/tmp}/om-guide-XXXXXX.md")"
trap 'rm -f "$TMP"' EXIT

awk '
  BEGIN { in_front=0; done_front=0 }
  /^---$/ { if (!done_front) { in_front=!in_front; if (!in_front) done_front=1; next } }
  in_front { next }
  /^import / { next }
  /^<[A-Z]/ { next }
  { print }
' "$INPUT" > "$TMP"

PDF_ENGINE=""
for engine in tectonic xelatex pdflatex; do
  if command -v "$engine" >/dev/null 2>&1; then
    PDF_ENGINE="$engine"
    break
  fi
done

if [[ -z "$PDF_ENGINE" ]]; then
  echo "No PDF engine found. Install tectonic, xelatex, or pdflatex." >&2
  exit 1
fi

pandoc "$TMP" \
  -o "$OUTPUT" \
  --pdf-engine="$PDF_ENGINE" \
  -V lang=pl-PL \
  -V geometry:margin=2.5cm \
  -V documentclass=article \
  --metadata title="Open Mercato — ${SLUG}" \
  2>/dev/null || pandoc "$TMP" -o "$OUTPUT" --pdf-engine="$PDF_ENGINE"

echo "Wrote: $OUTPUT"
