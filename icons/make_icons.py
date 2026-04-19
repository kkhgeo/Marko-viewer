"""Render icon.svg → icon16.png, icon48.png, icon128.png using cairosvg."""
import cairosvg
from pathlib import Path

HERE = Path(__file__).parent
svg_bytes = (HERE / "icon.svg").read_bytes()

for size in (16, 48, 128):
    out = HERE / f"icon{size}.png"
    cairosvg.svg2png(
        bytestring=svg_bytes,
        write_to=str(out),
        output_width=size,
        output_height=size,
    )
    print(f"  wrote {out.name} ({size}x{size})")

print("done.")
