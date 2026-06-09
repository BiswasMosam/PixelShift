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
const canvas        = $('canvas');

// State
let images      = []; // { id, file, src, width, height }
let selectedFmt = 'image/png';
let selectedExt = 'png';
let idSeq       = 0;

// ── Helpers ────────────────────────────────────────────

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function formatBytes(n) {
  if (n < 1024)      return n + ' B';
  if (n < 1_048_576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1_048_576).toFixed(1) + ' MB';
}

function setSliderFill(v) {
  qualitySlider.style.setProperty('--pct', v + '%');
}

// ── Load files ─────────────────────────────────────────

function loadFiles(fileList) {
  const fresh = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!fresh.length) return;

  let pending = fresh.length;

  fresh.forEach(file => {
    const id = ++idSeq;
    const reader = new FileReader();

    reader.onload = e => {
      const src = e.target.result;
      const img = new Image();

      img.onload = () => {
        images.push({ id, file, src, width: img.naturalWidth, height: img.naturalHeight });
        if (--pending === 0) syncGrid();
      };

      img.src = src;
    };

    reader.readAsDataURL(file);
  });
}

// ── Sync grid to images[] ──────────────────────────────

function syncGrid() {
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

  fileCount.textContent = `${images.length} image${images.length !== 1 ? 's' : ''}`;
  syncConvertLabel();

  // Remove cards whose image was deleted
  imgGrid.querySelectorAll('.img-card').forEach(card => {
    if (!images.find(img => img.id === +card.dataset.id)) card.remove();
  });

  // Add cards for new images (preserves existing DOM nodes)
  images.forEach(img => {
    if (imgGrid.querySelector(`[data-id="${img.id}"]`)) return;

    const card = document.createElement('div');
    card.className = 'img-card';
    card.dataset.id = img.id;
    card.innerHTML = `
      <img src="${img.src}" alt="${img.file.name}" />
      <button class="btn-remove" type="button" aria-label="Remove image">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="9" height="9">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="card-info">
        <p>${img.file.name}</p>
        <p class="card-size">${img.width}&times;${img.height} &middot; ${formatBytes(img.file.size)}</p>
      </div>
      <div class="card-done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="30" height="30">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    `;

    card.querySelector('.btn-remove').addEventListener('click', e => {
      e.stopPropagation();
      images = images.filter(im => im.id !== img.id);
      syncGrid();
    });

    imgGrid.appendChild(card);
  });
}

function syncConvertLabel() {
  const n = images.length;
  convertLabel.textContent = n === 1
    ? 'Convert & Download'
    : `Convert ${n} Images & Download ZIP`;
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

document.querySelectorAll('.fmt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fmt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFmt = btn.dataset.fmt;
    selectedExt = btn.dataset.ext;
    const lossy = selectedFmt === 'image/jpeg' || selectedFmt === 'image/webp';
    qualityWrap.classList.toggle('open', lossy);
  });
});

// ── Quality slider ─────────────────────────────────────

qualitySlider.addEventListener('input', () => {
  qualityOut.textContent = qualitySlider.value + '%';
  setSliderFill(qualitySlider.value);
});

setSliderFill(85);

// ── Canvas conversion ──────────────────────────────────

function convertToDataURL(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (selectedFmt === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL(selectedFmt, parseInt(qualitySlider.value, 10) / 100));
    };
    img.src = src;
  });
}

function markDone(id) {
  imgGrid.querySelector(`[data-id="${id}"]`)?.classList.add('done');
}

// ── Convert & download ─────────────────────────────────

btnConvert.addEventListener('click', async () => {
  if (!images.length) return;

  btnConvert.disabled = true;
  convertIcon.innerHTML = '';
  convertLabel.textContent = 'Converting…';

  if (images.length === 1) {
    const img = images[0];
    const dataURL = await convertToDataURL(img.src);
    triggerDownload(dataURL, img.file.name.replace(/\.[^.]+$/, '') + '.' + selectedExt);
    markDone(img.id);
    flashSuccess('Convert & Download');

  } else {
    const useZip = typeof JSZip !== 'undefined';

    if (useZip) {
      const zip = new JSZip();
      for (const img of images) {
        const dataURL = await convertToDataURL(img.src);
        const base64  = dataURL.split(',')[1];
        zip.file(img.file.name.replace(/\.[^.]+$/, '') + '.' + selectedExt, base64, { base64: true });
        markDone(img.id);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      triggerDownload(url, `pixelshift-${selectedExt}.zip`);
      URL.revokeObjectURL(url);
      flashSuccess(`Convert ${images.length} Images & Download ZIP`);

    } else {
      // Fallback: individual downloads with small delay to avoid browser blocking
      for (const img of images) {
        const dataURL = await convertToDataURL(img.src);
        triggerDownload(dataURL, img.file.name.replace(/\.[^.]+$/, '') + '.' + selectedExt);
        markDone(img.id);
        await new Promise(r => setTimeout(r, 120));
      }
      flashSuccess(`Convert ${images.length} Images & Download ZIP`);
    }
  }
});

function triggerDownload(href, filename) {
  const a = Object.assign(document.createElement('a'), { href, download: filename });
  a.click();
}

function flashSuccess(resetLabel) {
  btnConvert.classList.add('done');
  convertIcon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
  convertLabel.textContent = 'Done!';

  setTimeout(() => {
    btnConvert.classList.remove('done');
    btnConvert.disabled = false;
    convertIcon.innerHTML = `
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    `;
    convertLabel.textContent = resetLabel;
    imgGrid.querySelectorAll('.img-card.done').forEach(c => c.classList.remove('done'));
  }, 2600);
}
