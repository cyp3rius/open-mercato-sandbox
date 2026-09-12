# Partner Programs Module — Agent Guidelines

Partner loyalty and B2B agreement programs tied to CRM partner entities (distinct from procurement suppliers).

## MUST Rules

1. **MUST link memberships to `customerEntityId`** — CRM partner companies/people
2. **MUST accrue incentives from sales events** — subscribers on order created/updated
3. **MUST use `incentivePercent` (0–100) and `incentiveBase` (`net` | `gross`)** on program definition
4. **MUST expose CRM detail widget** — `widgets/injection/partner-incentives`
5. **MUST record payouts via dedicated API** — `/api/partner_programs/incentives/payout`

## Key Reference Files

| When you need | Copy from |
|---------------|-----------|
| Programs list | `backend/partner_programs/programs/page.tsx` |
| Program detail | `backend/partner_programs/programs/[id]/page.tsx` |
| CRM injection widget | `widgets/injection/partner-incentives/` |
| Accrual subscribers | `subscribers/` (sales order events) |
| ACL / setup | `acl.ts`, `setup.ts` |

## Data Model

- **PartnerProgram** — validity, incentive rules
- **Membership** — partner entity + optional role
- **Incentive ledger** — accrual and payout entries

## Relations

- **customers** — memberships and detail tab widget
- **sales** — accrual from orders/invoices
- **currencies** — ledger currency

## Operator documentation

- Module guide: [`.ai/module-guides/partner-programs.md`](../../../../.ai/module-guides/partner-programs.md)
