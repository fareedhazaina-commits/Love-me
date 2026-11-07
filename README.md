# Love, Me

A browser-based illustrated makeup application game built with HTML, CSS, vanilla JavaScript and Canvas 2D.

## Run locally

Open `index.html` in a modern browser, or serve this folder with a local static server. The project currently has no package installation or build step.

## Main files

- `index.html` — application shell and canvas/vanity layout
- `style.css` — visual styling and responsive layout
- `js/data.js` — skin tones, product catalogue, shades and face-zone definitions
- `js/engine.js` — character rendering, makeup layers, drawing input, blending and history
- `js/ui.js` — product catalogue and interface interactions
- `js/main.js` — application initialisation
- `assets/` — character, hair, cosmetic and accessory artwork

## Current development baseline

Stage 1: project structure, entry points and local asset references checked; baseline retained before engine changes.

Stage 2: drawing input now uses Pointer Events for mouse, touch and stylus; pointer capture keeps strokes continuous; supported stylus pressure is used when available, with a fallback for ordinary mouse/touch; stroke stamps are interpolated and the canvas is rendered once per pointer event rather than once per stamp; the blending scratch canvas is reused and smudge processing is limited to the local brush region rather than the full makeup layer. Brush footprint now responds to pressure, and blending is constrained to the active product's application zone.

## Known limitations still to address

- Product application still uses the existing approximate face-zone ellipses. These are not yet precise anatomical masks derived from the character artwork.
- Shimmer shades now receive deterministic micro-sparkle highlights; dedicated matte, satin, glitter, metallic and holographic material models remain future work.
- The current character and canvas are fixed at 400 × 550 logical pixels; responsive display scales the canvas.
- Browser interaction testing across physical phones, tablets and styluses is still required.


Additional engine hardening: brush footprints and blending are clipped to the active product's current zone geometry; secondary pointers are ignored during an active stroke; strokes that begin outside an allowed zone no longer create empty undo entries; keyboard eraser and blend modes remain mutually exclusive.

## Stage 3 implementation notes

- Added a selectable finish override (Product, matte, velvet, satin, gloss, shimmer, glitter, metallic and holographic). The renderer uses distinct pigment strength, highlight and sparkle treatments; these are procedural approximations, not physically based cosmetic materials.
- Added on-screen Undo and Redo controls alongside the existing keyboard shortcuts.
- Added compact mobile/tablet layout rules, touch-friendly stacked layout and reduced-motion support.
- Brush finish is intentionally non-destructive: it changes subsequent strokes only; existing makeup remains on its layer until erased or cleared.
- Anatomical precision remains bounded by the current source artwork and zone geometry. The current ellipse masks are retained rather than fabricating facial contours without a verified mask aligned to the character image.
