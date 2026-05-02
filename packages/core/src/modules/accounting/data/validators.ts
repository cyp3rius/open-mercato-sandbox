import { z } from 'zod'
import { ACCOUNTING_INVOICE_KINDS } from '../lib/constants'
import { normalizeBankAccountNumberForStorage } from '../lib/bankAccountLookup'
import { ACCOUNTING_INVOICE_NUMBERING_MODE_IDS } from '../lib/sellingEntityConstants'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const accountingInvoiceKindSchema = z.enum(ACCOUNTING_INVOICE_KINDS)
export const accountingPaymentMethodSchema = z.enum(['cash', 'transfer', 'card'])

const lineItemSchema = z.object({
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  quantity: z.union([z.string(), z.number()]).transform((value) => String(value)),
  unitPriceNet: z.union([z.string(), z.number()]).transform((value) => String(value)),
  taxRate: z.union([z.string(), z.number()]).transform((value) => String(value)),
})

const baseInvoiceSchema = z.object({
  documentNumber: z.string().trim().min(1),
  documentKind: accountingInvoiceKindSchema,
  issueDate: z.string().regex(dateRegex, 'Expected YYYY-MM-DD date format'),
  salesDate: z.string().regex(dateRegex, 'Expected YYYY-MM-DD date format').optional().nullable(),
  paymentDueDate: z.string().regex(dateRegex, 'Expected YYYY-MM-DD date format').optional().nullable(),
  paymentTermDays: z.coerce.number().int().positive().optional().nullable(),
  paymentMethod: accountingPaymentMethodSchema.optional().nullable(),
  paymentAccount: z.string().trim().optional().nullable(),
  sellerEntityId: z.uuid().optional().nullable(),
  sellerName: z.string().trim().optional().nullable(),
  sellerNip: z.string().trim().optional().nullable(),
  sellerRegon: z.string().trim().optional().nullable(),
  sellerAddress: z.string().trim().optional().nullable(),
  buyerEntityId: z.uuid().optional().nullable(),
  buyerName: z.string().trim().optional().nullable(),
  buyerNip: z.string().trim().optional().nullable(),
  buyerRegon: z.string().trim().optional().nullable(),
  buyerAddress: z.string().trim().optional().nullable(),
  lineItems: z.array(lineItemSchema).optional().nullable(),
  title: z.string().trim().optional().nullable(),
  counterpartyName: z.string().trim().optional().nullable(),
  externalReference: z.string().trim().optional().nullable(),
  currencyCode: z.string().trim().max(3).optional().nullable(),
  totalAmount: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((value) => {
      if (value === null || value === undefined || value === '') return null
      return String(value)
    }),
  sourceSystem: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  isDraft: z.boolean().optional(),
})

export const accountingInvoiceCreateSchema = baseInvoiceSchema.extend({
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const accountingInvoiceUpdateSchema = baseInvoiceSchema.partial().extend({
  id: z.uuid(),
})

export const accountingInvoiceDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
})

export type AccountingInvoiceCreateInput = z.infer<typeof accountingInvoiceCreateSchema>
export type AccountingInvoiceUpdateInput = z.infer<typeof accountingInvoiceUpdateSchema>
export type AccountingInvoiceDeleteInput = z.infer<typeof accountingInvoiceDeleteSchema>

const bankAccountLineSchema = z.object({
  accountNumber: z
    .string()
    .transform((s) => normalizeBankAccountNumberForStorage(String(s ?? '')))
    .refine((s) => s.length > 0, { message: 'Account number is required' }),
  label: z.string().trim().optional().nullable(),
  currencyCode: z.string().trim().max(3).optional().nullable(),
  isDefault: z.boolean().optional().nullable(),
})

const sellingEntityBase = z.object({
  name: z.string().trim().min(1),
  nip: z.string().trim().optional().nullable(),
  regon: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  bankAccounts: z.array(bankAccountLineSchema).optional().nullable(),
  invoiceNumberingMode: z.enum(ACCOUNTING_INVOICE_NUMBERING_MODE_IDS),
  invoiceNumberingCustom: z.string().trim().optional().nullable(),
})

export const accountingSellingEntityCreateSchema = sellingEntityBase
  .extend({
    organizationId: z.uuid(),
    tenantId: z.uuid(),
  })
  .superRefine((val, ctx) => {
    if (val.invoiceNumberingMode === 'custom' && !String(val.invoiceNumberingCustom ?? '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom numbering template is required',
        path: ['invoiceNumberingCustom'],
      })
    }
  })

export const accountingSellingEntityUpdateSchema = sellingEntityBase
  .partial()
  .extend({
    id: z.uuid(),
    organizationId: z.uuid(),
    tenantId: z.uuid(),
  })
  .superRefine((val, ctx) => {
    if (val.invoiceNumberingMode === 'custom' && val.invoiceNumberingCustom !== undefined) {
      if (!String(val.invoiceNumberingCustom ?? '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Custom numbering template is required',
          path: ['invoiceNumberingCustom'],
        })
      }
    }
  })

export const accountingSellingEntityDeleteSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().optional(),
  tenantId: z.uuid().optional(),
})

export type AccountingSellingEntityCreateInput = z.infer<typeof accountingSellingEntityCreateSchema>
export type AccountingSellingEntityUpdateInput = z.infer<typeof accountingSellingEntityUpdateSchema>
export type AccountingSellingEntityDeleteInput = z.infer<typeof accountingSellingEntityDeleteSchema>
