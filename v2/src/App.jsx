import { useCallback, useEffect, useRef, useState } from 'react';
import { SHADES } from './shades.js';
import dollMeta from './doll.json';   // written by tools/prep_doll.py

// ---- artwork (made by tools/prep_doll.py) ----
const DOLL = '/doll/doll.webp';
const EYES_CLOSED = '/doll/eyes-closed.webp';      // only the eyes; swapped in for a blink
const SKIN_MASK = '/doll/skin-mask.png';
const EYES = dollMeta.eyes;                         // eye patch position, % of the doll

// ---- makeup layers ----
// Paint is kept only for the head, neck and shoulders (the top third of the doll), which is all the
// zoomed-in view ever shows. That keeps phone memory low while the strokes stay sharp.
const CANVAS_W = 2048;                 // about 1.5x the doll's pixels
const CANVAS_H = 3072;                 // full doll height at that scale
const PAINT_H = 1000;                  // rows of it that we paint on
const PAINT_FRAC = PAINT_H / CANVAS_H;
const BRUSH_RADIUS = 34;               // canvas px
const STAMP_ALPHA = 0.03;              // light per stamp: colour builds up with every pass
const STAMP_SPACING = 0.3;             // fraction of the radius between stamps
const BRUSH_TIP = { x: 0.5, y: 0.08 }; // where the bristles touch, fraction of the brush image

// Soft round falloff (gaussian that reaches exactly 0 at the edge, so no disc outline shows),
// indexed by squared distance from the stamp centre.
const KERNEL = (() => {
  const n = BRUSH_RADIUS * BRUSH_RADIUS;
  const k = new Float32Array(n + 1);
  const twoSigma2 = 2 * (BRUSH_RADIUS * 0.42) ** 2;
  for (let i = 0; i <= n; i++) k[i] = Math.exp(-i / twoSigma2) * Math.min(1, (1 - i / n) * 3);
  return k;
})();

// ---- staging ----
const DOLL_X = { room: 50, vanity: 69 }; // doll centre, % of the room width
const FACE_Y = 39;                       // face centre, % of the room height (zoom focus)
const WALK_MS = 1500;
const ZOOM_MS = 900;

// Random blink: eyes open for 2.5–5.5s, then closed for ~140ms; sometimes a quick double blink.
function useBlink() {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    let timer;
    const wait = (ms, fn) => { timer = setTimeout(fn, ms); };
    const openPhase = () => wait(2500 + Math.random() * 3000, () => {
      setClosed(true);
      wait(140, () => {
        setClosed(false);
        if (Math.random() < 0.25) {
          wait(120, () => { setClosed(true); wait(140, () => { setClosed(false); openPhase(); }); });
        } else {
          openPhase();
        }
      });
    });
    openPhase();
    return () => clearTimeout(timer);
  }, []);
  return closed;
}

// How far to zoom so her whole head fits comfortably on this screen shape.
function useFaceZoom() {
  const calc = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    return Math.max(2.8, Math.min(4.6, (0.8 * W) / (0.105 * H)));
  };
  const [zoom, setZoom] = useState(calc);
  useEffect(() => {
    const onResize = () => setZoom(calc());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return zoom;
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (c, to, t) => c.map((v, i) => Math.round(v + (to[i] - v) * t));
// push a colour away from grey so glitter stays vivid instead of washing out
const vivid = (c, k = 1.3) => { const m = (c[0] + c[1] + c[2]) / 3; return c.map((v) => Math.max(0, Math.min(255, Math.round(m + (v - m) * k)))); };

function sparkle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

export default function App() {
  const closed = useBlink();
  const zoom = useFaceZoom();

  // stage: room -> walking (to the vanity) -> zoomed (painting) -> leaving (zoom out, walk back)
  const [stage, setStage] = useState('room');
  const [atVanity, setAtVanity] = useState(false);
  const [shade, setShade] = useState(null);
  const [painted, setPainted] = useState(false);

  const blushRef = useRef(null);
  const glitterRef = useRef(null);
  const brushRef = useRef(null);
  const drag = useRef(null);
  const timers = useRef([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });   // brush offset from its resting spot

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const openMakeup = () => {
    if (stage !== 'room') return;
    setStage('walking');
    setAtVanity(true);                              // she walks over to the vanity...
    later(() => setStage('zoomed'), WALK_MS + 100);  // ...then the camera zooms to her face
  };

  const closeMakeup = () => {
    if (stage !== 'zoomed') return;
    setStage('leaving');                            // zoom out first...
    drag.current = null;
    setOffset({ x: 0, y: 0 });
    later(() => setAtVanity(false), ZOOM_MS);       // ...then she walks back to the centre
    later(() => setStage('room'), ZOOM_MS + WALK_MS);
  };

  // Matte blush is accumulated in a floating-point buffer (smooth, no 8-bit banding or hue noise)
  // and drawn as an opaque "multiply" colour with a touch of dither, so it looks like a soft
  // skin-toned finish. Glitter shades also scatter tiny coloured specks.
  const paintBuf = useRef(null);

  const paintSegment = useCallback((from, to, carry) => {
    const blush = blushRef.current;
    const glitter = glitterRef.current;
    if (!blush || !shade) return carry;
    if (!paintBuf.current) paintBuf.current = new Float32Array(CANVAS_W * PAINT_H * 4);
    const buf = paintBuf.current;
    const rect = blush.getBoundingClientRect();
    const sx = blush.width / rect.width;
    const sy = blush.height / rect.height;
    const bctx = blush.getContext('2d');
    const gctx = glitter.getContext('2d');
    const base = hexToRgb(shade.hex);
    const [cr, cg, cb] = base.map((v) => v / 255);
    const R = BRUSH_RADIUS;
    const R2 = R * R;
    const spacing = R * STAMP_SPACING;

    const ax = (from.x - rect.left) * sx, ay = (from.y - rect.top) * sy;
    const bx = (to.x - rect.left) * sx, by = (to.y - rect.top) * sy;
    const dist = Math.hypot(bx - ax, by - ay);

    let dx0 = Infinity, dy0 = Infinity, dx1 = -1, dy1 = -1;
    let d = spacing - carry;
    while (d <= dist) {
      const t = dist === 0 ? 0 : d / dist;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (x > -R && x < CANVAS_W + R && y > -R && y < PAINT_H + R) {
        const x0 = Math.max(0, Math.floor(x - R)), x1 = Math.min(CANVAS_W - 1, Math.ceil(x + R));
        const y0 = Math.max(0, Math.floor(y - R)), y1 = Math.min(PAINT_H - 1, Math.ceil(y + R));
        for (let yy = y0; yy <= y1; yy++) {
          const ddy = yy - y;
          for (let xx = x0; xx <= x1; xx++) {
            const ddx = xx - x;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 > R2) continue;
            const a = STAMP_ALPHA * KERNEL[d2 | 0];
            if (a < 0.0004) continue;
            const i = (yy * CANVAS_W + xx) * 4;
            const keep = 1 - a;               // "over" compositing, premultiplied
            buf[i] = cr * a + buf[i] * keep;
            buf[i + 1] = cg * a + buf[i + 1] * keep;
            buf[i + 2] = cb * a + buf[i + 2] * keep;
            buf[i + 3] = a + buf[i + 3] * keep;
          }
        }
        if (x0 < dx0) dx0 = x0;
        if (y0 < dy0) dy0 = y0;
        if (x1 > dx1) dx1 = x1;
        if (y1 > dy1) dy1 = y1;

        if (shade.glitter) {
          const n = 3 + (Math.random() < 0.5 ? 1 : 0);
          for (let k = 0; k < n; k++) {
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * R * 0.95;
            const px = x + Math.cos(ang) * rad;
            const py = y + Math.sin(ang) * rad;
            if (Math.random() < 0.05) {            // the odd tiny sparkle
              const [sr, sg, sb] = mix(base, [255, 255, 255], 0.55);
              gctx.fillStyle = `rgba(${sr},${sg},${sb},0.95)`;
              sparkle(gctx, px, py, 3.5 + Math.random() * 3.5);
            } else {                                // fine, saturated glitter
              const [gr, gg, gb] = vivid(mix(base, [255, 255, 255], Math.random() * 0.35));
              gctx.fillStyle = `rgba(${gr},${gg},${gb},${0.8 + Math.random() * 0.2})`;
              gctx.beginPath();
              gctx.arc(px, py, 0.9 + Math.random() * 1.5, 0, Math.PI * 2);
              gctx.fill();
            }
          }
        }
      }
      d += spacing;
    }

    if (dx1 >= 0) {                                 // redraw only the area that changed
      const w = dx1 - dx0 + 1, h = dy1 - dy0 + 1;
      const img = bctx.createImageData(w, h);
      const o = img.data;
      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          const i = ((dy0 + yy) * CANVAS_W + (dx0 + xx)) * 4;
          const A = buf[i + 3];
          const j = (yy * w + xx) * 4;
          const dither = Math.random() - 0.5;
          // opaque colour that, multiplied over the skin, equals "paint of alpha A and colour C"
          o[j] = 255 * (1 - A + buf[i]) + dither;
          o[j + 1] = 255 * (1 - A + buf[i + 1]) + dither;
          o[j + 2] = 255 * (1 - A + buf[i + 2]) + dither;
          o[j + 3] = 255;
        }
      }
      bctx.putImageData(img, dx0, dy0);
      setPainted(true);
    }
    return (carry + dist) % spacing;
  }, [shade]);

  const onBrushDown = (e) => {
    const rect = brushRef.current.getBoundingClientRect();   // the un-rotated frame: the tip is a fixed point in it
    const tip = { x: rect.left + rect.width * BRUSH_TIP.x, y: rect.top + rect.height * BRUSH_TIP.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pid: e.pointerId, grab: { x: e.clientX, y: e.clientY }, start: offset, tip, last: tip, carry: 0 };
    e.preventDefault();
  };

  const onBrushMove = (e) => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    const newTip = {
      x: Math.max(0, Math.min(window.innerWidth, d.tip.x + (e.clientX - d.grab.x))),
      y: Math.max(0, Math.min(window.innerHeight, d.tip.y + (e.clientY - d.grab.y))),
    };
    d.carry = paintSegment(d.last, newTip, d.carry);
    d.last = newTip;
    setOffset({ x: d.start.x + (newTip.x - d.tip.x), y: d.start.y + (newTip.y - d.tip.y) });
  };

  const onBrushUp = (e) => {
    if (drag.current?.pid === e.pointerId) drag.current = null;
  };

  const zoomed = stage === 'zoomed';
  const dollX = atVanity ? DOLL_X.vanity : DOLL_X.room;
  const walking = (stage === 'walking') || (stage === 'leaving' && atVanity === false);
  const worldStyle = {
    transformOrigin: `${DOLL_X.vanity}% ${FACE_Y}%`,
    // zoom around her face, and slide it to the middle of the screen (she stands at DOLL_X.vanity)
    transform: zoomed ? `translateX(${50 - DOLL_X.vanity}%) scale(${zoom})` : 'translateX(0) scale(1)',
  };
  // the layers cover only the top of the doll, so the skin mask is pinned to the top at full doll width
  const maskStyle = {
    height: `${PAINT_FRAC * 100}%`,
    WebkitMaskImage: `url(${SKIN_MASK})`, maskImage: `url(${SKIN_MASK})`,
    WebkitMaskSize: '100% auto', maskSize: '100% auto',
    WebkitMaskPosition: 'top left', maskPosition: 'top left',
  };

  return (
    <main className={`room stage-${stage}`} role="img" aria-label="Love, Me dressing and beauty room">
      <div className="world" style={worldStyle}>
        <div className="scene-bg" />

        <div className={`doll ${walking || stage === 'walking' ? 'is-walking' : ''}`} style={{ left: `${dollX}%` }} aria-hidden="true">
          <div className="doll-sway">
            <img className="doll-img" src={DOLL} alt="" draggable="false" />
            <img
              className="doll-eyes"
              src={EYES_CLOSED}
              alt=""
              draggable="false"
              style={{ left: `${EYES.x}%`, top: `${EYES.y}%`, width: `${EYES.w}%`, height: `${EYES.h}%`, opacity: closed ? 1 : 0 }}
            />
            <canvas ref={blushRef} className="layer layer-blush" width={CANVAS_W} height={PAINT_H} style={maskStyle} />
            <canvas ref={glitterRef} className="layer layer-glitter" width={CANVAS_W} height={PAINT_H} style={maskStyle} />
          </div>
        </div>

        <button
          className="face-btn"
          onClick={openMakeup}
          aria-label="Open makeup"
          tabIndex={stage === 'room' ? 0 : -1}
        >
          <img src="/makeup/button.webp" alt="" draggable="false" />
        </button>
      </div>

      {zoomed && (
        <>
          <button className="back-btn" onClick={closeMakeup} aria-label="Back to the room">‹</button>

          {!painted && (
            <div className="hint">{shade ? 'Now drag the brush over her cheeks' : 'Pick a shade from the palette'}</div>
          )}

          <div className="palette">
            <img src="/makeup/palette.webp" alt="Blush palette" draggable="false" />
            {SHADES.map((s) => (
              <button
                key={s.id}
                className={`swatch ${shade?.id === s.id ? 'on' : ''}`}
                style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%` }}
                onClick={() => setShade(s)}
                aria-label={s.name}
                aria-pressed={shade?.id === s.id}
              />
            ))}
          </div>

          <div ref={brushRef} className="brush" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
            {/* held at an angle, like applying blush; it pivots on the bristle tip, which is what paints */}
            <div
              className="brush-rot"
              onPointerDown={onBrushDown}
              onPointerMove={onBrushMove}
              onPointerUp={onBrushUp}
              onPointerCancel={onBrushUp}
            >
              <img src="/makeup/brush.webp" alt="Blush brush" draggable="false" />
              {shade && (
                <>
                  {/* only the very top layer of the bristles takes the colour; the rest stays white */}
                  <span className="bristle-tint">
                    <i style={{ background: shade.hex, WebkitMaskImage: 'url(/makeup/brush.webp)', maskImage: 'url(/makeup/brush.webp)' }} />
                  </span>
                  {shade.glitter && <span className="bristle-glitter" />}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
