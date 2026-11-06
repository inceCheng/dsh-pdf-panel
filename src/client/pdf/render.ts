/**
 * Canvas rendering of a single PDF page, with cancellation and page cleanup.
 *
 * Rendering happens into an exclusively owned buffer canvas so the currently
 * displayed bitmap survives re-renders (zoom changes, retries) until the new
 * one is complete. The buffer is then blitted into the page's visible canvas.
 */
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist'

/** CSS pixels per PDF unit at 100% zoom (96 dpi). */
export const PDF_BASE_SCALE = 96 / 72
/** Upper bound for one page's raster allocation; larger pages render at a lower ratio. */
const MAX_CANVAS_PIXELS = 16_777_216

/** Page geometry in CSS pixels at 100% zoom. */
export interface PdfPageSize {
  readonly width: number
  readonly height: number
}

/** Optional DOM text rendering that shares the canvas page's cleanup barrier. */
export type RenderPdfText = (page: PDFPageProxy, viewport: PageViewport) => {
  readonly promise: Promise<void>
  cancel(): void
}

/**
 * Render one page into an exclusively owned canvas.
 * Cancellation cannot write dimensions after a delayed `getPage`; active render
 * tasks are cancelled and awaited before the page is cleaned up.
 * @param document - loaded PDF.js document.
 * @param pageNumber - 1-based page number.
 * @param canvas - buffer canvas owned exclusively by this render.
 * @param signal - render lifetime.
 * @param pixelRatio - device pixel ratio multiplied by the settled display zoom.
 * @param renderText - optional selectable text layer sharing this page and viewport.
 * @returns the page's CSS dimensions at 100% zoom once rendering completes.
 */
export async function renderPdfPage(
  document: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
  pixelRatio: number,
  renderText?: RenderPdfText,
): Promise<PdfPageSize> {
  signal.throwIfAborted()
  const page: PDFPageProxy = await document.getPage(pageNumber)
  try {
    signal.throwIfAborted()
    const viewport = page.getViewport({ scale: PDF_BASE_SCALE })
    // Limit raster allocation without changing the page's display dimensions.
    const ratio = Math.min(pixelRatio, Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)))
    canvas.width = Math.max(1, Math.floor(viewport.width * ratio))
    canvas.height = Math.max(1, Math.floor(viewport.height * ratio))
    const task = page.render({
      canvas,
      viewport,
      transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
    })
    let text: ReturnType<RenderPdfText> | undefined
    let cancelled = false
    const cancel = (): void => {
      if (cancelled) return
      cancelled = true
      task.cancel()
      text?.cancel()
    }
    signal.addEventListener('abort', cancel, { once: true })
    try {
      text = renderText?.(page, viewport)
      if (signal.aborted) cancel()
      await Promise.all([task.promise, text?.promise])
      signal.throwIfAborted()
      return { width: viewport.width, height: viewport.height }
    } catch (error) {
      cancel()
      await Promise.allSettled([task.promise, text?.promise])
      throw error
    } finally {
      signal.removeEventListener('abort', cancel)
    }
  } finally {
    page.cleanup()
  }
}
