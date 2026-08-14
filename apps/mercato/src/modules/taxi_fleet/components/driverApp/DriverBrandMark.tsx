'use client'

type Props = {
  className?: string
  /** Compact mark for app chrome. */
  compact?: boolean
}

export function DriverBrandMark({ className, compact = false }: Props) {
  return (
    <img
      src="/driver/logo-rs-moto-taxi.svg"
      alt="RS Moto Taxi"
      className={className ?? (compact ? 'h-10 w-auto' : 'h-16 w-auto')}
      width={compact ? 48 : 96}
      height={compact ? 40 : 64}
      decoding="async"
    />
  )
}
