"use client"

import * as React from 'react'

export type PolicyCreateLeadMergeResult = 'merged' | 'cancelled'

export type PolicyCreateLeadMergeContextValue = {
  /**
   * Called when the user picks a lead in the combobox (non-empty). Should confirm, fetch, and remount form with merged values.
   */
  mergeLeadFromPicker: (nextLeadId: string, previousLeadId: string) => Promise<PolicyCreateLeadMergeResult>
}

const PolicyCreateLeadMergeContext = React.createContext<PolicyCreateLeadMergeContextValue | null>(null)

export function PolicyCreateLeadMergeProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: PolicyCreateLeadMergeContextValue
}) {
  return <PolicyCreateLeadMergeContext.Provider value={value}>{children}</PolicyCreateLeadMergeContext.Provider>
}

export function usePolicyCreateLeadMerge(): PolicyCreateLeadMergeContextValue | null {
  return React.useContext(PolicyCreateLeadMergeContext)
}
