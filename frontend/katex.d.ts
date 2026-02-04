declare module "katex" {
  interface KaTeXOptions {
    displayMode?: boolean
    throwOnError?: boolean
  }
  function renderToString(tex: string, options?: KaTeXOptions): string
  function render(tex: string, element: HTMLElement, options?: KaTeXOptions): void
}
