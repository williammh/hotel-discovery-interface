import { afterEach, beforeEach, vi } from "vitest"

/**
 * jsdom lays nothing out and measures nothing, so anything that positions
 * itself from its own box — the fallback map — reads zeroes. This hands it a
 * fixed viewport and the pointer-capture methods jsdom leaves unimplemented.
 */
export function stubViewport(width = 800, height = 600) {
  class ResizeObserverStub {
    constructor(private readonly callback: ResizeObserverCallback) {}

    observe(target: Element) {
      this.callback(
        [{ target, contentRect: { width, height } } as ResizeObserverEntry],
        this as unknown as ResizeObserver
      )
    }

    unobserve() {}
    disconnect() {}
  }

  const originalResizeObserver = globalThis.ResizeObserver
  const originalGetRect = Element.prototype.getBoundingClientRect

  beforeEach(() => {
    globalThis.ResizeObserver =
      ResizeObserverStub as unknown as typeof ResizeObserver

    Element.prototype.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
      } as DOMRect
    }

    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  })

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver
    Element.prototype.getBoundingClientRect = originalGetRect
  })

  return { width, height }
}
