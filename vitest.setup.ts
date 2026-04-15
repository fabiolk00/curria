import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver
