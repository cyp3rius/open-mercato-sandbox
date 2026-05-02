import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { fetchCompanyFromMfVatRegistry } from '../../../lib/mfVatRegistry'
import { isValidNip, normalizeNipDigits } from '../../../lib/nip'
import { isValidRegon, normalizeRegonDigits } from '../../../lib/regon'

const bodySchema = z
  .object({
    nip: z.string().trim().optional(),
    regon: z.string().trim().optional(),
  })
  .refine((v) => (v.nip?.length ?? 0) > 0 || (v.regon?.length ?? 0) > 0, {
    message: 'Provide NIP or REGON',
  })

export const metadata = {
  POST: {
    requireAuth: true,
    /** VAT whitelist lookup: CRM company editors or accounting invoice flows (read-only public MF API). */
    requireAnyFeatures: ['customers.companies.manage', 'accounting.invoices.manage'],
  },
}

const successSchema = z.object({
  ok: z.literal(true),
  data: z
    .object({
      displayName: z.string(),
      legalName: z.string(),
      nip: z.string().nullable(),
      regon: z.string().nullable(),
      addressLine1: z.string().nullable().optional(),
      postalCode: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
    })
    .nullable(),
})

const errorSchema = z.object({
  error: z.string(),
})

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide NIP or REGON' }, { status: 400 })
  }

  const nipRaw = parsed.data.nip?.length ? normalizeNipDigits(parsed.data.nip) : null
  const regonRaw = parsed.data.regon?.length ? normalizeRegonDigits(parsed.data.regon) : null

  if (nipRaw && (!nipRaw || nipRaw.length !== 10 || !isValidNip(nipRaw))) {
    return NextResponse.json({ error: 'Invalid NIP' }, { status: 400 })
  }
  if (regonRaw && (!regonRaw || !isValidRegon(regonRaw))) {
    return NextResponse.json({ error: 'Invalid REGON' }, { status: 400 })
  }

  try {
    const data = await fetchCompanyFromMfVatRegistry({
      nip: nipRaw ?? undefined,
      regon: nipRaw ? undefined : regonRaw ?? undefined,
    })
    if (!data) {
      return NextResponse.json({ ok: true as const, data: null })
    }
    return NextResponse.json({ ok: true as const, data })
  } catch {
    return NextResponse.json({ error: 'Registry request failed' }, { status: 502 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Customers',
  summary: 'Lookup company in Polish VAT whitelist (MF API)',
  methods: {
    POST: {
      summary: 'Fetch company data by NIP or REGON',
      description:
        'Calls the public Ministry of Finance VAT whitelist API (wl-api.mf.gov.pl). Rate limits apply.',
      body: bodySchema,
      responses: [
        { status: 200, description: 'Lookup result (data null if not found)', schema: successSchema },
        { status: 400, description: 'Validation error', schema: errorSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 502, description: 'Upstream error', schema: errorSchema },
      ],
    },
  },
}
