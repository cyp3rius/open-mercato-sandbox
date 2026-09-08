#!/usr/bin/env python3
"""Parse Fakturownia XLS export → JSON (stdout). Local-only helper for import script."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def cell_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if value == int(value):
            return str(int(value))
        return str(value).strip()
    return str(value).strip()


def digits_only(value) -> str:
    return re.sub(r"\D", "", cell_str(value))


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: parse-fakturownia-xls.py <path-to.xls>", file=sys.stderr)
        return 2

    xls_path = Path(sys.argv[1]).expanduser().resolve()
    if not xls_path.exists():
        print(f"File not found: {xls_path}", file=sys.stderr)
        return 1

    try:
        import xlrd
    except ImportError:
        print("Missing xlrd. Install with: python3 -m venv .venv && .venv/bin/pip install xlrd", file=sys.stderr)
        return 1

    wb = xlrd.open_workbook(str(xls_path))
    sh = wb.sheet_by_index(0)
    headers = [cell_str(sh.cell_value(0, c)) for c in range(sh.ncols)]

    rows = []
    for r in range(1, sh.nrows):
        raw = {headers[c]: sh.cell_value(r, c) for c in range(sh.ncols)}
        row = {
            "rowNumber": r,
            "fakturowniaId": cell_str(raw.get("ID")),
            "shortName": cell_str(raw.get("Nazwa skrócona")),
            "clientName": cell_str(raw.get("Klient")),
            "taxIdRaw": cell_str(raw.get("Numer NIP")),
            "taxIdDigits": digits_only(raw.get("Numer NIP")),
            "city": cell_str(raw.get("Miejscowość")),
            "postalCode": cell_str(raw.get("Kod pocztowy")),
            "street": cell_str(raw.get("Ulica")),
            "country": cell_str(raw.get("Kraj")),
            "correspondenceAddress": cell_str(raw.get("Adres korespondencyjny")),
            "isCompanyFlag": raw.get("Firma") in (1, 1.0, "1", True),
            "email": cell_str(raw.get("E-mail")),
            "website": cell_str(raw.get("Strona WWW")),
            "phone": cell_str(raw.get("Telefon")),
            "mobile": cell_str(raw.get("Tel.kom.")),
            "fax": cell_str(raw.get("Fax")),
            "firstName": cell_str(raw.get("Imię")),
            "lastName": cell_str(raw.get("Nazwisko")),
            "bankName": cell_str(raw.get("Bank")),
            "bankAccount": cell_str(raw.get("Numer rachunku")),
            "bankAccountSuffix": cell_str(
                raw.get("Indywidualne konto bankowe (lub końcówka konta)")
            ),
            "extraDescription": cell_str(raw.get("Dodatkowy opis")),
            "clientCode": cell_str(raw.get("ID klienta")),
            "role": cell_str(raw.get("Rola podmiotu 3")),
        }
        rows.append(row)

    json.dump({"source": str(xls_path), "sheet": sh.name, "rows": rows}, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
