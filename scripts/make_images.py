"""Generate public/og-image.png (1200x630) and public/apple-touch-icon.png (180x180).

Pure-Pillow render so it needs no browser/Chromium. Run: python scripts/make_images.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")

BG = (11, 15, 16)          # #0b0f10
TEAL = (44, 181, 164)      # #2cb5a4
WHITE = (232, 237, 236)    # #e8edec
GRAY = (159, 176, 173)     # #9fb0ad
CHIP_BG = (255, 255, 255, 13)
CHIP_BORDER = (255, 255, 255, 20)

FONTS = "C:/Windows/Fonts"

def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)

BOLD = "segoeuib.ttf"
REG = "segoeui.ttf"

# Lucide "box" silhouette on a 24 grid (rounding dropped for a clean raster).
HEX = [(3, 8), (12, 3), (21, 8), (21, 16), (12, 21), (3, 16)]
TOP_V = [(3.3, 7), (12, 12), (20.7, 7)]
STEM = [(12, 12), (12, 22)]

def draw_box(d, ox, oy, scale, width, color):
    def P(pts):
        return [(ox + x * scale, oy + y * scale) for x, y in pts]
    d.line(P(HEX) + P([HEX[0]]), fill=color, width=width, joint="curve")
    d.line(P(TOP_V), fill=color, width=width, joint="curve")
    d.line(P(STEM), fill=color, width=width, joint="curve")

def rounded(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

def line_width(draw, segments, fnt):
    return sum(draw.textlength(t, font=fnt) for t, _ in segments)

# ---------------- OG image ----------------
def make_og():
    img = Image.new("RGB", (1200, 630), BG)

    glow = Image.new("RGBA", (1200, 630), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([820, -200, 1340, 320], fill=(*TEAL, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")

    d = ImageDraw.Draw(img, "RGBA")

    # Badge + wordmark
    rounded(d, [88, 84, 180, 176], 22, fill=(*TEAL, 41), outline=(*TEAL, 90), width=2)
    draw_box(d, 88 + 21, 84 + 21, 2.1, 6, TEAL)
    wf = font(BOLD, 60)
    wx, wy = 204, 96
    d.text((wx, wy), "ox", font=wf, fill=TEAL)
    wx += d.textlength("ox", font=wf)
    d.text((wx, wy), "Edit", font=wf, fill=WHITE)

    # Headline
    hf = font(BOLD, 66)
    lines = [
        [("Edit ", WHITE), ("ox_inventory", TEAL), (" items,", WHITE)],
        [("weapons & shops", WHITE)],
        [("in your browser.", WHITE)],
    ]
    y = 250
    for segs in lines:
        x = 88
        for text, color in segs:
            d.text((x, y), text, font=hf, fill=color)
            x += d.textlength(text, font=hf)
        y += 80

    # Subtitle
    sf = font(REG, 28)
    d.text((88, y + 8), "Non-destructive saves · bulk edits · image optimization · no upload, no install.",
           font=sf, fill=GRAY)

    img.save(os.path.join(PUB, "og-image.png"))
    print("wrote og-image.png", img.size)

# ---------------- Apple touch icon ----------------
def make_icon():
    s = 180
    img = Image.new("RGB", (s, s), (16, 28, 26))
    d = ImageDraw.Draw(img, "RGBA")
    rounded(d, [0, 0, s, s], 40, fill=(16, 28, 26))
    # subtle teal panel
    rounded(d, [22, 22, s - 22, s - 22], 28, fill=(*TEAL, 28))
    draw_box(d, 44, 44, 3.9, 9, TEAL)
    img.save(os.path.join(PUB, "apple-touch-icon.png"))
    print("wrote apple-touch-icon.png", img.size)

if __name__ == "__main__":
    make_og()
    make_icon()
