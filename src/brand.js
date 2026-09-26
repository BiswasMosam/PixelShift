/* PixelShift's wordmark, and the page's reactions to it.

   The name is drawn in square pixels on a canvas, from a 5 x 7 bitmap face
   defined below. Each pixel is three subpixels, red, green and blue, drawn
   with additive blending: lined up they add to white, pulled apart they
   fringe into colour. Each subpixel has its own stiffness, so when a pixel
   is pushed (by the cursor, a drag, the occasional glitch) red springs back
   first and blue last, and the name trails colour.

   The loop only runs while something is moving, and not at all when
   reduced motion is asked for. Vanilla, no libraries. */

'use strict';

(() => {
  const body = document.body;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let excite = () => {}; /* set once the wordmark exists */

  /* ---- the "Out" list and count follow what this browser can encode ---- */
  const outFormats = [...document.querySelectorAll('.fmt strong')].map((s) => s.textContent);
  const outList = document.querySelector('.formats div:last-child dd');
  if (outList) outList.textContent = outFormats.join(' · ');
  const outCount = document.querySelector('.start__top span:last-child');
  if (outCount) outCount.textContent = `10 in · ${outFormats.length} out`;

  /* ---- keyboard: the empty screen is one big button ---- */
  const start = document.getElementById('uploadZone');
  start.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      start.click();
    }
  });

  /* ---- dragging files over the page ---- */
  let dragDepth = 0;
  const setDragging = (on) => {
    body.classList.toggle('dragging', on);
    if (on) excite();
  };
  document.addEventListener('dragenter', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    if (dragDepth++ === 0) setDragging(true);
  });
  document.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) setDragging(false);
  });
  document.addEventListener('drop', () => {
    dragDepth = 0;
    setDragging(false);
  });

  const canvas = document.getElementById('mark');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  /* ---- the face: 7 rows, '#' is a pixel ---- */
  const FACE = {
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..']
  };

  /* Lay words out on a grid of cells, one letter space apart, lines two
     cells apart. Returns the lit cells and the grid's size. */
  const layout = (lines) => {
    const cells = [];
    let cols = 0;
    lines.forEach((word, li) => {
      let x = 0;
      [...word].forEach((ch, ci) => {
        FACE[ch].forEach((row, ry) => {
          [...row].forEach((bit, rx) => {
            if (bit === '#') cells.push({ gx: x + rx, gy: li * 9 + ry });
          });
        });
        x += FACE[ch][0].length + (ci < word.length - 1 ? 1 : 0);
      });
      cols = Math.max(cols, x);
    });
    return { cells, cols, rows: lines.length * 9 - 2 };
  };

  /* Per subpixel: colour, stiffness, damping. Red is snappiest, blue laziest.
     The three colours add up to the site's bone white. */
  const CHANNELS = [
    { color: '#f20000', k: 0.16, damp: 0.72 },
    { color: '#00f200', k: 0.1, damp: 0.76 },
    { color: '#0000ec', k: 0.065, damp: 0.8 }
  ];

  let grid = null;
  let pixels = [];
  let pitch = 10;
  let dpr = 1;
  let running = false;
  let pointer = null;

  const build = () => {
    const width = canvas.clientWidth;
    if (!width) return;
    grid = layout(width < 640 ? ['PIXEL', 'SHIFT'] : ['PIXELSHIFT']);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    pitch = width / grid.cols;
    const height = Math.round(pitch * grid.rows);
    canvas.style.height = height + 'px';
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const old = pixels;
    pixels = grid.cells.map((c, i) => ({
      x: (c.gx + 0.5) * pitch,
      y: (c.gy + 0.5) * pitch,
      gx: c.gx,
      gy: c.gy,
      wait: 0,
      push: { x: 0, y: 0 },
      /* each subpixel's offset from home, and its velocity */
      ch: old[i] ? old[i].ch : CHANNELS.map(() => ({ dx: 0, dy: 0, vx: 0, vy: 0 }))
    }));
    draw();
  };

  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const size = pitch * 0.84;
    const half = size / 2;
    CHANNELS.forEach((c, n) => {
      ctx.fillStyle = c.color;
      for (const p of pixels) {
        const s = p.ch[n];
        ctx.fillRect(p.x + s.dx - half, p.y + s.dy - half, size, size);
      }
    });
  };

  /* Spring every subpixel toward its target: home, plus the cursor's push,
     plus any kick still decaying. Returns whether anything still moves. */
  const step = () => {
    let moving = false;
    const reach = pitch * 5;
    for (const p of pixels) {
      if (p.wait > 0) {
        p.wait--;
        moving = true;
        continue;
      }
      let tx = p.push.x;
      let ty = p.push.y;
      if (pointer) {
        const vx = p.x - pointer.x;
        const vy = p.y - pointer.y;
        const d = Math.hypot(vx, vy);
        if (d < reach && d > 0.001) {
          const f = (1 - d / reach) ** 2 * pitch * 1.6;
          tx += (vx / d) * f;
          ty += (vy / d) * f;
        }
      }
      p.push.x *= 0.88;
      p.push.y *= 0.88;
      if (Math.abs(p.push.x) > 0.05 || Math.abs(p.push.y) > 0.05) moving = true;
      CHANNELS.forEach((c, n) => {
        const s = p.ch[n];
        s.vx = (s.vx + (tx - s.dx) * c.k) * c.damp;
        s.vy = (s.vy + (ty - s.dy) * c.k) * c.damp;
        s.dx += s.vx;
        s.dy += s.vy;
        if (Math.abs(s.dx - tx) > 0.05 || Math.abs(s.dy - ty) > 0.05) moving = true;
      });
    }
    return moving || !!pointer || body.classList.contains('dragging');
  };

  const loop = () => {
    if (body.classList.contains('dragging')) {
      /* while files hover over the page, the name shivers */
      for (const p of pixels) {
        p.push.x += (Math.random() - 0.5) * pitch * 0.35;
        p.push.y += (Math.random() - 0.5) * pitch * 0.35;
      }
    }
    const moving = step();
    draw();
    if (moving && !body.classList.contains('has-images')) {
      requestAnimationFrame(loop);
    } else {
      running = false;
    }
  };

  const wake = () => {
    if (reduced || running || body.classList.contains('has-images') || !pixels.length) return;
    running = true;
    requestAnimationFrame(loop);
  };

  excite = () => {
    if (reduced) return;
    for (const p of pixels) {
      p.push.x += (Math.random() - 0.5) * pitch * 2;
      p.push.y += (Math.random() - 0.5) * pitch * 2;
    }
    wake();
  };

  /* ---- intro: the pixels arrive from scattered places, left to right ---- */
  const intro = () => {
    if (reduced) return;
    for (const p of pixels) {
      const ox = (Math.random() - 0.5) * pitch * 30;
      const oy = (Math.random() - 0.5) * pitch * 14;
      p.wait = Math.round(p.gx * 0.9 + Math.random() * 6);
      p.ch.forEach((s) => {
        s.dx = ox;
        s.dy = oy;
        s.vx = 0;
        s.vy = 0;
      });
    }
    wake();
  };

  /* ---- now and then, a row or two glitches sideways ---- */
  const glitch = () => {
    const quiet = document.hidden || body.classList.contains('has-images') || pointer;
    if (!reduced && !quiet && grid) {
      const row = Math.floor(Math.random() * grid.rows);
      const band = 1 + Math.floor(Math.random() * 2);
      const shove = (Math.random() < 0.5 ? -1 : 1) * pitch * (1.5 + Math.random() * 2.5);
      for (const p of pixels) {
        if (p.gy >= row && p.gy < row + band) p.push.x += shove;
      }
      wake();
    }
    setTimeout(glitch, 4500 + Math.random() * 4500);
  };

  /* ---- the cursor pushes pixels aside ---- */
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    wake();
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = null;
    wake();
  });

  /* Rebuild when the width changes, and again when the page empties out
     (the canvas has no width while images are showing). */
  let lastWidth = 0;
  new ResizeObserver(() => {
    if (canvas.clientWidth === lastWidth) return;
    lastWidth = canvas.clientWidth;
    build();
  }).observe(canvas);

  let hadImages = false;
  new MutationObserver(() => {
    const has = body.classList.contains('has-images');
    if (hadImages && !has) {
      build();
      excite();
    }
    hadImages = has;
  }).observe(body, { attributes: true, attributeFilter: ['class'] });

  build();
  lastWidth = canvas.clientWidth;
  intro();
  setTimeout(glitch, 3500);
})();
