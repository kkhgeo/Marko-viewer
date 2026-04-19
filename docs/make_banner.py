"""Render docs/banner.png using Paperlogy (woff2 → Pillow).

Uses Paperlogy fonts bundled in ../fonts/ directly — no system install needed.
"""
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

HERE = Path(__file__).parent
FONTS = HERE.parent / "fonts"

def load_woff2(woff2_path: Path, size: int) -> ImageFont.FreeTypeFont:
    tt = TTFont(str(woff2_path))
    buf = io.BytesIO()
    tt.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, size)

# ---- Canvas (2x resolution for HiDPI) ----
SCALE = 2
W = 1000 * SCALE
H = 440 * SCALE

BG       = '#f6f0e3'
INK      = '#0f1624'
AMBER    = '#ff8a2a'
BLUE     = '#009fde'
GREEN    = '#00ab84'

img = Image.new('RGB', (W, H), BG)
draw = ImageDraw.Draw(img)

def px(v: int) -> int:
    return int(v * SCALE)

# ---- Top editorial line ----
draw.rectangle([(0, 0), (W, px(4))], fill=INK)

# ---- Load fonts ----
font_marko    = load_woff2(FONTS / "Paperlogy-7Bold.woff2",     px(68))
# 태그라인·부제·기능태그 모두 동일 크기
font_text     = load_woff2(FONTS / "Paperlogy-5Medium.woff2",   px(24))

# ---- Logo: 3 squares + MARKO ----
SQ       = px(48)
SQ_GAP   = px(9)
TXT_GAP  = px(22)
y_logo   = px(120)

marko_bbox = draw.textbbox((0, 0), "MARKO", font=font_marko)
marko_w = marko_bbox[2] - marko_bbox[0]
marko_h = marko_bbox[3] - marko_bbox[1]
marko_top_bearing = marko_bbox[1]  # Paperlogy has top bearing above cap

total_w = SQ * 3 + SQ_GAP * 2 + TXT_GAP + marko_w
start_x = (W - total_w) // 2

# Squares
for i, color in enumerate([AMBER, BLUE, GREEN]):
    x = start_x + i * (SQ + SQ_GAP)
    draw.rounded_rectangle([x, y_logo, x + SQ, y_logo + SQ], radius=px(6), fill=color)

# MARKO — vertically center with squares (use cap height)
marko_x = start_x + SQ * 3 + SQ_GAP * 2 + TXT_GAP
# bbox top may include ascender space; compensate
marko_y = y_logo + (SQ - marko_h) // 2 - marko_top_bearing
draw.text((marko_x, marko_y), "MARKO", font=font_marko, fill=INK)

# ---- Divider line ----
y_div = px(220)
cx = W // 2
div_half = px(120)
draw.line([(cx - div_half, y_div), (cx + div_half, y_div)], fill=INK + "40", width=px(1))

# ---- Tagline ----
tagline = "한국어 논문 글쓰기용 로컬 마크다운 뷰어"
tl_bbox = draw.textbbox((0, 0), tagline, font=font_text)
tl_w = tl_bbox[2] - tl_bbox[0]
draw.text(((W - tl_w) // 2, px(245)), tagline, font=font_text, fill=INK)

# ---- Subtitle (same size, muted color) ----
subtitle = "AI와 협업하는 조용한 읽기 · 주석 도구"
st_bbox = draw.textbbox((0, 0), subtitle, font=font_text)
st_w = st_bbox[2] - st_bbox[0]
draw.text(((W - st_w) // 2, px(305)), subtitle, font=font_text, fill='#4a556b')

# ---- Feature tags (same size, more muted) ----
tags = ["3-COLUMN LAYOUT", "LaTeX MATH", "HIGHLIGHTS", "MEMOS"]
sep = "    ·    "
tag_line = sep.join(tags)
tag_bbox = draw.textbbox((0, 0), tag_line, font=font_text)
tag_w = tag_bbox[2] - tag_bbox[0]
draw.text(((W - tag_w) // 2, px(385)), tag_line, font=font_text, fill='#7a8499')

# ---- Save ----
out = HERE / "banner.png"
img.save(out, optimize=True)
print(f"wrote {out.name}  ({W}x{H} @{SCALE}x)")
