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

Stage 2: drawing input now uses Pointer Events for mouse, touch and stylus; pointer capture keeps strokes continuous; supported stylus pressure is used when available, with a fallback for ordinary mouse/touch; stroke stamps are interpolated and the canvas is rendered once per pointer event rather than once per stamp; the blending scratch canvas is reused rather than recreated for every stamp.

## Known limitations still to address

- Product application still uses the existing approximate face-zone ellipses. These are not yet precise anatomical masks derived from the character artwork.
- Cosmetic materials are still mostly soft pigment stamps. Dedicated matte, satin, shimmer, glitter, metallic and holographic renderers are future work.
- The current character and canvas are fixed at 400 × 550 logical pixels; responsive display scales the canvas.
- Browser interaction testing across physical phones, tablets and styluses is still required.
