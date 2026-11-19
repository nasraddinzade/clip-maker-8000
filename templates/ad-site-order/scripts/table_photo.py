"""The table: a free-licence photo of matte wood (licence in CREDITS.md and LICENSES.md of the project).
Writes public/table/wood_full.jpg (the photo, full resolution, drawn where the devices lie) and public/table/wood_tile.jpg
(the photo and its three mirror images at half resolution, continuing the table without a seam). Prints the size for
config.json table.photoPx. A large photo is fine (6000 px); OCR it at scale 0.25 (tools, video-ad-craft).
python scripts/table_photo.py PHOTO.jpg"""
import os, sys
from PIL import Image, ImageOps
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
s = Image.open(sys.argv[1]).convert("RGB"); w, h = s.size
os.makedirs(os.path.join(ROOT, "public/table"), exist_ok=True)
s.save(os.path.join(ROOT, "public/table/wood_full.jpg"), quality=90)
hs = s.resize((w // 2, h // 2), Image.LANCZOS); t = Image.new("RGB", (w, h))
t.paste(hs, (0, 0)); t.paste(ImageOps.mirror(hs), (w // 2, 0)); t.paste(ImageOps.flip(hs), (0, h // 2)); t.paste(ImageOps.flip(ImageOps.mirror(hs)), (w // 2, h // 2))
t.save(os.path.join(ROOT, "public/table/wood_tile.jpg"), quality=88)
print(f"table photo {w} x {h} px (config.json table.photoPx: [{w}, {h}])")
