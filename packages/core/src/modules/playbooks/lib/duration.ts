import { z } from 'zod'

export const procedureDurationSchema = z.object({
  amount: z.number().int().positive(),
  unit: z.enum(['hours', 'days', 'weeks', 'months']),
})

export type ProcedureDuration = z.infer<typeof procedureDurationSchema>

export function addDurationToDate(date: Date, duration: ProcedureDuration): Date {
  const result = new Date(date)
  switch (duration.unit) {
    case 'hours':
      result.setHours(result.getHours() + duration.amount)
      break
    case 'days':
      result.setDate(result.getDate() + duration.amount)
      break
    case 'weeks':
      result.setDate(result.getDate() + duration.amount * 7)
      break
    case 'months':
      result.setMonth(result.getMonth() + duration.amount)
      break
  }
  return result
}
