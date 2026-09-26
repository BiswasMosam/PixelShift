'use strict';

const $ = id => document.getElementById(id);

const fileInput     = $('fileInput');
const uploadZone    = $('uploadZone');
const addStrip      = $('addStrip');
const fileCount     = $('fileCount');
const imgGrid       = $('imgGrid');
const divider       = $('divider');
const formatRow     = $('formatRow');
const qualityWrap   = $('qualityWrap');
const qualitySlider = $('qualitySlider');
const qualityOut    = $('qualityOut');
const btnConvert    = $('btnConvert');
const convertIcon   = $('convertIcon');
const convertLabel  = $('convertLabel');
const notice        = $('notice');

// State
let images      = []; // { id, file, src, width, height, ready }
let selectedFmt = 'image/png';
let selectedExt = 'png';
let idSeq       = 0;
let busy        = false;

// ── Helpers ────────────────────────────────────────────

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function formatBytes(n) {
  if (n < 1024)      return n + ' B';
  if (n < 1_048_576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1_048_576).toFixed(1) + ' MB';
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setSliderFill(v) {
  qualitySlider.style.setProperty('--pct', v + '%');
}

function baseName(file) {
  return file.name.replace(/\.[^.]+$/, '');
}

let noticeTimer;
function showNotice(msg) {
  notice.textContent = msg;
  show(notice);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => hide(notice), 6000);
}

// ── Lazy script loading ────────────────────────────────
// Decoders for formats browsers can't read are only fetched when needed.

const LIBS = {
  heic: ['https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js'],
  tiff: ['https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako_inflate.min.js',
         'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js'],
};

const scriptCache = new Map();

function loadScript(url) {
  if (!scriptCache.has(url)) {
    scriptCache.set(url, new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement('script'), { src: url, onload: resolve });
      s.onerror = () => { scriptCache.delete(url); reject(new Error('Could not load decoder (offline?)')); };
      document.head.appendChild(s);
    }));
  }
  return scriptCache.get(url);
}

async function loadLib(name) {
  for (const url of LIBS[name]) await loadScript(url);
}

// ── Format sniffing ────────────────────────────────────

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];

async function sniff(file) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (a, b) => String.fromCharCode(...head.slice(a, b));

  if (ascii(4, 8) === 'ftyp' && HEIF_BRANDS.includes(ascii(8, 12))) return 'heic';
  if ((head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0) ||
      (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0 && head[3] === 0x2a)) return 'tiff';

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'heic' || ext === 'heif') return 'heic';
  if (ext === 'tif'  || ext === 'tiff') return 'tiff';
  return 'native';
}

// ── Decoding ───────────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => img.naturalWidth ? resolve(img) : reject(new Error('Image has no size'));
    img.onerror = () => reject(new Error('Unsupported or corrupt image'));
    img.src = src;
  });
}

function canvasToBlob(cv, type, quality) {
  return new Promise((resolve, reject) =>
    cv.toBlob(b => b ? resolve(b) : reject(new Error('Encoding failed')), type, quality));
}

async function decodeHeic(file) {
  await loadLib('heic');
  return HeicTo({ blob: file, type: 'image/png' });
}

async function decodeTiff(file) {
  await loadLib('tiff');
  const buf  = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  // Pick the largest page; multi-page TIFFs often carry a small thumbnail first
  const page = ifds.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  UTIF.decodeImage(buf, page, ifds);
  const rgba = UTIF.toRGBA8(page);
  const cv = document.createElement('canvas');
  cv.width = page.width;
  cv.height = page.height;
  cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, 0, page.width * page.height * 4), page.width, page.height), 0, 0);
  return canvasToBlob(cv, 'image/png');
}

// Returns an object URL the browser can render, plus dimensions.
async function decode(file) {
  const kind = await sniff(file);
  const original = URL.createObjectURL(file);

  // Try native first: Safari reads HEIC, some builds read TIFF, and it's free.
  try {
    const img = await loadImage(original);
    return { src: original, width: img.naturalWidth, height: img.naturalHeight };
  } catch (err) {
    URL.revokeObjectURL(original);
    if (kind === 'native') throw err;
  }

  const blob = kind === 'heic' ? await decodeHeic(file) : await decodeTiff(file);
  const src  = URL.createObjectURL(blob);
  const img  = await loadImage(src);
  return { src, width: img.naturalWidth, height: img.naturalHeight };
}

// ── Load files ─────────────────────────────────────────

function loadFiles(fileList) {
  const fresh = Array.from(fileList);
  if (!fresh.length) return;

  fresh.forEach(file => {
    const entry = { id: ++idSeq, file, src: null, width: 0, height: 0, ready: false };
    images.push(entry);

    decode(file)
      .then(res => {
        if (!images.includes(entry)) return URL.revokeObjectURL(res.src); // removed meanwhile
        Object.assign(entry, res, { ready: true });
        fillCard(entry);
        syncConvertButton();
      })
      .catch(err => {
        console.warn(file.name, err);
        removeImage(entry.id);
        showNotice(`Couldn't read "${file.name}": ${err.message || err}`);
      });
  });

  syncGrid();
}

function removeImage(id) {
  const entry = images.find(im => im.id === id);
  if (entry?.src) URL.revokeObjectURL(entry.src);
  images = images.filter(im => im.id !== id);
  syncGrid();
}

// ── Sync grid to images[] ──────────────────────────────

function syncGrid() {
  // The layout switches between the empty screen and the workspace on this.
  document.body.classList.toggle('has-images', images.length > 0);

  if (images.length === 0) {
    show(uploadZone);
    hide(addStrip);
    hide(imgGrid);
    hide(divider);
    hide(formatRow);
    hide(btnConvert);
    qualityWrap.classList.remove('open');
    return;
  }

  hide(uploadZone);
  show(addStrip);
  show(imgGrid);
  show(divider);
  show(formatRow);
  show(btnConvert);

  const total = images.reduce((sum, im) => sum + im.file.size, 0);
  fileCount.textContent = `${images.length} image${images.length !== 1 ? 's' : ''} · ${formatBytes(total)}`;
  syncConvertButton();

  // Remove cards whose image was deleted
  imgGrid.querySelectorAll('.img-card').forEach(card => {
    if (!images.find(img => img.id === +card.dataset.id)) card.remove();
  });

  // Add cards for new images (preserves existing DOM nodes)
  images.forEach(img => {
    if (imgGrid.querySelector(`[data-id="${img.id}"]`)) return;

    const card = document.createElement('div');
    card.className = 'img-card loading';
    card.dataset.id = img.id;
    card.innerHTML = `
      <div class="card-spinner"><span></span><p>Decoding…</p></div>
      <button class="btn-remove" type="button" aria-label="Remove image">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="9" height="9">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="card-info">
        <p>${escapeHTML(img.file.name)}</p>
        <p class="card-size">${formatBytes(img.file.size)}</p>
      </div>
      <div class="card-done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="30" height="30">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    `;

    card.querySelector('.btn-remove').addEventListener('click', e => {
      e.stopPropagation();
      removeImage(img.id);
    });

    imgGrid.appendChild(card);
    if (img.ready) fillCard(img);
  });
}

function fillCard(img) {
  const card = imgGrid.querySelector(`[data-id="${img.id}"]`);
  if (!card) return;
  card.classList.remove('loading');
  card.querySelector('.card-spinner')?.remove();
  const el = Object.assign(document.createElement('img'), { src: img.src, alt: img.file.name });
  card.prepend(el);
  card.querySelector('.card-size').innerHTML =
    `${img.width}&times;${img.height} &middot; ${formatBytes(img.file.size)}`;
}

function syncConvertButton() {
  if (busy) return;
  const n = images.length;
  const pending = images.filter(im => !im.ready).length;
  btnConvert.disabled = pending > 0;
  convertLabel.textContent = pending
    ? `Decoding ${pending} image${pending !== 1 ? 's' : ''}…`
    : n === 1 ? 'Convert and download' : `Convert ${n} images · ZIP`;
}

// ── Upload zone events ─────────────────────────────────

uploadZone.addEventListener('click', () => fileInput.click());

// Global drag-and-drop so the whole page is a drop target
document.addEventListener('dragover', e => {
  e.preventDefault();
  (images.length ? addStrip : uploadZone).classList.add('over');
});

document.addEventListener('dragleave', e => {
  if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
    uploadZone.classList.remove('over');
    addStrip.classList.remove('over');
  }
});

document.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('over');
  addStrip.classList.remove('over');
  if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
});

addStrip.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
  loadFiles(e.target.files);
  fileInput.value = '';
});

// ── Format selection ───────────────────────────────────

const LOSSY = ['image/jpeg', 'image/webp', 'image/avif'];

// Hide canvas-encoded formats this browser can't actually produce
// (toBlob silently falls back to PNG otherwise, e.g. AVIF on most browsers).
document.querySelectorAll('.fmt[data-probe]').forEach(btn => {
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  if (!probe.toDataURL(btn.dataset.fmt).startsWith('data:' + btn.dataset.fmt)) btn.remove();
});

// Balanced rows: 6 buttons → 3 + 3, 7 → 4 + 3
const fmtCount = formatRow.children.length;
formatRow.style.setProperty('--cols', fmtCount <= 4 ? fmtCount : Math.ceil(fmtCount / 2));

document.querySelectorAll('.fmt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fmt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFmt = btn.dataset.fmt;
    selectedExt = btn.dataset.ext;
    qualityWrap.classList.toggle('open', LOSSY.includes(selectedFmt));
  });
});

// ── Quality slider ─────────────────────────────────────

qualitySlider.addEventListener('input', () => {
  qualityOut.textContent = qualitySlider.value + '%';
  setSliderFill(qualitySlider.value);
});

setSliderFill(85);

// ── Encoders ───────────────────────────────────────────

const FLATTEN = ['image/jpeg', 'image/bmp']; // formats without alpha get a white background

async function drawToCanvas(src, maxSide) {
  const img = await loadImage(src);
  let w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement('canvas');

  if (maxSide) {
    // Square canvas, image fitted and centred (for icons)
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const side  = Math.round(Math.max(w, h) * scale);
    cv.width = cv.height = side;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
    return cv;
  }

  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (FLATTEN.includes(selectedFmt)) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0);
  return cv;
}

function encodeBMP(cv) {
  const { width: w, height: h } = cv;
  const rgba = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const dataSize = rowSize * h;
  const buf = new ArrayBuffer(54 + dataSize);
  const v = new DataView(buf);

  v.setUint16(0, 0x4d42, true);        // "BM"
  v.setUint32(2, 54 + dataSize, true);
  v.setUint32(10, 54, true);           // pixel data offset
  v.setUint32(14, 40, true);           // BITMAPINFOHEADER
  v.setInt32(18, w, true);
  v.setInt32(22, h, true);             // positive = bottom-up
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, dataSize, true);
  v.setInt32(38, 2835, true);          // 72 DPI
  v.setInt32(42, 2835, true);

  const px = new Uint8Array(buf, 54);
  for (let y = 0; y < h; y++) {
    const row = (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = row + x * 3;
      px[d] = rgba[s + 2]; px[d + 1] = rgba[s + 1]; px[d + 2] = rgba[s];
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

async function encodeICO(src) {
  const cv  = await drawToCanvas(src, 256);
  const png = new Uint8Array(await (await canvasToBlob(cv, 'image/png')).arrayBuffer());
  const buf = new ArrayBuffer(22 + png.length);
  const v = new DataView(buf);

  v.setUint16(2, 1, true);             // type: icon
  v.setUint16(4, 1, true);             // one image
  v.setUint8(6, cv.width  >= 256 ? 0 : cv.width);
  v.setUint8(7, cv.height >= 256 ? 0 : cv.height);
  v.setUint16(10, 1, true);            // planes
  v.setUint16(12, 32, true);           // bpp
  v.setUint32(14, png.length, true);
  v.setUint32(18, 22, true);           // offset
  new Uint8Array(buf, 22).set(png);
  return new Blob([buf], { type: 'image/x-icon' });
}

async function encodeTIFF(cv) {
  await loadLib('tiff');
  const { data } = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
  return new Blob([UTIF.encodeImage(data.buffer, cv.width, cv.height)], { type: 'image/tiff' });
}

async function convert(src) {
  if (selectedFmt === 'image/x-icon') return encodeICO(src);
  const cv = await drawToCanvas(src);
  if (selectedFmt === 'image/bmp')  return encodeBMP(cv);
  if (selectedFmt === 'image/tiff') return encodeTIFF(cv);
  return canvasToBlob(cv, selectedFmt, parseInt(qualitySlider.value, 10) / 100);
}

function markDone(id) {
  imgGrid.querySelector(`[data-id="${id}"]`)?.classList.add('done');
}

// ── Convert & download ─────────────────────────────────

btnConvert.addEventListener('click', async () => {
  if (!images.length || images.some(im => !im.ready)) return;

  busy = true;
  btnConvert.disabled = true;
  convertIcon.innerHTML = '';
  convertLabel.textContent = 'Converting…';
  const batch = images.slice();

  try {
    if (batch.length === 1) {
      const img = batch[0];
      downloadBlob(await convert(img.src), baseName(img.file) + '.' + selectedExt);
      markDone(img.id);

    } else if (typeof JSZip !== 'undefined') {
      const zip  = new JSZip();
      const used = new Set();
      for (const img of batch) {
        let name = baseName(img.file) + '.' + selectedExt;
        for (let i = 2; used.has(name); i++) name = `${baseName(img.file)} (${i}).${selectedExt}`;
        used.add(name);
        zip.file(name, await convert(img.src));
        markDone(img.id);
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `pixelshift-${selectedExt}.zip`);

    } else {
      // Fallback: individual downloads with small delay to avoid browser blocking
      for (const img of batch) {
        downloadBlob(await convert(img.src), baseName(img.file) + '.' + selectedExt);
        markDone(img.id);
        await new Promise(r => setTimeout(r, 120));
      }
    }
    flashSuccess();
  } catch (err) {
    console.error(err);
    showNotice(`Conversion failed: ${err.message || err}`);
    resetButton();
  }
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function resetButton() {
  busy = false;
  btnConvert.classList.remove('done');
  convertIcon.innerHTML = `
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  `;
  syncConvertButton();
}

function flashSuccess() {
  btnConvert.classList.add('done');
  convertIcon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
  convertLabel.textContent = 'Done. Check your downloads';

  setTimeout(() => {
    resetButton();
    imgGrid.querySelectorAll('.img-card.done').forEach(c => c.classList.remove('done'));
  }, 2600);
}
