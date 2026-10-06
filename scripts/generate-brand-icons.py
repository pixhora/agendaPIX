#!/usr/bin/env python3
"""Gera favicons/app icons a partir de /workspace/agendapix-logo-assets/icon-square.png."""
from pathlib import Path
from PIL import Image
import numpy as np
import sys

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "/workspace/agendapix-logo-assets/icon-square.png")
ROOT = Path(__file__).resolve().parents[1]
CHARCOAL = (20, 20, 20, 255)

def extract(src: Path) -> Image.Image:
    rgb = np.array(Image.open(src).convert("RGB"))
    mask = rgb.mean(axis=2) > 8
    ys, xs = np.where(mask)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    side = max(y1 - y0, x1 - x0)
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    y0, x0 = max(0, cy - side // 2), max(0, cx - side // 2)
    y1, x1 = y0 + side, x0 + side
    crop, m = rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    return Image.fromarray(np.dstack([crop, np.where(m, 255, 0).astype(np.uint8)]), "RGBA")

def fit(im: Image.Image, n: int) -> Image.Image:
    return im.resize((n, n), Image.Resampling.LANCZOS)

def opaque(im: Image.Image, n: int) -> Image.Image:
    base = Image.alpha_composite(Image.new("RGBA", im.size, CHARCOAL), im)
    return base.convert("RGB").resize((n, n), Image.Resampling.LANCZOS)

def maskable(im: Image.Image, n: int, safe=0.8) -> Image.Image:
    out = Image.new("RGB", (n, n), CHARCOAL[:3])
    s = int(n * safe)
    out.paste(opaque(im, s), ((n - s) // 2, (n - s) // 2))
    return out

def main():
    sq = extract(SRC)
    pub = ROOT / "public" / "brand"
    app = ROOT / "app"
    pub.mkdir(parents=True, exist_ok=True)
    fit(sq, 512).save(pub / "vagatta-icon.png")
    fit(sq, 128).save(pub / "vagatta-icon-128.png")
    fit(sq, 128).save(pub / "vagatta-icon.webp", "WEBP", quality=92)
    fit(sq, 32).save(pub / "vagatta-icon-32.png")
    fit(sq, 192).save(app / "icon.png")
    imgs = [fit(sq, 16), fit(sq, 32)]
    imgs[0].save(app / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)], append_images=[imgs[1]])
    opaque(sq, 180).save(app / "apple-icon.png")
    opaque(sq, 192).save(pub / "icon-192.png")
    opaque(sq, 512).save(pub / "icon-512.png")
    maskable(sq, 192).save(pub / "icon-192-maskable.png")
    maskable(sq, 512).save(pub / "icon-512-maskable.png")
    print("ok", pub, app)

if __name__ == "__main__":
    main()
