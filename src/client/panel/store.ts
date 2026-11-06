/** Bytes of PDFs opened in this browser session, keyed by right-sidebar tab id. */

/** One PDF opened in a panel tab. */
export interface LoadedPdf {
  readonly name: string
  readonly bytes: Uint8Array
}

const documents = new Map<string, LoadedPdf>()

/** @param tabId - owning tab. @returns the document the tab already opened, if any. */
export function storedDocument(tabId: string): LoadedPdf | undefined {
  return documents.get(tabId)
}

/** Remember the document across tab switches and body remounts. */
export function storeDocument(tabId: string, document: LoadedPdf): void {
  documents.set(tabId, document)
}

/** Release the bytes when the tab record ends. */
export function forgetDocument(tabId: string): void {
  documents.delete(tabId)
}
