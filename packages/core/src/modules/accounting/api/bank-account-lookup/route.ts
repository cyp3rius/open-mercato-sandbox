import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { lookupBankAccountStructured } from '../../lib/bankAccountLookup'

const bodySchema = z.object({
  accountNumber: z.string().max(96),
})

export const metadata = {
  POST: {
    requireAuth: true,
    requireAnyFeatures: [
      'accounting.settings.view',
      'accounting.settings.manage',
      'accounting.invoices.view',
      'accounting.invoices.manage',
    ],
  },
}

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'accountNumber is required' }, { status: 400 })
  }

  const out = lookupBankAccountStructured(parsed.data.accountNumber)
  return NextResponse.json(out)
}
