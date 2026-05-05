export async function runWithConcurrencyLimit<TInput, TOutput>(
  items: readonly TInput[],
  maxConcurrent: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const limit = Math.max(1, Math.floor(maxConcurrent))
  const results = new Array<TOutput>(items.length)
  let nextIndex = 0

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index)
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runWorker(),
  )

  await Promise.all(workers)

  return results
}
