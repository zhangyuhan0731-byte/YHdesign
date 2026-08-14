"""提取参考图中的深灰线条，生成透明 PNG（无颜色填充）。"""
import numpy as np
from PIL import Image
import os

SRC = r"C:\Users\zhang\Documents\xwechat_files\wxid_56ko49rjbgno22_b759\temp\RWTemp\2026-08\21f8c60142504bbc78b6085273c3c87d\a820e64c649eb888e26a75d12e01e796.jpg"
DST = r"C:\Users\zhang\Desktop\YHdesign\images\ledger.png"

img = Image.open(SRC).convert("RGB")
W0, H0 = img.size
print(f"原图尺寸: {W0}x{H0}")

arr = np.array(img)
lum = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]

# 统计亮度分布，确认阈值合理
print("亮度分布:",
      "min", lum.min(),
      "max", lum.max(),
      "median", float(np.median(lum)))

# 用 lum<170 找深灰像素的边界（粗定位 bbox）
mask = lum < 170
ys, xs = np.where(mask)
bbox = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
print(f"深灰像素 bbox: {bbox}  宽={bbox[2]-bbox[0]}  高={bbox[3]-bbox[1]}")

# 看看钱袋大概的尺度
print(f"钱袋约占整图宽度: {(bbox[2]-bbox[0])/W0*100:.1f}%")

# 裁切到钱袋区域 + 边距
pad = 6
x0 = max(0, bbox[0] - pad)
y0 = max(0, bbox[1] - pad)
x1 = min(arr.shape[1], bbox[2] + pad + 1)
y1 = min(arr.shape[0], bbox[3] + pad + 1)
crop = img.crop((x0, y0, x1, y1))
crop_arr = np.array(crop)
crop_lum = 0.299 * crop_arr[..., 0] + 0.587 * crop_arr[..., 1] + 0.114 * crop_arr[..., 2]

# 构建 RGBA：保留原图深灰颜色，alpha 用亮度反推的过渡
# cream 填充 lum~234 → alpha 0；深灰 stroke lum~95 → alpha 255；中间值平滑过渡
out = np.zeros((crop_arr.shape[0], crop_arr.shape[1], 4), dtype=np.uint8)
alpha_c = np.clip((210 - crop_lum) * 3.5, 0, 255).astype(np.uint8)
out[..., 0] = crop_arr[..., 0]
out[..., 1] = crop_arr[..., 1]
out[..., 2] = crop_arr[..., 2]
out[..., 3] = alpha_c

out_img = Image.fromarray(out, "RGBA")
cw, ch = out_img.size
# 缩放到最大 256px（覆盖首页 44px/记账页 40px/空状态 120px 的 2x 渲染）
MAX = 256
if max(cw, ch) > MAX:
    if cw >= ch:
        nw, nh = MAX, int(ch * MAX / cw)
    else:
        nw, nh = int(cw * MAX / ch), MAX
    out_img = out_img.resize((nw, nh), Image.LANCZOS)

# 确保目录存在
os.makedirs(os.path.dirname(DST), exist_ok=True)
out_img.save(DST, optimize=True)
print(f"已保存: {DST}  尺寸={out_img.size}  大小={os.path.getsize(DST)} bytes")

# 验证：再读一次，看 alpha 通道比例
verify = np.array(out_img)
nonzero = (verify[..., 3] > 0).sum()
print(f"非透明像素占比: {nonzero/(verify.shape[0]*verify.shape[1])*100:.1f}%")
