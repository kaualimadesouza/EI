import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BrandMark } from './BrandMark'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function tapMark(times: number, gapMs: number) {
  for (let i = 0; i < times; i += 1) {
    if (i > 0) act(() => vi.advanceTimersByTime(gapMs))
    fireEvent.click(screen.getByText('por TOPA'))
  }
}

describe('BrandMark', () => {
  it('shows the app version next to the TOPA mark', () => {
    render(<BrandMark label="por TOPA" className="" />)

    expect(screen.getByText('por TOPA')).toHaveTextContent(`v${__APP_VERSION__}`)
  })

  it('fires the staff gesture on five quick taps, and needs five more for the next', () => {
    const onStaffTaps = vi.fn()
    render(<BrandMark label="por TOPA" className="" onStaffTaps={onStaffTaps} />)

    tapMark(4, 300)
    expect(onStaffTaps).not.toHaveBeenCalled()
    tapMark(1, 300)
    expect(onStaffTaps).toHaveBeenCalledOnce()
    tapMark(4, 300)

    expect(onStaffTaps).toHaveBeenCalledOnce()
  })

  it('ignores taps spread over more than 2 s, as a customer touching the screen would', () => {
    const onStaffTaps = vi.fn()
    render(<BrandMark label="por TOPA" className="" onStaffTaps={onStaffTaps} />)

    tapMark(8, 600)

    expect(onStaffTaps).not.toHaveBeenCalled()
  })
})
