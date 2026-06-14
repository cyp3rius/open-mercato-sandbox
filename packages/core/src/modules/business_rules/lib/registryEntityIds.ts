import { E } from '#generated/entities.ids.generated'

function walkRegistry(node: unknown, out: Set<string>): void {
  if (typeof node === 'string') {
    if (node.includes(':')) {
      out.add(node)
    }
    return
  }
  if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node)) {
      walkRegistry(value, out)
    }
  }
}

export function collectRegisteredEntityTypeIds(): string[] {
  const out = new Set<string>()
  walkRegistry(E as Record<string, unknown>, out)
  return Array.from(out).sort((left, right) => left.localeCompare(right))
}
