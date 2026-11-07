document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('mainCanvas');
  initEngine(canvas);
  initUI();
  loadSkinTone('Base');
  startBlink();
});
