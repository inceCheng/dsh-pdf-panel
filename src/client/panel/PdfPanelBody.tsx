/** Right-sidebar tab body: drop/open a PDF, then render the lazy viewer. */
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type DragEvent, type ReactNode } from 'react'
import { FileTypeIcon } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionSlotProps, SidebarRightTabInfo, Translate } from '../api'
import { forgetDocument, storeDocument, storedDocument, type LoadedPdf } from './store'
import { insertPassage } from './prompt'
import type { PdfViewerLabels, PdfViewerProps } from '../pdf/types'

/** The DSH module loader's `require` also loads package-local lazy chunks. */
const loaderRequire = require as unknown as { async(specifier: string): Promise<unknown> }

const LazyPdfPanel = lazy(async () => {
  const chunk = (await loaderRequire.async('./client.pdf.js')) as { PdfPanel: ComponentType<PdfViewerProps> }
  return { default: chunk.PdfPanel }
})

/** Props injected by the right-sidebar body slot. */
export interface PdfPanelBodyProps extends SessionSlotProps {
  /** Framework hook carrying the live tab record. */
  readonly useTabInfo: () => SidebarRightTabInfo
  /** Plugin-localized copy. */
  readonly t: Translate
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

/** Boundary that keeps one failed viewer chunk from taking down the panel. */
class ViewerBoundary extends Component<{ readonly children: ReactNode; readonly fallback: (message: string) => ReactNode }, { readonly message?: string }> {
  override state: { readonly message?: string } = {}

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  override render(): ReactNode {
    if (this.state.message !== undefined) return this.props.fallback(this.state.message)
    return this.props.children
  }
}

/** Render the PDF panel for one right-sidebar tab. */
export function PdfPanelBody(props: PdfPanelBodyProps): ReactNode {
  const { useTabInfo, inputActions, t } = props
  const info = useTabInfo()
  const tabId = info.tab.id
  const [doc, setDoc] = useState<LoadedPdf | undefined>(() => storedDocument(tabId))
  const [epoch, setEpoch] = useState(0)
  const [error, setError] = useState<string>()
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragDepth = useRef(0)

  // One tab record owns one byte buffer; the record ending releases it.
  useEffect(() => {
    const signal = info.tab.signal
    const forget = (): void => { forgetDocument(tabId) }
    signal.addEventListener('abort', forget, { once: true })
    return () => { signal.removeEventListener('abort', forget) }
  }, [tabId, info.tab.signal])

  const openFile = useCallback(async (file: File): Promise<void> => {
    if (!isPdf(file)) {
      setError(t('unsupported'))
      return
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const next: LoadedPdf = { name: file.name, bytes }
      storeDocument(tabId, next)
      setDoc(next)
      setEpoch(value => value + 1)
      setError(undefined)
    } catch {
      setError(t('readFailed'))
    }
  }, [tabId, t])

  const pickFile = useCallback((): void => { inputRef.current?.click() }, [])

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>): void => {
    // Keep the drop away from the app-wide composer attachment targets: a PDF
    // dropped on this panel opens here, it does not become a chat attachment.
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = 0
    setDragActive(false)
    const files = Array.from(event.dataTransfer?.files ?? [])
    const pdf = files.find(isPdf)
    if (pdf === undefined) {
      if (files.length > 0) setError(t('unsupported'))
      return
    }
    void openFile(pdf)
  }, [openFile, t])

  const onDragEnter = useCallback((event: DragEvent<HTMLDivElement>): void => {
    if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current += 1
    setDragActive(true)
  }, [])

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragActive(false)
  }, [])

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
    if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const labels = useMemo<PdfViewerLabels>(() => ({
    loading: t('viewerLoading'),
    failed: message => t('viewerFailed', { message }),
    retry: t('retry'),
    pageOf: (page, total) => t('pageOf', { page, total }),
    zoomIn: t('zoomIn'),
    zoomOut: t('zoomOut'),
    fitWidth: t('fitWidth'),
    actualSize: t('actualSize'),
    actionExplain: t('actionExplain'),
    actionTranslate: t('actionTranslate'),
    actionCopy: t('actionCopy'),
    copied: t('copied'),
    selectionHint: t('selectionHint'),
  }), [t])

  const onPassageAction = useCallback((kind: 'explain' | 'translate', text: string): void => {
    insertPassage(inputActions, kind, text, t)
  }, [inputActions, t])

  return (
    <div
      className="dsh-pdf-panel"
      data-dsh-pdf-panel
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        data-dsh-pdf-file-input
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file !== undefined) void openFile(file)
        }}
      />
      {doc === undefined
        ? (
          <div className="dsh-pdf-panel__empty">
            <span className="dsh-pdf-panel__glyph"><FileTypeIcon kind="pdf" size={44} /></span>
            <div className="dsh-pdf-panel__empty-title">{t('emptyTitle')}</div>
            <div className="dsh-pdf-panel__empty-hint">{t('emptyHint')}</div>
            <button type="button" className="dsh-pdf-panel__primary" onClick={pickFile}>{t('chooseFile')}</button>
            <div className="dsh-pdf-panel__hint">{t('selectionHint')}</div>
          </div>
        )
        : (
          <>
            <div className="dsh-pdf-panel__bar">
              <span className="dsh-pdf-panel__file" title={doc.name}>{doc.name}</span>
              <button type="button" className="dsh-pdf-panel__btn" onClick={pickFile}>{t('openAnother')}</button>
            </div>
            <div className="dsh-pdf-panel__viewer">
              <ViewerBoundary fallback={message => (
                <div className="dsh-pdf-panel__status" role="alert">{t('viewerFailed', { message })}</div>
              )}>
                <Suspense fallback={<div className="dsh-pdf-panel__status">{t('viewerLoading')}</div>}>
                  <LazyPdfPanel
                    key={`${tabId}:${epoch}`}
                    bytes={doc.bytes}
                    fileName={doc.name}
                    labels={labels}
                    onPassageAction={onPassageAction}
                  />
                </Suspense>
              </ViewerBoundary>
            </div>
          </>
        )}
      {error !== undefined && (
        <div className="dsh-pdf-panel__error" role="alert" data-dsh-pdf-error>
          {error}
          <button type="button" className="dsh-pdf-panel__link" onClick={() => { setError(undefined) }}>{t('retry')}</button>
        </div>
      )}
      {dragActive && <div className="dsh-pdf-panel__drop">{t('dropActive')}</div>}
    </div>
  )
}
