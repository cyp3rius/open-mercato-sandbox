const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<number, Set<string>>()

export async function isPublicHolidayPl(date: string): Promise<boolean> {
  const year = new Date(`${date}T12:00:00`).getFullYear()
  let holidays = cache.get(year)

  if (!holidays) {
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PL`)
      if (!res.ok) throw new Error(`Nager API ${res.status}`)
      const data = (await res.json()) as Array<{ date: string }>
      holidays = new Set(data.map((entry) => entry.date))
      cache.set(year, holidays)
      setTimeout(() => cache.delete(year), CACHE_MS)
    } catch {
      return false
    }
  }

  return holidays.has(date)
}
