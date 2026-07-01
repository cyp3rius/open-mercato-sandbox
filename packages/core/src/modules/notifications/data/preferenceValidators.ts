import { z } from 'zod'

export const saveNotificationPreferencesSchema = z.object({
  preferences: z.record(z.string(), z.boolean()),
})

export type SaveNotificationPreferencesInput = z.infer<typeof saveNotificationPreferencesSchema>
