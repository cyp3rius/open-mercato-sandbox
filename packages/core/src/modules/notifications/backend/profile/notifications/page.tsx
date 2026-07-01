'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'
import { NotificationPreferencesEditor } from '../../../components/NotificationPreferencesEditor'

export default function ProfileNotificationPreferencesPage() {
  const t = useT()

  return (
    <section className="max-w-5xl space-y-6 rounded-lg border bg-background p-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">
          {t('settings.profile.notifications', 'Notification Preferences')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('notifications.preferences.subtitle', 'Choose which actions should trigger in-app notifications for your account.')}
        </p>
      </header>
      <NotificationPreferencesEditor />
    </section>
  )
}
