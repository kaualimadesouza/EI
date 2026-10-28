import { describe, expect, it, vi } from 'vitest'

import { WebWakeLock } from './web-wake-lock'

/** A page whose visibility the test flips, as the lock screen or another app would. */
class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'

  show(state: DocumentVisibilityState) {
    this.visibilityState = state
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

function sentinel() {
  return { release: vi.fn(() => Promise.resolve()) }
}

function fakeWakeLock(...answers: Promise<ReturnType<typeof sentinel>>[]) {
  const request = vi.fn()
  for (const answer of answers) request.mockReturnValueOnce(answer)
  return { request }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('WebWakeLock', () => {
  it('keeps the screen on at once and lets it go when released', async () => {
    const granted = sentinel()
    const wakeLock = fakeWakeLock(Promise.resolve(granted))

    const release = new WebWakeLock(wakeLock, new FakePage()).hold()
    await settle()
    release()

    expect(wakeLock.request).toHaveBeenCalledExactlyOnceWith('screen')
    expect(granted.release).toHaveBeenCalledOnce()
  })

  it('asks again each time the page comes back, never while it is hidden, and keeps one lock', async () => {
    const page = new FakePage()
    page.visibilityState = 'hidden'
    const first = sentinel()
    const second = sentinel()
    const wakeLock = fakeWakeLock(Promise.resolve(first), Promise.resolve(second))

    const release = new WebWakeLock(wakeLock, page).hold()
    page.show('hidden')
    expect(wakeLock.request).not.toHaveBeenCalled()
    page.show('visible')
    await settle()
    page.show('visible')
    await settle()

    expect(wakeLock.request).toHaveBeenCalledTimes(2)
    expect(first.release).toHaveBeenCalledOnce()
    release()
    expect(second.release).toHaveBeenCalledOnce()
    page.show('visible')
    expect(wakeLock.request).toHaveBeenCalledTimes(2)
  })

  it('lets go of a lock granted after the pager already released it', async () => {
    let grant: (granted: ReturnType<typeof sentinel>) => void = () => {}
    const late = sentinel()
    const wakeLock = fakeWakeLock(new Promise((resolve) => (grant = resolve)))

    new WebWakeLock(wakeLock, new FakePage()).hold()()
    grant(late)
    await settle()

    expect(late.release).toHaveBeenCalledOnce()
  })

  it('tries again when the page comes back after the device refused, as on battery saver', async () => {
    const page = new FakePage()
    const granted = sentinel()
    const wakeLock = fakeWakeLock(Promise.reject(new DOMException('battery saver', 'NotAllowedError')), Promise.resolve(granted))

    const release = new WebWakeLock(wakeLock, page).hold()
    await settle()
    page.show('visible')
    await settle()
    release()

    expect(wakeLock.request).toHaveBeenCalledTimes(2)
    expect(granted.release).toHaveBeenCalledOnce()
  })
})
