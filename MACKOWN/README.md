# MACKOWN® — 三个世界

一个名字，三种个人风格。整套站点完全离线运行，不依赖网络、CDN 或构建工具。

## 直接打开

双击 **`index.html`**。这是总入口，可以进入三个独立站点：

| 世界 | 路径 | 风格 | 核心体验 |
| --- | --- | --- | --- |
| **01 ORBITAL** | `orbit/index.html` | 天体观测 / 深空电影感 | Three.js 3D 行星、光环、三颗卫星；拖拽环绕、滚轮缩放、点击天体聚焦、频谱扫描、环境音 |
| **02 ATELIER** | `atelier/index.html` | 温暖编辑设计 / 纸感 | 作品集、项目档案弹窗、可拖动太阳、海报生成器、日/夜模式 |
| **03 SIGNAL** | `signal/index.html` | 深夜电台 / 酸性数字 | Web Audio 合成器、16 步鼓机、可调频电台、8+5 键合成器、曲目切换 |

## 操作提示

### ORBITAL
- 拖拽：环绕行星
- 滚轮 / 双指捏合：缩放
- 点击行星或卫星：聚焦
- 底部 `01–04`：切换观测对象
- `SCAN`：启动频谱扫描
- `SOUND`：打开深空环境音（建议戴耳机）
- 键盘：`1–4` 聚焦，`0` / `Esc` 回到全景，`S` 扫描，`M` 声音，`R` 重置

### ATELIER
- 拖动红色太阳，改变构图
- 点击作品：打开项目详情；`Esc` 关闭，方向键切换
- 右侧 `Night`：切换日/夜
- 海报机：选色、拖拽或点击海报随机生成

### SIGNAL
- `Play`：开始合成循环
- 点击 16 步网格：编辑鼓点；`Generate` / `Clear` 重组
- 调频：89.3 / 96.7 / 104.2 会改变整站强调色
- 曲目列表：切换节拍与和弦
- 钢琴：点击琴键，或使用 `A S D F G H J K` / `W E T Y U`

## 上传到 GitHub / Cloudflare Pages

**这个文件夹本身就是完整站点**（`MACKOWN/`），把它整体上传即可：

```
index.html        ← 总入口（必须）
assets/           ← 字体、Three.js（必须）
atelier/          ← 必须
signal/           ← 必须
orbit/            ← 必须
README.md         ← 建议
.nojekyll         ← GitHub Pages 用，内容为空，其他平台忽略
```

工作区里的 `ocr_test.*` 等无关文件不需要上传。

### GitHub Pages
1. 新建仓库，把上面这些文件/目录放到仓库**根目录**（`index.html` 必须在根目录）
2. Settings → Pages → Build and deployment → Source 选 `Deploy from a branch`，Branch 选 `main`，目录选 `/ (root)`，保存
3. 等 1–2 分钟，访问 `https://<用户名>.github.io/<仓库名>/`

### Cloudflare Pages
- 用 GitHub 连接：构建设置里 Build command **留空**，Build output directory 填 **`/`**
- 或者直接上传（Direct Upload）：把上面这些文件拖进上传区，根目录要能看到 `index.html`

## 文件结构

```
index.html                 总入口 / 三世界目录
.nojekyll                  （空文件）GitHub Pages 跳过 Jekyll 处理
assets/
  fonts.css                内嵌字体（离线可用）
  fonts/                   字体源文件
  vendor/three.min.js      Three.js r128（本地）
atelier/                   ATELIER 站点
signal/                    SIGNAL 站点
orbit/                     ORBITAL 3D 站点
```

## 技术说明

- Three.js r128：程序化行星着色器、光环、卫星纹理、星场、扫描脉冲
- Web Audio API：鼓机、合成器、环境音、交互音效
- Canvas 2D：首页粒子场、SIGNAL 示波器、程序化行星/卫星纹理
- 所有字体通过 `@font-face` 内嵌，无外部请求
- 支持键盘、触摸、`prefers-reduced-motion`
- 建议使用最新版 Chrome / Edge / Firefox / Safari；需要 WebGL 才能看到 ORBITAL 的 3D 场景

Designed & coded as one personal constellation.
