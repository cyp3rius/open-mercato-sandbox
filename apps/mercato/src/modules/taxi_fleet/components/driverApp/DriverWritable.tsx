'use client'

import * as React from 'react'
import { useDriverAppMode } from './useDriverAppMode'

/** Renders children only when not in impersonation read-only mode. Must be used under DriverShell. */
export function DriverWritable({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { readOnly } = useDriverAppMode()
  if (readOnly) return <>{fallback}</>
  return <>{children}</>
}
