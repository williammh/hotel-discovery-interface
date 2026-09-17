/**
 * Browsers cap how many WebGL contexts a page may hold and block new ones once
 * a page has lost too many ("Web page caused context loss and was blocked").
 * Asking first turns that from a runtime crash into a fallback decision.
 */

/** Cached: the probe itself costs a context, so it runs at most once per page. */
let available: boolean | null = null

export function isWebGLAvailable(): boolean {
  if (available !== null) {
    return available
  }

  if (typeof document === "undefined") {
    return false
  }

  try {
    const canvas = document.createElement("canvas")
    const context =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null)

    available = context !== null

    // Hand the slot back immediately; the real renderer needs one of its own.
    context?.getExtension("WEBGL_lose_context")?.loseContext()
  } catch {
    available = false
  }

  return available
}

/** Forces the next call to probe again. Also the seam tests set support through. */
export function resetWebGLProbe(value: boolean | null = null): void {
  available = value
}
