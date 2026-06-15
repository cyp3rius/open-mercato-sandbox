import { resolveAppBranding } from '@open-mercato/shared/lib/branding'
import LoginPageClient from './login-page-client'

export default function LoginPage() {
  const branding = resolveAppBranding({ fallbackName: 'Open Mercato' })

  return (
    <LoginPageClient
      logoSrc={branding.logoSrc}
      logoAlt={branding.documentTitle}
      brandName={branding.productName}
    />
  )
}
