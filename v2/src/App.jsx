import { useEffect, useRef, useState } from 'react';
import { SHADES } from './shades.js';
import dollMeta from './doll.json';   // written by tools/prep_doll.py
import { Painter, CANVAS_W, PAINT_H, PAINT_FRAC } from './painter.js';

// ---- artwork (made by tools/prep_doll.py and tools/prep_makeup.py) ----
const DOLL = '/doll/doll.webp';
const EYES_CLOSED = '/doll/eyes-closed.webp';      // only the eyes; swapped in for a blink
// No placement rules at the moment: makeup can go anywhere on her. The only limit is her outline
// (the doll image itself is the mask), so paint never floats out into the room.
// zone-face.png / skin-mask.png are still built by tools/prep_doll.py, ready for when the exact
// placement is decided.
const EYES = dollMeta.eyes;                         // eye patch position, % of the doll

// ---- the brush: dip it in a pan to load colour, painting uses it up ----
const BRUSH_TIP = { x: 0.5, y: 0.08 };   // where the bristles touch, fraction of the brush image
const LOAD_PER_DAB = 0.1;                // ten dabs fill the brush
const TAP_LOAD = 0.35;                   // tapping a pan is a shortcut for a few dabs
const HOLD_LOAD = 0.03;                  // pressing and holding in a pan keeps loading
const LOAD_LENGTH = 1800;                // canvas px of stroke one full load paints (about 4 cheek strokes)
const DAB_COST = 0.03;
const FLIP_DEADZONE = 0.03;              // fraction of the doll's width around her centre line

// ---- staging ----
const DOLL_X = { room: 50, vanity: 69 }; // doll centre, % of the room width
const FACE_Y = 39;                       // face centre, % of the room height (zoom focus)
const WALK_MS = 1500;
const ZOOM_MS = 900;

const EMPTY_BRUSH = { rgb: [255, 255, 255], load: 0, glitter: 0 };
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;

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

const Icon = ({ d, extra }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />{extra}
  </svg>
);

export default function App() {
  const closed = useBlink();
  const zoom = useFaceZoom();

  // stage: room -> walking (to the vanity) -> zoomed (painting) -> leaving (zoom out, walk back)
  const [stage, setStage] = useState('room');
  const [atVanity, setAtVanity] = useState(false);

  // the brush and what is on it
  const [brush, setBrushState] = useState(EMPTY_BRUSH);
  const brushNow = useRef(EMPTY_BRUSH);
  const setBrush = (b) => { brushNow.current = b; setBrushState(b); };
  const [side, setSide] = useState('right');                // which way the handle points
  const [offsets, setOffsets] = useState({ brush: { x: 0, y: 0 }, eraser: { x: 0, y: 0 } });

  // feedback on the palette
  const [lastPan, setLastPan] = useState(null);
  const [dips, setDips] = useState({});
  const [puffs, setPuffs] = useState([]);

  // history buttons / hint
  const [painted, setPainted] = useState(false);
  const [hist, setHist] = useState({ undo: false, redo: false });
  const [sure, setSure] = useState(false);                  // "clear all" asks twice

  const blushEl = useRef(null);
  const glitterEl = useRef(null);
  const painter = useRef(null);
  const brushEl = useRef(null);
  const eraserEl = useRef(null);
  const paletteEl = useRef(null);
  const drag = useRef(null);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // ---- set up the painter (no placement zone is set, so it paints anywhere) ----
  useEffect(() => {
    painter.current = new Painter(blushEl.current, glitterEl.current);
  }, []);

  const syncHistory = () => setHist({ undo: painter.current.canUndo, redo: painter.current.canRedo });

  // ---- going to the vanity and back ----
  const openMakeup = () => {
    if (stage !== 'room') return;
    setStage('walking');
    setAtVanity(true);                              // she walks over to the vanity...
    later(() => setStage('zoomed'), WALK_MS + 100);  // ...then the camera zooms to her face
  };

  const closeMakeup = () => {
    if (stage !== 'zoomed') return;
    setStage('leaving');                            // zoom out first...
    stopDrag();
    setOffsets({ brush: { x: 0, y: 0 }, eraser: { x: 0, y: 0 } });
    setSide('right');
    later(() => setAtVanity(false), ZOOM_MS);       // ...then she walks back to the centre
    later(() => setStage('room'), ZOOM_MS + WALK_MS);
  };

  // ---- the palette: dipping, tapping, puffs, dents ----
  const panAt = (p) => {                            // which pan is the brush tip over?
    const root = paletteEl.current;
    if (!root) return null;
    for (const el of root.querySelectorAll('.swatch')) {
      const r = el.getBoundingClientRect();
      const nx = (p.x - (r.left + r.width / 2)) / (r.width * 0.58);
      const ny = (p.y - (r.top + r.height / 2)) / (r.height * 0.58);
      if (nx * nx + ny * ny <= 1) return SHADES.find((s) => s.id === el.dataset.id) ?? null;
    }
    return null;
  };

  // add colour to the brush; a different shade mixes with what is already on it
  const dip = (pan, amount) => {
    const b = brushNow.current;
    const next = Math.min(1, b.load + amount);
    const added = next - b.load;
    const w = b.load < 0.01 ? 1 : Math.max(added / next, Math.min(0.25, amount * 2));
    const pr = hexToRgb(pan.hex);
    setBrush({
      rgb: b.rgb.map((v, i) => Math.round(lerp(v, pr[i], w))),
      glitter: lerp(b.glitter, pan.glitter ? 1 : 0, w),
      load: next,
    });
    setLastPan(pan.id);
    setDips((d) => ({ ...d, [pan.id]: (d[pan.id] ?? 0) + 1 }));
    const key = Math.random();
    setPuffs((p) => [...p, { key, id: pan.id, hex: pan.hex }]);
    later(() => setPuffs((p) => p.filter((x) => x.key !== key)), 700);
    if (navigator.vibrate) navigator.vibrate(8);
  };

  const cleanBrush = () => setBrush(EMPTY_BRUSH);

  // ---- pointer plumbing for the two tools ----
  const toCanvas = (p) => {
    const r = blushEl.current.getBoundingClientRect();
    return { x: (p.x - r.left) * (CANVAS_W / r.width), y: (p.y - r.top) * (PAINT_H / r.height) };
  };

  const stopDrag = () => {
    const d = drag.current;
    if (d?.timer) clearInterval(d.timer);
    drag.current = null;
  };

  const brushParams = () => {
    const b = brushNow.current;
    return { rgb: b.rgb, glitter: b.glitter, factor: Math.sqrt(b.load) };
  };

  const spend = (cost) => {
    const b = brushNow.current;
    if (cost > 0) setBrush({ ...b, load: Math.max(0, b.load - cost) });
  };

  const holdTick = (d) => {                         // pressed and holding still
    if (d.tool === 'eraser') { painter.current.eraseDab(...Object.values(toCanvas(d.last))); return; }
    const pan = panAt(d.last);
    if (pan) { dip(pan, HOLD_LOAD); return; }
    if (brushNow.current.load > 0.01) {
      const c = toCanvas(d.last);
      if (painter.current.dab(c.x, c.y, brushParams(), true) > 0.02) { spend(DAB_COST * 0.5); setPainted(true); }
    }
  };

  const onDown = (tool) => (e) => {
    const outer = (tool === 'brush' ? brushEl : eraserEl).current;
    const r = outer.getBoundingClientRect();         // the un-rotated frame: the contact point is fixed in it
    const tip = tool === 'brush'
      ? { x: r.left + r.width * BRUSH_TIP.x, y: r.top + r.height * BRUSH_TIP.y }
      : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
    painter.current.beginStroke();
    drag.current = { tool, pid: e.pointerId, grab: { x: e.clientX, y: e.clientY }, start: offsets[tool], tip, last: tip, carry: 0, lastMove: performance.now() };
    drag.current.timer = setInterval(() => {
      const d = drag.current;
      if (d && performance.now() - d.lastMove > 130) holdTick(d);
    }, 160);

    // the first press: a dab
    if (tool === 'eraser') { painter.current.eraseDab(...Object.values(toCanvas(tip))); return; }
    const pan = panAt(tip);
    if (pan) { dip(pan, LOAD_PER_DAB); return; }
    if (brushNow.current.load > 0.01) {
      const c = toCanvas(tip);
      if (painter.current.dab(c.x, c.y, brushParams()) > 0.02) { spend(DAB_COST); setPainted(true); }
    }
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    const tip = {
      x: Math.max(0, Math.min(window.innerWidth, d.tip.x + (e.clientX - d.grab.x))),
      y: Math.max(0, Math.min(window.innerHeight, d.tip.y + (e.clientY - d.grab.y))),
    };
    if (Math.hypot(tip.x - d.last.x, tip.y - d.last.y) > 0.5) d.lastMove = performance.now();

    if (d.tool === 'brush') {
      // the handle points to whichever side of her face the brush is working on
      const rect = blushEl.current.getBoundingClientRect();
      const centre = rect.left + rect.width / 2;
      const dead = rect.width * FLIP_DEADZONE;
      if (tip.x < centre - dead) setSide('left'); else if (tip.x > centre + dead) setSide('right');

      const b = brushNow.current;
      const onPan = panAt(tip);
      if (b.load > 0.01 && !onPan) {
        const out = painter.current.blushSegment(toCanvas(d.last), toCanvas(tip), d.carry, brushParams());
        d.carry = out.carry;
        if (out.used > 0) { spend(out.used / LOAD_LENGTH); setPainted(true); }
      }
    } else {
      d.carry = painter.current.eraseSegment(toCanvas(d.last), toCanvas(tip), d.carry);
    }
    d.last = tip;
    setOffsets((o) => ({ ...o, [d.tool]: { x: d.start.x + (tip.x - d.tip.x), y: d.start.y + (tip.y - d.tip.y) } }));
  };

  const onUp = (e) => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    stopDrag();
    painter.current.endStroke();
    syncHistory();
  };

  // ---- history ----
  const undo = () => { painter.current.undo(); syncHistory(); };
  const redo = () => { painter.current.redo(); syncHistory(); };
  const clearAll = () => {
    if (!sure) { setSure(true); later(() => setSure(false), 2200); return; }
    painter.current.clear();
    setSure(false);
    setPainted(false);
    syncHistory();
  };

  // ---- render ----
  const zoomed = stage === 'zoomed';
  const dollX = atVanity ? DOLL_X.vanity : DOLL_X.room;
  const walking = (stage === 'walking') || (stage === 'leaving' && atVanity === false);
  const worldStyle = {
    transformOrigin: `${DOLL_X.vanity}% ${FACE_Y}%`,
    // zoom around her face, and slide it to the middle of the screen (she stands at DOLL_X.vanity)
    transform: zoomed ? `translateX(${50 - DOLL_X.vanity}%) scale(${zoom})` : 'translateX(0) scale(1)',
  };
  // the layers cover only the top of the doll, so masks are pinned to the top at full doll width
  const maskOf = (url) => ({
    height: `${PAINT_FRAC * 100}%`,
    WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`,
    WebkitMaskSize: '100% auto', maskSize: '100% auto',
    WebkitMaskPosition: 'top left', maskPosition: 'top left',
  });

  const loaded = brush.load > 0.01;
  const tintColor = `rgb(${brush.rgb.join(',')})`;
  const tintOpacity = loaded ? Math.min(1, 0.3 + 0.7 * Math.min(1, brush.load * 1.2)) : 0;

  return (
    <main className={`room stage-${stage}`} role="img" aria-label="Love, Me dressing and beauty room">
      <div className="world" style={worldStyle}>
        <div className="scene-bg" />

        <div className={`doll ${walking ? 'is-walking' : ''}`} style={{ left: `${dollX}%` }} aria-hidden="true">
          <div className="doll-sway">
            <img className="doll-img" src={DOLL} alt="" draggable="false" />
            <img
              className="doll-eyes"
              src={EYES_CLOSED}
              alt=""
              draggable="false"
              style={{ left: `${EYES.x}%`, top: `${EYES.y}%`, width: `${EYES.w}%`, height: `${EYES.h}%`, opacity: closed ? 1 : 0 }}
            />
            <canvas ref={blushEl} className="layer layer-blush" width={CANVAS_W} height={PAINT_H} style={maskOf(DOLL)} />
            <canvas ref={glitterEl} className="layer layer-glitter" width={CANVAS_W} height={PAINT_H} style={maskOf(DOLL)} />
          </div>
        </div>

        <button className="face-btn" onClick={openMakeup} aria-label="Open makeup" tabIndex={stage === 'room' ? 0 : -1}>
          <img src="/makeup/button.webp" alt="" draggable="false" />
        </button>
      </div>

      {zoomed && (
        <>
          <button className="back-btn" onClick={closeMakeup} aria-label="Back to the room">‹</button>

          <div className="toolbar">
            <button onClick={undo} disabled={!hist.undo} aria-label="Undo"><Icon d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></button>
            <button onClick={redo} disabled={!hist.redo} aria-label="Redo"><Icon d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></button>
            <button onClick={cleanBrush} disabled={!loaded} aria-label="Clean the brush"><Icon d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" extra={<path d="M4 4l16 16" />} /></button>
            <button className={sure ? 'sure' : ''} onClick={clearAll} aria-label={sure ? 'Tap again to clear all makeup' : 'Clear all makeup'}>
              {sure ? <span className="sure-text">Sure?</span> : <Icon d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />}
            </button>
          </div>

          {!painted && (
            <div className="hint">{loaded ? 'Now dab or brush her cheeks' : 'Dab the brush in a shade, or tap one'}</div>
          )}

          <div className="palette" ref={paletteEl}>
            <img src="/makeup/palette.webp" alt="Blush palette" draggable="false" />
            {SHADES.map((s) => (
              <button
                key={s.id}
                data-id={s.id}
                className={`swatch ${lastPan === s.id ? 'on' : ''}`}
                style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%`, '--dent': Math.min(1, (dips[s.id] ?? 0) / 14) }}
                onClick={() => dip(s, TAP_LOAD)}
                aria-label={`${s.name} - tap to load the brush`}
              />
            ))}
            {puffs.map((p) => {
              const s = SHADES.find((x) => x.id === p.id);
              return (
                <span key={p.key} className="puff" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <i key={i} style={{ background: p.hex, '--dx': `${(i - 3) * 7 + (i % 2 ? 4 : -4)}px`, '--dy': `${-14 - (i % 3) * 7}px` }} />
                  ))}
                </span>
              );
            })}
          </div>

          <div ref={eraserEl} className="eraser" style={{ transform: `translate(${offsets.eraser.x}px, ${offsets.eraser.y}px)` }}>
            <div className="eraser-rot" onPointerDown={onDown('eraser')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <img src="/makeup/eraser.webp" alt="Eraser" draggable="false" />
            </div>
          </div>

          <div ref={brushEl} className="brush" data-load={brush.load.toFixed(2)} style={{ transform: `translate(${offsets.brush.x}px, ${offsets.brush.y}px)` }}>
            {/* held at an angle like a real blush brush; the handle points to the side being worked on,
                and it pivots on the bristle tip, which is what paints */}
            <div className={`brush-rot side-${side}`} onPointerDown={onDown('brush')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <img src="/makeup/brush.webp" alt="Blush brush" draggable="false" />
              {/* only the very top layer of the bristles takes the colour; the rest stays white */}
              <span className="bristle-tint" style={{ opacity: tintOpacity }}>
                <i style={{ background: tintColor, WebkitMaskImage: 'url(/makeup/brush.webp)', maskImage: 'url(/makeup/brush.webp)' }} />
              </span>
              <span className="bristle-glitter" style={{ opacity: loaded ? Math.min(1, brush.glitter * brush.load * 1.6) : 0 }} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
