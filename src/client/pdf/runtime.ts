/**
 * One real module Worker and one PDF.js loading task per mounted document.
 *
 * PDF.js always runs on its own worker: the plugin builds a Blob URL from the
 * same-version worker source inlined by `build.mjs`, waits until that module
 * has evaluated, and only then hands its port to PDF.js. A worker that fails to
 * start is reported as a fatal failure — parsing never falls back to the main
 * thread.
 */
import { getDocument, PDFWorker, type PDFDocumentProxy } from 'pdfjs-dist'
import { createPdfBinaryDataFactory, workerSource } from './assets'

/** Message the worker posts after its module has fully evaluated. */
const WORKER_READY = 'dsh-pdf-panel-worker-ready'

/** Fatal failure of the dedicated PDF.js worker (startup or transport). */
export class PdfWorkerFailure extends Error {
  /** Distinguishes worker failures from ordinary document parsing errors. */
  readonly kind = 'worker'

  /** @param cause - native error event or messageerror event. */
  constructor(cause: Event) {
    super(undefined, { cause })
    this.name = 'PdfWorkerFailure'
  }
}

/** One in-flight document load and its complete cleanup operation. */
export interface PdfSession {
  readonly document: Promise<PDFDocumentProxy>
  /**
   * Cancel loading, destroy the document, terminate the worker and revoke its
   * Blob URL. Teardown failures are logged after native resources are released.
   * @returns cleanup completion without rejection.
   */
  dispose(): Promise<void>
}

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason?: unknown) => void
}

/** @returns a promise plus its externally held settlement functions. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

/**
 * Open complete PDF bytes with an explicitly owned Worker.
 * @param data - complete PDF bytes retained by the panel; the worker receives a copy.
 * @param signal - document lifetime.
 * @param reportFailure - reports a fatal worker failure, including failures after loading.
 * @returns the pending document and idempotent asynchronous cleanup.
 */
export function openPdf(
  data: Uint8Array,
  signal: AbortSignal,
  reportFailure: (error: PdfWorkerFailure) => void,
): PdfSession {
  const lifetime = new AbortController()
  const stopped = AbortSignal.any([signal, lifetime.signal])
  const failed = deferred<never>()
  const broken = deferred<undefined>()
  let url: string | undefined
  let worker: Worker | undefined
  let bridge: PDFWorker | undefined
  let loading: ReturnType<typeof getDocument> | undefined
  let closing: Promise<void> | undefined
  let removeReady: (() => void) | undefined

  const workerFailed = (event: Event): void => {
    const error = new PdfWorkerFailure(event)
    failed.reject(error)
    broken.resolve(undefined)
    try {
      if (!stopped.aborted) reportFailure(error)
    } catch (failure) {
      console.error('[dsh-pdf-panel] failure callback threw', failure)
    } finally {
      void dispose()
    }
  }
  const aborted = (): void => {
    failed.reject(stopped.reason)
    void dispose()
  }
  stopped.addEventListener('abort', aborted, { once: true })

  const dispose = (): Promise<void> => {
    if (closing !== undefined) return closing
    closing = Promise.resolve().then(async () => {
      try {
        if (loading !== undefined) await Promise.race([loading.destroy(), broken.promise])
      } finally {
        removeReady?.()
        stopped.removeEventListener('abort', aborted)
        bridge?.destroy()
        worker?.removeEventListener('error', workerFailed)
        worker?.removeEventListener('messageerror', workerFailed)
        worker?.terminate()
        if (url !== undefined) URL.revokeObjectURL(url)
      }
    }).catch((error: unknown) => {
      console.error('[dsh-pdf-panel] PDF cleanup failed', error)
    })
    lifetime.abort()
    return closing
  }

  const initialize = async (): Promise<PDFDocumentProxy> => {
    stopped.throwIfAborted()
    const BinaryDataFactory = createPdfBinaryDataFactory()
    const bytes = data.slice()
    url = URL.createObjectURL(new Blob([
      workerSource,
      `\nself.postMessage({type:${JSON.stringify(WORKER_READY)}});\n`,
    ], { type: 'text/javascript' }))
    worker = new Worker(url, { type: 'module', name: 'dsh-pdf-panel' })
    worker.addEventListener('error', workerFailed)
    worker.addEventListener('messageerror', workerFailed)
    const started = deferred<undefined>()
    const ready = (event: MessageEvent<unknown>): void => {
      if (typeof event.data !== 'object' || event.data === null || !('type' in event.data)
        || event.data.type !== WORKER_READY) return
      started.resolve(undefined)
    }
    worker.addEventListener('message', ready)
    const port = worker
    removeReady = () => { port.removeEventListener('message', ready) }
    await Promise.race([started.promise, failed.promise])
    removeReady()
    stopped.throwIfAborted()
    bridge = PDFWorker.create({ port })
    loading = getDocument({
      data: bytes,
      worker: bridge,
      BinaryDataFactory,
      cMapPacked: true,
      useWorkerFetch: false,
      enableXfa: false,
      stopAtErrors: true,
    })
    return loading.promise
  }

  const document = Promise.race([initialize(), failed.promise]).catch(async (error: unknown) => {
    await dispose()
    throw error
  })
  return { document, dispose }
}
