/**
 * Lab page entry: mounts the real `PdfPanel` with mock host labels and records
 * passage callbacks on `window.__lab` so the Playwright test can assert them.
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { PdfPanel } from '../src/client/pdf/index'
import type { PdfViewerLabels } from '../src/client/pdf/types'

/** Localized copy mirroring the plugin's dictionaries. */
const labels: PdfViewerLabels = {
  loading: '正在准备 PDF…',
  failed: message => `PDF 加载失败：${message}`,
  retry: '重试',
  pageOf: (page, total) => `第 ${page} / ${total} 页`,
  zoomIn: '放大',
  zoomOut: '缩小',
  fitWidth: '适合宽度',
  actualSize: '实际大小',
  actionExplain: '解读',
  actionTranslate: '翻译',
  actionCopy: '复制',
  copied: '已复制',
  selectionHint: '选中文字后可右键「解读」或「翻译」',
}

interface LabActions {
  readonly kind: 'explain' | 'translate'
  readonly text: string
}

interface LabState {
  status: 'mounting' | 'mounted' | 'error'
  error?: string
  actions: LabActions[]
  unmount(): void
  remount(): void
  reload(): void
}

declare global {
  interface Window {
    __lab: LabState
  }
}

const container = document.getElementById('root')
if (container === null) throw new Error('lab page has no #root')
const root = createRoot(container)

let cachedBytes: Uint8Array | undefined
let epoch = 0
let mountedKey = 0

/** Render with one stable key so prop updates keep the component mounted. */
function renderViewer(bytes: Uint8Array, key: number): void {
  root.render(createElement(PdfPanel, {
    key,
    bytes,
    fileName: 'lab-sample.pdf',
    labels,
    onPassageAction: (kind, text) => {
      state.actions.push({ kind, text })
    },
  }))
  state.status = 'mounted'
}

/** Mount (or re-mount) the viewer; a new key forces fresh worker/session. */
function mount(bytes: Uint8Array): void {
  cachedBytes = bytes
  epoch += 1
  mountedKey = epoch
  renderViewer(bytes, mountedKey)
}

const state: LabState = {
  status: 'mounting',
  actions: [],
  unmount: () => { root.unmount() },
  remount: () => { if (cachedBytes !== undefined) mount(cachedBytes) },
  // New bytes without a key change, like the panel opening another PDF.
  reload: () => { if (cachedBytes !== undefined) renderViewer(cachedBytes.slice(), mountedKey) },
}
window.__lab = state

const source = new URLSearchParams(location.search).get('src') ?? '/sample.pdf'

fetch(source)
  .then(async (response) => {
    if (!response.ok) throw new Error(`document request failed: ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  })
  .then((bytes) => { mount(bytes) })
  .catch((error: unknown) => {
    state.status = 'error'
    state.error = error instanceof Error ? error.message : String(error)
    container.textContent = `lab setup failed: ${state.error}`
  })
