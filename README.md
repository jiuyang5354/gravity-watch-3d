# Gravity Watch 3D · 重力表盘 3D

Apple Watch 物理级 3D 重力交互演示器（WebGL ESM：`Three.js r187` + `Rapier3D 0.21.0` WASM）与原生 **watchOS 10+ SceneKit / Metal 3D** 伴随工程。

---

## 核心特性

### 1. Web 3D 交互演示器（仓库根目录，可直接托管于 GitHub Pages）

- **实时 3D 物理引擎与可切换求解器（[physics3d.js](physics3d.js)）**
  - 默认内置 `@dimforge/rapier3d-compat@0.21.0` WASM 刚体仿真，并支持在面板中实时切换至解析 3D 物理求解器（Analytic 3D）。
  - 针对不同材质建构真实碰撞形体：42 顶点 GIA 标准圆钻 `convexHull` 凸包、倒角金条 `roundCuboid`、标准球体 `ball`，配合 32 段圆角弧形屏幕围栏与顶部/底部隐形盖板。
- **离轴非对称视锥空间投影 + 物理级渲染管线（[scene3d.js](scene3d.js) / [watchHardware3d.js](watchHardware3d.js)）**
  - 双通道渲染架构：Off-Axis Portal Frustum 空间纵深投影、3D 雕刻表壳（Series 10 / Ultra 2 / 钛金属金 / 无框预览）、各向异性拉丝金属表壳与数字表冠、2.5D 蓝宝石玻璃色散封装与 512×624 钻石互折射缓冲。
  - `EffectComposer` + HDR `UnrealBloomPass` + `Neutral` / `AgX` / `ACES Filmic` 电影级色调映射。
- **5 大物理主题与真实材质/微交互（[textures3d.js](textures3d.js)）**
  - `01 网球`：法网红土球场 + 光学橄榄绿羊毛毡（零均值微对比纹理 + 干爽硫化胶缝）。
  - `02 钻石`：48 面 GIA 光线追踪折射火彩 + 可切换颜色的高定丝绒软垫（玄黑 / 酒红 / 午夜蓝 / 祖母绿）。
  - `03 篮球`：室内涂漆枫木地板 + 粒面深鞍棕全粒面真皮（微凹谷环境光遮蔽 + 炭黑胶筋线）。
  - `04 金条`：999.9 各向异性拉丝铸造金锭 + CNC 黑曜石/枪灰金库托盘，精准克制辉光。
  - `05 足球`：夜间球场草皮 + 缝线微凹牛皮比赛球（缝线边缘遮蔽与柔和皮革微光泽）。
- **物理自洽的表面微交互（`SurfaceTrailBuffer`）**
  - 软质/松散地面（丝绒、红土、草皮）保留真实压痕、绒毛顺向梳理与位移痕迹；
  - 硬质刚性地面（漆面枫木球场、精磨黑曜石金库）**不产生刮痕**，而是在运动物体正下方即时呈现 60fps 光学溢色与反射交互。
- **完整交互与 Tweaks 实时控制台（[app.js](app.js) / [index.html](index.html)）**
  - 拖拽旋转 3D 表体、自动 360° 摇摆录屏模式、移动设备陀螺仪接入、数字表冠点击/滚轮切场景、Web Audio 物理碰撞声效，以及右侧 `Tweaks` 面板（密度、物理引擎、HDRI、色调映射、丝绒配色、表面互映强度、Bloom、弹性、摩擦、空气阻力、重力倍率、AOD 常亮等）。

### 2. 原生 watchOS 10+ 工程（[watchos/](watchos/)）

- 位于 [watchos/GravityWatchFace3D/](watchos/GravityWatchFace3D/)，基于 SwiftUI + SceneKit + 自定义 MSL（Metal Shading Language）3-Bounce GIA 钻石光线追踪着色器，支持 60Hz CoreMotion 手腕重力感应、Digital Crown 切换主题与 Always-On Display 降亮度模式。
- 详细编译与真机安装步骤请参阅 [watchos/README.md](watchos/README.md)。

---

## 本地运行 Web 3D 演示器

由于页面使用原生 ES Module（`importmap`）、`HDRLoader` 与 `Rapier3D WASM`，需通过本地 HTTP 服务器访问（请勿直接双击 `index.html` 以 `file://` 打开）：

```bash
python -m http.server 8766
```

随后在浏览器打开：

```text
http://localhost:8766/
```

仓库根目录已包含完整的静态资源与本地化依赖，可直接开启 **GitHub Pages** 部署预览。

---

## 目录结构

```text
.
├── index.html              # 主页面结构与 importmap 配置
├── styles.css              # 海报式排版与 Tweaks 控件样式
├── boot.js                 # ESM 引导（Three.js r187 + Rapier 0.21.0 WASM 初始化）
├── app.js                  # 状态管理、交互事件、陀螺仪与 Tweaks 控制台联动
├── scene3d.js              # 离轴空间投影、材质/布光、SurfaceTrailBuffer 与 HDR 合成
├── textures3d.js           # 5 大主题贴图/法线/粗糙度合成与天鹅绒参数预设
├── physics3d.js            # Rapier3D WASM 刚体世界与 Analytic 3D 解析求解器
├── watchHardware3d.js      # Apple Watch 3D 表壳/表冠/表带/蓝宝石玻璃几何构建
├── vendor/                 # 本地化 Three.js r187 (ESM + JSM addons) 与 Rapier 0.21.0
├── assets/
│   ├── hdr/                # studio_small_08 / studio_small_09 (CC0, Poly Haven)
│   └── textures/           # 红土、深木、草坪、丝绒、毛毡、皮革、金属、橡胶 PBR 贴图
└── watchos/                # 原生 watchOS 10+ Xcode 工程与使用说明
    ├── README.md
    └── GravityWatchFace3D/
```

---

## 致谢与资源许可

- 本项目内置使用的 HDRI 环境贴图与扫描 PBR 材质纹理来自 [Poly Haven](https://polyhaven.com/)（CC0 许可）。
- 3D 渲染基于 [Three.js r187](https://github.com/mrdoob/three.js)，刚体物理基于 [Rapier](https://github.com/dimforge/rapier)。
