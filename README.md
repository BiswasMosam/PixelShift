# PixelShift — Image Format Converter

**A smooth, elegant browser-based tool for converting images between formats. No server, no sign-up, no limits.**

![Runs in Browser](https://img.shields.io/badge/runs-in%20browser-7c3aed?style=flat-square)
![No Upload](https://img.shields.io/badge/no%20upload-private-0ea5e9?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)
![Zero Dependencies](https://img.shields.io/badge/zero%20server%20deps-clean-f59e0b?style=flat-square)

---

## What is PixelShift?

PixelShift is a fully client-side image converter that runs entirely in your browser. Upload one image or a batch of dozens, choose an output format, tune the quality, and download — everything happens locally on your machine. No file ever leaves your device.

---

## Features

- **Batch conversion** — drop multiple images at once and convert them all in one click
- **ZIP download** — when converting multiple images, all results are packaged into a single ZIP file automatically
- **HEIC support** — iPhone photos (`.heic` / `.heif`) open in every browser, not just Safari
- **Format control** — convert to PNG, JPG, WEBP, AVIF, TIFF, BMP, or ICO with one click
- **Quality slider** — fine-tune compression for JPG, WEBP and AVIF output (1–100%)
- **Drag and drop** — drag images anywhere onto the page to add them
- **Live preview grid** — see all queued images with their filename, dimensions, and file size
- **Individual removal** — hover any card and click × to remove just that image from the queue
- **Transparency fix** — fills a white background when converting transparent images to JPG or BMP
- **Clear errors** — unreadable files are skipped with a message instead of silently disappearing
- **Progress feedback** — each card gets a green checkmark as it finishes converting
- **Fully private** — conversion happens on-device using the HTML5 Canvas API; nothing is sent to any server
- **No installation** — open `index.html` directly in any modern browser

---

## Supported Formats

| Direction | Formats |
|-----------|---------|
| **Input** | HEIC, HEIF, JPG, PNG, WEBP, AVIF, TIFF, GIF, BMP, ICO, SVG, plus anything else the browser can display (e.g. JPEG XL in Safari) |
| **Output** | PNG, JPG, WEBP, TIFF, BMP, ICO, and AVIF where the browser can encode it |

> **Notes**
> - HEIC and TIFF decoders are loaded on demand the first time you add one of those files (HEIC is ~3 MB, fetched once and cached by the browser). Safari decodes HEIC natively, so it skips the download.
> - AVIF output only appears in browsers whose canvas can encode AVIF; elsewhere the button is hidden instead of quietly producing a PNG.
> - ICO output is a single 256px icon (image fitted and centred on a transparent square).
> - Multi-page TIFFs use the largest page; animated GIFs and HEIC bursts use the first frame.
> - HEIC *output* isn't offered: browsers have no HEVC encoder.

---

## How to Use

1. **Open** `index.html` in any modern browser (Chrome, Edge, Firefox, Safari)
2. **Drop** your images onto the page, or click to browse your files
3. **Pick** an output format — PNG, JPG, WEBP, AVIF, TIFF, BMP, or ICO
4. **Adjust quality** (JPG / WEBP / AVIF only) using the slider
5. **Click** "Convert & Download"
   - Single image → downloads directly
   - Multiple images → downloads a ZIP containing all converted files

To add more images after the first upload, use the "+ Add more images" strip or drop additional files anywhere on the page.

---

## Getting Started

No build step, no package manager, no server required.

```bash
# Clone the repository
git clone https://github.com/BiswasMosam/PixelShift.git

# Navigate into the project
cd PixelShift

# Open directly in your browser
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

Or just download the ZIP from GitHub and open `index.html`.

---

## Project Structure

```
PixelShift/
├── index.html        # Markup and layout
├── src/
│   ├── style.css     # All styles — dark theme, animations, responsive grid
│   └── app.js        # All logic — sniffing, decoding (HEIC/TIFF), encoders, ZIP packaging
└── assets/           # Reserved for future icons or static assets
```

The entire application is three files with no build tooling. `app.js` has no module system — it loads directly as a classic script.

---

## How It Works

1. **Sniffing** — the first bytes of each file are checked (HEIF `ftyp` brands, TIFF `II*`/`MM*`), with the extension as a fallback. This matters because Windows often reports an empty MIME type for `.heic`
2. **Decoding** — the browser tries the file natively first. If that fails, HEIC goes through [heic-to](https://github.com/hoppergee/heic-to) (libheif in a Web Worker) and TIFF through [UTIF.js](https://github.com/photopea/UTIF.js); both produce a PNG the browser can render. Cards show a spinner while this runs
3. **Canvas conversion** — each image is drawn onto a `<canvas>` at its natural resolution and exported with `canvas.toBlob(mimeType, quality)`
4. **Custom encoders** — BMP (24-bit), ICO (PNG-in-ICO) and TIFF (via UTIF) are written byte by byte, since canvas can't export them
5. **Transparency** — for JPG and BMP a white rectangle is filled first, so transparent areas don't turn black
6. **Single file** — the result Blob is downloaded through a temporary object URL
7. **Batch ZIP** — converted Blobs are added to a [JSZip](https://stuk.github.io/jszip/) archive (duplicate names get ` (2)`, ` (3)` suffixes) and downloaded as a `.zip` file
8. **Fallback** — if JSZip fails to load (e.g. offline), individual files are downloaded sequentially with a small delay to prevent browser popup blocking

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Markup | HTML5 |
| Styles | Plain CSS (custom properties, grid, `backdrop-filter`, CSS animations) |
| Logic | Vanilla JavaScript (ES2022, async/await) |
| Conversion | HTML5 Canvas API (`toBlob`) + hand-written BMP / ICO encoders |
| HEIC decode | [heic-to 1.5](https://github.com/hoppergee/heic-to) via jsDelivr, lazy-loaded |
| TIFF decode/encode | [UTIF.js 3.1](https://github.com/photopea/UTIF.js) + pako via jsDelivr, lazy-loaded |
| Batch ZIP | [JSZip 3.10](https://stuk.github.io/jszip/) via CDN |
| Font | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts |

No framework. No bundler. No backend.

---

## Browser Support

Works in all evergreen browsers. WEBP and AVIF output buttons are feature-detected at load and hidden when the browser can't encode them, so you never get a PNG mislabelled as something else. HEIC and TIFF input need a network connection the first time (to fetch the decoders); everything else works offline.

---

## License

MIT — do whatever you want with it.

---

*Built with [Claude Code](https://claude.ai/code)*
