/**
 * Schedule work after the current request finishes when running under Next.js,
 * otherwise fall back to setImmediate. Avoids a static `next/server` import so
 * CLI bootstrap (commands → trip sync) does not hard-depend on Next runtime.
 */
export function scheduleAfterResponse(task: () => void): void {
  void import('next/server')
    .then((mod) => {
      const afterFn = (mod as { after?: (fn: () => void) => void }).after
      if (typeof afterFn === 'function') {
        afterFn(task)
        return
      }
      setImmediate(task)
    })
    .catch(() => {
      setImmediate(task)
    })
}
