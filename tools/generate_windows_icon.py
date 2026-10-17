"""Generate the Windows stock-alert icon from code-native vector primitives.

Requires Pillow only when regenerating; the app consumes the checked-in .ico.
The SVG and raster previews are generated from the same scene, not separate designs.
"""
from io import BytesIO
from pathlib import Path
import struct

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "windows" / "FearIndexAlarm" / "Assets"
SIZES = (16, 20, 24, 32, 40, 48, 64, 128, 256)

# Coordinates use a 256 x 256 viewBox. Solid fills retain contrast at tray sizes.
SCENE = [
    ("rounded", (4, 4, 252, 252), "#102B38", 52),
    ("line", ((36, 202), (218, 202)), "#244654", 3),
    ("rounded", (40, 146, 60, 201), "#245F66", 4),
    ("rounded", (77, 128, 97, 201), "#245F66", 4),
    ("rounded", (114, 157, 134, 201), "#245F66", 4),
    ("line", ((43, 65), (83, 108), (114, 85), (151, 123)), "#80F2CC", 12),
    ("line", ((130, 123), (151, 123), (151, 102)), "#80F2CC", 12),
    ("polygon", ((182, 113), (241, 218), (123, 218)), "#FFC34D"),
    ("line", ((182, 149), (182, 181)), "#102B38", 12),
    ("circle", (182, 201), "#102B38", 7),
]


def svg():
    nodes = []
    for kind, coordinates, color, *extra in SCENE:
        if kind == "rounded":
            x1, y1, x2, y2 = coordinates
            nodes.append(f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" rx="{extra[0]}" fill="{color}"/>')
        elif kind == "line":
            points = " ".join(f"{x},{y}" for x, y in coordinates)
            nodes.append(f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="{extra[0]}" stroke-linecap="round" stroke-linejoin="round"/>')
        elif kind == "polygon":
            points = " ".join(f"{x},{y}" for x, y in coordinates)
            nodes.append(f'<polygon points="{points}" fill="{color}"/>')
        else:
            x, y = coordinates
            nodes.append(f'<circle cx="{x}" cy="{y}" r="{extra[0]}" fill="{color}"/>')
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Stock market alert: falling chart and warning triangle">\n  ' + "\n  ".join(nodes) + "\n</svg>\n"


def render(size):
    scale = size * 4 / 256
    canvas = Image.new("RGBA", (size * 4, size * 4))
    draw = ImageDraw.Draw(canvas)
    for kind, coordinates, color, *extra in SCENE:
        if kind == "rounded":
            draw.rounded_rectangle(tuple(value * scale for value in coordinates), radius=extra[0] * scale, fill=color)
        elif kind == "line":
            points = [(x * scale, y * scale) for x, y in coordinates]
            width = max(1, round(extra[0] * scale))
            draw.line(points, fill=color, width=width, joint="curve")
            radius = width / 2
            for x, y in points:
                draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=color)
        elif kind == "polygon":
            draw.polygon([(x * scale, y * scale) for x, y in coordinates], fill=color)
        else:
            x, y = coordinates
            radius = extra[0]
            draw.ellipse(tuple(value * scale for value in (x-radius, y-radius, x+radius, y+radius)), fill=color)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    (ASSETS / "stock-alert.svg").write_text(svg(), encoding="utf-8")
    render(256).save(ASSETS / "stock-alert.png")
    # ICO directory + independent PNG frames: supported by Windows Vista and newer.
    payloads = []
    for size in SIZES:
        buffer = BytesIO()
        render(size).save(buffer, format="PNG")
        payloads.append(buffer.getvalue())
    offset = 6 + 16 * len(SIZES)
    directory = []
    for size, payload in zip(SIZES, payloads):
        directory.append(struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(payload), offset))
        offset += len(payload)
    (ASSETS / "stock-alert.ico").write_bytes(struct.pack("<HHH", 0, 1, len(SIZES)) + b"".join(directory) + b"".join(payloads))
    with Image.open(ASSETS / "stock-alert.ico") as icon:
        assert icon.ico.sizes() == {(size, size) for size in SIZES}
        for size in SIZES:
            assert icon.ico.getimage((size, size)).size == (size, size)
    preview = Image.new("RGB", (720, 420), "#F1F5F5")
    draw = ImageDraw.Draw(preview)
    preview.paste(render(256), (24, 24), render(256))
    draw.text((24, 292), "Stock chart + warning / Windows", fill="#102B38")
    for index, size in enumerate((16, 20, 24, 32, 48, 64)):
        x = 320 + (index % 3) * 126
        y = 24 + (index // 3) * 190
        frame = render(size)
        preview.paste(frame, (x, y), frame)
        enlarged = frame.resize((64, 64), Image.Resampling.NEAREST)
        preview.paste(enlarged, (x, y + 80), enlarged)
        draw.text((x, y + 150), f"{size}px", fill="#102B38")
    preview_path = ROOT / "artifacts" / "stock-alert-preview.png"
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview.save(preview_path)
    print(f"Generated {ASSETS / 'stock-alert.ico'} ({len(SIZES)} sizes); preview: {preview_path}")


if __name__ == "__main__":
    main()
