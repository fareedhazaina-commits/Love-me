"""
Prepare the doll artwork for the game, WITHOUT resizing or re-compressing the pixels.

Input  (art-source/):  doll-eyes-open.webp, doll-eyes-closed.webp   (flat white background)
Output (v2/public/doll/):
  doll.webp         the open-eyes doll, background removed (lossless RGBA, original pixel size)
  eyes-closed.webp  ONLY the closed-eyes patch (feathered), so a blink swaps just the eyes
  skin-mask.png     alpha mask of bare skin (face, eyelids, ears, neck, arms, legs) for makeup
  doll.json         patch position/size (as % of the doll) and image size

Run:  python tools/prep_doll.py
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-source")
OUT = os.path.join(ROOT, "v2", "public", "doll")
os.makedirs(OUT, exist_ok=True)

open_rgb = np.array(Image.open(os.path.join(SRC, "doll-eyes-open.webp")).convert("RGB")).astype(np.float32)
closed_rgb = np.array(Image.open(os.path.join(SRC, "doll-eyes-closed.webp")).convert("RGB")).astype(np.float32)
H, W, _ = open_rgb.shape
print("doll size", W, "x", H)

# ---------- 1. background removal (flood fill from the border, then clean the anti-aliased edge)
def cutout(rgb):
    near_white = rgb.min(axis=2) >= 244
    lab, n = ndi.label(near_white)            # 4-connectivity
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    # also remove enclosed white pockets (e.g. gaps between hair strands and the ear); tiny
    # white specks (eye highlights) are kept
    sizes = np.bincount(lab.ravel())
    cents = ndi.center_of_mass(near_white, lab, range(1, len(sizes)))
    def in_eyes(c):                      # the whites of the eyes must stay opaque
        return 170 <= c[0] <= 240 and 430 <= c[1] <= 600
    pockets = {i for i in range(1, len(sizes)) if sizes[i] >= 60 and not in_eyes(cents[i - 1])}
    bg = np.isin(lab, list(border | pockets))
    # edge band: pixels touching the background that are not background themselves
    band = ndi.binary_dilation(bg, iterations=2) & ~bg
    alpha = np.where(bg, 0.0, 1.0).astype(np.float32)
    out = rgb.copy()
    # in the band the pixel is (outline colour) blended with white: recover coverage + true colour
    m = rgb.min(axis=2)
    cov = np.clip((255.0 - m) / (255.0 - 120.0), 0.0, 1.0)   # outline is about 120 at its darkest
    cov = np.maximum(cov, 0.0)
    a_band = np.where(band, np.minimum(1.0, cov * 1.15), 1.0)
    alpha = np.where(band, a_band, alpha)
    alpha[bg] = 0.0
    safe = np.maximum(alpha, 1e-3)[..., None]
    unmixed = (rgb - (1.0 - alpha[..., None]) * 255.0) / safe
    out = np.where(band[..., None], np.clip(unmixed, 0, 255), rgb)
    return out, alpha, bg

doll_rgb, doll_alpha, bg = cutout(open_rgb)
rgba = np.dstack([doll_rgb, doll_alpha * 255.0]).round().clip(0, 255).astype(np.uint8)
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, "doll.webp"), lossless=True, method=6)
print("doll.webp saved; background fraction", round(float(bg.mean()), 3))

# ---------- 2. align the closed-eyes image to the open one, using the lower face (no eyes there)
def best_offset(ref, mov, box, search=6):
    x0, y0, x1, y1 = box
    base = ref[y0:y1, x0:x1]
    best = (1e9, 0, 0)
    for dy in range(-search, search + 1):
        for dx in range(-search, search + 1):
            t = mov[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
            e = np.abs(base - t).mean()
            if e < best[0]:
                best = (e, dx, dy)
    return best

FACE_LOW = (430, 250, 600, 330)       # nose / mouth / chin
err, dx, dy = best_offset(open_rgb, closed_rgb, FACE_LOW)
print(f"closed-eyes offset dx={dx} dy={dy} (error {err:.2f})")
aligned = np.roll(np.roll(closed_rgb, -dy, axis=0), -dx, axis=1)

# ---------- 3. find the region that really differs (the eyes) and make a feathered patch
# Only the eyes truly differ; hair/jaw outlines differ by hairline shifts, so keep the patch to the eyes.
diff = np.abs(open_rgb - aligned).sum(axis=2)
EYE_SEARCH = np.zeros_like(diff, bool); EYE_SEARCH[172:238, 436:596] = True
sig = (diff > 200) & EYE_SEARCH
ys, xs = np.where(sig)
print("eye difference bbox: x", xs.min(), xs.max(), " y", ys.min(), ys.max())
PAD = 12
x0, x1 = max(xs.min() - PAD, 0), min(xs.max() + PAD, W)
y0, y1 = max(ys.min() - PAD, 0), min(ys.max() + PAD, H)
pw, ph = x1 - x0, y1 - y0
yy, xx = np.mgrid[0:ph, 0:pw]
# rounded-rectangle falloff, so the patch melts into the open-eyes face
edge = np.minimum.reduce([xx, pw - 1 - xx, yy, ph - 1 - yy]).astype(np.float32)
feather = np.clip(edge / 9.0, 0, 1)
patch = aligned[y0:y1, x0:x1]
patch_rgba = np.dstack([patch, feather * 255]).round().clip(0, 255).astype(np.uint8)
Image.fromarray(patch_rgba, "RGBA").save(os.path.join(OUT, "eyes-closed.webp"), lossless=True, method=6)
print("patch", pw, "x", ph, "at", x0, y0)

# ---------- 4. skin mask (makeup may only land on bare skin)
def skin(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r >= 232) & (g >= 212) & ((r - b) >= 24) & ((r - b) <= 75) & ((g - b) >= 6)

# The mask follows the OPEN-eyes doll: eyeballs, brows, lips, hair, clothes and background are
# excluded. (The lids are the skin above the eyes in that image.)
mask = skin(open_rgb) & (doll_alpha > 0.5)
mask = ndi.binary_closing(mask, structure=np.ones((3, 3)), iterations=2)   # close hairline gaps
# fill only TINY pinholes (image noise), never real features like the eyes
holes, n = ndi.label(~mask)
hs = np.bincount(holes.ravel())
tiny = np.isin(holes, [i for i in range(1, len(hs)) if hs[i] < 40])
mask = (mask | tiny) & (doll_alpha > 0.3)
mask_f = ndi.gaussian_filter(mask.astype(np.float32), 0.9)
mrgba = np.zeros((H, W, 4), np.uint8); mrgba[..., 3] = (mask_f * 255).round().astype(np.uint8)
Image.fromarray(mrgba, "RGBA").save(os.path.join(OUT, "skin-mask.png"), optimize=True)
print("skin mask coverage", round(float(mask.mean()), 3))

json.dump({"width": int(W), "height": int(H),
           "eyes": {"x": round(x0 / W * 100, 4), "y": round(y0 / H * 100, 4),
                    "w": round(pw / W * 100, 4), "h": round(ph / H * 100, 4)}},
          open(os.path.join(OUT, "doll.json"), "w"), indent=1)
print("done")
