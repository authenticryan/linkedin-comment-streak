"""Draws the 2x2 green-squares icon as PNGs (no dependencies).

Writes extension/icons/icon{16,48,128}.png and store/icon-128.png
(the Store wants 96px of artwork centred on a 128px transparent canvas).
Run: python3 scripts/make-icons.py
"""
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHADES = [(155, 233, 168), (48, 161, 78), (64, 196, 99), (33, 110, 57)]


def draw(canvas, art, path):
    off = (canvas - art) / 2
    cell = art / 2
    pad = max(1, round(art * 0.06))
    rad = max(1, art * 0.08)
    rows = []
    for y in range(canvas):
        row = bytearray([0])
        for x in range(canvas):
            ax, ay = x - off, y - off
            px = (0, 0, 0, 0)
            if 0 <= ax < art and 0 <= ay < art:
                cx, cy = int(ax // cell), int(ay // cell)
                lx, ly = ax - cx * cell, ay - cy * cell
                if pad <= lx < cell - pad and pad <= ly < cell - pad:
                    ex = min(lx - pad, cell - pad - 1 - lx)
                    ey = min(ly - pad, cell - pad - 1 - ly)
                    corner = ex < rad and ey < rad and (rad - ex) ** 2 + (rad - ey) ** 2 > rad ** 2
                    if not corner:
                        px = SHADES[cy * 2 + cx] + (255,)
            row += bytes(px)
        rows.append(bytes(row))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", canvas, canvas, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
        + chunk(b"IEND", b"")
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


for size in (16, 48, 128):
    draw(size, size, os.path.join(ROOT, "extension", "icons", f"icon{size}.png"))
draw(128, 96, os.path.join(ROOT, "store", "icon-128.png"))
print("icons written")
