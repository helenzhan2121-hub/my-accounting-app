#!/usr/bin/env python3
# icon-gen.py —— 生成 App 图标（圆角色块 + 单个汉字/字母）
# 用法: python icon-gen.py --text 记 --color "#FF7EB3" --outdir .
# 依赖: Pillow + 系统中文字体（macOS 默认 /System/Library/Fonts/PingFang.ttc）
import os, argparse, sys
from PIL import Image, ImageDraw, ImageFont

DEFAULT_FONT = "/System/Library/Fonts/PingFang.ttc"

def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def make_png(size, text, color, font_path, out):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=color + (255,))
    try:
        font = ImageFont.truetype(font_path, int(size * 0.62))
    except Exception:
        font = ImageFont.truetype(font_path, int(size * 0.62), index=0)
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]; th = bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    d.text((x, y), text, font=font, fill=(255, 255, 255, 255))
    img.save(out)
    print("wrote", out, img.size)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", default="记", help="图标上的字（建议1字）")
    ap.add_argument("--color", default="#FF7EB3", help="背景色 hex")
    ap.add_argument("--font", default=DEFAULT_FONT)
    ap.add_argument("--outdir", default=".")
    args = ap.parse_args()

    if not os.path.exists(args.font):
        sys.exit(f"字体不存在: {args.font}（macOS 用 /System/Library/Fonts/PingFang.ttc；其他系统请指定 --font）")
    rgb = hex2rgb(args.color)
    os.makedirs(args.outdir, exist_ok=True)
    make_png(64, args.text, rgb, args.font, os.path.join(args.outdir, "favicon.png"))
    make_png(192, args.text, rgb, args.font, os.path.join(args.outdir, "icon-192.png"))
    make_png(512, args.text, rgb, args.font, os.path.join(args.outdir, "icon-512.png"))

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        f'  <rect width="64" height="64" rx="14" fill="{args.color}"/>\n'
        '  <text x="32" y="46" font-family="-apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif" '
        f'font-size="42" font-weight="700" text-anchor="middle" fill="#fff">{args.text}</text>\n'
        '</svg>\n'
    )
    with open(os.path.join(args.outdir, "favicon.svg"), "w", encoding="utf-8") as f:
        f.write(svg)
    print("wrote favicon.svg")

if __name__ == "__main__":
    main()
