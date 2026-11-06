/**
 * Lazy PDF viewer chunk entry.
 *
 * The panel shell loads this file through the DSH module loader's
 * `require.async('./client.pdf.js')` and renders the named `PdfPanel` export
 * inside a sized container. The chunk owns PDF.js, its dedicated worker, the
 * page surfaces, the text layer, and the selection context menu so the plugin's
 * startup bundle stays small.
 *
 * Only `react`, `react-dom`, and `pdfjs-dist` are imported: this module never
 * depends on host platform modules.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PassageActionKind, PdfViewerLabels, PdfViewerModule, PdfViewerProps } from './types'
import { openPdf } from './runtime'
import { PDF_BASE_SCALE, renderPdfPage, type PdfPageSize } from './render'
import { pdfTextRenderer, type PdfTextLayer } from './text'
import viewerCss from './viewer.css'

/** Stylesheet element id shared by every mounted viewer. */
const STYLESHEET_ID = 'dsh-pdf-panel/viewer'

/** Inject the chunk's stylesheet once, at module import time. */
function installViewerStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLESHEET_ID) !== null) return
  const tag = document.createElement('style')
  tag.id = STYLESHEET_ID
  tag.dataset.plugin = 'dsh-pdf-panel'
  tag.textContent = viewerCss
  document.head.appendChild(tag)
}

installViewerStyles()

/** Zoom range offered by the toolbar. */
const MIN_ZOOM = 0.2
const MAX_ZOOM = 5
/** Multiplier of one zoom-in / zoom-out step. */
const ZOOM_STEP = 1.25
/** Fit-width never magnifies a page beyond actual size. */
const FIT_WIDTH_MAX = 1
/** Horizontal + vertical page inset inside the scrollport. */
const PAGES_PADDING = 12
/** Aspect ratio used by placeholders before a page has been rendered. */
const PLACEHOLDER_ASPECT = '3 / 4'
/** Render pages up to one viewport outside the visible area. */
const RENDER_AHEAD_MARGIN = '100% 0px'
/** Raster re-render delay after the last zoom change (text scales immediately). */
const ZOOM_SETTLE_MS = 120
/** How long the copy confirmation stays in the selection menu. */
const COPIED_FEEDBACK_MS = 1400

type ZoomMode = { readonly kind: 'fit' } | { readonly kind: 'fixed'; readonly zoom: number }

type DocumentState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly document: PDFDocumentProxy }
  | { readonly status: 'failed'; readonly error: Error }

interface SelectionMenuState {
  readonly text: string
  readonly x: number
  readonly y: number
}

/** @returns `value` clamped to `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Round a zoom value to whole percentages so repeated steps stay stable. */
function roundZoom(value: number): number {
  return Math.round(value * 100) / 100
}

/** @returns an `Error` view of an arbitrary rejection reason. */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/** @returns the localized failure sentence for one load/render error. */
function failureMessage(error: Error, labels: PdfViewerLabels): string {
  const message = error.message.trim() !== '' ? error.message : error.name
  return labels.failed(message)
}

/** Trim NUL characters and surrounding whitespace from a raw selection. */
function normalizePassage(raw: string): string {
  return raw.replace(/\u0000/g, '').trim()
}

/** Copy text with the async clipboard API, falling back to a selection hack. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    const clipboard: Clipboard | undefined = navigator.clipboard
    if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
      await clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path; the async API can be blocked by permissions.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    return copied
  } catch {
    return false
  }
}

/**
 * Track a value that settles only after `delay` ms of quiet.
 * @param value - live value.
 * @param delay - settle delay in milliseconds.
 * @returns the settled value.
 */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => { setSettled(value) }, delay)
    return () => { clearTimeout(timer) }
  }, [value, delay])
  return settled
}

interface PdfPageViewProps {
  readonly document: PDFDocumentProxy
  readonly pageNumber: number
  readonly totalPages: number
  readonly displayZoom: number
  readonly renderZoom: number
  readonly scrollRoot: HTMLElement | null
  readonly labels: PdfViewerLabels
  readonly placeholderAspect: string
  readonly eager: boolean
  readonly register: (page: number, node: HTMLDivElement | null) => void
}

type PageRenderState = 'idle' | 'rendering' | 'ready' | 'failed'

/**
 * One page surface: lazy canvas raster plus the selectable PDF.js text layer.
 * Re-renders only when the settled zoom changes and the page is near the
 * viewport; the text layer is built once and scales with the page box.
 */
function PdfPageView(props: PdfPageViewProps): ReactNode {
  const { document, pageNumber, totalPages, displayZoom, renderZoom, scrollRoot, labels, placeholderAspect, eager, register } = props
  const hostRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textHostRef = useRef<HTMLDivElement | null>(null)
  const textLayerRef = useRef<PdfTextLayer | undefined>(undefined)
  const renderedZoom = useRef<number | undefined>(undefined)
  const pending = useRef(Promise.resolve())
  const [size, setSize] = useState<PdfPageSize>()
  const [state, setState] = useState<PageRenderState>('idle')
  const [failure, setFailure] = useState<Error>()
  const [attempt, setAttempt] = useState(0)
  const [requested, setRequested] = useState(eager)
  const [visible, setVisible] = useState(false)

  // Lazy raster: request a page once it comes within one viewport of the reader.
  useEffect(() => {
    const node = hostRef.current
    if (node === null) return
    if (typeof IntersectionObserver === 'undefined') {
      setRequested(true)
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      const intersecting = entries.some(entry => entry.isIntersecting)
      setVisible(intersecting)
      if (intersecting) setRequested(true)
    }, { root: scrollRoot, rootMargin: RENDER_AHEAD_MARGIN })
    observer.observe(node)
    return () => { observer.disconnect() }
  }, [scrollRoot])

  // Current-page tracking in the parent observes the same host nodes.
  useEffect(() => {
    const node = hostRef.current
    if (node === null) return
    register(pageNumber, node)
    return () => { register(pageNumber, null) }
  }, [register, pageNumber])

  // Canvas rasterization; serialized per page so cancelled tasks finish first.
  // The first raster uses the live zoom (already settled when pages mount); later
  // rasters wait for the debounced zoom so wheel gestures stay cheap.
  const targetZoom = renderedZoom.current === undefined ? displayZoom : renderZoom
  useEffect(() => {
    if (!requested) return
    if (renderedZoom.current === targetZoom) return
    // Zoomed-off pages keep their previous bitmap until they scroll back near.
    if (renderedZoom.current !== undefined && !visible) return
    const canvas = canvasRef.current
    const textHost = textHostRef.current
    if (canvas === null || textHost === null) return
    setFailure(undefined)
    setState(previous => (previous === 'ready' ? previous : 'rendering'))
    const lifetime = new AbortController()
    let newText: PdfTextLayer | undefined
    pending.current = pending.current.then(async () => {
      if (lifetime.signal.aborted) return
      const buffer = window.document.createElement('canvas')
      try {
        const rendered = await renderPdfPage(
          document,
          pageNumber,
          buffer,
          lifetime.signal,
          window.devicePixelRatio * targetZoom,
          textLayerRef.current === undefined
            ? (page, viewport) => {
                newText = pdfTextRenderer(textHost)(page, viewport)
                return newText
              }
            : undefined,
        )
        if (lifetime.signal.aborted) return
        const context = canvas.getContext('2d')
        if (context === null) throw new Error('PDF canvas has no 2D context')
        canvas.width = buffer.width
        canvas.height = buffer.height
        context.drawImage(buffer, 0, 0)
        if (textLayerRef.current === undefined) {
          textLayerRef.current = newText
          newText = undefined
        }
        renderedZoom.current = targetZoom
        setSize(rendered)
        setState('ready')
      } catch (error) {
        if (!lifetime.signal.aborted) {
          setFailure(toError(error))
          setState('failed')
        }
      } finally {
        buffer.width = 0
        buffer.height = 0
        newText?.cancel()
      }
    })
    return () => { lifetime.abort() }
  }, [requested, visible, targetZoom, document, pageNumber, attempt])

  // Text follows the live zoom immediately; the raster catches up when settled.
  useLayoutEffect(() => {
    textLayerRef.current?.sync()
  }, [displayZoom, size])

  useEffect(() => () => {
    textLayerRef.current?.cancel()
    textLayerRef.current = undefined
  }, [])

  const sizerStyle: CSSProperties = size === undefined
    ? { aspectRatio: placeholderAspect }
    : { width: `${size.width * displayZoom}px`, height: `${size.height * displayZoom}px` }
  const hasBitmap = size !== undefined

  return (
    <div
      ref={hostRef}
      className="dsh-pdf-viewer__page"
      data-dsh-pdf-page={pageNumber}
      data-dsh-pdf-page-state={state}
    >
      <div className="dsh-pdf-viewer__sizer" style={sizerStyle}>
        <div className="dsh-pdf-viewer__surface">
          <canvas
            ref={canvasRef}
            className="dsh-pdf-viewer__canvas"
            role="img"
            aria-label={labels.pageOf(pageNumber, totalPages)}
          />
          <div ref={textHostRef} className="dsh-pdf-viewer__text" data-dsh-pdf-text />
        </div>
        {!hasBitmap && <div className="dsh-pdf-viewer__placeholder" aria-hidden="true" />}
        {requested && !hasBitmap && state !== 'failed' && (
          <div className="dsh-pdf-viewer__spinner" role="status" aria-label={labels.loading} />
        )}
        {state === 'failed' && (
          <div className="dsh-pdf-viewer__page-error" role="alert">
            <span>{failureMessage(failure ?? new Error(String(labels.loading)), labels)}</span>
            <button type="button" className="dsh-pdf-viewer__retry" onClick={() => { setAttempt(value => value + 1) }}>
              {labels.retry}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Centered loading / failure surface used by the document-level states. */
function ViewerStatus(props: {
  readonly message: string
  readonly busy?: boolean
  readonly inline?: boolean
  readonly action?: ReactNode
}): ReactNode {
  const classes = props.inline === true
    ? 'dsh-pdf-viewer__status dsh-pdf-viewer__status--inline'
    : 'dsh-pdf-viewer__status'
  return (
    <div className={classes} role={props.busy === true ? 'status' : 'alert'}>
      {props.busy === true && (
        <div className="dsh-pdf-viewer__spinner dsh-pdf-viewer__spinner--large" aria-hidden="true" />
      )}
      <span className="dsh-pdf-viewer__status-message">{props.message}</span>
      {props.action}
    </div>
  )
}

/** Compact inline icons used by the toolbar. */
function Icon(props: { readonly children: ReactNode }): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {props.children}
    </svg>
  )
}

/**
 * Render the complete right-sidebar PDF reader.
 * @param props - complete PDF bytes, file name, localized copy, and the passage callback.
 * @returns the reader filling its container.
 */
export function PdfPanel(props: PdfViewerProps): ReactNode {
  const { bytes, labels, onPassageAction } = props
  const [attempt, setAttempt] = useState(0)
  const [documentState, setDocumentState] = useState<DocumentState>({ status: 'loading' })
  const [baseSize, setBaseSize] = useState<PdfPageSize>()
  const [mode, setMode] = useState<ZoomMode>({ kind: 'fit' })
  const [scrollport, setScrollport] = useState<HTMLDivElement | null>(null)
  const [scrollportWidth, setScrollportWidth] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [menu, setMenu] = useState<SelectionMenuState>()
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuPointerDown = useRef(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pageNodes = useRef(new Map<number, HTMLDivElement>())

  const pageCount = documentState.status === 'ready' ? documentState.document.numPages : 0

  // ---- Loading the document -------------------------------------------------

  useEffect(() => {
    let disposed = false
    const lifetime = new AbortController()
    setDocumentState({ status: 'loading' })
    setBaseSize(undefined)
    setCurrentPage(1)
    setMenu(undefined)
    const session = openPdf(bytes, lifetime.signal, (error) => {
      if (!disposed) setDocumentState({ status: 'failed', error })
    })
    session.document.then(
      (document) => { if (!disposed) setDocumentState({ status: 'ready', document }) },
      (error: unknown) => { if (!disposed) setDocumentState({ status: 'failed', error: toError(error) }) },
    )
    return () => {
      disposed = true
      lifetime.abort()
      void session.dispose()
    }
  }, [bytes, attempt])

  // Intrinsic page size drives fit-width, page navigation, and placeholders.
  useEffect(() => {
    if (documentState.status !== 'ready') return
    let disposed = false
    const document = documentState.document
    document.getPage(1).then(
      (page) => {
        if (disposed) return
        const viewport = page.getViewport({ scale: PDF_BASE_SCALE })
        setBaseSize({ width: viewport.width, height: viewport.height })
      },
      () => {
        if (disposed) return
        // Fall back to US Letter so an unreadable first page cannot block layout.
        setBaseSize({ width: 612 * PDF_BASE_SCALE, height: 792 * PDF_BASE_SCALE })
      },
    )
    return () => { disposed = true }
  }, [documentState])

  // ---- Scrollport sizing and zoom ------------------------------------------

  const attachScrollport = useCallback((node: HTMLDivElement | null): void => {
    setScrollport(node)
  }, [])

  useLayoutEffect(() => {
    if (scrollport === null) return
    const measure = (): void => { setScrollportWidth(scrollport.clientWidth) }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(scrollport)
    return () => { observer.disconnect() }
  }, [scrollport])

  const fitZoom = useMemo((): number => {
    if (baseSize === undefined || baseSize.width <= 0 || scrollportWidth <= 0) return FIT_WIDTH_MAX
    const available = scrollportWidth - PAGES_PADDING * 2
    return clamp(available / baseSize.width, MIN_ZOOM, FIT_WIDTH_MAX)
  }, [baseSize, scrollportWidth])
  const zoom = mode.kind === 'fit' ? fitZoom : mode.zoom
  const renderZoom = useDebounced(zoom, ZOOM_SETTLE_MS)

  const setFixedZoom = useCallback((value: number): void => {
    setMode({ kind: 'fixed', zoom: roundZoom(clamp(value, MIN_ZOOM, MAX_ZOOM)) })
  }, [])
  const zoomIn = useCallback((): void => { setFixedZoom(zoom * ZOOM_STEP) }, [setFixedZoom, zoom])
  const zoomOut = useCallback((): void => { setFixedZoom(zoom / ZOOM_STEP) }, [setFixedZoom, zoom])
  const fitWidth = useCallback((): void => { setMode({ kind: 'fit' }) }, [])
  const actualSize = useCallback((): void => { setFixedZoom(1) }, [setFixedZoom])

  // ---- Current page tracking -----------------------------------------------

  const registerPage = useCallback((page: number, node: HTMLDivElement | null): void => {
    if (node === null) pageNodes.current.delete(page)
    else pageNodes.current.set(page, node)
  }, [])

  const pagesReady = documentState.status === 'ready' && baseSize !== undefined && scrollportWidth > 0

  useEffect(() => {
    if (scrollport === null || pageCount === 0) return
    let frame = 0
    const update = (): void => {
      frame = 0
      const marker = scrollport.getBoundingClientRect().top + scrollport.clientHeight * 0.35
      let page = 1
      for (let number = 1; number <= pageCount; number += 1) {
        const node = pageNodes.current.get(number)
        if (node === undefined) continue
        if (node.getBoundingClientRect().top <= marker) page = number
        else break
      }
      setCurrentPage(previous => (previous === page ? previous : page))
    }
    const schedule = (): void => {
      if (frame !== 0) return
      frame = requestAnimationFrame(update)
    }
    update()
    scrollport.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      scrollport.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [scrollport, pageCount, pagesReady, zoom])

  const scrollToPage = useCallback((page: number): void => {
    if (pageCount === 0) return
    const next = clamp(Math.round(page), 1, pageCount)
    const node = pageNodes.current.get(next)
    if (node === undefined) return
    node.scrollIntoView({ block: 'start' })
    setCurrentPage(next)
  }, [pageCount])

  // ---- Selection context menu ----------------------------------------------

  const readSelection = useCallback((): { readonly text: string } | undefined => {
    const root = rootRef.current
    if (root === null || typeof window.getSelection !== 'function') return undefined
    const selection = window.getSelection()
    if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return undefined
    const range = selection.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return undefined
    const text = normalizePassage(selection.toString())
    if (text === '') return undefined
    return { text }
  }, [])

  const closeMenu = useCallback((): void => {
    setMenu(undefined)
    setCopied(false)
  }, [])

  const handleContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>): void => {
    const root = rootRef.current
    if (menuRef.current !== null && event.target instanceof Node && menuRef.current.contains(event.target)) {
      event.preventDefault()
      return
    }
    const read = readSelection()
    if (root === null || read === undefined) {
      closeMenu()
      return
    }
    event.preventDefault()
    const bounds = root.getBoundingClientRect()
    setCopied(false)
    setMenu({ text: read.text, x: event.clientX - bounds.left, y: event.clientY - bounds.top })
  }, [closeMenu, readSelection])

  // Position the menu inside the viewer once its measured size is known.
  useLayoutEffect(() => {
    if (menu === undefined) return
    const node = menuRef.current
    const root = rootRef.current
    if (node === null || root === null) return
    const margin = 8
    const left = clamp(menu.x, margin, Math.max(margin, root.clientWidth - node.offsetWidth - margin))
    const top = clamp(menu.y, margin, Math.max(margin, root.clientHeight - node.offsetHeight - margin))
    node.style.left = `${left}px`
    node.style.top = `${top}px`
  }, [menu])

  useEffect(() => {
    if (menu === undefined) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target instanceof Node ? event.target : null
      const inside = target !== null && menuRef.current !== null && menuRef.current.contains(target)
      menuPointerDown.current = inside
      if (inside) return
      closeMenu()
    }
    const onPointerUp = (): void => { menuPointerDown.current = false }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      closeMenu()
    }
    const onSelectionChange = (): void => {
      if (menuPointerDown.current) return
      if (readSelection() === undefined) closeMenu()
    }
    const onScroll = (): void => { closeMenu() }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [menu, closeMenu, readSelection])

  useEffect(() => () => {
    if (copyTimer.current !== undefined) clearTimeout(copyTimer.current)
  }, [])

  const runPassageAction = useCallback((kind: PassageActionKind): void => {
    if (menu === undefined) return
    const text = menu.text
    closeMenu()
    onPassageAction(kind, text)
  }, [closeMenu, menu, onPassageAction])

  const copyPassage = useCallback((): void => {
    if (menu === undefined) return
    void writeClipboard(menu.text).then((done) => {
      if (!done || menuRef.current === null) return
      setCopied(true)
      if (copyTimer.current !== undefined) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => {
        copyTimer.current = undefined
        setCopied(false)
      }, COPIED_FEEDBACK_MS)
    })
  }, [menu])

  // ---- Render ---------------------------------------------------------------

  const placeholderAspect = baseSize === undefined
    ? PLACEHOLDER_ASPECT
    : `${baseSize.width} / ${baseSize.height}`
  const zoomPercent = Math.round(zoom * 100)
  const pageLabel = pageCount > 0 ? labels.pageOf(Math.min(currentPage, pageCount), pageCount) : ''
  const documentFailed = documentState.status === 'failed'

  return (
    <div
      ref={rootRef}
      className="dsh-pdf-viewer"
      role="region"
      aria-label={props.fileName}
      data-dsh-pdf-viewer
      data-dsh-pdf-state={documentState.status}
      data-dsh-pdf-current-page={currentPage}
      data-dsh-pdf-pages={pageCount}
      data-dsh-pdf-zoom={zoomPercent}
      data-dsh-pdf-zoom-mode={mode.kind}
      data-dsh-pdf-selection={menu?.text}
      onContextMenu={handleContextMenu}
    >
      <div className="dsh-pdf-viewer__toolbar" role="toolbar" aria-label={pageLabel !== '' ? pageLabel : labels.loading}>
        <button
          type="button"
          className="dsh-pdf-viewer__button"
          data-dsh-pdf-page-prev
          title={pageCount > 0 ? labels.pageOf(Math.max(1, currentPage - 1), pageCount) : undefined}
          aria-label={pageCount > 0 ? labels.pageOf(Math.max(1, currentPage - 1), pageCount) : labels.loading}
          disabled={currentPage <= 1}
          onClick={() => { scrollToPage(currentPage - 1) }}
        >
          <Icon><path d="M4 10l4-4 4 4" /></Icon>
        </button>
        <span className="dsh-pdf-viewer__page-label" data-dsh-pdf-page-label>{pageLabel}</span>
        <button
          type="button"
          className="dsh-pdf-viewer__button"
          data-dsh-pdf-page-next
          title={pageCount > 0 ? labels.pageOf(Math.min(pageCount, currentPage + 1), pageCount) : undefined}
          aria-label={pageCount > 0 ? labels.pageOf(Math.min(pageCount, currentPage + 1), pageCount) : labels.loading}
          disabled={pageCount === 0 || currentPage >= pageCount}
          onClick={() => { scrollToPage(currentPage + 1) }}
        >
          <Icon><path d="M4 6l4 4 4-4" /></Icon>
        </button>
        <span className="dsh-pdf-viewer__separator" aria-hidden="true" />
        <button
          type="button"
          className="dsh-pdf-viewer__button"
          data-dsh-pdf-zoom-out
          title={labels.zoomOut}
          aria-label={labels.zoomOut}
          disabled={zoom <= MIN_ZOOM}
          onClick={zoomOut}
        >
          <Icon><path d="M3 8h10" /></Icon>
        </button>
        <span className="dsh-pdf-viewer__zoom-label" data-dsh-pdf-zoom-label>{zoomPercent}%</span>
        <button
          type="button"
          className="dsh-pdf-viewer__button"
          data-dsh-pdf-zoom-in
          title={labels.zoomIn}
          aria-label={labels.zoomIn}
          disabled={zoom >= MAX_ZOOM}
          onClick={zoomIn}
        >
          <Icon><path d="M3 8h10M8 3v10" /></Icon>
        </button>
        <button
          type="button"
          className="dsh-pdf-viewer__button"
          data-dsh-pdf-fit-width
          data-active={mode.kind === 'fit'}
          title={labels.fitWidth}
          aria-label={labels.fitWidth}
          aria-pressed={mode.kind === 'fit'}
          onClick={fitWidth}
        >
          <Icon><path d="M4 3v10M12 3v10M5 8h6M6.5 6.2L4.7 8l1.8 1.8M9.5 6.2L11.3 8l-1.8 1.8" /></Icon>
        </button>
        <button
          type="button"
          className="dsh-pdf-viewer__button"
          data-dsh-pdf-actual-size
          data-active={mode.kind === 'fixed' && Math.abs(zoom - 1) < 0.005}
          title={labels.actualSize}
          aria-label={labels.actualSize}
          onClick={actualSize}
        >
          1:1
        </button>
        <span className="dsh-pdf-viewer__hint" title={labels.selectionHint}>{labels.selectionHint}</span>
      </div>
      <div className="dsh-pdf-viewer__stage">
        {documentState.status === 'loading' && <ViewerStatus busy message={labels.loading} />}
        {documentFailed && (
          <ViewerStatus
            message={failureMessage(documentState.error, labels)}
            action={(
              <button type="button" className="dsh-pdf-viewer__retry" onClick={() => { setAttempt(value => value + 1) }}>
                {labels.retry}
              </button>
            )}
          />
        )}
        {documentState.status === 'ready' && (
          <div className="dsh-pdf-viewer__scrollport" ref={attachScrollport} data-dsh-pdf-scrollport>
            {pagesReady
              ? (
                <div className="dsh-pdf-viewer__pages" data-dsh-pdf-pages-container>
                  {Array.from({ length: pageCount }, (_, index) => {
                    const pageNumber = index + 1
                    return (
                      <PdfPageView
                        key={pageNumber}
                        document={documentState.document}
                        pageNumber={pageNumber}
                        totalPages={pageCount}
                        displayZoom={zoom}
                        renderZoom={renderZoom}
                        scrollRoot={scrollport}
                        labels={labels}
                        placeholderAspect={placeholderAspect}
                        eager={pageNumber === 1}
                        register={registerPage}
                      />
                    )
                  })}
                </div>
              )
              : <ViewerStatus busy inline message={labels.loading} />}
          </div>
        )}
      </div>
      {menu !== undefined && (
        <div
          ref={menuRef}
          className="dsh-pdf-viewer__menu"
          role="menu"
          data-dsh-pdf-menu
          data-selection-text={menu.text}
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className="dsh-pdf-viewer__menu-item"
            role="menuitem"
            data-dsh-pdf-action="explain"
            onClick={() => { runPassageAction('explain') }}
          >
            {labels.actionExplain}
          </button>
          <button
            type="button"
            className="dsh-pdf-viewer__menu-item"
            role="menuitem"
            data-dsh-pdf-action="translate"
            onClick={() => { runPassageAction('translate') }}
          >
            {labels.actionTranslate}
          </button>
          <div className="dsh-pdf-viewer__menu-separator" role="separator" />
          <button
            type="button"
            className={copied ? 'dsh-pdf-viewer__menu-item dsh-pdf-viewer__menu-item--copied' : 'dsh-pdf-viewer__menu-item'}
            role="menuitem"
            data-dsh-pdf-action="copy"
            data-dsh-pdf-copied={copied}
            onClick={copyPassage}
          >
            {copied ? labels.copied : labels.actionCopy}
          </button>
        </div>
      )}
    </div>
  )
}

export type { PdfViewerModule }
