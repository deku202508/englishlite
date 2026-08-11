"""生成扩展图标（绿色圆角方块 + 白色 EN），Apple 风格"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(BASE, "icons")
os.makedirs(ICON_DIR, exist_ok=True)

FONT_PATH = r"C:\Windows\Fonts\arialbd.ttf"
GREEN = (52, 199, 89, 255)  # Apple 绿 #34C759

for size in (16, 48, 128):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=GREEN)
    try:
        font = ImageFont.truetype(FONT_PATH, int(size * 0.44))
    except OSError:
        font = ImageFont.load_default()
    text = "EN"
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    d.text((x, y), text, font=font, fill=(255, 255, 255, 255))
    out = os.path.join(ICON_DIR, f"icon{size}.png")
    img.save(out)
    print("written:", out)
