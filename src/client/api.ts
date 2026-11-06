/**
 * Minimal structural types for the DSH browser plugin API this package uses.
 *
 * The runtime contract lives in the DSH client packages; these declarations are
 * intentionally narrow so the plugin type-checks without importing the whole
 * host type graph. Keep them in sync with the DSH version pinned in the bundle
 * manifest (`engines.dsh`) when upgrading.
 */

/** Dispose callback returned by registrations and effects. */
export type Disposable = () => void

/** One localized dictionary, keyed by message id. */
export type Dictionary = Readonly<Record<string, string>>

/** Localized view of one registered plugin namespace. */
export interface Translate {
  (key: string, params?: Readonly<Record<string, string | number>>): string
}

/** Copy registration and binding service (`ctx.locale`). */
export interface LocaleService {
  register(namespace: string, dictionaries: Readonly<Record<string, Dictionary>>): Disposable
  bind(namespace: string): Translate
}

/** Component/slot registry (`ctx.slots`). */
export interface SlotsService {
  inject(name: string, callback: () => Disposable | void): Disposable
  register(entry: Readonly<Record<string, unknown>>, component: unknown): Disposable
}

/** A guide page entry contributed by a tab type. */
export interface SidebarRightGuideEntry {
  readonly id: string
  readonly order: number
  readonly title: () => string
  readonly description?: () => string
  readonly icon?: unknown
}

/** Static declaration of one right-sidebar tab type. */
export interface SidebarRightTabDefinition {
  readonly id: string
  readonly kind: string
  readonly multiple?: boolean
  readonly keepMounted?: boolean
  readonly title: (address: string) => string
  readonly guide?: readonly SidebarRightGuideEntry[]
}

/** Tab-type registry (`ctx.sidebarRightTabs`). */
export interface SidebarRightTabsService {
  register(definition: SidebarRightTabDefinition): Disposable
}

/** Navigation controller for the right sidebar (`ctx.sidebarRight`). */
export interface SidebarRightService {
  openTab(kind: string, options?: { readonly params?: Readonly<Record<string, unknown>> }): void
}

/** Live tab information injected into one tab body. */
export interface SidebarRightTabInfo {
  readonly sidebar: { readonly expanded: boolean; readonly fullscreen: boolean }
  readonly panel: { readonly id: string; readonly isFloating: boolean }
  readonly tab: {
    readonly id: string
    readonly visible: boolean
    readonly signal: AbortSignal
    readonly navigation: { readonly params: unknown; readonly revision: number; readonly address: string }
    readonly actions: { close(): void }
  }
}

/** Browser composer input actions supplied to session-scoped slots. */
export interface InputActions {
  insertQuote(text: string): boolean
  captureInsertion(): unknown
  insertText(text: string, span: unknown): boolean
  setDraft(text: string): void
}

/** One clause of the plugin's browser context. */
export interface PluginContext {
  effect(callback: () => void | Disposable, label?: string): Disposable
  slots: SlotsService
  locale: LocaleService
  sidebarRightTabs: SidebarRightTabsService
  sidebarRight: SidebarRightService
}

/** Props the DSH slot renderer injects into a session-scoped right-sidebar body. */
export interface SessionSlotProps {
  readonly sessionId: string
  readonly inputActions: InputActions
}
