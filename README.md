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
- **Format control** — convert to PNG, JPG, or WEBP with one click
- **Quality slider** — fine-tune compression for JPG and WEBP output (1–100%)
- **Drag and drop** — drag images anywhere onto the page to add them
- **Live preview grid** — see all queued images with their filename, dimensions, and file size
- **Individual removal** — hover any card and click × to remove just that image from the queue
- **JPG transparency fix** — automatically fills a white background when converting transparent images to JPG
- **Progress feedback** — each card gets a green checkmark as it finishes converting
- **Fully private** — conversion happens on-device using the HTML5 Canvas API; nothing is sent to any server
- **No installation** — open `index.html` directly in any modern browser

---

## Supported Formats

| Direction | Formats |
|-----------|---------|
| **Input** | PNG, JPG, WEBP, GIF, BMP, SVG, AVIF — anything the browser can display |
| **Output** | PNG, JPG, WEBP |

> **Note:** For animated GIFs, only the first frame is captured during conversion. This is a browser canvas limitation.

---

## How to Use

1. **Open** `index.html` in any modern browser (Chrome, Edge, Firefox, Safari)
2. **Drop** your images onto the page, or click to browse your files
3. **Pick** an output format — PNG, JPG, or WEBP
4. **Adjust quality** (JPG / WEBP only) using the slider
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
│   └── app.js        # All logic — file loading, canvas conversion, ZIP packaging
└── assets/           # Reserved for future icons or static assets
```

The entire application is three files with no build tooling. `app.js` has no module system — it loads directly as a classic script.

---

## How It Works

1. **File reading** — `FileReader.readAsDataURL()` loads each image into memory as a base64 data URL
2. **Canvas conversion** — each image is drawn onto an HTML5 `<canvas>` element at its natural resolution, then exported via `canvas.toDataURL(mimeType, quality)`
3. **JPG transparency** — before drawing, a white rectangle is filled on the canvas to replace any transparent areas (canvas defaults to black for missing alpha in JPEG)
4. **Single file** — the resulting data URL is set as an `<a>` element's `href` and `.click()` is triggered
5. **Batch ZIP** — converted images are added to a [JSZip](https://stuk.github.io/jszip/) instance as base64 strings; a Blob URL is generated and downloaded as a `.zip` file
6. **Fallback** — if JSZip fails to load (e.g. offline), individual files are downloaded sequentially with a small delay to prevent browser popup blocking

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Markup | HTML5 |
| Styles | Plain CSS (custom properties, grid, `backdrop-filter`, CSS animations) |
| Logic | Vanilla JavaScript (ES2022, async/await) |
| Conversion | HTML5 Canvas API (`toDataURL`) |
| Batch ZIP | [JSZip 3.10](https://stuk.github.io/jszip/) via CDN |
| Font | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts |

No framework. No bundler. No backend.

---

## Browser Support

Works in all evergreen browsers. The WEBP output format requires a browser that supports `canvas.toDataURL('image/webp')` — supported in Chrome, Edge, and Firefox. Safari 16+ also supports it. If the browser does not support the requested MIME type, the canvas silently falls back to PNG.

---

## License

MIT — do whatever you want with it.

---

*Built with [Claude Code](https://claude.ai/code)*
