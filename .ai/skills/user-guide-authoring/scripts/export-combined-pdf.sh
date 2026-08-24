#!/usr/bin/env bash
# Build combined PL user guide PDF with table of contents (single pandoc run).
# Usage: export-combined-pdf.sh [output-filename]
# Default: apps/docs/static/manuals/pl/codzienna-praca-pelna.pdf
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
PL_DIR="$REPO_ROOT/apps/docs/docs/user-guide/pl"
OUT_DIR="$REPO_ROOT/apps/docs/static/manuals/pl"
OUT_NAME="${1:-codzienna-praca-pelna.pdf}"
OUTPUT="$OUT_DIR/$OUT_NAME"

MODULES=(
  dashboard
  messages
  workflows-tasks
  customers
  partner-programs
  sales-simple
  catalog-products
  resources
  procurement
  cases
  playbooks
  insurance-desk
)

strip_mdx() {
  awk '
    BEGIN { in_front=0; done_front=0 }
    /^---$/ { if (!done_front) { in_front=!in_front; if (!in_front) done_front=1; next } }
    in_front { next }
    /^import / { next }
    /^<[A-Z]/ { next }
    { print }
  ' "$1"
}

if ! command -v pandoc >/dev/null 2>&1; then
  echo "pandoc is required. Install: https://pandoc.org/installing.html" >&2
  exit 1
fi

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

mkdir -p "$OUT_DIR"
TMP="$(mktemp "${TMPDIR:-/tmp}/om-guide-combined-XXXXXX.md")"
trap 'rm -f "$TMP"' EXIT

{
  cat <<'EOF'
---
title: "Instrukcja obsługi Open Mercato"
subtitle: "Moduły menu Codzienna praca"
lang: pl-PL
---

Instrukcja dla osób nietechnicznych korzystających z panelu administracyjnego. Moduły floty taxi i księgowości nie są objęte tym dokumentem.

EOF

  first=1
  for slug in "${MODULES[@]}"; do
    input="$PL_DIR/${slug}.mdx"
    if [[ ! -f "$input" ]]; then
      echo "Missing: $input" >&2
      exit 1
    fi
    if [[ "$first" -eq 0 ]]; then
      printf '\n\\newpage\n\n'
    fi
    first=0
    strip_mdx "$input"
  done
} > "$TMP"

pandoc "$TMP" \
  -o "$OUTPUT" \
  --pdf-engine="$PDF_ENGINE" \
  --toc \
  --toc-depth=1 \
  -V toc-title="Spis treści" \
  -V lang=pl-PL \
  -V geometry:margin=2.5cm \
  -V documentclass=article \
  -V papersize=a4 \
  2>/dev/null || pandoc "$TMP" -o "$OUTPUT" --pdf-engine="$PDF_ENGINE" --toc --toc-depth=1

echo "Wrote: $OUTPUT (with table of contents)"
