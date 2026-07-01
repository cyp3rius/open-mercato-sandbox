export const CASES_PROCEDURE_NOTIFY_OWNER_MESSAGE_TYPE = 'cases.procedureNotify.owner'
export const CASES_PROCEDURE_NOTIFY_CUSTOMER_MESSAGE_TYPE = 'cases.procedureNotify.customer'

export function isProcedureNotifyMessageType(type: string): boolean {
  return (
    type === CASES_PROCEDURE_NOTIFY_OWNER_MESSAGE_TYPE
    || type === CASES_PROCEDURE_NOTIFY_CUSTOMER_MESSAGE_TYPE
  )
}

export function isProcedureNotifyOwnerMessageType(type: string): boolean {
  return type === CASES_PROCEDURE_NOTIFY_OWNER_MESSAGE_TYPE
}

export function isProcedureNotifyCustomerMessageType(type: string): boolean {
  return type === CASES_PROCEDURE_NOTIFY_CUSTOMER_MESSAGE_TYPE
}
