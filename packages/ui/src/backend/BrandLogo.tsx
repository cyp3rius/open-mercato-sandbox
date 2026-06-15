"use client"

import Image from 'next/image'
import { cn } from '@open-mercato/shared/lib/utils'
import { DEFAULT_BRAND_LOGO_SRC } from '@open-mercato/shared/lib/branding'

type BrandLogoProps = {
  src?: string | null
  alt: string
  variant?: 'sidebar' | 'sidebarCompact' | 'mobile' | 'inline' | 'hero'
  className?: string
}

const VARIANT_CLASS: Record<NonNullable<BrandLogoProps['variant']>, string> = {
  sidebar: 'm-4 h-8 w-auto max-w-[168px] object-contain',
  sidebarCompact: 'h-8 w-8 object-contain',
  mobile: 'h-7 w-auto max-w-[140px] object-contain',
  inline: 'h-8 w-auto max-w-[160px] object-contain',
  hero: 'h-auto w-full max-w-[240px] object-contain',
}

const VARIANT_SIZE: Record<NonNullable<BrandLogoProps['variant']>, { width: number; height: number }> = {
  sidebar: { width: 168, height: 32 },
  sidebarCompact: { width: 32, height: 32 },
  mobile: { width: 140, height: 28 },
  inline: { width: 160, height: 32 },
  hero: { width: 240, height: 64 },
}

export function BrandLogo({
  src,
  alt,
  variant = 'sidebar',
  className,
}: BrandLogoProps) {
  const resolvedSrc = src?.trim() || DEFAULT_BRAND_LOGO_SRC
  const size = VARIANT_SIZE[variant]

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={size.width}
      height={size.height}
      className={cn('shrink-0', VARIANT_CLASS[variant], className)}
      priority={variant === 'inline' ? false : true}
    />
  )
}
