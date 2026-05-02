/** Zapis i payload: co najwyżej jedno `isDefault: true`, pozostałe `null`. */
export function normalizeBankAccountLinesAtMostOneDefault<
  T extends { isDefault?: boolean | null },
>(lines: T[]): T[] {
  let assigned = false
  return lines.map((line) => {
    const on = line.isDefault === true && !assigned
    if (on) assigned = true
    return { ...line, isDefault: on ? true : null } as T
  })
}

/** Wersja robocza formularza (`isDefault` jako boolean). */
export function normalizeDraftBankAccountsSingleDefault<T extends { isDefault: boolean }>(rows: T[]): T[] {
  let assigned = false
  return rows.map((row) => {
    const on = row.isDefault === true && !assigned
    if (on) assigned = true
    return { ...row, isDefault: on }
  })
}
