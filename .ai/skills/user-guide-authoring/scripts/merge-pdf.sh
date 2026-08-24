#!/usr/bin/env bash
# Merge PL user guides into codzienna-praca-pelna.pdf (with table of contents).
# Delegates to export-combined-pdf.sh for correct TOC + page numbers.
# Usage: merge-pdf.sh [output-filename]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_NAME="${1:-codzienna-praca-pelna.pdf}"

exec "$SCRIPT_DIR/export-combined-pdf.sh" "$OUT_NAME"
