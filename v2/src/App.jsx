import { useCallback, useEffect, useRef, useState } from 'react';
import { SHADES } from './shades.js';
import dollMeta from './doll.json';   // written by tools/prep_doll.py

// ---- artwork (made by tools/prep_doll.py) ----
const DOLL = '/doll/doll.webp';
const EYES_CLOSED = '/doll/eyes-closed.webp';      // only the eyes; swapped in for a blink
const SKIN_MASK = '/doll/skin-mask.png';
const EYES = dollMeta.eyes;                         // eye patch position, % of the doll

// ---- makeup canvases: about 1.5x the doll's pixels (capped for phone memory) ----
const CANVAS_W = 2048;
const CANVAS_H = 3072;
const BRUSH_RADIUS = 34;        // canvas px
const STAMP_ALPHA = 0.02;       // very light per stamp: colour builds up with every pass
const STAMP_SPACING = 0.3;      // fraction of the radius between stamps
const BRUSH_TIP = { x: 0.5, y: 0.08 };   // where the bristles touch, fraction of the brush image

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
    return Math.max(2.4, Math.min(3.7, (0.6 * W) / (0.105 * H)));
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

  // Soft round stamps along the stroke. Matte shades lay colour; glitter shades also scatter sparkles.
  const paintSegment = useCallback((from, to, carry) => {
    const blush = blushRef.current;
    const glitter = glitterRef.current;
    if (!blush || !shade) return carry;
    const rect = blush.getBoundingClientRect();
    const sx = blush.width / rect.width;
    const sy = blush.height / rect.height;
    const bctx = blush.getContext('2d');
    const gctx = glitter.getContext('2d');
    const base = hexToRgb(shade.hex);
    const [r, g, b] = base;
    const spacing = BRUSH_RADIUS * STAMP_SPACING;

    const ax = (from.x - rect.left) * sx, ay = (from.y - rect.top) * sy;
    const bx = (to.x - rect.left) * sx, by = (to.y - rect.top) * sy;
    const dist = Math.hypot(bx - ax, by - ay);

    const baseAlpha = shade.glitter ? STAMP_ALPHA * 0.6 : STAMP_ALPHA;
    let d = spacing - carry;
    let drew = false;
    while (d <= dist) {
      const t = dist === 0 ? 0 : d / dist;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (x > -BRUSH_RADIUS && x < blush.width + BRUSH_RADIUS && y > -BRUSH_RADIUS && y < blush.height + BRUSH_RADIUS) {
        const grad = bctx.createRadialGradient(x, y, 0, x, y, BRUSH_RADIUS);
        grad.addColorStop(0, `rgba(${r},${g},${b},${baseAlpha})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${baseAlpha * 0.6})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        bctx.fillStyle = grad;
        bctx.fillRect(x - BRUSH_RADIUS, y - BRUSH_RADIUS, BRUSH_RADIUS * 2, BRUSH_RADIUS * 2);

        if (shade.glitter) {
          const n = Math.random() < 0.5 ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const rad = Math.sqrt(Math.random()) * BRUSH_RADIUS * 0.95;
            const px = x + Math.cos(a) * rad;
            const py = y + Math.sin(a) * rad;
            const [cr, cg, cb] = mix(base, [255, 255, 255], 0.25 + Math.random() * 0.6);
            gctx.fillStyle = `rgba(${cr},${cg},${cb},${0.7 + Math.random() * 0.3})`;
            if (Math.random() < 0.09) {
              gctx.fillStyle = 'rgba(255,255,255,0.95)';
              sparkle(gctx, px, py, 7 + Math.random() * 6);
            } else {
              gctx.beginPath();
              gctx.arc(px, py, 2.2 + Math.random() * 3.2, 0, Math.PI * 2);
              gctx.fill();
            }
          }
        }
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
  const maskStyle = { WebkitMaskImage: `url(${SKIN_MASK})`, maskImage: `url(${SKIN_MASK})` };

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
            <canvas ref={blushRef} className="layer layer-blush" width={CANVAS_W} height={CANVAS_H} style={maskStyle} />
            <canvas ref={glitterRef} className="layer layer-glitter" width={CANVAS_W} height={CANVAS_H} style={maskStyle} />
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
              <>
                {/* only the very top layer of the bristles takes the colour; the rest stays white */}
                <span className="bristle-tint">
                  <i style={{ background: shade.hex, WebkitMaskImage: 'url(/makeup/brush.webp)', maskImage: 'url(/makeup/brush.webp)' }} />
                </span>
                {shade.glitter && <span className="bristle-glitter" />}
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
