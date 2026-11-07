const assert = require('node:assert/strict');
const fs = require('node:fs');

const engine = fs.readFileSync('js/engine.js', 'utf8');
const ui = fs.readFileSync('js/ui.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

for (const id of ['mainCanvas', 'brush-size', 'brush-opacity', 'finish-select', 'undo-btn', 'redo-btn', 'eraser-btn', 'blend-btn', 'clear-layer-btn', 'clear-all-btn']) {
  assert.ok(html.includes('id="' + id + '"'), 'Missing required UI element: ' + id);
}
for (const finish of ['matte', 'velvet', 'satin', 'gloss', 'shimmer', 'glitter', 'metallic', 'holographic']) {
  assert.ok(html.includes('value="' + finish + '"'), 'Missing finish option: ' + finish);
}
for (const fn of ['applyStroke', 'applyBlendStroke', 'undoLayer', 'redoLayer', 'clearLayer', 'clearAllLayers']) {
  assert.ok(engine.includes('function ' + fn + '('), 'Missing engine function: ' + fn);
}
for (const binding of ["getElementById('finish-select')", "getElementById('undo-btn')", "getElementById('redo-btn')"]) {
  assert.ok(ui.includes(binding), 'Missing UI binding: ' + binding);
}
assert.ok(engine.includes('clipToProductZone(lctx, activeProductId)'), 'Brush strokes must remain zone-clipped');
assert.ok(engine.includes('setPointerCapture(e.pointerId)'), 'Pointer capture must remain enabled');
console.log('Love, Me smoke checks passed.');
