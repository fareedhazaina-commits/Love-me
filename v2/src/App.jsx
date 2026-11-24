import { useCallback, useEffect, useRef, useState } from 'react';
import { SHADES } from './shades.js';
import { buildSkinMask } from './skinMask.js';

const OPEN = '/doll/bun-eyes-open.png';
const CLOSED = '/doll/bun-eyes-closed-2.png';

// Paint canvas = 2x the doll image so zoomed-in strokes stay smooth.
const CANVAS_W = 816;
const CANVAS_H = 1224;
const BRUSH_RADIUS = 24;       // stamp radius, in canvas pixels
const STAMP_ALPHA = 0.022;     // very light per stamp: colour builds up with every pass
const STAMP_SPACING = 0.3;     // fraction of the radius between stamps along a stroke
const BRUSH_TIP = { x: 0.5, y: 0.1 }; // where the bristles touch, as a fraction of the brush image

// Face centre inside the room, used as the zoom focus (doll sits at bottom 4%, height 66%).
const FACE_ORIGIN = '50% 37%';

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

// How far to zoom so the whole face fits comfortably on this screen shape.
function useFaceZoom() {
  const calc = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    return Math.max(2.4, Math.min(3.7, (0.6 * W) / (0.093 * H)));
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

export default function App() {
  const closed = useBlink();
  const zoom = useFaceZoom();

  const [makeup, setMakeup] = useState(false);
  const [shade, setShade] = useState(null);
  const [painted, setPainted] = useState(false);
  const [mask, setMask] = useState(null);

  const canvasRef = useRef(null);
  const brushRef = useRef(null);
  const drag = useRef(null);        // active brush drag: { pid, grab, start, tip, last, carry }
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // brush offset from its resting spot

  // Skin-only mask: makeup can only land on her skin.
  useEffect(() => {
    let alive = true;
    buildSkinMask([OPEN, CLOSED], CANVAS_W / 408).then((m) => alive && setMask(m)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const openMakeup = () => setMakeup(true);
  const closeMakeup = () => { setMakeup(false); setOffset({ x: 0, y: 0 }); drag.current = null; };

  // Soft round stamps along the stroke, very low alpha, so repeated strokes build intensity.
  const paintSegment = useCallback((from, to, carry) => {
    const canvas = canvasRef.current;
    if (!canvas || !shade) return carry;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const ctx = canvas.getContext('2d');
    const [r, g, b] = hexToRgb(shade.hex);
    const spacing = BRUSH_RADIUS * STAMP_SPACING;

    const ax = (from.x - rect.left) * sx, ay = (from.y - rect.top) * sy;
    const bx = (to.x - rect.left) * sx, by = (to.y - rect.top) * sy;
    const dist = Math.hypot(bx - ax, by - ay);

    let d = spacing - carry;
    let drew = false;
    while (d <= dist) {
      const t = dist === 0 ? 0 : d / dist;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (x > -BRUSH_RADIUS && x < canvas.width + BRUSH_RADIUS && y > -BRUSH_RADIUS && y < canvas.height + BRUSH_RADIUS) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, BRUSH_RADIUS);
        grad.addColorStop(0, `rgba(${r},${g},${b},${STAMP_ALPHA})`);
        grad.addColorStop(0.55, `rgba(${r},${g},${b},${STAMP_ALPHA * 0.6})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - BRUSH_RADIUS, y - BRUSH_RADIUS, BRUSH_RADIUS * 2, BRUSH_RADIUS * 2);
        drew = true;
      }
      d += spacing;
    }
    if (drew) setPainted(true);
    return (carry + dist) % spacing;
  }, [shade]);

  const onBrushDown = (e) => {
    const el = brushRef.current;
    const rect = el.getBoundingClientRect();
    const tip = { x: rect.left + rect.width * BRUSH_TIP.x, y: rect.top + rect.height * BRUSH_TIP.y };
    el.setPointerCapture(e.pointerId);
    drag.current = {
      pid: e.pointerId,
      grab: { x: e.clientX, y: e.clientY },
      start: offset,
      tip,
      last: tip,
      carry: 0,
    };
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

  const worldStyle = {
    transformOrigin: FACE_ORIGIN,
    transform: makeup ? `scale(${zoom})` : 'scale(1)',
  };
  const maskStyle = mask
    ? { WebkitMaskImage: `url(${mask.url})`, maskImage: `url(${mask.url})` }
    : { visibility: 'hidden' };

  return (
    <main className={`room ${makeup ? 'is-makeup' : ''}`} role="img" aria-label="Love, Me dressing and beauty room">
      <div className="world" style={worldStyle}>
        <div className="doll" aria-hidden="true">
          <img className="doll-img" src={OPEN} alt="" draggable="false" />
          <img className="doll-img doll-closed" src={CLOSED} alt="" draggable="false" style={{ opacity: closed ? 1 : 0 }} />
          <canvas ref={canvasRef} className="makeup-layer" width={CANVAS_W} height={CANVAS_H} style={maskStyle} />
        </div>

        <button className="face-btn" onClick={openMakeup} aria-label="Open makeup" tabIndex={makeup ? -1 : 0}>
          <img src="/makeup/button.webp" alt="" draggable="false" />
        </button>
      </div>

      {makeup && (
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

          <div
            ref={brushRef}
            className="brush"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
            onPointerDown={onBrushDown}
            onPointerMove={onBrushMove}
            onPointerUp={onBrushUp}
            onPointerCancel={onBrushUp}
          >
            <img src="/makeup/brush.webp" alt="Blush brush" draggable="false" />
            {shade && (
              <span
                className="bristle-tint"
                style={{ background: shade.hex, WebkitMaskImage: 'url(/makeup/brush.webp)', maskImage: 'url(/makeup/brush.webp)' }}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
