// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const FACE_W = 400;
const FACE_H = 550;

// ─── STATE ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let faceX = 0, faceY = 0;
let isDrawing = false;
let lastX = null, lastY = null;
let lastPressure = 0.5;
let lastPointerTime = 0;
let activePointerId = null;
let blendScratch = null;
let blendScratchCtx = null;
let isBlinking = false;
let eraserMode   = false;
let blendingMode = false;

let activeProductId = null;
let activeShade     = null;
let brushRadius     = 20;
let brushOpacity    = 5;

let activeBrowStyleId = null;
let activeLashStyleId = null;
let activeHairStyleId = null;
let browColor = '#3D1F0D';

// ─── IMAGES ───────────────────────────────────────────────────────────────────
const faceImg      = new Image();
const blinkImg     = new Image();
const browImg      = new Image();
const lashImg      = new Image();
const hairBackImg  = new Image();
const hairFrontImg = new Image();

let tintedBrowCache = null;
let tintedBrowColor = null;

// ─── LAYERS ───────────────────────────────────────────────────────────────────
const layers      = {};
const layerCtxs   = {};
const undoStacks  = {};
const redoStacks  = {};
const layerUsed   = {};
const MAX_UNDO    = 20;

// ─── ANIMATED CURSOR (spring physics) ────────────────────────────────────────
let _cursorWrap = null;
let _cursorImg  = null;
let _cursorDot  = null;

// Spring state
let _mouseX = 0, _mouseY = 0;
let _curX   = 0, _curY   = 0;
let _velX   = 0, _velY   = 0;
let _rot    = 0;
let _cursorReady = false;

const SPRING_K   = 0.16;  // stiffness
const SPRING_D   = 0.74;  // damping
const MAX_ROTATE = 14;    // max tilt in degrees

function initCursorPhysics() {
  _cursorWrap = document.getElementById('cursor-wrap');
  _cursorImg  = document.getElementById('cursor-img');
  _cursorDot  = document.getElementById('cursor-dot');

  document.addEventListener('mousemove', e => {
    if (!_cursorReady) {
      _curX = e.clientX; _curY = e.clientY;
      _cursorReady = true;
    }
    _mouseX = e.clientX;
    _mouseY = e.clientY;
  });

  requestAnimationFrame(_animCursor);
}

function _animCursor() {
  requestAnimationFrame(_animCursor);
  if (!_cursorWrap || _cursorWrap.classList.contains('hidden') || !_cursorReady) return;

  // Spring step
  const dx = _mouseX - _curX;
  const dy = _mouseY - _curY;
  _velX = (_velX + dx * SPRING_K) * SPRING_D;
  _velY = (_velY + dy * SPRING_K) * SPRING_D;
  _curX += _velX;
  _curY += _velY;

  // Tilt in direction of horizontal movement (lean like a real brush)
  const speed  = Math.hypot(_velX, _velY);
  const target = speed > 0.4 ? Math.atan2(_velX, -_velY) * (180 / Math.PI) * 0.22 : 0;
  _rot += (target - _rot) * 0.12;
  const r = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, _rot));

  _cursorWrap.style.left      = _curX + 'px';
  _cursorWrap.style.top       = _curY + 'px';
  _cursorWrap.style.transform = `translate(-50%, -88%) rotate(${r.toFixed(2)}deg)`;
}

function showApplicator(imgSrc, dotColor) {
  if (!_cursorWrap || !_cursorImg) return;
  _cursorImg.src = imgSrc;

  if (_cursorDot) {
    if (dotColor) {
      _cursorDot.style.display    = 'block';
      _cursorDot.style.background = dotColor;
    } else {
      _cursorDot.style.display = 'none';
    }
  }

  _cursorWrap.classList.remove('hidden');
  document.body.classList.add('has-applicator');
}

function hideApplicator() {
  if (!_cursorWrap) return;
  _cursorWrap.classList.add('hidden');
  document.body.classList.remove('has-applicator');
}

function bounceApplicator() {
  if (!_cursorWrap || _cursorWrap.classList.contains('hidden')) return;
  _cursorWrap.classList.remove('pressing');
  requestAnimationFrame(() => {
    _cursorWrap.classList.add('pressing');
    _cursorWrap.addEventListener('animationend', () => _cursorWrap.classList.remove('pressing'), { once: true });
  });
}

// ─── TRANSPARENCY HELPER ──────────────────────────────────────────────────────
function stripWhiteBg(imgEl) {
  try {
    const c = document.createElement('canvas');
    c.width  = imgEl.naturalWidth  || 400;
    c.height = imgEl.naturalHeight || 550;
    const octx = c.getContext('2d');
    octx.drawImage(imgEl, 0, 0);
    const d  = octx.getImageData(0, 0, c.width, c.height);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i+1], b = px[i+2], a = px[i+3];
      if (a < 10) continue;
      const bright = (r + g + b) / 3;
      const sat    = Math.max(r, g, b) - Math.min(r, g, b);
      if (bright > 218 && sat < 30) {
        const t = Math.max(0, (bright - 218) / 37);
        px[i+3] = Math.round(a * (1 - t));
      }
    }
    octx.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
  } catch (e) {
    return null;
  }
}

// Load an image, strip white background, set onto target Image object
function loadProcessed(target, src, onDone) {
  const loader = new Image();
  loader.crossOrigin = 'anonymous';
  loader.onload = () => {
    const processed = stripWhiteBg(loader);
    target.onload = () => { if (onDone) onDone(); else render(); };
    target.src = processed || src;
  };
  loader.onerror = () => {
    target.src = src;
    target.onload = () => { if (onDone) onDone(); else render(); };
  };
  loader.src = src;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function initEngine(mainCanvas) {
  canvas = mainCanvas;
  ctx    = canvas.getContext('2d');

  canvas.width  = FACE_W;
  canvas.height = FACE_H;

  LAYER_ORDER.forEach(id => {
    const c = document.createElement('canvas');
    c.width  = FACE_W;
    c.height = FACE_H;
    layers[id]     = c;
    layerCtxs[id]  = c.getContext('2d');
    undoStacks[id] = [];
    redoStacks[id] = [];
    layerUsed[id]  = false;
  });

  faceX = 0;
  faceY = 0;

  // Pointer Events unify mouse, touch and stylus input. Capture keeps a stroke
  // continuous when the pointer briefly leaves the canvas.
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('lostpointercapture', onPointerUp);

  initCursorPhysics();
}

// ─── SKIN TONE ────────────────────────────────────────────────────────────────
function loadSkinTone(toneId) {
  loadProcessed(faceImg,  `assets/Body/${toneId}.png`);
  loadProcessed(blinkImg, `assets/Body/${toneId}(EC).png`, () => {});
}

// ─── BLINK ────────────────────────────────────────────────────────────────────
function startBlink() {
  function doBlink() {
    isBlinking = true;  render();
    setTimeout(() => {
      isBlinking = false; render();
      setTimeout(doBlink, 2500 + Math.random() * 2500);
    }, 110 + Math.random() * 60);
  }
  setTimeout(doBlink, 1200 + Math.random() * 800);
}

// ─── OVERLAYS ─────────────────────────────────────────────────────────────────
function setBrow(styleId, color) {
  activeBrowStyleId = styleId;
  if (color) browColor = color;
  const s = BROW_STYLES.find(b => b.id === styleId);
  if (!s) return;
  tintedBrowCache = null;
  loadProcessed(browImg, s.img, () => { tintedBrowCache = null; render(); });
}
function clearBrow()        { activeBrowStyleId = null; browImg.src = ''; render(); }
function setBrowColor(hex)  { browColor = hex; tintedBrowCache = null; render(); }

function setLash(styleId) {
  activeLashStyleId = styleId;
  const s = LASH_STYLES.find(l => l.id === styleId);
  if (!s) return;
  loadProcessed(lashImg, s.img);
}
function clearLash() { activeLashStyleId = null; lashImg.src = ''; render(); }

function setHair(styleId) {
  activeHairStyleId = styleId;
  const s = HAIR_STYLES.find(h => h.id === styleId);
  if (!s) return;
  if (s.back) {
    loadProcessed(hairBackImg,  s.back);
    loadProcessed(hairFrontImg, s.front);
  } else {
    loadProcessed(hairBackImg, s.img);
    hairFrontImg.src = '';
  }
}
function clearHair() {
  activeHairStyleId = null;
  hairBackImg.src = ''; hairFrontImg.src = '';
  render();
}

// ─── TINTED BROW ─────────────────────────────────────────────────────────────
function getTintedBrow() {
  if (tintedBrowCache && tintedBrowColor === browColor) return tintedBrowCache;
  if (!browImg.complete || !browImg.naturalWidth) return null;
  const off  = document.createElement('canvas');
  off.width  = FACE_W; off.height = FACE_H;
  const oc   = off.getContext('2d');
  oc.drawImage(browImg, 0, 0, FACE_W, FACE_H);
  oc.globalCompositeOperation = 'source-atop';
  oc.fillStyle   = browColor;
  oc.globalAlpha = 0.82;
  oc.fillRect(0, 0, FACE_W, FACE_H);
  oc.globalAlpha = 1;
  tintedBrowCache = off;
  tintedBrowColor = browColor;
  return off;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, FACE_W, FACE_H);

  // 1. Hair back
  if (activeHairStyleId && hairBackImg.complete && hairBackImg.naturalWidth)
    ctx.drawImage(hairBackImg, 0, 0, FACE_W, FACE_H);

  // 2. Base doll (or blink frame)
  const base = (isBlinking && blinkImg.complete && blinkImg.naturalWidth) ? blinkImg : faceImg;
  if (base.complete && base.naturalWidth)
    ctx.drawImage(base, 0, 0, FACE_W, FACE_H);

  // 3. Makeup layers (PRD order: foundation→contour→blush→highlight→eyeshadow→eyeliner→mascara→lip→gloss)
  LAYER_ORDER.forEach(id => ctx.drawImage(layers[id], 0, 0));

  // 4. Lip shine overlay (screen mode highlight so lips never look flat)
  if (layerUsed['lipcolor'] || layerUsed['lipgloss']) drawLipShine();

  // 5. Brows (tinted overlay)
  if (activeBrowStyleId) {
    const tb = getTintedBrow();
    if (tb) ctx.drawImage(tb, 0, 0);
  }

  // 6. Lashes
  if (activeLashStyleId && lashImg.complete && lashImg.naturalWidth)
    ctx.drawImage(lashImg, 0, 0, FACE_W, FACE_H);

  // 7. Hair front (bangs over face)
  if (activeHairStyleId && hairFrontImg.src && hairFrontImg.complete && hairFrontImg.naturalWidth)
    ctx.drawImage(hairFrontImg, 0, 0, FACE_W, FACE_H);
}

function drawLipShine() {
  const z  = ZONES.lipcolor[0];
  const cx = z.cx * FACE_W;
  const cy = z.cy * FACE_H;
  const rx = z.rx * FACE_W;
  const ry = z.ry * FACE_H;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.94, ry * 0.88, 0, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(cx, cy - ry * 0.28, 0, cx, cy, rx * 0.70);
  g.addColorStop(0,   'rgba(255,255,255,0.55)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.22)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.restore();
}

// ─── ZONE CHECK ───────────────────────────────────────────────────────────────
// Build one clipping path from the product's allowed face regions. Clipping the
// whole brush footprint (not just its centre) prevents soft edges crossing the
// boundary of the selected makeup area.
function clipToProductZone(targetCtx, productId) {
  const product = PRODUCTS[productId];
  const ellipses = product && ZONES[product.zone];
  if (!ellipses || !ellipses.length) return false;

  targetCtx.beginPath();
  ellipses.forEach(e => {
    targetCtx.ellipse(
      e.cx * FACE_W, e.cy * FACE_H,
      e.rx * FACE_W, e.ry * FACE_H,
      0, 0, Math.PI * 2
    );
  });
  targetCtx.clip();
  return true;
}

function isInZone(productId, x, y) {
  const key      = PRODUCTS[productId].zone;
  const ellipses = ZONES[key];
  if (!ellipses) return false;
  const nx = x / FACE_W;
  const ny = y / FACE_H;
  return ellipses.some(e => {
    const dx = (nx - e.cx) / e.rx;
    const dy = (ny - e.cy) / e.ry;
    return dx * dx + dy * dy <= 1;
  });
}

// ─── STROKE ───────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}

function applyStroke(x, y, pressure = 0.5, speed = 0, shouldRender = true) {
  if (!activeProductId) return;
  if (!eraserMode && !activeShade) return;

  const product = PRODUCTS[activeProductId];
  const lctx = layerCtxs[activeProductId];
  if (!product || !lctx) return;

  // Pressure changes both brush footprint and pigment load. A neutral 0.5
  // pressure keeps mouse/touch behaviour identical to the previous baseline.
  const normalizedPressure = Math.max(0.1, Math.min(1, Number(pressure) || 0.5));
  const pressureScale = 0.78 + normalizedPressure * 0.44;
  const effR = product.radius * (brushRadius / 20) * pressureScale;

  if (!eraserMode && !isInZone(activeProductId, x, y)) return;

  lctx.save();
  if (!eraserMode) clipToProductZone(lctx, activeProductId);

  if (eraserMode) {
    const g = lctx.createRadialGradient(x, y, 0, x, y, effR * 1.3);
    g.addColorStop(0,    'rgba(0,0,0,0.28)');
    g.addColorStop(0.30, 'rgba(0,0,0,0.14)');
    g.addColorStop(0.60, 'rgba(0,0,0,0.05)');
    g.addColorStop(1,    'rgba(0,0,0,0)');
    lctx.globalCompositeOperation = 'destination-out';
    lctx.fillStyle = g;
  } else {
    // Soft airbrush — 5-stop gradient for natural feathering
    // Real pressure is available on many styluses. Mouse/touch commonly report
    // a fixed or missing value, so pressure is normalised with a safe fallback.
    const pressureFactor = 0.55 + normalizedPressure;
    // Slower strokes deposit slightly more pigment; fast swipes stay lighter.
    const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    const speedFactor = 1.12 - Math.min(0.55, safeSpeed / 900);
    const opacity = product.opacityStep * (brushOpacity / 5) * pressureFactor * speedFactor;
    const { r, g, b } = hexToRgb(activeShade.hex);
    const gr = lctx.createRadialGradient(x, y, 0, x, y, effR);
    gr.addColorStop(0,    `rgba(${r},${g},${b},${(opacity * 0.70).toFixed(4)})`);
    gr.addColorStop(0.20, `rgba(${r},${g},${b},${(opacity * 0.48).toFixed(4)})`);
    gr.addColorStop(0.45, `rgba(${r},${g},${b},${(opacity * 0.22).toFixed(4)})`);
    gr.addColorStop(0.72, `rgba(${r},${g},${b},${(opacity * 0.07).toFixed(4)})`);
    gr.addColorStop(1,    `rgba(${r},${g},${b},0)`);
    lctx.globalCompositeOperation = product.blendMode;
    lctx.fillStyle = gr;
    layerUsed[activeProductId] = true;
  }

  lctx.beginPath();
  lctx.arc(x, y, effR, 0, Math.PI * 2);
  lctx.fill();
  lctx.restore();
  if (shouldRender) render();
}

// ─── BLEND STROKE ─────────────────────────────────────────────────────────────
function applyBlendStroke(x, y, pressure = 0.5, shouldRender = true) {
  if (!activeProductId) return;
  const product = PRODUCTS[activeProductId];
  const c = layers[activeProductId];
  const lctx = layerCtxs[activeProductId];
  if (!product || !c || !lctx || !isInZone(activeProductId, x, y)) return;

  const normalizedPressure = Math.max(0.1, Math.min(1, Number(pressure) || 0.5));
  const pressureScale = 0.78 + normalizedPressure * 0.44;
  const effR = product.radius * (brushRadius / 20) * pressureScale * 2.2;

  // Reuse one scratch canvas instead of allocating a new canvas per stamp.
  if (!blendScratch) {
    blendScratch = document.createElement('canvas');
    blendScratch.width = FACE_W; blendScratch.height = FACE_H;
    blendScratchCtx = blendScratch.getContext('2d');
  }
  const tc = blendScratchCtx;
  tc.clearRect(0, 0, FACE_W, FACE_H);
  tc.filter = `blur(${Math.max(3, Math.round(effR * 0.18))}px)`;
  tc.drawImage(c, 0, 0);
  tc.filter = 'none';

  // Composite blurred version into clip circle
  lctx.save();
  clipToProductZone(lctx, activeProductId);
  lctx.beginPath();
  lctx.arc(x, y, effR, 0, Math.PI * 2);
  lctx.clip();
  lctx.globalAlpha = 0.22 * (brushOpacity / 5) * (0.55 + normalizedPressure);
  lctx.drawImage(blendScratch, 0, 0);
  lctx.restore();
  if (shouldRender) render();
}

// ─── APPLICATOR CURSOR ────────────────────────────────────────────────────────
const BRUSH_CURSOR_MAP = {
  foundation:  'assets/Makeup Products/Brushes/Soft Brush.png',
  blush:       'assets/Makeup Products/Brushes/Diffuse Brush.png',
  highlighter: 'assets/Makeup Products/Brushes/Diffuse Brush.png',
  eyeshadow:   'assets/Makeup Products/Brushes/Soft Brush.png',
  contour:     'assets/Makeup Products/Brushes/Precision Brush.png',
  mascara:     'assets/Makeup Products/Mascara/Mascara.png',
};

// updateCursor — called whenever activeProductId / activeShade / mode changes
function updateCursor() {
  if (!canvas) return;

  if (eraserMode) {
    hideApplicator();
    canvas.style.cursor = 'cell';
    return;
  }

  if (blendingMode) {
    showApplicator('assets/Makeup Products/Brushes/Smudge Brush.png', null);
    canvas.style.cursor = 'none';
    return;
  }

  if (!activeProductId || !activeShade) {
    hideApplicator();
    canvas.style.cursor = 'default';
    return;
  }

  let imgSrc, dotColor = null;

  if (['eyeliner', 'lipcolor', 'lipgloss'].includes(activeProductId)) {
    imgSrc = activeShade.img;
  } else {
    imgSrc   = BRUSH_CURSOR_MAP[activeProductId];
    dotColor = activeShade.hex;
  }

  if (!imgSrc) { hideApplicator(); canvas.style.cursor = 'crosshair'; return; }

  showApplicator(imgSrc, dotColor);
  canvas.style.cursor = 'none';
}

// ─── POINTER EVENTS ───────────────────────────────────────────────────────────
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = FACE_W / rect.width;
  const scaleY = FACE_H / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function getPointerPressure(e) {
  // PointerEvent.pressure is meaningful for a pressed stylus. Mouse and many
  // touchscreens report 0 or a constant; use a stable fallback in those cases.
  return (Number.isFinite(e.pressure) && e.pressure > 0) ? e.pressure : 0.5;
}

function onPointerDown(e) {
  // Ignore secondary pointers while a stroke is active; this prevents a
  // second finger from stealing pointer capture and corrupting the first path.
  if (isDrawing || !activeProductId || (e.button !== undefined && e.button !== 0)) return;
  e.preventDefault();
  activePointerId = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  isDrawing = true;
  lastX = null; lastY = null;
  lastPressure = getPointerPressure(e);
  lastPointerTime = performance.now();
  saveUndo(activeProductId);
  bounceApplicator();
  const { x, y } = getPos(e);
  if (blendingMode) applyBlendStroke(x, y, lastPressure, false);
  else applyStroke(x, y, lastPressure, 0, false);
  lastX = x; lastY = y;
  render();
}

function onPointerMove(e) {
  if (!isDrawing || (activePointerId !== null && e.pointerId !== activePointerId)) return;
  e.preventDefault();
  const { x, y } = getPos(e);
  const pressure = getPointerPressure(e);
  const now = performance.now();
  const elapsed = Math.max(1, now - lastPointerTime);
  const distance = lastX === null ? 0 : Math.hypot(x - lastX, y - lastY);
  const speed = distance / elapsed * 1000;

  if (lastX !== null) {
    // Interpolate stamps to avoid gaps during fast swipes. Pressure is
    // interpolated too, so stylus changes remain smooth along the stroke.
    const steps = Math.min(64, Math.max(1, Math.ceil(distance / 2.2)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = lastX + (x - lastX) * t;
      const py = lastY + (y - lastY) * t;
      const pp = lastPressure + (pressure - lastPressure) * t;
      if (blendingMode) applyBlendStroke(px, py, pp, false);
      else applyStroke(px, py, pp, speed, false);
    }
  } else if (blendingMode) {
    applyBlendStroke(x, y, pressure, false);
  } else {
    applyStroke(x, y, pressure, speed, false);
  }

  lastX = x; lastY = y;
  lastPressure = pressure;
  lastPointerTime = now;
  render();
}

function onPointerUp(e) {
  if (e && activePointerId !== null && e.pointerId !== activePointerId) return;
  if (activePointerId !== null && canvas && canvas.hasPointerCapture(activePointerId)) {
    try { canvas.releasePointerCapture(activePointerId); } catch (_) {}
  }
  isDrawing = false;
  lastX = null; lastY = null;
  lastPointerTime = 0;
  activePointerId = null;
}

// ─── UNDO / REDO / CLEAR ──────────────────────────────────────────────────────
function saveUndo(id) {
  const stack = undoStacks[id];
  stack.push(layerCtxs[id].getImageData(0, 0, FACE_W, FACE_H));
  if (stack.length > MAX_UNDO) stack.shift();
  redoStacks[id] = []; // new action clears redo
}

function undoLayer(id) {
  if (!undoStacks[id].length) return;
  redoStacks[id].push(layerCtxs[id].getImageData(0, 0, FACE_W, FACE_H));
  layerCtxs[id].putImageData(undoStacks[id].pop(), 0, 0);
  render();
}

function redoLayer(id) {
  if (!redoStacks[id].length) return;
  undoStacks[id].push(layerCtxs[id].getImageData(0, 0, FACE_W, FACE_H));
  layerCtxs[id].putImageData(redoStacks[id].pop(), 0, 0);
  render();
}

function clearLayer(id) {
  saveUndo(id);
  layerCtxs[id].clearRect(0, 0, FACE_W, FACE_H);
  layerUsed[id] = false;
  render();
}

function clearAllLayers() {
  LAYER_ORDER.forEach(id => {
    layerCtxs[id].clearRect(0, 0, FACE_W, FACE_H);
    undoStacks[id] = []; redoStacks[id] = [];
    layerUsed[id]  = false;
  });
  render();
}
