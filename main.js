/* Decorative dot clouds + dithered photos that resolve on hover.
   No libraries. Everything redraws on resize. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { ink: "#000", peri: "#8f9ef2" };
  const DUO = [[29, 33, 80], [85, 96, 196], [169, 180, 245], [238, 240, 253]];

  // ---------- seeded value noise ----------
  function makeNoise(seed) {
    const hash = (x, y) => {
      let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };
    const s = t => t * t * (3 - 2 * t);
    const v = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
    return (x, y) => v(x, y) * 0.55 + v(x * 2.1, y * 2.1) * 0.3 + v(x * 4.3, y * 4.3) * 0.15;
  }
  function rng(seed) {
    let t = seed * 9301 + 49297;
    return () => ((t = Math.imul(t ^ (t >>> 15), t | 1) + 0x6d2b79f5) >>> 0) / 4294967296;
  }
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  function fit(cv) {
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width));
    cv.height = Math.max(1, Math.round(r.height));
    const g = cv.getContext("2d");
    g.clearRect(0, 0, cv.width, cv.height);
    return g;
  }

  // ---------- cloud: pixel outline with periwinkle dust outside ----------
  function drawCloud(cv) {
    const g = fit(cv), seed = +cv.dataset.seed || 1, n = makeNoise(seed), r = rng(seed);
    const cell = innerWidth < 760 ? 3 : 4;
    const cols = Math.ceil(cv.width / cell), rows = Math.ceil(cv.height / cell);
    const br = cv.dataset.anchor === "br";
    const field = (i, j) => {
      let x = i / cols, y = j / rows;
      if (br) { x = 1 - x; y = 1 - y; }
      const d = Math.hypot(x * 1.1, y * 1.25);
      return n(i / 22, j / 22) * 0.7 + (1 - d) * 1.05 - 0.2;
    };
    const F = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) F[j * cols + i] = field(i, j);
    const T = 0.55, at = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows) ? 1 : F[j * cols + i];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const f = F[j * cols + i];
      if (f > T) {
        const edge = at(i - 1, j) <= T || at(i + 1, j) <= T || at(i, j - 1) <= T || at(i, j + 1) <= T;
        if (edge || (f < T + 0.05 && r() < 0.05)) { g.fillStyle = C.ink; g.fillRect(i * cell, j * cell, cell, cell); }
      } else {
        const p = Math.pow(clamp((f - (T - 0.32)) / 0.32), 1.6) * 0.7;
        if (r() < p) { g.fillStyle = C.peri; g.fillRect(i * cell, j * cell, cell - 1, cell - 1); }
        else if (r() < p * 0.025) { g.fillStyle = C.ink; g.fillRect(i * cell, j * cell, cell, cell); }
      }
    }
  }

  // ---------- loops: dotted contour lines ----------
  function drawLoops(cv) {
    const g = fit(cv), seed = +cv.dataset.seed || 1, n = makeNoise(seed), m = makeNoise(seed + 50);
    const cell = 3, cols = Math.ceil(cv.width / cell), rows = Math.ceil(cv.height / cell);
    g.fillStyle = C.ink;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if ((i + j) % 3) continue;
      if (m(i / 70, j / 70) < 0.52) continue;
      const v = n(i / 45, j / 45);
      for (const L of [0.42, 0.52, 0.62]) if (Math.abs(v - L) < 0.006) { g.fillRect(i * cell, j * cell, 2, 2); break; }
    }
  }

  // ---------- dithered photos ----------
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  function paint(fig, block) {
    const cv = fig._cv, img = fig._img, W = cv.width, H = cv.height;
    const w = Math.ceil(W / block), h = Math.ceil(H / block);
    const off = fig._off || (fig._off = document.createElement("canvas"));
    off.width = w; off.height = h;
    const o = off.getContext("2d", { willReadFrequently: true });
    if (img && img.naturalWidth) {
      const ir = img.naturalWidth / img.naturalHeight, tr = W / H;
      let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
      if (ir > tr) { sw = sh * tr; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / tr; sy = (img.naturalHeight - sh) / 2; }
      o.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    } else {
      const nz = makeNoise(fig._seed);
      const d = o.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = 255 * clamp(nz(x / 14, y / 14) * 1.2 - 0.05), k = (y * w + x) * 4;
        d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255;
      }
      o.putImageData(d, 0, 0);
    }
    let id;
    try { id = o.getImageData(0, 0, w, h); }
    catch (e) { cv.style.opacity = 0; fig.classList.add("clear", "plain"); return; } // opened as a local file: show the plain photo
    const px = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const l = (0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2]) / 255;
      const s = l * 3, base = Math.floor(s), idx = clamp(base + (s - base > B4[(y & 3) * 4 + (x & 3)] ? 1 : 0), 0, 3);
      const c = DUO[idx]; px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2];
    }
    o.putImageData(id, 0, 0);
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(off, 0, 0, w, h, 0, 0, w * block, h * block);
  }

  function setupFig(fig, k) {
    const img = fig.querySelector("img");
    const cv = document.createElement("canvas");
    cv.className = "dither"; cv.setAttribute("aria-hidden", "true");
    fig.appendChild(cv);
    const box = document.createElement("div");
    box.className = "box";
    box.innerHTML = "<span></span>";
    box.firstChild.textContent = fig.dataset.label || "";
    if (fig.dataset.label) fig.appendChild(box);
    fig._cv = cv; fig._img = img; fig._seed = 20 + k;

    let timer = null, state = "px";
    const base = () => Math.max(5, Math.round(cv.width / 60));
    const size = () => { const r = fig.getBoundingClientRect(); cv.width = Math.round(r.width); cv.height = Math.round(r.height); };
    const run = (steps, done) => {
      clearTimeout(timer);
      cv.style.opacity = 1;
      const go = i => {
        if (i >= steps.length) return done && done();
        paint(fig, steps[i]); timer = setTimeout(() => go(i + 1), 65);
      };
      go(0);
    };
    const resolve = () => {
      if (fig.classList.contains("missing") || state === "clear") return;
      state = "clear";
      const b = base(), steps = reduce ? [] : [b * 0.7, b * 0.45, b * 0.25, 2].map(v => Math.max(2, Math.round(v)));
      run(steps, () => { cv.style.opacity = 0; fig.classList.add("clear"); });
    };
    const pixelate = () => {
      if (state === "px") return;
      state = "px"; fig.classList.remove("clear");
      const b = base(), steps = reduce ? [b] : [3, Math.round(b * 0.5), b];
      run(steps);
    };
    fig._redraw = () => { size(); if (state === "px") paint(fig, base()); };

    fig.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") resolve(); });
    fig.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") pixelate(); });
    if (!fig.closest("a")) fig.addEventListener("click", () => (state === "px" ? resolve() : pixelate()));

    const ready = () => fig._redraw();
    const fail = () => { fig.classList.add("missing"); fig.dataset.file = img.getAttribute("src"); fig._img = null; fig._redraw(); };
    if (!img) { fig.classList.add("missing"); fig._redraw(); return; }
    if (img.complete) (img.naturalWidth ? ready() : fail());
    img.addEventListener("load", ready);
    img.addEventListener("error", fail);
  }

  const figs = [...document.querySelectorAll(".px")];
  figs.forEach(setupFig);

  function drawAll() {
    document.querySelectorAll("canvas.cloud").forEach(drawCloud);
    document.querySelectorAll("canvas.loops").forEach(drawLoops);
    figs.forEach(f => f._redraw && f._redraw());
  }
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(drawAll, 150); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(drawAll);
  drawAll();
})();
