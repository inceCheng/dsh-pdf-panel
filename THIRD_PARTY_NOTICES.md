# Third-party notices

This package's built client chunk (`lib/client.pdf.js`) bundles the following
third-party software and its data files.

## PDF.js

- Source: https://github.com/mozilla/pdf.js
- Version: 6.3.289
- License: Apache License 2.0
- Bundled data: `cmaps/`, `standard_fonts/`, and `wasm/` assets from the same
  `pdfjs-dist` release, inlined as base64 in the client chunk.

The full Apache-2.0 license text is retained at the top of `lib/client.pdf.js`
in the generated build artifact. The generator (`build.mjs`) embeds that banner
from the installed `pdfjs-dist` package so it stays in sync with the bundled
version.
