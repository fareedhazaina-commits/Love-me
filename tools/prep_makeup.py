"""
Cut the makeup tool artwork out of its white background WITHOUT resizing the detail away.

Input : assets/Makeup Products/Eraser/Eraser.png   (flat white background)
Output: v2/public/makeup/eraser.webp               (transparent, cropped)

Run:  python tools/prep_makeup.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, "assets", "Makeup Products", "Eraser", "Eraser.png")
out = os.path.join(ROOT, "v2", "public", "makeup", "eraser.webp")

rgb = np.array(Image.open(src).convert("RGB")).astype(np.float32)
near_white = rgb.min(axis=2) >= 242
lab, n = ndi.label(near_white)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
alpha = np.where(bg, 0, 255).astype(np.uint8)
im = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), "RGBA")
im.putalpha(im.split()[3].filter(ImageFilter.GaussianBlur(1.0)))
a = np.array(im)[..., 3]
ys, xs = np.where(a > 8)
im = im.crop((max(xs.min() - 4, 0), max(ys.min() - 4, 0), xs.max() + 5, ys.max() + 5))
im.thumbnail((640, 640), Image.LANCZOS)
im.save(out, quality=92)
print("eraser saved", im.size)
