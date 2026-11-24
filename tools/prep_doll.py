"""
Prepare the doll artwork for the game, WITHOUT resizing or re-compressing the pixels.

Input  (art-source/):  doll-eyes-open.webp, doll-eyes-closed.webp   (flat white background)
Output (v2/public/doll/):
  doll.webp         the open-eyes doll, background removed (lossless RGBA, original pixel size)
  eyes-closed.webp  ONLY the closed-eyes patch (feathered), so a blink swaps just the eyes
  skin-mask.png     alpha mask of bare skin (face, eyelids, ears, neck, arms, legs) for makeup
  zone-blush.png    where blush may be applied (two soft cheek areas inside the skin mask)
  (also v2/src/doll.json: image size and the eye-patch position, as % of the doll)

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
S = W / 1024.0            # the pixel boxes below were measured on a 1024-wide doll; scale them
def sc(*v): return tuple(int(round(x * S)) for x in v)
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
        return 170 * S <= c[0] <= 240 * S and 430 * S <= c[1] <= 600 * S
    pockets = {i for i in range(1, len(sizes)) if sizes[i] >= 60 * S * S and not in_eyes(cents[i - 1])}
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
def best_offset(ref, mov, box, search=8):
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

FACE_LOW = sc(430, 250, 600, 330)       # nose / mouth / chin
err, dx, dy = best_offset(open_rgb, closed_rgb, FACE_LOW)
print(f"closed-eyes offset dx={dx} dy={dy} (error {err:.2f})")
aligned = np.roll(np.roll(closed_rgb, -dy, axis=0), -dx, axis=1)

# ---------- 3. find the region that really differs (the eyes) and make a feathered patch
# Only the eyes truly differ; hair/jaw outlines differ by hairline shifts, so keep the patch to the eyes.
diff = np.abs(open_rgb - aligned).sum(axis=2)
EYE_SEARCH = np.zeros_like(diff, bool); ya, yb, xa, xb = sc(176, 232, 444, 584)
EYE_SEARCH[ya:yb, xa:xb] = True
sig = (diff > 200) & EYE_SEARCH
ys, xs = np.where(sig)
print("eye difference bbox: x", xs.min(), xs.max(), " y", ys.min(), ys.max())
PAD = int(round(10 * S))
x0, x1 = max(xs.min() - PAD, 0), min(xs.max() + PAD, W)
y0, y1 = max(ys.min() - PAD, 0), min(ys.max() + PAD, H)
pw, ph = x1 - x0, y1 - y0
yy, xx = np.mgrid[0:ph, 0:pw]
# rounded-rectangle falloff, so the patch melts into the open-eyes face
edge = np.minimum.reduce([xx, pw - 1 - xx, yy, ph - 1 - yy]).astype(np.float32)
feather = np.clip(edge / (6.0 * S), 0, 1)
patch = aligned[y0:y1, x0:x1]
patch_rgba = np.dstack([patch, feather * 255]).round().clip(0, 255).astype(np.uint8)
Image.fromarray(patch_rgba, "RGBA").save(os.path.join(OUT, "eyes-closed.webp"), lossless=True, method=6)
print("patch", pw, "x", ph, "at", x0, y0)

# ---------- 4. skin mask (makeup may only land on bare skin)
# The doll's outlines split her into regions (face, neck, arms, legs, clothes, eyes...). A region
# is skin when most of its pixels are skin-coloured; then the WHOLE region counts, so light
# highlights on the skin are included but cream clothes, hair and the eyes are not.
def skin(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r >= 232) & (g >= 195) & ((r - b) >= 20) & ((r - b) <= 90) & ((g - b) >= 5)

barrier = (open_rgb[..., 0] < 236) | (open_rgb[..., 1] < 190) | (doll_alpha < 0.5)   # outlines, hair, eyes
lab, n = ndi.label(~barrier)
sizes = np.bincount(lab.ravel(), minlength=n + 1).astype(np.float64)
sk_count = np.bincount(lab.ravel(), weights=skin(open_rgb).ravel().astype(np.float64), minlength=n + 1)
frac = sk_count / np.maximum(sizes, 1)
keep = [i for i in range(1, n + 1) if sizes[i] >= 150 * S * S and frac[i] >= 0.35]
mask = np.isin(lab, keep)
mask = ndi.binary_dilation(mask, iterations=max(1, int(round(2 * S)))) & (doll_alpha > 0.3)   # reach the outline
mask_f = ndi.gaussian_filter(mask.astype(np.float32), 0.9 * S)
mrgba = np.zeros((H, W, 4), np.uint8); mrgba[..., 3] = (mask_f * 255).round().astype(np.uint8)
Image.fromarray(mrgba, "RGBA").save(os.path.join(OUT, "skin-mask.png"), optimize=True)
print("skin mask coverage", round(float(mask.mean()), 3))

# ---------- 5. product zones: where blush is allowed (two soft cheek shapes, inside the skin mask)
# Fractions of the doll width, measured on this doll (cheek level, under the eyes, clear of the nose,
# mouth, eyes and ears). Other products (eyeshadow, lipstick...) get their own zone the same way.
def soft_ellipse(cx, cy, rx, ry, edge=0.45):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    t = np.clip((1.0 - r) / edge, 0.0, 1.0)            # 1 in the middle, fading to 0 at the rim
    return t * t * (3 - 2 * t)                         # smoothstep

CHEEKS = [(0.4575, 0.1605), (0.5405, 0.1605)]            # (x, y) as fractions of width / height
RX, RY = 0.042 * W, 0.029 * W
zone = np.zeros((H, W), np.float32)
for fx, fy in CHEEKS:
    zone = np.maximum(zone, soft_ellipse(fx * W, fy * H, RX, RY))
zone = zone * mask_f                                     # never outside the skin
zrgba = np.zeros((H, W, 4), np.uint8); zrgba[..., 3] = (zone * 255).round().astype(np.uint8)
Image.fromarray(zrgba, "RGBA").save(os.path.join(OUT, "zone-blush.png"), optimize=True)
print("blush zone saved")

json.dump({"width": int(W), "height": int(H),
           "eyes": {"x": round(x0 / W * 100, 4), "y": round(y0 / H * 100, 4),
                    "w": round(pw / W * 100, 4), "h": round(ph / H * 100, 4)}},
          open(os.path.join(ROOT, "v2", "src", "doll.json"), "w"), indent=1)
print("done")
