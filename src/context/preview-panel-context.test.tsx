import React, { useEffect, useState } from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'

import { PreviewPanelProvider, usePreviewPanel } from './preview-panel-context'

function CacheHarness() {
  const { getCachedUrl, invalidateCache, setCachedUrl } = usePreviewPanel()
  const [, setTick] = useState(0)

  useEffect(() => {
    setCachedUrl('first', 'https://example.com/first.pdf')
    setCachedUrl('second', 'https://example.com/second.pdf')
    invalidateCache('first')
    setTick(1)
  }, [invalidateCache, setCachedUrl])

  return (
    <>
      <div data-testid="first">{getCachedUrl('first') ?? 'missing'}</div>
      <div data-testid="second">{getCachedUrl('second') ?? 'missing'}</div>
    </>
  )
}

describe('PreviewPanelContext', () => {
  it('invalidates only the requested cache entry', () => {
    render(
      <PreviewPanelProvider>
        <CacheHarness />
      </PreviewPanelProvider>,
    )

    expect(screen.getByTestId('first')).toHaveTextContent('missing')
    expect(screen.getByTestId('second')).toHaveTextContent('https://example.com/second.pdf')
  })
})
