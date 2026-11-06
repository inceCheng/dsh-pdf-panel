/**
 * dsh-pdf-panel browser entry.
 *
 * Registers one right-sidebar page type, its body, a guide entry that opens it,
 * and a compact conversation-header entry. The heavy PDF engine lives in a lazy
 * chunk (`require.async('./client.pdf.js')`) loaded on the first preview.
 */
import { createElement } from 'react'
import { FileTypeIcon } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PluginContext } from './api'
import { NS, dictionaries } from './locales'
import { installStyles } from './styles'
import { PdfPanelBody } from './panel/PdfPanelBody'
import { PdfHeaderAction } from './panel/PdfHeaderAction'
import panelCss from './panel/panel.css'

/** Browser plugin name; must match the package name so the loader resolves the bundle. */
export const name = 'dsh-pdf-panel'
/** Services the browser plugin needs before it can register anything. */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

/** Static identity of this tab implementation (unique across every registration). */
const TAB_ID = 'dsh-pdf-panel'
/** Tab type discriminator; `ctx.sidebarRight.openTab` names this. */
export const PDF_TAB_KIND = 'pdf-panel'
const HEADER_ACTION_ID = 'dsh-pdf-panel-open'

/** Guide-card glyph: the same file mark the host uses for PDFs. */
function PdfGuideIcon(props: { readonly size?: number; readonly className?: string }) {
  return createElement(FileTypeIcon, { kind: 'pdf', size: props.size ?? 16, className: props.className })
}

/** Register copy, styles, the tab type/body, and the header entry. */
export function apply(ctx: PluginContext): void {
  installStyles('dsh-pdf-panel/panel', panelCss)
  ctx.effect(() => ctx.locale.register(NS, dictionaries), 'dsh-pdf-panel: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: PDF_TAB_KIND,
    title: () => t('tabTitle'),
    guide: [{
      id: 'open-pdf',
      order: 0,
      title: () => t('guideTitle'),
      description: () => t('guideDescription'),
      icon: PdfGuideIcon,
    }],
  }), 'dsh-pdf-panel: tab type')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: TAB_ID,
    locale: NS,
  }, PdfPanelBody)), 'dsh-pdf-panel: tab body')

  ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: HEADER_ACTION_ID,
    order: -9,
    locale: NS,
    inject: () => ({ open: () => { ctx.sidebarRight.openTab(PDF_TAB_KIND) } }),
  }, PdfHeaderAction)), 'dsh-pdf-panel: header entry')
}
