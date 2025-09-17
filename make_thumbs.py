import os
from pathlib import Path
from PIL import Image

# ---------- SETTINGS ----------
SRC_DIR = "images"           # folder with your full-size pages
DST_DIR = "thumbs"           # where thumbnails will be saved
PREFIX = "Book_PHYS101_"     # base filename for pages
PAGE_COUNT = 294             # total number of pages
THUMB_WIDTH = 120            # thumbnail width in pixels
JPEG_QUALITY = 85            # 0–100 (higher = better quality/larger size)
# ------------------------------

Path(DST_DIR).mkdir(exist_ok=True)

for i in range(PAGE_COUNT):
    src_file = Path(SRC_DIR) / f"{PREFIX}{i}.png"
    dst_file = Path(DST_DIR) / f"{PREFIX}{i}.jpg"

    if not src_file.exists():
        print(f"[skip] {src_file} not found")
        continue

    try:
        with Image.open(src_file) as img:
            img.thumbnail((THUMB_WIDTH, img.height))  # keep aspect ratio
            img.convert("RGB").save(dst_file, "JPEG", quality=JPEG_QUALITY)
        print(f"[ok] {dst_file}")
    except Exception as e:
        print(f"[error] Could not process {src_file}: {e}")

print("\n✅ Thumbnails finished! Check the 'thumbs' folder.")
