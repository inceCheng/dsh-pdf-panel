/** Injects the plugin's stylesheet into the host document exactly once. */
const installed = new Set<string>()

/**
 * Append one plugin-owned `<style>` element.
 * @param id - stable style element id.
 * @param css - stylesheet text bundled by the build.
 */
export function installStyles(id: string, css: string): void {
  if (installed.has(id) || document.getElementById(id) !== null) {
    installed.add(id)
    return
  }
  const tag = document.createElement('style')
  tag.id = id
  tag.dataset.plugin = 'dsh-pdf-panel'
  tag.textContent = css
  document.head.appendChild(tag)
  installed.add(id)
}
