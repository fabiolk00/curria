describe('candidate scoring closure refinement', () => {
  it('prefers the metric closure instead of dying before the percentage', () => {
    const text = 'Reduced processing time by 40% for core batch workloads.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Reduced processing time', 'metric_impact'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Reduced processing time by 40%')
  })

  it('prefers the zero-downtime closure instead of stopping after the verb phrase', () => {
    const text = 'Delivered migrations with zero downtime during weekend cutovers.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Delivered migrations', 'action_result'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Delivered migrations with zero downtime')
  })

  it('absorbs quantified client closure when compact and semantically attached', () => {
    const text = 'Built data pipelines for 3 enterprise clients across finance.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Built data pipelines', 'action_result'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Built data pipelines for 3 enterprise clients')
  })

  it('does not absorb a broad long tail after a good metric closure', () => {
    const text = 'Reduced latency by 40% in batch pipelines across LATAM and shared support teams.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Reduced latency', 'metric_impact'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Reduced latency by 40%')
  })

  it('does not end on a weak prepositional tail when a better closure exists slightly later', () => {
    const text = 'Improved throughput with zero downtime for payroll processing.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Improved throughput', 'metric_impact'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Improved throughput with zero downtime')
  })

  it('keeps the current span when the continuation is broad and weak', () => {
    const text = 'Built reporting infrastructure for the operations team across all LATAM regions.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Built reporting infrastructure', 'action_result'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Built reporting infrastructure')
  })

  it('fallback highlight also benefits from the same deterministic closure logic', () => {
    const text = 'Generated annual savings by 25% with warehouse process redesign.'
    const items = [{
      itemId: 'exp_fallback_metric',
      section: 'experience' as const,
      text,
    }]

    const resolved = validateAndResolveHighlights(items, [])
    expect(resolved).toEqual([{
      itemId: 'exp_fallback_metric',
      section: 'experience',
      ranges: [
        buildRange(text, 'Generated annual savings by 25%', 'metric_impact'),
      ],
    }])
  })
})
