// ─── INIT ─────────────────────────────────────────────────────────────────────
function initUI() {
  initSparkles();
  initCatTabs();
  buildSkinRow();
  buildMakeupPane();   // eyes + lips (into #cat-makeup)
  buildFacePane();     // foundation, blush, etc. (into #cat-face)
  buildHairPane();     // hair grid (into #cat-hair)
  buildBrowsPane();    // brows + lashes (into #cat-brows)
  bindBrushControls();
  bindKeyboard();
}

// ─── SPARKLES ─────────────────────────────────────────────────────────────────
function initSparkles() {
  const wrap  = document.getElementById('sparkles');
  const chars = ['✦','✧','⋆','★','✫','✬','✴','❋','✽'];
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('span');
    s.className = 'sp';
    s.textContent = chars[Math.floor(Math.random() * chars.length)];
    s.style.setProperty('--sz',    (5 + Math.random() * 16) + 'px');
    s.style.setProperty('--dur',   (1.2 + Math.random() * 2.8) + 's');
    s.style.setProperty('--delay', (Math.random() * 4) + 's');
    s.style.left = (Math.random() * 100) + 'vw';
    s.style.top  = (Math.random() * 100) + 'vh';
    wrap.appendChild(s);
  }
}

// ─── CATEGORY TABS ────────────────────────────────────────────────────────────
function initCatTabs() {
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('sel'));
      document.querySelectorAll('.cat-pane').forEach(p => p.classList.add('hidden'));
      tab.classList.add('sel');
      const pane = document.getElementById('cat-' + tab.dataset.cat);
      if (pane) pane.classList.remove('hidden');
    });
  });
}

// ─── SKIN ROW ─────────────────────────────────────────────────────────────────
function buildSkinRow() {
  const row = document.getElementById('skin-row');
  SKIN_TONES.forEach((tone, i) => {
    const btn = document.createElement('button');
    btn.className = 'skin-dot' + (i === 1 ? ' active' : '');
    btn.style.background = tone.hex;
    btn.title = tone.name;
    btn.onclick = () => {
      row.querySelectorAll('.skin-dot').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadSkinTone(tone.id);
    };
    row.appendChild(btn);
  });
}

// ─── MAKEUP PANE: Eyes + Lips ─────────────────────────────────────────────────
function buildMakeupPane() {
  buildEyeSection();
  buildLipSection();
  buildGlossSection();
}

function buildEyeSection() {
  const shelf = document.getElementById('eye-shelf');

  // Eyeshadow palette
  const esWrap = document.createElement('div');
  esWrap.className = 'prod-wrap';
  const esImg = makeProdImg(
    'assets/Makeup Products/Eyeshadow/Eyeshadow.png',
    'Eyeshadow', 'palette-img',
    () => togglePanel(esWrap)
  );
  const esPanel = makePanGrid(PRODUCTS.eyeshadow.shades, 'eyeshadow', esImg, 5);
  esPanel.classList.add('palette-body');
  esWrap.appendChild(esImg);
  esWrap.appendChild(esPanel);
  shelf.appendChild(esWrap);

  // Eyeliner pens
  const penWrap = document.createElement('div');
  penWrap.className = 'prod-wrap';

  const penRow = document.createElement('div');
  penRow.className = 'pen-row';

  let activeEyelinerStyle = null;

  PRODUCTS.eyeliner.shades.forEach(shade => {
    const img = makeProdImg(shade.img, shade.name, 'pen-img', () => {
      penRow.querySelectorAll('.prod-img').forEach(b => b.classList.remove('sel'));
      img.classList.add('sel');
      activeEyelinerStyle = shade;
      deselectAllMakeup();
      img.classList.add('sel');
      activeProductId = 'eyeliner';
      activeShade = shade;
      updateCursor();
      document.getElementById('brush-bar').classList.remove('hidden');
    });
    penRow.appendChild(img);
  });

  const colorRow = document.createElement('div');
  colorRow.className = 'pan-row';
  PRODUCTS.eyeliner.colors.forEach(col => {
    const pan = makePan(col, false, () => {
      colorRow.querySelectorAll('.pan').forEach(p => p.classList.remove('sel'));
      pan.classList.add('sel');
      if (activeEyelinerStyle) {
        activeShade = { ...activeEyelinerStyle, hex: col.hex };
        updateCursor();
      }
    });
    colorRow.appendChild(pan);
  });

  penWrap.appendChild(penRow);
  penWrap.appendChild(colorRow);
  shelf.appendChild(penWrap);

  // Mascara
  const mascWrap = document.createElement('div');
  mascWrap.className = 'prod-wrap';
  const mascImg = makeProdImg(
    'assets/Makeup Products/Mascara/Mascara.png',
    'Mascara', 'mascara-img',
    () => togglePanel(mascWrap)
  );
  const mascPanel = makePanGrid(PRODUCTS.mascara.shades, 'mascara', mascImg, 3);
  mascPanel.classList.add('palette-body', 'compact');
  mascWrap.appendChild(mascImg);
  mascWrap.appendChild(mascPanel);
  shelf.appendChild(mascWrap);
}

function buildLipSection() {
  const shelf = document.getElementById('lipstick-shelf');
  PRODUCTS.lipcolor.shades.forEach(shade => {
    const img = makeProdImg(shade.img, shade.name, 'lip-img', () => {
      deselectAllMakeup();
      img.classList.add('sel');
      activeProductId = 'lipcolor';
      activeShade     = shade;
      updateCursor();
      document.getElementById('brush-bar').classList.remove('hidden');
    });
    shelf.appendChild(img);
  });
}

function buildGlossSection() {
  const shelf = document.getElementById('gloss-shelf');
  PRODUCTS.lipgloss.shades.forEach(shade => {
    const img = makeProdImg(shade.img, shade.name, 'gloss-img', () => {
      deselectAllMakeup();
      img.classList.add('sel');
      activeProductId = 'lipgloss';
      activeShade     = shade;
      updateCursor();
      document.getElementById('brush-bar').classList.remove('hidden');
    });
    shelf.appendChild(img);
  });
}

// ─── FACE PANE ────────────────────────────────────────────────────────────────
function buildFacePane() {
  const shelf = document.getElementById('face-shelf');
  const specs = [
    { productId: 'foundation',  img: PRODUCTS.foundation.icon,  cols: 4 },
    { productId: 'contour',     img: PRODUCTS.contour.icon,      cols: 3 },
    { productId: 'blush',       img: PRODUCTS.blush.icon,        cols: 3 },
    { productId: 'highlighter', img: PRODUCTS.highlighter.icon,  cols: 2 },
  ];

  specs.forEach(({ productId, img, cols }) => {
    const wrap = document.createElement('div');
    wrap.className = 'face-product-wrap';

    const prodImg = makeProdImg(img, PRODUCTS[productId].name, 'face-prod-img', () => {
      togglePanel(wrap);
    });

    const panel = makePanGrid(PRODUCTS[productId].shades, productId, prodImg, cols);
    panel.classList.add('palette-body', 'compact');

    wrap.appendChild(prodImg);
    wrap.appendChild(panel);
    shelf.appendChild(wrap);
  });
}

// ─── HAIR PANE ────────────────────────────────────────────────────────────────
function buildHairPane() {
  const grid = document.getElementById('hair-row');

  const nb = makeNoneBtn('None', () => {
    grid.querySelectorAll('.prod-img').forEach(b => b.classList.remove('sel'));
    clearHair();
  });
  grid.appendChild(nb);

  HAIR_STYLES.forEach(style => {
    const img = makeProdImg(style.back || style.img, style.name, 'hair-img', () => {
      grid.querySelectorAll('.prod-img').forEach(b => b.classList.remove('sel'));
      img.classList.add('sel');
      setHair(style.id);
    });
    grid.appendChild(img);
  });
}

// ─── BROWS & LASHES PANE ─────────────────────────────────────────────────────
function buildBrowsPane() {
  buildBrowSection();
  buildLashSection();
}

function buildBrowSection() {
  const shelf = document.getElementById('brow-shelf');

  const nb = makeNoneBtn('None', () => {
    shelf.querySelectorAll('.prod-img, .none-btn').forEach(b => b.classList.remove('sel'));
    nb.classList.add('sel');
    pencilColorRow.classList.add('hidden');
    clearBrow();
  });
  nb.classList.add('sel');
  shelf.appendChild(nb);

  const styleRow = document.createElement('div');
  styleRow.className = 'overlay-row';
  BROW_STYLES.forEach(style => {
    const img = makeProdImg(style.img, style.name, 'overlay-img', () => {
      shelf.querySelectorAll('.prod-img, .none-btn').forEach(b => b.classList.remove('sel'));
      img.classList.add('sel');
      pencilColorRow.classList.remove('hidden');
      setBrow(style.id, browColor);
    });
    styleRow.appendChild(img);
  });
  shelf.appendChild(styleRow);

  const pencilColorRow = document.createElement('div');
  pencilColorRow.className = 'pen-row hidden';
  BROW_COLORS.forEach(col => {
    const img = makeProdImg(col.pencil, col.name, 'pencil-img', () => {
      pencilColorRow.querySelectorAll('.prod-img').forEach(b => b.classList.remove('sel'));
      img.classList.add('sel');
      setBrowColor(col.hex);
    });
    pencilColorRow.appendChild(img);
  });
  shelf.appendChild(pencilColorRow);
}

function buildLashSection() {
  const shelf = document.getElementById('lash-shelf');

  const nb = makeNoneBtn('None', () => {
    shelf.querySelectorAll('.prod-img, .none-btn').forEach(b => b.classList.remove('sel'));
    nb.classList.add('sel');
    clearLash();
  });
  nb.classList.add('sel');
  shelf.appendChild(nb);

  const row = document.createElement('div');
  row.className = 'overlay-row';
  LASH_STYLES.forEach(style => {
    const img = makeProdImg(style.img, style.name, 'overlay-img', () => {
      row.querySelectorAll('.prod-img, .none-btn').forEach(b => b.classList.remove('sel'));
      img.classList.add('sel');
      setLash(style.id);
    });
    row.appendChild(img);
  });
  shelf.appendChild(row);
}

// ─── PAN GRID FACTORY ─────────────────────────────────────────────────────────
function makePanGrid(shades, productId, prodImgRef, cols) {
  const panel = document.createElement('div');
  panel.className = 'pan-panel hidden';

  const grid = document.createElement('div');
  grid.className = 'pan-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  shades.forEach(shade => {
    const pan = makePan(shade, !!shade.shimmer, () => {
      grid.querySelectorAll('.pan').forEach(p => p.classList.remove('sel'));
      pan.classList.add('sel');
      deselectAllMakeup();
      if (prodImgRef) prodImgRef.classList.add('sel');
      activeProductId = productId;
      activeShade     = shade;
      updateCursor();
      document.getElementById('brush-bar').classList.remove('hidden');
    });
    grid.appendChild(pan);
  });

  panel.appendChild(grid);
  return panel;
}

// ─── PAN BUTTON (magical candy-like dimensional pan) ──────────────────────────
function makePan(shade, shimmer, onClick) {
  const name = (shade.name || '').toLowerCase();
  const isGlitter  = name.includes('glitter') || name.includes('holo') || name.includes('crystal');
  const finishClass = isGlitter ? 'glitter' : shimmer ? 'shimmer' : 'matte';

  const pan = document.createElement('button');
  pan.className = `pan ${finishClass}`;
  pan.style.background = shade.hex;
  pan.title = shade.name;

  const shine = document.createElement('span');
  shine.className = 'pan-shine';
  pan.appendChild(shine);

  const spec = document.createElement('span');
  spec.className = 'pan-spec';
  pan.appendChild(spec);

  pan.addEventListener('click', e => { e.stopPropagation(); onClick(); });
  return pan;
}

// ─── TOGGLE PANEL ─────────────────────────────────────────────────────────────
function togglePanel(wrap) {
  const panel   = wrap.querySelector('.pan-panel');
  const prodImg = wrap.querySelector('.prod-img');
  if (!panel) return;
  const opening = panel.classList.contains('hidden');

  document.querySelectorAll('.pan-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.prod-img').forEach(i => i.classList.remove('sel'));

  if (opening) {
    panel.classList.remove('hidden');
    if (prodImg) prodImg.classList.add('sel');
  } else {
    deselect();
  }
}

// ─── PRODUCT IMAGE FACTORY ────────────────────────────────────────────────────
function makeProdImg(src, alt, extraClass, onClick) {
  const img = document.createElement('img');
  img.className = 'prod-img' + (extraClass ? ' ' + extraClass : '');
  img.alt = alt; img.title = alt; img.draggable = false;

  const loader = new Image();
  loader.crossOrigin = 'anonymous';
  loader.onload  = () => {
    const proc = stripWhiteBg(loader);
    img.src = proc || src;
  };
  loader.onerror = () => { img.src = src; };
  loader.src = src;

  img.addEventListener('click', onClick);
  return img;
}

// ─── DESELECT ─────────────────────────────────────────────────────────────────
function deselectAllMakeup() {
  document.querySelectorAll('.prod-img').forEach(i => i.classList.remove('sel'));
  document.querySelectorAll('.pan-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.pan').forEach(p => p.classList.remove('sel'));
}

function deselect() {
  deselectAllMakeup();
  activeProductId = null;
  activeShade     = null;
  eraserMode      = false;
  blendingMode    = false;
  document.getElementById('brush-bar').classList.add('hidden');
  document.getElementById('eraser-btn').classList.remove('active');
  document.getElementById('blend-btn').classList.remove('active');
  hideApplicator();
  if (canvas) canvas.style.cursor = 'default';
}

// ─── NONE BUTTON ──────────────────────────────────────────────────────────────
function makeNoneBtn(label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'none-btn';
  btn.textContent = '✕ ' + label;
  btn.addEventListener('click', () => { onClick(); btn.classList.add('sel'); });
  return btn;
}

// ─── BRUSH CONTROLS ───────────────────────────────────────────────────────────
function bindBrushControls() {
  document.getElementById('brush-size').addEventListener('input', e => {
    brushRadius = parseInt(e.target.value);
  });
  document.getElementById('brush-opacity').addEventListener('input', e => {
    brushOpacity = parseInt(e.target.value);
  });

  const eraserBtn = document.getElementById('eraser-btn');
  eraserBtn.addEventListener('click', () => {
    if (!activeProductId) return;
    eraserMode   = !eraserMode;
    blendingMode = false;
    eraserBtn.classList.toggle('active', eraserMode);
    document.getElementById('blend-btn').classList.remove('active');
    updateCursor();
  });

  const blendBtn = document.getElementById('blend-btn');
  blendBtn.addEventListener('click', () => {
    if (!activeProductId) return;
    blendingMode = !blendingMode;
    eraserMode   = false;
    blendBtn.classList.toggle('active', blendingMode);
    document.getElementById('eraser-btn').classList.remove('active');
    updateCursor();
  });

  document.getElementById('clear-layer-btn').addEventListener('click', () => {
    if (activeProductId) clearLayer(activeProductId);
  });
  document.getElementById('clear-all-btn').addEventListener('click', () => {
    if (confirm('Clear all makeup?')) clearAllLayers();
  });
}

// ─── KEYBOARD ─────────────────────────────────────────────────────────────────
function bindKeyboard() {
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z') { e.preventDefault(); if (activeProductId) undoLayer(activeProductId); }
    if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); if (activeProductId) redoLayer(activeProductId); }
    if (e.key === 'Escape') deselect();
    if ((e.key === 'e' || e.key === 'E') && activeProductId) {
      eraserMode = !eraserMode;
      document.getElementById('eraser-btn').classList.toggle('active', eraserMode);
      updateCursor();
    }
    if ((e.key === 'b' || e.key === 'B') && activeProductId) {
      blendingMode = !blendingMode;
      document.getElementById('blend-btn').classList.toggle('active', blendingMode);
      updateCursor();
    }
  });
}
