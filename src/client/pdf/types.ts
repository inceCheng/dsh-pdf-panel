/** Contract between the main bundle (panel shell) and the lazy PDF viewer chunk. */
import type { ComponentType } from 'react'

/** Selection actions the viewer offers in its right-click menu. */
export type PassageActionKind = 'explain' | 'translate'

/** Localized copy the viewer renders; built by the main bundle so the chunk carries no locale. */
export interface PdfViewerLabels {
  readonly loading: string
  readonly failed: (message: string) => string
  readonly retry: string
  readonly pageOf: (page: number, total: number) => string
  readonly zoomIn: string
  readonly zoomOut: string
  readonly fitWidth: string
  readonly actualSize: string
  readonly actionExplain: string
  readonly actionTranslate: string
  readonly actionCopy: string
  readonly copied: string
  readonly selectionHint: string
}

/** Props of the lazily loaded PDF viewer. */
export interface PdfViewerProps {
  /** Complete PDF bytes, retained by the panel shell for the tab's lifetime. */
  readonly bytes: Uint8Array
  /** File name shown in the viewer's header. */
  readonly fileName: string
  /** Localized copy. */
  readonly labels: PdfViewerLabels
  /** Hand one selected passage to the composer owner. */
  readonly onPassageAction: (kind: PassageActionKind, text: string) => void
}

/** Module shape exported by lib/client.pdf.js. */
export interface PdfViewerModule {
  readonly PdfPanel: ComponentType<PdfViewerProps>
}
