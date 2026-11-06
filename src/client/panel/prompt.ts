/**
 * Turn a selected PDF passage into a chat composer draft.
 *
 * The composer understands the same quote node the transcript uses, so a
 * passage lands as a removable quote followed by the instruction. When the
 * composer cannot take a quote (for example while a command claim is active) the
 * passage falls back to Markdown blockquote text in one insert.
 */
import type { InputActions, Translate } from '../api'
import type { PassageActionKind } from '../pdf/types'

/** Build the Markdown blockquote form of a passage. */
function quoteLines(passage: string): string {
  return passage
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n')
}

/**
 * Insert one selected passage plus its default instruction into the composer.
 * @param inputActions - the bound session's composer actions.
 * @param kind - whether the user asked for an explanation or a translation.
 * @param passage - selected text from the PDF.
 * @param t - plugin-localized copy.
 */
export function insertPassage(
  inputActions: InputActions,
  kind: PassageActionKind,
  passage: string,
  t: Translate,
): void {
  const instruction = kind === 'explain' ? t('explainInstruction') : t('translateInstruction')
  const span = inputActions.captureInsertion()
  if (inputActions.insertQuote(passage.trim())) {
    inputActions.insertText(`\n\n${instruction}`, inputActions.captureInsertion())
    return
  }
  inputActions.insertText(`${t('promptLead')}\n\n${quoteLines(passage)}\n\n${instruction}`, span)
}
