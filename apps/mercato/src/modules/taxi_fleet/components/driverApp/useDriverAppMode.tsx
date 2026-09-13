'use client'

import * as React from 'react'
import type { DriverImpersonationInfo } from '../../lib/driverImpersonation'

export type DriverAppModeValue = {
  readOnly: boolean
  impersonation: DriverImpersonationInfo | null
}

const DriverAppModeContext = React.createContext<DriverAppModeValue>({
  readOnly: false,
  impersonation: null,
})

export function DriverAppModeProvider({
  value,
  children,
}: {
  value: DriverAppModeValue
  children: React.ReactNode
}) {
  return <DriverAppModeContext.Provider value={value}>{children}</DriverAppModeContext.Provider>
}

export function useDriverAppMode(): DriverAppModeValue {
  return React.useContext(DriverAppModeContext)
}
