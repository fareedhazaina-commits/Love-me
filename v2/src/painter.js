// The makeup painting engine: two canvases on the doll (blush + glitter), a floating-point blush
// buffer for a smooth finish, soft round dabs, glitter diamonds, an eraser, and stroke-by-stroke
// undo / redo. It knows nothing about React; App.jsx drives it with pointer positions.

export const CANVAS_W = 2048;          // about 1.5x the doll's pixels
export const CANVAS_H = 3072;          // full doll height at that scale
export const PAINT_H = 1000;           // rows we paint on: head, neck and shoulders (top third)
export const PAINT_FRAC = PAINT_H / CANVAS_H;

export const BRUSH_RADIUS = 44;        // canvas px: a soft round blush dab
export const ERASER_RADIUS = 54;
const STAMP_ALPHA = 0.03;              // light per stamp, colour builds up with every pass
const DAB_ALPHA = 0.075;               // a single press leaves a visible soft circle
const STAMP_SPACING = 0.3;             // fraction of the radius between stamps
const ERASE_STRENGTH = 0.2;
const TILE = 64;                       // undo remembers the touched 64x64 tiles only
const MAX_UNDO = 15;

// Soft round falloff (gaussian reaching exactly 0 at the rim, so no disc outline shows),
// indexed by squared distance from the centre.
function makeKernel(R, sigmaFrac) {
  const n = R * R;
  const k = new Float32Array(n + 1);
  const twoSigma2 = 2 * (R * sigmaFrac) ** 2;
  for (let i = 0; i <= n; i++) k[i] = Math.exp(-i / twoSigma2) * Math.min(1, (1 - i / n) * 3);
  return k;
}

const mix = (c, to, t) => c.map((v, i) => Math.round(v + (to[i] - v) * t));

// a four-pointed diamond sparkle
function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

export class Painter {
  constructor(blushCanvas, glitterCanvas) {
    this.bctx = blushCanvas.getContext('2d');
    this.gctx = glitterCanvas.getContext('2d', { willReadFrequently: true });
    this.W = blushCanvas.width;
    this.H = blushCanvas.height;
    this.buf = new Float32Array(this.W * this.H * 4);     // premultiplied rgba, 0..1
    this.zone = null;                                     // Uint8 alpha of the allowed area
    this.kBrush = makeKernel(BRUSH_RADIUS, 0.45);
    this.kErase = makeKernel(ERASER_RADIUS, 0.5);
    this.undoStack = [];
    this.redoStack = [];
    this.stroke = null;
  }

  setZone(alpha) { this.zone = alpha; }

  zoneAt(x, y) {
    if (!this.zone) return 1;
    const xi = x | 0, yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= this.W || yi >= this.H) return 0;
    return this.zone[yi * this.W + xi] / 255;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  // ---- history (one stroke = one undo step; only the tiles it touched are remembered) ----
  beginStroke() { this.stroke = { tiles: new Map() }; }

  endStroke() {
    const s = this.stroke;
    this.stroke = null;
    if (!s || s.tiles.size === 0) return false;
    this.undoStack.push(s);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack.length = 0;
    return true;
  }

  _readTile(tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    const w = Math.min(TILE, this.W - x), h = Math.min(TILE, this.H - y);
    const buf = new Float32Array(w * h * 4);
    for (let r = 0; r < h; r++) {
      const from = ((y + r) * this.W + x) * 4;
      buf.set(this.buf.subarray(from, from + w * 4), r * w * 4);
    }
    return { tx, ty, x, y, w, h, buf, g: this.gctx.getImageData(x, y, w, h) };
  }

  _writeTile(t) {
    for (let r = 0; r < t.h; r++) {
      this.buf.set(t.buf.subarray(r * t.w * 4, (r + 1) * t.w * 4), ((t.y + r) * this.W + t.x) * 4);
    }
    this.gctx.putImageData(t.g, t.x, t.y);
    this._flush(t.x, t.y, t.x + t.w - 1, t.y + t.h - 1);
  }

  _touch(x0, y0, x1, y1) {          // remember the "before" state of tiles this stroke is about to change
    if (!this.stroke) return;
    const ax = Math.max(0, x0), ay = Math.max(0, y0);
    const bx = Math.min(this.W - 1, x1), by = Math.min(this.H - 1, y1);
    for (let ty = Math.floor(ay / TILE); ty <= Math.floor(by / TILE); ty++) {
      for (let tx = Math.floor(ax / TILE); tx <= Math.floor(bx / TILE); tx++) {
        const key = ty * 1000 + tx;
        if (!this.stroke.tiles.has(key)) this.stroke.tiles.set(key, this._readTile(tx, ty));
      }
    }
  }

  undo() {
    const rec = this.undoStack.pop();
    if (!rec) return false;
    rec.after = new Map();
    for (const [key, t] of rec.tiles) rec.after.set(key, this._readTile(t.tx, t.ty));
    for (const t of rec.tiles.values()) this._writeTile(t);
    this.redoStack.push(rec);
    return true;
  }

  redo() {
    const rec = this.redoStack.pop();
    if (!rec) return false;
    for (const t of rec.after.values()) this._writeTile(t);
    this.undoStack.push(rec);
    return true;
  }

  clear() {
    this.buf.fill(0);
    this.bctx.clearRect(0, 0, this.W, this.H);
    this.gctx.clearRect(0, 0, this.W, this.H);
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.stroke = null;
  }

  // ---- drawing the float buffer onto the blush canvas ----
  // The canvas holds an OPAQUE colour that, multiplied over the skin, equals "paint of alpha A and
  // colour C". That avoids the hue noise of low-alpha 8-bit canvases; a touch of dither avoids banding.
  _flush(x0, y0, x1, y1) {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;
    const img = this.bctx.createImageData(w, h);
    const o = img.data;
    const buf = this.buf;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const i = ((y0 + yy) * this.W + (x0 + xx)) * 4;
        const A = buf[i + 3];
        const j = (yy * w + xx) * 4;
        const dither = Math.random() - 0.5;
        o[j] = 255 * (1 - A + buf[i]) + dither;
        o[j + 1] = 255 * (1 - A + buf[i + 1]) + dither;
        o[j + 2] = 255 * (1 - A + buf[i + 2]) + dither;
        o[j + 3] = 255;
      }
    }
    this.bctx.putImageData(img, x0, y0);
  }

  // one soft blush stamp, limited to the allowed zone; returns the zone weight under its centre
  _stamp(cx, cy, rgb, alpha) {
    const R = BRUSH_RADIUS, R2 = R * R;
    const zw = this.zoneAt(cx, cy);
    if (zw < 0.02) return { zw, rect: null };
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(this.W - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(this.H - 1, Math.ceil(cy + R));
    this._touch(x0, y0, x1, y1);
    const [cr, cg, cb] = rgb.map((v) => v / 255);
    const { buf, zone, W, kBrush } = this;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy - cy;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        const z = zone ? zone[yy * W + xx] / 255 : 1;
        if (z === 0) continue;
        const a = alpha * kBrush[d2 | 0] * z;
        if (a < 0.0004) continue;
        const i = (yy * W + xx) * 4;
        const keep = 1 - a;                       // "over" compositing, premultiplied
        buf[i] = cr * a + buf[i] * keep;
        buf[i + 1] = cg * a + buf[i + 1] * keep;
        buf[i + 2] = cb * a + buf[i + 2] * keep;
        buf[i + 3] = a + buf[i + 3] * keep;
      }
    }
    return { zw, rect: [x0, y0, x1, y1] };
  }

  // a sparkle of glitter: a few big diamonds and lots of miniature ones of the same shape
  _glitter(x, y, rgb, radius, amount) {
    const tinyN = Math.round(amount * (3 + Math.random() * 3));     // many miniature diamonds
    for (let i = 0; i < tinyN; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * radius;
      this._diamond(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, rgb, 1.5 + Math.random() * 1.6);
    }
  }

  _diamond(x, y, rgb, size) {
    if (this.zoneAt(x, y) < 0.35) return;
    const r = size ?? 4 + Math.random() * 4;                        // big ones are 4-8 px, tiny ones 1.5-3 px
    this._touch(Math.floor(x - r - 1), Math.floor(y - r - 1), Math.ceil(x + r + 1), Math.ceil(y + r + 1));
    const t = 0.5 + Math.random() * 0.4;
    const [sr, sg, sb] = mix(rgb, [255, 255, 255], Math.random() < 0.2 ? 0.92 : t);
    this.gctx.fillStyle = `rgba(${sr},${sg},${sb},${0.85 + Math.random() * 0.15})`;
    diamond(this.gctx, x, y, r);
  }

  _grow(rect, r) {
    if (!rect) return r;
    if (!r) return rect.slice();
    return [Math.min(r[0], rect[0]), Math.min(r[1], rect[1]), Math.max(r[2], rect[2]), Math.max(r[3], rect[3])];
  }

  // ---- blush ----
  // A stroke is a trail of overlapping round dabs. `factor` (0..1) is how much colour is on the
  // brush. Returns the new carry and `used`: stroke length actually painted inside the zone.
  blushSegment(a, b, carry, { rgb, factor, glitter }) {
    const spacing = BRUSH_RADIUS * STAMP_SPACING;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    let d = spacing - carry;
    let dirty = null;
    let used = 0;
    while (d <= dist) {
      const t = dist === 0 ? 0 : d / dist;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const { zw, rect } = this._stamp(x, y, rgb, STAMP_ALPHA * factor);
      if (rect) {
        dirty = this._grow(rect, dirty);
        used += spacing * zw;
        if (glitter > 0.05) {
          this._glitter(x, y, rgb, BRUSH_RADIUS * 0.9, glitter * factor);           // lots of tiny diamonds
          if (Math.random() < 0.2 * glitter * factor) {                              // and the odd big one
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * BRUSH_RADIUS * 0.9;
            this._diamond(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, rgb);
          }
        }
      }
      d += spacing;
    }
    if (dirty) this._flush(...dirty);
    return { carry: (carry + dist) % spacing, used };
  }

  // a single press: one soft round circle (factor scales it; `weak` for the repeats while holding)
  dab(x, y, { rgb, factor, glitter }, weak = false) {
    const { zw, rect } = this._stamp(x, y, rgb, DAB_ALPHA * factor * (weak ? 0.45 : 1));
    if (!rect) return 0;
    this._flush(...rect);
    if (glitter > 0.05) {
      for (let k = 0; k < (weak ? 2 : 3); k++) this._glitter(x, y, rgb, BRUSH_RADIUS * 0.85, glitter * factor);
      const bigN = Math.random() < 0.7 * glitter * factor ? 1 + (Math.random() < 0.4 ? 1 : 0) : 0;
      for (let i = 0; i < bigN; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * BRUSH_RADIUS * 0.8;
        this._diamond(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, rgb);
      }
    }
    return zw;
  }

  // ---- eraser: softly rubs out blush and glitter (anywhere on the skin) ----
  _erase(cx, cy, strength) {
    const R = ERASER_RADIUS, R2 = R * R;
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(this.W - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(this.H - 1, Math.ceil(cy + R));
    if (x1 < x0 || y1 < y0) return null;
    this._touch(x0, y0, x1, y1);
    const { buf, W, kErase } = this;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy - cy;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        const keep = 1 - strength * kErase[d2 | 0];
        const i = (yy * W + xx) * 4;
        buf[i] *= keep; buf[i + 1] *= keep; buf[i + 2] *= keep; buf[i + 3] *= keep;
      }
    }
    const g = this.gctx;                          // glitter fades the same way
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad.addColorStop(0, `rgba(0,0,0,${Math.min(1, strength * 1.6)})`);
    grad.addColorStop(0.6, `rgba(0,0,0,${Math.min(1, strength * 1.0)})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = grad;
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.restore();
    return [x0, y0, x1, y1];
  }

  eraseSegment(a, b, carry) {
    const spacing = ERASER_RADIUS * 0.35;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    let d = spacing - carry;
    let dirty = null;
    while (d <= dist) {
      const t = dist === 0 ? 0 : d / dist;
      const rect = this._erase(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, ERASE_STRENGTH);
      dirty = this._grow(rect, dirty);
      d += spacing;
    }
    if (dirty) this._flush(...dirty);
    return (carry + dist) % spacing;
  }

  eraseDab(x, y) {
    const rect = this._erase(x, y, ERASE_STRENGTH * 1.4);
    if (rect) this._flush(...rect);
  }
}
