'use client'

import React from 'react'
import { RefreshCw } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const THRESHOLD_PX = 68
const MAX_PULL_PX = 112
const RESISTANCE = 0.42

type RefreshFn = () => void | Promise<void>

type PullContextValue = {
  registerPageRefresh: (fn: RefreshFn | null) => void
  runPageRefresh: () => Promise<void>
}

const DriverPullToRefreshContext = React.createContext<PullContextValue | null>(null)

function getWindowScrollTop(): number {
  if (typeof window === 'undefined') return 0
  return window.scrollY || document.documentElement.scrollTop || 0
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function useRegisterDriverPullToRefresh(onRefresh: RefreshFn): void {
  const ctx = React.useContext(DriverPullToRefreshContext)
  const onRefreshRef = React.useRef(onRefresh)
  onRefreshRef.current = onRefresh

  React.useEffect(() => {
    if (!ctx) return
    const wrapped: RefreshFn = () => onRefreshRef.current()
    ctx.registerPageRefresh(wrapped)
    return () => ctx.registerPageRefresh(null)
  }, [ctx])
}

type ProviderProps = {
  children: React.ReactNode
}

export function DriverPullToRefreshProvider({ children }: ProviderProps) {
  const pageRefreshRef = React.useRef<RefreshFn | null>(null)

  const registerPageRefresh = React.useCallback((fn: RefreshFn | null) => {
    pageRefreshRef.current = fn
  }, [])

  const runPageRefresh = React.useCallback(async () => {
    const pageRefresh = pageRefreshRef.current
    if (pageRefresh) await pageRefresh()
  }, [])

  const contextValue = React.useMemo<PullContextValue>(
    () => ({ registerPageRefresh, runPageRefresh }),
    [registerPageRefresh, runPageRefresh],
  )

  return (
    <DriverPullToRefreshContext.Provider value={contextValue}>
      {children}
    </DriverPullToRefreshContext.Provider>
  )
}

type GestureProps = {
  children: React.ReactNode
  onShellRefresh: RefreshFn
}

export function DriverPullToRefresh({ children, onShellRefresh }: GestureProps) {
  const ctx = React.useContext(DriverPullToRefreshContext)
  const onShellRefreshRef = React.useRef(onShellRefresh)
  onShellRefreshRef.current = onShellRefresh

  const runRefresh = React.useCallback(async () => {
    await onShellRefreshRef.current()
    await ctx?.runPageRefresh()
  }, [ctx])

  return <DriverPullToRefreshGesture onRefresh={runRefresh}>{children}</DriverPullToRefreshGesture>
}

type InnerGestureProps = {
  children: React.ReactNode
  onRefresh: () => Promise<void>
}

function DriverPullToRefreshGesture({ children, onRefresh }: InnerGestureProps) {
  const t = useT()
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const startYRef = React.useRef(0)
  const pullingRef = React.useRef(false)
  const refreshingRef = React.useRef(false)
  const pullPxRef = React.useRef(0)

  const [pullPx, setPullPx] = React.useState(0)
  const [refreshing, setRefreshing] = React.useState(false)
  const [armed, setArmed] = React.useState(false)
  const [animating, setAnimating] = React.useState(false)

  const applyPull = React.useCallback((rawDelta: number) => {
    const next = Math.min(MAX_PULL_PX, Math.max(0, rawDelta * RESISTANCE))
    pullPxRef.current = next
    setPullPx(next)
    setArmed(next >= THRESHOLD_PX)
  }, [])

  const resetPull = React.useCallback((withTransition: boolean) => {
    if (withTransition) setAnimating(true)
    pullPxRef.current = 0
    setPullPx(0)
    setArmed(false)
    if (withTransition) {
      window.setTimeout(() => setAnimating(false), 220)
    }
  }, [])

  const finishRefresh = React.useCallback(async () => {
    refreshingRef.current = true
    setRefreshing(true)
    setArmed(true)
    setAnimating(true)
    pullPxRef.current = THRESHOLD_PX
    setPullPx(THRESHOLD_PX)
    try {
      await onRefresh()
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
      resetPull(true)
    }
  }, [onRefresh, resetPull])

  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const onTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current) return
      if (event.touches.length !== 1) return
      if (isEditableTarget(event.target)) return
      if (getWindowScrollTop() > 1) return
      pullingRef.current = true
      startYRef.current = event.touches[0].clientY
      setAnimating(false)
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return
      if (event.touches.length !== 1) return
      if (getWindowScrollTop() > 1) {
        pullingRef.current = false
        resetPull(false)
        return
      }
      const delta = event.touches[0].clientY - startYRef.current
      if (delta <= 0) {
        if (pullPxRef.current > 0) resetPull(false)
        return
      }
      if (event.cancelable) event.preventDefault()
      applyPull(delta)
    }

    const onTouchEnd = () => {
      if (!pullingRef.current) return
      pullingRef.current = false
      if (refreshingRef.current) return
      if (pullPxRef.current >= THRESHOLD_PX) {
        void finishRefresh()
        return
      }
      resetPull(true)
    }

    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchmove', onTouchMove, { passive: false })
    node.addEventListener('touchend', onTouchEnd)
    node.addEventListener('touchcancel', onTouchEnd)
    return () => {
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchmove', onTouchMove)
      node.removeEventListener('touchend', onTouchEnd)
      node.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [applyPull, finishRefresh, resetPull])

  const visible = pullPx > 2 || refreshing
  const progress = Math.min(1, pullPx / THRESHOLD_PX)
  const iconRotation = refreshing ? 0 : progress * 180
  const label = refreshing
    ? t('taxi_fleet.driverApp.refreshing', 'Refreshing…')
    : t('taxi_fleet.driverApp.pullToRefresh', 'Pull to refresh')

  return (
    <div
      ref={containerRef}
      className="relative overscroll-y-contain"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{ height: Math.max(pullPx, refreshing ? THRESHOLD_PX : 0) }}
        aria-hidden={!visible}
      >
        <div
          className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm transition-[opacity,transform,border-color,color] duration-150 ${
            visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          } ${armed || refreshing ? 'border-[#B2E1FF] text-[#1B84FF]' : 'border-[#F1F1F4] text-[#78829D]'}`}
          role="status"
          aria-live="polite"
          aria-label={label}
        >
          <RefreshCw
            className={`size-5 ${refreshing ? 'animate-spin' : ''}`}
            style={
              refreshing
                ? undefined
                : {
                    transform: `rotate(${iconRotation}deg)`,
                    transition: animating ? 'transform 200ms ease' : undefined,
                  }
            }
            aria-hidden
            strokeWidth={2.25}
          />
        </div>
      </div>

      <div
        className={animating || refreshing ? 'transition-transform duration-200 ease-out' : undefined}
        style={{ transform: pullPx > 0 || refreshing ? `translateY(${pullPx}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  )
}
