"""Render docs/banner.svg → docs/banner.png (2x resolution)."""
import cairosvg
from pathlib import Path

HERE = Path(__file__).parent
svg_bytes = (HERE / "banner.svg").read_bytes()

cairosvg.svg2png(
    bytestring=svg_bytes,
    write_to=str(HERE / "banner.png"),
    output_width=2560,
    output_height=720,
)
print("wrote docs/banner.png (2560x720 @2x)")
