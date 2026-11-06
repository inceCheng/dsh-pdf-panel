/**
 * Same-version PDF.js resources, inlined by the plugin build.
 *
 * `build.mjs` generates `dsh-pdf-assets` with the exact `pdf.worker.min.mjs`
 * source and base64 copies of every data file PDF.js 6 may request (CMaps,
 * standard font data, wasm decoders). Serving them from memory keeps the lazy
 * chunk self-contained: no network lookups and no main-thread parser fallback.
 */
import { pdfAssets, workerSource } from 'dsh-pdf-assets'

export { workerSource }

/** Resource kinds PDF.js 6 requests through its `BinaryDataFactory` option. */
export type PdfAssetKind = 'cMapUrl' | 'standardFontDataUrl' | 'wasmUrl'

/** Public surface PDF.js expects from the document's binary data factory. */
export interface PdfBinaryDataFactory {
  /**
   * Resolve one bundled PDF.js data file.
   * @param request - PDF.js resource kind and exact file name.
   * @returns independent bytes for the worker to consume.
   */
  fetch(request: { readonly kind: PdfAssetKind; readonly filename: string }): Promise<Uint8Array>
}

const ASSET_KINDS: ReadonlySet<string> = new Set<PdfAssetKind>(['cMapUrl', 'standardFontDataUrl', 'wasmUrl'])

/**
 * Construct the data factory PDF.js instantiates while opening a document.
 * Requests are answered from build-inlined base64 maps only.
 * @returns the class passed as the `BinaryDataFactory` getDocument option.
 */
export function createPdfBinaryDataFactory(): new () => PdfBinaryDataFactory {
  return class implements PdfBinaryDataFactory {
    async fetch({ kind, filename }: { readonly kind: PdfAssetKind; readonly filename: string }): Promise<Uint8Array> {
      if (!ASSET_KINDS.has(kind)) {
        throw new Error(`PDF.js requested an unsupported binary asset kind: ${String(kind)}`)
      }
      const files = pdfAssets[kind]
      const data = Object.hasOwn(files, filename) ? files[filename] : undefined
      if (data === undefined) throw new Error(`PDF.js asset is not bundled: ${kind}/${filename}`)
      return decodeBase64(data)
    }
  }
}

/**
 * @param base64 - build-inlined asset content.
 * @returns a fresh byte array owned by the worker request.
 */
function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
