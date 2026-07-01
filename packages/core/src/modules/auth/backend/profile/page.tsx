'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function ProfilePage() {
  const t = useT()

  return (
    <section className="max-w-2xl space-y-2 rounded-lg border bg-background p-6">
      <h2 className="text-lg font-semibold">{t('profile.page.title', 'Profile')}</h2>
      <p className="text-sm text-muted-foreground">
        {t('profile.page.selectItem', 'Select an item from the menu to manage your account.')}
      </p>
    </section>
  )
}
