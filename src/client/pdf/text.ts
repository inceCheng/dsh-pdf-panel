/**
 * Selectable text overlay built by PDF.js's own `TextLayerBuilder`.
 *
 * The layer is rendered once per page at 100% zoom and then scaled with the
 * page box: PDF.js positions spans in percentages of the page and sizes their
 * fonts through CSS variables, so a single render follows every zoom without
 * re-fetching text content. `TextLayerBuilder` also installs the selection and
 * copy normalization the official viewer uses.
 */
// PDF.js's official viewer resolves its version-matched engine via this global.
import 'pdfjs-dist'
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs'
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist'

/** A mounted text overlay: one render promise, cancellation, and scale refitting. */
export interface PdfTextLayer {
  readonly promise: Promise<void>
  /** Re-fit the layer to its host after a zoom or panel-size change. */
  sync(): void
  cancel(): void
}

/**
 * Create the renderer that builds one page's selectable overlay in a host.
 * @param host - absolute overlay matching the page's displayed dimensions.
 * @returns a renderer whose promise resolves after the layer is attached.
 */
export function pdfTextRenderer(host: HTMLElement): (page: PDFPageProxy, viewport: PageViewport) => PdfTextLayer {
  return (page: PDFPageProxy, viewport: PageViewport): PdfTextLayer => {
    let cancelled = false
    // PDF.js measures text against document styles; appending is deferred until
    // the layer's layout is ready so no unstyled text is ever visible.
    const layer = new TextLayerBuilder({
      pdfPage: page,
      onAppend: () => {
        // A cancellation after layout but before this callback cannot stop the
        // builder's continuation, so drop the DOM instead of attaching it.
        if (cancelled) layer.cancel()
        else host.append(container)
      },
    })
    const container = layer.div
    container.style.setProperty('--total-scale-factor', String(viewport.scale * viewport.userUnit))
    container.style.setProperty('--scale-round-x', '1px')
    container.style.setProperty('--scale-round-y', '1px')
    const sync = (): void => {
      const width = host.getBoundingClientRect().width
      if (width > 0 && viewport.width > 0) container.style.scale = String(width / viewport.width)
    }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(sync)
    observer?.observe(host)
    sync()
    const promise = layer.render({ viewport } as Parameters<TextLayerBuilder['render']>[0])
    return {
      promise,
      sync,
      cancel(): void {
        cancelled = true
        observer?.disconnect()
        // Also releases the builder's shared selection listener after the last page leaves.
        layer.cancel()
        container.remove()
      },
    }
  }
}
