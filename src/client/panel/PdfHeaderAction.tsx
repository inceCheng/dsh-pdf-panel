/** Conversation-header entry that opens the right-sidebar PDF reader. */
import type { ReactNode } from 'react'
import { FileTypeIcon } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Translate } from '../api'

/** Props injected into the header utility entry. */
export interface PdfHeaderActionProps {
  /** Plugin-localized copy. */
  readonly t: Translate
  /** Open (or focus) the PDF reader in the right sidebar. */
  readonly open: () => void
}

/** Render the compact header entry. */
export function PdfHeaderAction(props: PdfHeaderActionProps): ReactNode {
  return (
    <button
      type="button"
      className="dsh-pdf-header-action"
      aria-label={props.t('tabTitle')}
      title={props.t('tabTitle')}
      data-dsh-pdf-header-action
      onClick={() => { props.open() }}
    >
      <FileTypeIcon kind="pdf" size={16} />
    </button>
  )
}
