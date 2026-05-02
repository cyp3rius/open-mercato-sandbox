'use client'

import { type CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatInvoiceNumberPreview } from '../lib/invoiceNumbering'

/**
 * Przykładowy numer faktury wg wybranego trybu (podgląd, nie zapisuje danych).
 */
export function InvoiceNumberingPreviewField({ values }: CrudCustomFieldRenderProps) {
  const t = useT()
  const mode = typeof values?.invoiceNumberingMode === 'string' ? values.invoiceNumberingMode : 'seq_only'
  const custom = typeof values?.invoiceNumberingCustom === 'string' ? values.invoiceNumberingCustom : ''
  const year = new Date().getFullYear()
  const example = formatInvoiceNumberPreview(mode, custom, year, 1)
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">
        {t('accounting.settings.entities.numberingPreview', 'Example')}:
      </span>{' '}
      <span className="font-mono text-foreground">{example}</span>
    </p>
  )
}
