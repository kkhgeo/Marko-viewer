"""Render docs/logo.svg → docs/logo.png."""
import cairosvg
from pathlib import Path

HERE = Path(__file__).parent
svg_bytes = (HERE / "logo.svg").read_bytes()

# 2x resolution for crisp rendering on HiDPI
cairosvg.svg2png(
    bytestring=svg_bytes,
    write_to=str(HERE / "logo.png"),
    output_width=800,
    output_height=200,
)
print("wrote docs/logo.png (800x200)")
