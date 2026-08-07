# 趣玩小工具

一个纯本地、无后端的微信小程序工具合集。所有数据保存在本机（`wx.storage`），无需登录、不联网。

## 功能

### 主包工具（13 个）

| 工具 | 说明 |
| --- | --- |
| 记账本 | 收入支出记录，支持自定义分类 |
| 备忘录 | 随手保存小事情 |
| 倒数日记 | 重要日子倒计时 |
| 幸运转盘 | 选择困难时转一下 |
| 心情日记 | 每天记一句心情 |
| 体重记录 | 记录近期体重变化 |
| 喝水提醒 | 今日饮水打卡 |
| 每日抽签 | 抽一支今日灵感签 |
| 星座匹配 | 两人星座契合度 |
| 生肖匹配 | 属相关系查询 |
| 敲木鱼 | 安静敲一敲，带音效 |

首页宫格支持自定义排序（上移/下移），顺序即时保存到本机。

### 厨神分包（packages/chef）

内置 368 道菜谱，支持按现有食材匹配可做的菜、今日菜谱推荐、烹饪提示等。菜谱数据来自开源项目 [HowToCook](https://github.com/Anduin2017/HowToCook)，构建时生成为静态 JS 文件，放在分包中以避开主包 2MB 体积限制。

## 项目结构

```
├── app.js / app.json / app.wxss   # 小程序入口与全局配置
├── pages/                         # 主包页面（各个小工具）
├── packages/chef/                 # 厨神分包（菜谱页面 + 生成的数据）
├── utils/                         # 公共工具函数与静态数据
├── audio/                         # 音效资源
├── images/                        # 图片资源
└── tools/                         # 构建脚本
    ├── import-howtocook.js        # 从 HowToCook 导入菜谱，生成分包数据
    └── check-chef.js              # 菜谱数据校验
```

## 开发

1. 使用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)打开本项目根目录。
2. 无需安装依赖、无需配置后端，直接编译预览即可。

### 更新菜谱数据

```bash
node tools/import-howtocook.js   # 从 HowToCook 仓库重新生成 packages/chef/data/generated/
node tools/check-chef.js         # 校验生成的数据
```
