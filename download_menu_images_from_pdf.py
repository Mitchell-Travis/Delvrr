#!/usr/bin/env python3
"""
download_menu_images_from_pdf.py

1. Extract menu item names from a PDF.
2. Crawl Google Images for each item.
3. Download, resize, and compress to JPEG.
4. Save to ~/Desktop/Fuzion Pic/, named by product.
"""

import os
import re
import sys
from pathlib import Path

from icrawler.builtin import GoogleImageCrawler
from PIL import Image
from PyPDF2 import PdfReader

# === Config ===
PDF_PATH    = os.path.expanduser("~/Desktop/Menu GST.pdf")
OUTPUT_DIR  = os.path.expanduser("~/Desktop/Fuzion Pic")
MAX_IMAGES  = 1
MAX_DIM     = 800    # max pixel dimension for thumbnail
JPEG_QUAL   = 85     # JPEG quality (1–95)

# === Helpers ===
def sanitize_filename(name: str) -> str:
    """Convert product name into a safe filename."""
    name = name.strip().lower()
    name = re.sub(r"[^\w\s-]", "", name)      # remove non‑word chars
    return re.sub(r"\s+", "_", name)          # spaces → underscores

def extract_product_names(pdf_path: str) -> list[str]:
    """Pull out lines of text with no digits/$ as product candidates."""
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += (page.extract_text() or "") + "\n"
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    # Keep lines without digits or '$'
    candidates = [ln for ln in lines if not re.search(r"[\d\$]", ln)]
    # Drop known headers/footers
    blacklist = {
        "menu", "starters", "breakfast", "sandwiches", "pizza",
        "burgers", "desserts", "drinks", "thank you", "non alcoholic",
        "page", "@fuziondafrique", "@majusandtheburgerspotlib"
    }
    filtered = [
        ln for ln in candidates
        if ln.lower() not in blacklist
        and 3 <= len(ln) <= 40
    ]
    # De‑duplicate while preserving order
    seen, products = set(), []
    for ln in filtered:
        if ln not in seen:
            seen.add(ln)
            products.append(ln)
    return products

def ensure_dir(path: str):
    """Create directory (and parents) if it doesn't exist."""
    Path(path).mkdir(parents=True, exist_ok=True)

# === Main ===
def main():
    # 1) Check PDF exists
    if not os.path.isfile(PDF_PATH):
        print(f"Error: PDF not found at {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    # 2) Extract product names
    print("Extracting product names from PDF…")
    products = extract_product_names(PDF_PATH)
    if not products:
        print("Error: No products found. Check PDF extraction rules.", file=sys.stderr)
        sys.exit(1)
    print(f"Found {len(products)} items.")

    # 3) Prepare output folder
    ensure_dir(OUTPUT_DIR)

    # 4) Initialize GoogleImageCrawler (no downloader_kwargs here)
    crawler = GoogleImageCrawler(
        feeder_threads=1,
        parser_threads=2,
        downloader_threads=4,
        storage={'root_dir': OUTPUT_DIR}
    )

    # 5) Loop through each product
    for prod in products:
        print(f"\n→ Processing: {prod}")
        safe = sanitize_filename(prod)
        prod_folder = os.path.join(OUTPUT_DIR, safe)
        ensure_dir(prod_folder)

        # Download one decent‑sized image
        crawler.crawl(
            keyword=prod,
            max_num=MAX_IMAGES,
            min_size=(200, 200),
            file_idx_offset=0,
            overwrite=True
        )

        # Find and process the first image
        files = sorted(Path(prod_folder).glob("*"))
        if not files:
            print(f"  ⚠️  No image downloaded for '{prod}'")
            continue

        inp = files[0]
        outp = os.path.join(OUTPUT_DIR, f"{safe}.jpg")
        try:
            with Image.open(inp) as im:
                # Resize/compress
                im.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)
                im.convert("RGB").save(
                    outp,
                    format="JPEG",
                    optimize=True,
                    quality=JPEG_QUAL
                )
            # Cleanup folder
            for f in files: f.unlink()
            Path(prod_folder).rmdir()
            print(f"  ✔ Saved: {outp}")
        except Exception as e:
            print(f"  ✖ Failed to process '{prod}': {e}")

if __name__ == "__main__":
    main()
