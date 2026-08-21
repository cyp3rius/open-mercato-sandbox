'use client'

import React from 'react'

/**
 * Driver PWA is always light (Metronic-style). System/OS dark mode must not
 * tint shadcn tokens (dialogs, buttons) while the shell uses fixed light colors.
 */
export function useDriverForcedLightTheme(): void {
  React.useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.remove('dark')
    root.dataset.driverForcedLight = hadDark ? '1' : '0'
    return () => {
      if (root.dataset.driverForcedLight === '1') {
        root.classList.add('dark')
      }
      delete root.dataset.driverForcedLight
    }
  }, [])
}
