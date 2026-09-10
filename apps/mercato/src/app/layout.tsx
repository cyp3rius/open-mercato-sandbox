import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import '@/.mercato/generated/module-package-sources.css'
import { bootstrap } from '@/bootstrap'
import { AppProviders } from '@/components/AppProviders'

// Bootstrap all package registrations at module load time
bootstrap()
import { detectLocale, loadDictionary } from '@open-mercato/shared/lib/i18n/server'
import { resolveAppBranding } from '@open-mercato/shared/lib/branding'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { faviconSrc, documentTitle } = resolveAppBranding({ fallbackName: 'Open Mercato' })
  return {
    title: documentTitle,
    description: 'AI-supportive, modular ERP foundation for product & service companies',
    applicationName: 'RSMoto CRM',
    appleWebApp: {
      capable: true,
      title: 'RSMoto CRM',
      statusBarStyle: 'default',
    },
    icons: {
      icon: faviconSrc,
      apple: '/brand/apple-touch-icon.png',
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await detectLocale()
  const dict = await loadDictionary(locale)
  const demoModeEnabled = process.env.DEMO_MODE !== 'false'
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          key="om-theme-init"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('om-theme');
                  var theme = stored === 'dark' ? 'dark'
                    : stored === 'light' ? 'light'
                    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  if (theme === 'dark') document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning data-gramm="false">
        <AppProviders locale={locale} dict={dict} demoModeEnabled={demoModeEnabled}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
