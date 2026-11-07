# Changelog

## Stage 1–2 — 2026-11-07

- Confirmed `index.html`, `style.css`, `js/data.js`, `js/engine.js`, `js/ui.js` and `js/main.js` as the active application entry points.
- Preserved the existing artwork and product catalogue.
- Standardised canvas drawing input on Pointer Events (mouse, touch and stylus).
- Added pointer capture and cancellation handling for more reliable continuous strokes.
- Added stylus pressure support where the browser/device reports it, with a stable fallback for mouse and touch.
- Added stroke interpolation and pressure interpolation between pointer samples.
- Reduced redundant full-canvas redraws during a single pointer event.
- Reused the blend scratch canvas instead of allocating a new canvas for each brush stamp.
- Documented remaining limitations around anatomical masks and product-specific cosmetic materials.
