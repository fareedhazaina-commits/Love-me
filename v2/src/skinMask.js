// Builds a mask (as a PNG data URL) of the doll's bare skin, so makeup can only be
// applied to skin: not hair, clothes, eyes or the empty background.
// The mask is the union of the skin pixels in every image given (eyes open + closed),
// which lets eyelids be painted too.

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Skin is opaque, light peach: red high, noticeably more red than blue.
// (cream clothes are less saturated; hair and outlines are darker; eye whites are neutral)
export function isSkin(r, g, b, a) {
  const warm = r - b;
  return a > 200 && r >= 225 && g >= 175 && warm >= 32 && warm <= 110;
}

export async function buildSkinMask(srcs, scale = 2) {
  const imgs = await Promise.all(srcs.map(loadImage));
  const w = imgs[0].naturalWidth;
  const h = imgs[0].naturalHeight;

  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const sctx = small.getContext('2d');
  const out = sctx.createImageData(w, h);

  for (const img of imgs) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < px.length; i += 4) {
      if (isSkin(px[i], px[i + 1], px[i + 2], px[i + 3])) {
        out.data[i] = out.data[i + 1] = out.data[i + 2] = 0;
        out.data[i + 3] = 255;
      }
    }
  }
  sctx.putImageData(out, 0, 0);

  // Upscale smoothly to the paint-canvas resolution, with a slight blur for soft edges.
  const big = document.createElement('canvas');
  big.width = w * scale;
  big.height = h * scale;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.filter = 'blur(3px)';
  bctx.drawImage(small, 0, 0, big.width, big.height);

  // Re-sharpen the blurred alpha: this fills tiny pinholes (image shading/noise) while
  // keeping soft, slightly generous edges that cover the thin outline around the skin.
  const img = bctx.getImageData(0, 0, big.width, big.height);
  for (let i = 3; i < img.data.length; i += 4) {
    img.data[i] = Math.max(0, Math.min(255, (img.data[i] - 70) * 2.6));
  }
  bctx.putImageData(img, 0, 0);
  return { url: big.toDataURL('image/png'), width: big.width, height: big.height };
}
