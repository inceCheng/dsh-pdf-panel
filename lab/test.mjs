/**
 * End-to-end lab test for the lazy PDF viewer chunk.
 *
 * Serves the standalone lab page plus a freshly generated, text-selectable
 * 3-page PDF, drives the real viewer in the system Google Chrome through
 * playwright-core, and asserts: pages render, the PDF.js text layer supports
 * native drag selection, the right-click menu offers 解读 / 翻译 / 复制, and
 * `onPassageAction` receives the selected passage. Screenshots land in
 * `lab/screenshots/`.
 *
 * Run with: cd lab && npm test
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const labDir = dirname(fileURLToPath(import.meta.url))
const distDir = join(labDir, 'dist')
const samplesDir = join(labDir, 'samples')
const screenshotsDir = join(labDir, 'screenshots')
const samplePdfPath = join(samplesDir, 'sample.pdf')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
}

const failures = []
let checks = 0

/** Record one assertion; never throws so the run reports every result. */
function check(condition, message, detail) {
  checks += 1
  if (condition) {
    console.log(`  ok   ${message}`)
    return
  }
  failures.push(message)
  console.error(`  FAIL ${message}${detail === undefined ? '' : ` — ${detail}`}`)
}

/** Generate the sample PDF with real, selectable text via Chrome's print engine. */
async function generateSamplePdf(browser) {
  mkdirSync(samplesDir, { recursive: true })
  const page = await browser.newPage()
  const paragraphs = [
    'This document exists to prove that the lazy PDF viewer renders real, selectable text. The text underneath this sentence is not an image; PDF.js parses the content stream and lays out transparent glyph boxes over the rendered page.',
    'Every page of this file carries several paragraphs so that a drag selection crosses more than one line and produces a meaningful passage for the reading actions. The right-click menu should offer the reading actions only when a selection exists.',
    'Selection and copy behaviour comes from the official PDF.js TextLayerBuilder, which also normalises the clipboard text and manages the shared selection listeners between pages.',
  ]
  const marker = 'PDFMARKER'
  const long = Array.from({ length: 4 }, (_, index) =>
    `<p>${index === 0 ? `${marker} ` : ''}${paragraphs[index % paragraphs.length]} Paragraph ${index + 1} keeps the page dense enough that the reader has to scroll.</p>`).join('')
  await page.setContent(`<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: #16181c; }
  .tag { font-family: -apple-system, sans-serif; font-size: 10pt; letter-spacing: .12em; text-transform: uppercase; color: #6b7280; }
  h1 { margin: 6pt 0 14pt; font-size: 26pt; line-height: 1.15; }
  h2 { margin: 14pt 0 6pt; font-size: 16pt; }
  p { margin: 0 0 9pt; font-size: 12.5pt; line-height: 1.62; text-align: justify; }
  .page { page-break-before: always; }
  .first { page-break-before: avoid; }
</style></head><body>
  <section class="first">
    <div class="tag">dsh-pdf-panel lab · page one</div>
    <h1>Selectable PDF Text Layer</h1>
    ${long}
    <p>中文段落也应当可以被选中的：这是用于验证 PDF.js 文本层的中文字符串。</p>
  </section>
  <section class="page">
    <div class="tag">dsh-pdf-panel lab · page two</div>
    <h2>Second Page Heading</h2>
    ${long}
  </section>
  <section class="page">
    <div class="tag">dsh-pdf-panel lab · page three</div>
    <h2>Third Page Heading</h2>
    ${long}
  </section>
</body></html>`)
  const bytes = await page.pdf({ format: 'Letter', printBackground: true })
  writeFileSync(samplePdfPath, bytes)
  await page.close()
  return bytes.length
}

/** Serve lab/dist and the sample PDF on an ephemeral loopback port. */
async function startServer() {
  const server = createServer((request, response) => {
    const urlPath = (request.url ?? '/').split('?')[0]
    if (urlPath === '/invalid.pdf') {
      response.writeHead(200, { 'content-type': 'application/pdf', 'cache-control': 'no-store' })
      response.end('%PDF-1.4\n% deliberately invalid document for the failure-state check\n')
      return
    }
    const file = urlPath === '/sample.pdf'
      ? samplePdfPath
      : join(distDir, urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\//u, ''))
    try {
      const data = readFileSync(file)
      response.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      })
      response.end(data)
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain' })
      response.end('not found')
    }
  })
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('server did not bind a port')
  return { server, port: address.port }
}

/** Drag across a long text-layer span of page 1 (the PDFMARKER line when present). */
async function dragSelectFirstLine(page) {
  // A drag that starts inside an existing selection is treated as a selection
  // drag, so clear the previous one the way a clicking user would.
  await page.evaluate(() => window.getSelection()?.removeAllRanges())
  const target = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll(
      '[data-dsh-pdf-page="1"] .textLayer span[role="presentation"]',
    ))
    const readable = spans.filter(candidate => (candidate.textContent ?? '').trim().length > 12)
    const span = readable.find(candidate => (candidate.textContent ?? '').includes('PDFMARKER'))
      ?? readable.find(candidate => (candidate.textContent ?? '').trim().length > 24)
    if (span === undefined) return null
    const box = span.getBoundingClientRect()
    return { left: box.left, top: box.top, right: box.right, height: box.height }
  })
  if (target === null || target.height < 1) throw new Error('no selectable text span found on page 1')
  const y = target.top + target.height / 2
  await page.mouse.move(target.left + 2, y)
  await page.mouse.down()
  await page.mouse.move(target.right - 2, y, { steps: 12 })
  await page.mouse.up()
  return page.evaluate(() => window.getSelection()?.toString() ?? '')
}

/** Drag from the last text line of page 1 into the first text line of page 2. */
async function dragSelectAcrossPages(page) {
  await page.evaluate(() => window.getSelection()?.removeAllRanges())
  const points = await page.evaluate(() => {
    const spansFor = (pageNumber) => Array.from(document.querySelectorAll(
      `[data-dsh-pdf-page="${pageNumber}"] .textLayer span[role="presentation"]`,
    )).filter(span => (span.textContent ?? '').trim().length > 2)
    const start = spansFor(1).at(-1)
    const end = spansFor(2).at(0)
    if (start === undefined || end === undefined) return null
    const a = start.getBoundingClientRect()
    const b = end.getBoundingClientRect()
    return { ax: a.left + 2, ay: a.top + a.height / 2, bx: b.right - 2, by: b.top + b.height / 2 }
  })
  if (points === null) throw new Error('pages 1 and 2 have no selectable spans')
  await page.mouse.move(points.ax, points.ay)
  await page.mouse.down()
  await page.mouse.move(points.ax, points.ay + 8, { steps: 2 })
  await page.mouse.move(points.bx, points.by, { steps: 16 })
  await page.mouse.up()
  return page.evaluate(() => window.getSelection()?.toString() ?? '')
}

/** Right-click the current selection and wait for the viewer menu. */
async function openSelectionMenu(page) {
  const anchor = await page.evaluate(() => {
    const selection = window.getSelection()
    if (selection === null || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    // Right-click inside the selected glyphs: for a range spanning pages the
    // union rect can land in the gap, and a right-click there drops the
    // selection instead of opening the passage menu.
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0)
    const rect = rects.at(-1) ?? range.getBoundingClientRect()
    return { x: rect.left + Math.min(rect.width / 2, 48), y: rect.top + rect.height / 2 }
  })
  if (anchor === null) throw new Error('selection has no bounding rect')
  await page.mouse.click(anchor.x, anchor.y, { button: 'right' })
  await page.waitForSelector('[data-dsh-pdf-menu]', { state: 'visible', timeout: 5000 })
  return anchor
}

async function main() {
  mkdirSync(screenshotsDir, { recursive: true })
  mkdirSync(samplesDir, { recursive: true })
  const { server, port } = await startServer()
  const baseUrl = `http://127.0.0.1:${port}`
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const size = await generateSamplePdf(browser)
    console.log(`[lab] sample.pdf generated (${(size / 1024).toFixed(1)} KiB), serving ${baseUrl}`)

    const context = await browser.newContext({
      viewport: { width: 860, height: 940 },
      deviceScaleFactor: 2,
      colorScheme: 'light',
      permissions: ['clipboard-read', 'clipboard-write'],
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      const probe = { workers: 0, terminated: 0, revoked: 0, unhandled: [] }
      window.__probe = probe
      window.addEventListener('unhandledrejection', (event) => {
        probe.unhandled.push(String(event.reason))
      })
      const NativeWorker = window.Worker
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args)
          probe.workers += 1
        }
        terminate() {
          probe.terminated += 1
          return super.terminate()
        }
      }
      const revoke = URL.revokeObjectURL.bind(URL)
      URL.revokeObjectURL = (url) => {
        probe.revoked += 1
        revoke(url)
      }
    })
    const consoleErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => { consoleErrors.push(error.message) })

    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-dsh-pdf-viewer][data-dsh-pdf-state="ready"]', { timeout: 30000 })
    await page.waitForSelector('[data-dsh-pdf-page="1"][data-dsh-pdf-page-state="ready"]', { timeout: 30000 })
    await page.waitForSelector('[data-dsh-pdf-page="1"] .textLayer span[role="presentation"]', { timeout: 30000 })

    // ---- Rendering -----------------------------------------------------
    const pageCount = await page.getAttribute('[data-dsh-pdf-viewer]', 'data-dsh-pdf-pages')
    check(pageCount === '3', `document reports 3 pages (got ${pageCount})`)
    const pageLabel = await page.textContent('[data-dsh-pdf-page-label]')
    check(pageLabel === '第 1 / 3 页', `toolbar shows the current page (got ${JSON.stringify(pageLabel)})`)
    const page3State = await page.getAttribute('[data-dsh-pdf-page="3"]', 'data-dsh-pdf-page-state')
    check(page3State === 'idle', `page 3 is lazily deferred before scrolling (state ${page3State})`)
    const dpr = await page.evaluate(() => window.devicePixelRatio)
    const canvasSize = await page.evaluate(() => {
      const canvas = document.querySelector('[data-dsh-pdf-page="1"] canvas')
      return canvas === null ? null : { width: canvas.width, height: canvas.height, cssWidth: canvas.getBoundingClientRect().width }
    })
    check(canvasSize !== null && canvasSize.width > 100 && canvasSize.height > 100, 'page 1 canvas has a rendered bitmap')
    check(canvasSize !== null && canvasSize.width >= Math.floor(canvasSize.cssWidth * dpr), `canvas is device-pixel-ratio aware (${JSON.stringify(canvasSize)} dpr ${dpr})`)
    await page.locator('#frame').screenshot({ path: join(screenshotsDir, '01-document.png') })
    console.log('[lab] screenshot 01-document.png')

    // ---- Native text selection ----------------------------------------
    const selectionText = (await dragSelectFirstLine(page)).trim()
    check(selectionText.length > 0, `drag selection over the text layer produces text (${JSON.stringify(selectionText.slice(0, 60))}…)`)
    check(selectionText.includes('PDFMARKER'), 'selected passage contains the PDFMARKER text from the source document')

    // ---- Selection context menu ---------------------------------------
    await openSelectionMenu(page)
    const menuText = (await page.locator('[data-dsh-pdf-menu]').innerText()).trim()
    const menuSelection = await page.getAttribute('[data-dsh-pdf-menu]', 'data-selection-text')
    check((menuSelection ?? '').length > 0, 'menu exposes the selected passage through a data attribute')
    check(menuText.includes('解读') && menuText.includes('翻译') && menuText.includes('复制'),
      `menu offers 解读 / 翻译 / 复制 (got ${JSON.stringify(menuText)})`)
    const selectedNow = await page.evaluate(() => window.getSelection()?.toString().trim() ?? '')
    check(menuSelection === selectedNow, 'menu passage equals the live selection')
    await page.screenshot({ path: join(screenshotsDir, '02-selection-menu.png') })
    console.log('[lab] screenshot 02-selection-menu.png')

    // ---- Passage action callback --------------------------------------
    await page.click('[data-dsh-pdf-action="explain"]')
    await page.waitForFunction(() => window.__lab.actions.length > 0, undefined, { timeout: 5000 })
    const actions = await page.evaluate(() => window.__lab.actions)
    check(actions.length === 1 && actions[0].kind === 'explain',
      `onPassageAction fired with "explain" (${JSON.stringify(actions.map(action => action.kind))})`)
    check(actions[0]?.text === menuSelection, 'callback received exactly the selected passage')
    check(await page.locator('[data-dsh-pdf-menu]').count() === 0, 'menu closes after the action')

    // ---- Translate action callback ------------------------------------
    const translateSelection = (await dragSelectFirstLine(page)).trim()
    await openSelectionMenu(page)
    await page.click('[data-dsh-pdf-action="translate"]')
    await page.waitForFunction(() => window.__lab.actions.length > 1, undefined, { timeout: 5000 })
    const translateActions = await page.evaluate(() => window.__lab.actions)
    check(translateActions[1]?.kind === 'translate' && translateActions[1]?.text === translateSelection,
      'onPassageAction fired with "translate" and the selected passage')

    // ---- Copy action ---------------------------------------------------
    const copySelection = (await dragSelectFirstLine(page)).trim()
    check(copySelection.length > 0, 'selection can be made again for the copy action')
    await openSelectionMenu(page)
    await page.click('[data-dsh-pdf-action="copy"]')
    await page.waitForFunction(
      () => document.querySelector('[data-dsh-pdf-action="copy"]')?.textContent === '已复制',
      undefined,
      { timeout: 5000 },
    )
    const copiedLabel = await page.textContent('[data-dsh-pdf-action="copy"]')
    check(copiedLabel === '已复制', `copy action shows the copied confirmation (got ${JSON.stringify(copiedLabel)})`)
    check(await page.locator('[data-dsh-pdf-menu]').count() === 1, 'copy action leaves the menu open for further actions')
    let clipboardText = ''
    try {
      clipboardText = (await page.evaluate(() => navigator.clipboard.readText())).trim()
    } catch (error) {
      console.warn(`  warn clipboard read failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    check(clipboardText !== '' && clipboardText === copySelection, 'copy action placed the passage on the clipboard')
    await page.keyboard.press('Escape')
    await page.waitForSelector('[data-dsh-pdf-menu]', { state: 'detached', timeout: 5000 })
    check(true, 'Escape closes the menu')
    await page.mouse.click(300, 200, { button: 'right' })
    await page.waitForTimeout(150)
    check(await page.locator('[data-dsh-pdf-menu]').count() === 0, 'no menu appears without a text selection')

    // ---- Zoom ----------------------------------------------------------
    await page.waitForTimeout(250)
    const zoomBefore = Number(await page.getAttribute('[data-dsh-pdf-viewer]', 'data-dsh-pdf-zoom'))
    await page.click('[data-dsh-pdf-zoom-in]')
    await page.waitForFunction((previous) => {
      const root = document.querySelector('[data-dsh-pdf-viewer]')
      return Number(root?.getAttribute('data-dsh-pdf-zoom')) > previous
    }, zoomBefore, { timeout: 5000 })
    const zoomAfter = Number(await page.getAttribute('[data-dsh-pdf-viewer]', 'data-dsh-pdf-zoom'))
    const modeAfterZoomIn = await page.getAttribute('[data-dsh-pdf-viewer]', 'data-dsh-pdf-zoom-mode')
    check(zoomAfter > zoomBefore, `zoom-in increases the percentage (${zoomBefore}% → ${zoomAfter}%)`)
    check(modeAfterZoomIn === 'fixed', 'manual zoom switches the toolbar out of fit-width')
    await page.click('[data-dsh-pdf-fit-width]')
    await page.waitForFunction(() => document.querySelector('[data-dsh-pdf-viewer]')?.getAttribute('data-dsh-pdf-zoom-mode') === 'fit')
    check(true, 'fit-width button restores fit mode')
    await page.waitForTimeout(400)

    // ---- Cross-page selection: one range from page 1 through page 2 -----
    await page.click('[data-dsh-pdf-zoom-out]')
    await page.click('[data-dsh-pdf-zoom-out]')
    await page.waitForTimeout(500)
    await page.waitForSelector('[data-dsh-pdf-page="2"][data-dsh-pdf-page-state="ready"]', { timeout: 30000 })
    const crossPageText = (await dragSelectAcrossPages(page)).trim()
    check(crossPageText.length > 0, 'selection spans two pages through the page gap')
    check(crossPageText.replace(/\s+/gu, '').includes('PAGETWO'),
      `cross-page selection concatenates page 1 and page 2 text (${JSON.stringify(crossPageText.slice(0, 80))}…)`)
    await openSelectionMenu(page)
    const crossMenuText = await page.getAttribute('[data-dsh-pdf-menu]', 'data-selection-text')
    check(crossMenuText !== null && crossMenuText.trim() === crossPageText,
      'the menu opens for a cross-page selection and carries the full passage')
    await page.locator('#frame').screenshot({ path: join(screenshotsDir, '08-cross-page-selection.png') })
    console.log('[lab] screenshot 08-cross-page-selection.png')
    await page.keyboard.press('Escape')
    await page.waitForSelector('[data-dsh-pdf-menu]', { state: 'detached', timeout: 5000 })
    await page.click('[data-dsh-pdf-fit-width]')
    await page.waitForTimeout(400)

    // ---- Page navigation ----------------------------------------------
    await page.click('[data-dsh-pdf-page-next]')
    await page.waitForSelector('[data-dsh-pdf-page="2"][data-dsh-pdf-page-state="ready"]', { timeout: 30000 })
    await page.waitForFunction(() => document.querySelector('[data-dsh-pdf-viewer]')?.getAttribute('data-dsh-pdf-current-page') === '2', undefined, { timeout: 10000 })
    const pageLabelTwo = await page.textContent('[data-dsh-pdf-page-label]')
    check(pageLabelTwo === '第 2 / 3 页', `page navigation updates the toolbar (got ${JSON.stringify(pageLabelTwo)})`)
    await page.locator('#frame').screenshot({ path: join(screenshotsDir, '03-page-two.png') })
    console.log('[lab] screenshot 03-page-two.png')

    await page.click('[data-dsh-pdf-page-next]')
    await page.waitForSelector('[data-dsh-pdf-page="3"][data-dsh-pdf-page-state="ready"]', { timeout: 30000 })
    check(true, 'last page renders after navigating to it (lazy render)')

    // ---- Dark appearance ----------------------------------------------
    await page.emulateMedia({ colorScheme: 'dark' })
    // Back to page 1 so the dark selection/palette checks act on visible text.
    await page.evaluate(() => { document.querySelector('[data-dsh-pdf-scrollport]')?.scrollTo({ top: 0 }) })
    await page.waitForFunction(
      () => document.querySelector('[data-dsh-pdf-viewer]')?.getAttribute('data-dsh-pdf-current-page') === '1',
      undefined,
      { timeout: 10000 },
    )
    await page.waitForTimeout(300)
    await page.locator('#frame').screenshot({ path: join(screenshotsDir, '04-dark.png') })
    console.log('[lab] screenshot 04-dark.png')
    const darkBackground = await page.evaluate(() => getComputedStyle(document.querySelector('[data-dsh-pdf-viewer]')).backgroundColor)
    check(darkBackground !== 'rgb(236, 238, 241)', `viewer background follows the dark color scheme (${darkBackground})`)

    const darkSelection = (await dragSelectFirstLine(page)).trim()
    check(darkSelection.length > 0, 'text selection works in dark mode')
    await openSelectionMenu(page)
    const darkMenu = await page.evaluate(() => {
      const menu = document.querySelector('[data-dsh-pdf-menu]')
      const item = menu?.querySelector('.dsh-pdf-viewer__menu-item')
      const page = document.querySelector('.dsh-pdf-viewer__page')
      if (menu === null || item === null || item === undefined || page === null) return null
      const parse = (value) => (value.match(/\d+/gu) ?? []).slice(0, 3).map(Number)
      return {
        menu: parse(getComputedStyle(menu).backgroundColor),
        itemText: parse(getComputedStyle(item).color),
        page: parse(getComputedStyle(page).backgroundColor),
      }
    })
    const luminance = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
    check(darkMenu !== null && luminance(darkMenu.menu) < 80 && luminance(darkMenu.itemText) > 150,
      `dark mode menu keeps readable contrast (${JSON.stringify(darkMenu)})`)
    await page.screenshot({ path: join(screenshotsDir, '09-dark-selection-menu.png') })
    console.log('[lab] screenshot 09-dark-selection-menu.png')
    await page.keyboard.press('Escape')
    await page.waitForSelector('[data-dsh-pdf-menu]', { state: 'detached', timeout: 5000 })

    // Host-pinned theme wins over the OS preference in both directions.
    await page.emulateMedia({ colorScheme: 'light' })
    await page.evaluate(() => { document.documentElement.dataset.dsThemeSource = 'dark' })
    await page.waitForTimeout(150)
    const pinnedDark = await page.evaluate(() => getComputedStyle(document.querySelector('[data-dsh-pdf-viewer]')).backgroundColor)
    check(pinnedDark === 'rgb(21, 23, 27)', `data-ds-theme-source="dark" forces the dark palette (${pinnedDark})`)
    await page.evaluate(() => { document.documentElement.dataset.dsThemeSource = 'light' })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(150)
    const pinnedLight = await page.evaluate(() => getComputedStyle(document.querySelector('[data-dsh-pdf-viewer]')).backgroundColor)
    check(pinnedLight === 'rgb(236, 238, 241)', `data-ds-theme-source="light" forces the light palette (${pinnedLight})`)

    check(consoleErrors.length === 0, 'no browser console errors', consoleErrors.join(' | '))

    // ---- Re-mount (tab switch away/back): shell-retained bytes ----------
    const beforeRemount = await page.evaluate(() => window.__probe)
    await page.evaluate(() => { window.__lab.remount() })
    await page.waitForFunction(
      () => document.querySelector('[data-dsh-pdf-viewer]')?.getAttribute('data-dsh-pdf-state') === 'ready',
      undefined,
      { timeout: 30000 },
    )
    await page.waitForSelector('[data-dsh-pdf-page="1"][data-dsh-pdf-page-state="ready"]', { timeout: 30000 })
    const afterRemount = await page.evaluate(() => window.__probe)
    check(afterRemount.workers > beforeRemount.workers, `re-mount creates a fresh worker (${beforeRemount.workers} → ${afterRemount.workers})`)
    check(afterRemount.terminated > beforeRemount.terminated && afterRemount.revoked > beforeRemount.revoked,
      're-mount terminates the previous worker and revokes its blob URL')

    // ---- New bytes on the same mounted viewer (open another PDF) --------
    const beforeReload = await page.evaluate(() => window.__probe)
    await page.evaluate(() => { window.__lab.reload() })
    await page.waitForFunction(
      (before) => (window.__probe?.workers ?? 0) > before,
      beforeReload.workers,
      { timeout: 30000 },
    )
    await page.waitForSelector('[data-dsh-pdf-viewer][data-dsh-pdf-state="ready"]', { timeout: 30000 })
    await page.waitForSelector('[data-dsh-pdf-page="1"][data-dsh-pdf-page-state="ready"]', { timeout: 30000 })
    const afterReload = await page.evaluate(() => window.__probe)
    check(afterReload.workers > beforeReload.workers, `changing bytes loads a fresh worker (${beforeReload.workers} → ${afterReload.workers})`)
    check(afterReload.terminated > beforeReload.terminated && afterReload.revoked > beforeReload.revoked,
      'the previous worker and blob URL are released when bytes change')

    // ---- Teardown: worker termination + blob URL revoke -----------------
    await page.evaluate(() => { window.__lab.unmount() })
    await page.waitForTimeout(300)
    const probe = await page.evaluate(() => window.__probe)
    check(probe.workers >= 1, `viewer created a dedicated worker (${JSON.stringify(probe)})`)
    check(probe.terminated >= 1, 'unmount terminates the PDF worker')
    check(probe.revoked >= 1, 'unmount revokes the worker blob URL')
    check(await page.locator('[data-dsh-pdf-viewer]').count() === 0, 'unmount removes the viewer DOM')
    const finalProbe = await page.evaluate(() => window.__probe)
    check(finalProbe.unhandled.length === 0, 'no unhandled promise rejections during load, zoom, remount, or teardown',
      finalProbe.unhandled.join(' | '))

    // ---- Narrow sidebar (~500 px, the DSH right-sidebar width) ---------
    const narrow = await context.newPage()
    await narrow.setViewportSize({ width: 620, height: 900 })
    await narrow.goto(`${baseUrl}/index.html?w=460`, { waitUntil: 'domcontentloaded' })
    await narrow.waitForSelector('[data-dsh-pdf-page="1"][data-dsh-pdf-page-state="ready"]', { timeout: 30000 })
    const toolbarOverflow = await narrow.evaluate(() => {
      const bar = document.querySelector('.dsh-pdf-viewer__toolbar')
      return bar === null ? null : { scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth }
    })
    check(toolbarOverflow !== null && toolbarOverflow.scrollWidth <= toolbarOverflow.clientWidth + 1,
      `toolbar fits a narrow sidebar (${JSON.stringify(toolbarOverflow)})`)
    const narrowZoom = Number(await narrow.getAttribute('[data-dsh-pdf-viewer]', 'data-dsh-pdf-zoom'))
    check(narrowZoom > 0 && narrowZoom < 85, `fit-width adapts to the narrow panel (${narrowZoom}%)`)
    const narrowSelection = (await dragSelectFirstLine(narrow)).trim()
    check(narrowSelection.includes('PDFMARKER'), 'text selection works in the narrow panel')
    const narrowAnchor = await narrow.evaluate(() => {
      const selection = window.getSelection()
      if (selection === null || selection.rangeCount === 0) return null
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      return { x: rect.right - 3, y: rect.top + rect.height / 2 }
    })
    if (narrowAnchor === null) throw new Error('narrow selection has no rect')
    await narrow.mouse.click(narrowAnchor.x, narrowAnchor.y, { button: 'right' })
    await narrow.waitForSelector('[data-dsh-pdf-menu]', { state: 'visible', timeout: 5000 })
    const menuInside = await narrow.evaluate(() => {
      const root = document.querySelector('[data-dsh-pdf-viewer]').getBoundingClientRect()
      const menu = document.querySelector('[data-dsh-pdf-menu]').getBoundingClientRect()
      return {
        left: menu.left >= root.left - 1,
        right: menu.right <= root.right + 1,
        top: menu.top >= root.top - 1,
        bottom: menu.bottom <= root.bottom + 1,
      }
    })
    check(menuInside.left && menuInside.right && menuInside.top && menuInside.bottom,
      `selection menu stays inside the viewer bounds (${JSON.stringify(menuInside)})`)
    await narrow.screenshot({ path: join(screenshotsDir, '05-narrow-sidebar.png') })
    console.log('[lab] screenshot 05-narrow-sidebar.png')
    await narrow.close()

    // ---- Invalid PDF: localized failure + retry ------------------------
    const broken = await context.newPage()
    await broken.addInitScript(() => {
      const probe = { workers: 0, terminated: 0, revoked: 0, unhandled: [] }
      window.__probe = probe
      const NativeWorker = window.Worker
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args)
          probe.workers += 1
        }
        terminate() {
          probe.terminated += 1
          return super.terminate()
        }
      }
      const revoke = URL.revokeObjectURL.bind(URL)
      URL.revokeObjectURL = (url) => {
        probe.revoked += 1
        revoke(url)
      }
      window.addEventListener('unhandledrejection', (event) => {
        probe.unhandled.push(String(event.reason))
      })
    })
    await broken.goto(`${baseUrl}/index.html?src=/invalid.pdf`, { waitUntil: 'domcontentloaded' })
    await broken.waitForSelector('[data-dsh-pdf-viewer][data-dsh-pdf-state="failed"]', { timeout: 20000 })
    const failureText = (await broken.textContent('.dsh-pdf-viewer__status-message'))?.trim() ?? ''
    check(failureText.includes('PDF 加载失败'), `invalid PDF shows the localized failure message (${JSON.stringify(failureText)})`)
    check(await broken.locator('.dsh-pdf-viewer__retry').count() === 1, 'failure state offers a retry button')
    await broken.screenshot({ path: join(screenshotsDir, '06-failure.png') })
    console.log('[lab] screenshot 06-failure.png')
    await broken.click('.dsh-pdf-viewer__retry')
    await broken.waitForFunction(
      () => (window.__probe?.workers ?? 0) >= 2,
      undefined,
      { timeout: 20000 },
    ).catch(() => {})
    await broken.waitForSelector('[data-dsh-pdf-viewer][data-dsh-pdf-state="failed"]', { timeout: 20000 })
    const brokenProbe = await broken.evaluate(() => window.__probe)
    check(brokenProbe.workers >= 2, `retry rebuilds the document with a fresh worker (${JSON.stringify(brokenProbe)})`)
    check(brokenProbe.terminated >= 1 && brokenProbe.revoked >= 1,
      'the failed worker is terminated and its blob URL revoked before the retry')
    check(brokenProbe.unhandled.length === 0, 'invalid-PDF load and retry produce no unhandled rejections',
      brokenProbe.unhandled.join(' | '))
    await broken.close()

    // ---- Worker blocked: report failure, never parse on the main thread -
    const blocked = await context.newPage()
    await blocked.addInitScript(() => {
      window.Worker = class {
        constructor() { throw new Error('worker blocked by lab') }
      }
    })
    await blocked.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' })
    await blocked.waitForSelector('[data-dsh-pdf-viewer][data-dsh-pdf-state="failed"]', { timeout: 20000 })
    const workerFailureText = (await blocked.textContent('.dsh-pdf-viewer__status-message'))?.trim() ?? ''
    check(workerFailureText.includes('PDF 加载失败'), `worker startup failure is reported (${JSON.stringify(workerFailureText)})`)
    check(await blocked.locator('[data-dsh-pdf-page-state="ready"]').count() === 0,
      'no main-thread fallback renders pages when the worker cannot start')
    await blocked.screenshot({ path: join(screenshotsDir, '07-worker-blocked.png') })
    console.log('[lab] screenshot 07-worker-blocked.png')
    await blocked.close()
  } finally {
    await browser.close()
    server.close()
  }

  if (failures.length > 0) {
    console.error(`\n[lab] ${failures.length} of ${checks} checks failed`)
    process.exitCode = 1
    return
  }
  console.log(`\n[lab] all ${checks} checks passed`)
}

await main()
