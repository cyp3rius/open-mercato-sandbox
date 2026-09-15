import { z } from 'zod'

export const saveNotificationPreferencesSchema = z.object({
  preferences: z.record(z.string(), z.boolean()),
  pushPreferences: z.record(z.string(), z.boolean()).optional(),
})

export type SaveNotificationPreferencesInput = z.infer<typeof saveNotificationPreferencesSchema>
