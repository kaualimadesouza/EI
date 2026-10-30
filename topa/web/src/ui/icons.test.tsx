import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  CategoryIcon,
  CloseIcon,
  DineInIcon,
  MinusIcon,
  PlusIcon,
  TakeAwayIcon,
} from './icons'

describe('icons', () => {
  it('renders CategoryIcon for preset and custom categories', () => {
    const presets = ['combos', 'lanches', 'salgados', 'bebidas', 'doces']
    for (const cat of presets) {
      const { container } = render(<CategoryIcon category={cat} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    }

    const { container: custom } = render(<CategoryIcon category="especiais" />)
    expect(custom.querySelector('svg')).toBeInTheDocument()
  })

  it('renders all action and navigation icons', () => {
    const { container: dineIn } = render(<DineInIcon />)
    expect(dineIn.querySelector('svg')).toBeInTheDocument()

    const { container: takeAway } = render(<TakeAwayIcon />)
    expect(takeAway.querySelector('svg')).toBeInTheDocument()

    const { container: close } = render(<CloseIcon />)
    expect(close.querySelector('svg')).toBeInTheDocument()

    const { container: plus } = render(<PlusIcon />)
    expect(plus.querySelector('svg')).toBeInTheDocument()

    const { container: minus } = render(<MinusIcon />)
    expect(minus.querySelector('svg')).toBeInTheDocument()
  })
})
