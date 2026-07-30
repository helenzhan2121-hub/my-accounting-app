#!/usr/bin/env python3
# guide-gen.py —— 把多张截图拼成「添加到主屏幕」指引长图 + 步骤文字
# 用法: python guide-gen.py 截图1.png 截图2.png 截图3.png 截图4.png --out guide.png
#       --steps "步骤1说明" "步骤2说明" ...  （与图片顺序一一对应，可选）
# 依赖: Pillow + 系统中文字体
import os, sys, argparse, textwrap
from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/PingFang.ttc"
DEFAULT_STEPS = [
    "步骤 1：微信里打开链接，点右上角「···」，选择「用默认浏览器打开」",
    "步骤 2：点浏览器底部菜单按钮，选择「在 Safari 中打开」",
    "步骤 3：在 Safari 中点分享按钮，或地址栏菜单 →「共享」",
    "步骤 4：在共享菜单里找到并点击「添加到主屏幕」",
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+", help="截图路径，按步骤顺序")
    ap.add_argument("--out", default="add-to-home-guide.png")
    ap.add_argument("--steps", nargs="*", default=None)
    ap.add_argument("--title", default="iPhone 把应用添加到主屏幕")
    args = ap.parse_args()

    if not os.path.exists(FONT):
        sys.exit("缺少中文字体，请安装或改 FONT 路径")
    steps = args.steps if args.steps else DEFAULT_STEPS
    if len(steps) < len(args.images):
        steps = steps + DEFAULT_STEPS[len(steps):len(args.images)]

    title_font = ImageFont.truetype(FONT, 52)
    step_font = ImageFont.truetype(FONT, 36)
    desc_font = ImageFont.truetype(FONT, 28)

    W = 720; pad = 44; header_h = 140; step_h = 52; desc_h = 80
    img_w = W - pad * 2
    imgs = []
    for p in args.images:
        im = Image.open(p).convert("RGB")
        ratio = img_w / im.width
        imgs.append(im.resize((img_w, int(im.height * ratio)), Image.Resampling.LANCZOS))

    total_h = header_h + sum(im.height + step_h + desc_h + pad for im in imgs) + pad
    canvas = Image.new("RGB", (W, total_h), "#F5F6FA")
    draw = ImageDraw.Draw(canvas)

    tw = draw.textbbox((0, 0), args.title, font=title_font)[2]
    draw.text(((W - tw) / 2, 48), args.title, fill="#4F46E5", font=title_font)

    y = header_h
    for im, step in zip(imgs, steps):
        draw.text((pad, y), step.split("：")[0] if "：" in step else "步骤", fill="#4F46E5", font=step_font)
        y += step_h + 8
        mask = Image.new("L", im.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width, im.height), radius=20, fill=255)
        canvas.paste(im, (pad, y), mask)
        y += im.height + 16
        for line in textwrap.wrap(step, width=24):
            draw.text((pad, y), line, fill="#374151", font=desc_font)
            y += 40
        y += pad

    canvas.save(args.out, quality=95)
    print("saved", args.out, canvas.size)

if __name__ == "__main__":
    main()
