# Gravity Watch 3D · 重力表盘 3D

[![Apple iOS & watchOS CI Build](https://github.com/jiuyang5354/gravity-watch-3d/actions/workflows/apple-ci.yml/badge.svg)](https://github.com/jiuyang5354/gravity-watch-3d/actions/workflows/apple-ci.yml)

Apple Watch 物理级 3D 重力交互演示器（WebGL ESM：`Three.js r187` + `Rapier3D 0.21.0` WASM，`pristine_v16`）与原生 **iOS 17+ 伴侣工坊 & watchOS 10+ SceneKit / Metal 双端应用工程**（`GravityWatchStudio`）。

> **相关独立仓库（Android 动态壁纸版）**：[jiuyang5354/gravity-live-wallpaper-3d](https://github.com/jiuyang5354/gravity-live-wallpaper-3d)（`Kotlin + OpenGL ES 3.0 + 纯 Canvas 三层视差`）

---

## 核心特性

### 1. Web 3D 交互演示器（仓库根目录，可直接托管于 GitHub Pages）

- **实时 3D 物理引擎与双求解器（[physics3d.js](physics3d.js)）**
  - 默认内置 `@dimforge/rapier3d-compat@0.21.0` WASM 刚体仿真，并支持切换至解析 3D 物理求解器（Analytic 3D）。
  - 针对不同材质建构真实碰撞形体：42 顶点 GIA 标准圆钻 `convexHull` 凸包、倒角金条 `roundCuboid`、标准球体 `ball`，配合圆角弧形屏幕边界围栏与顶部/底部隐形盖板。
- **无边框离轴视差空间投影 + 物理级渲染管线（[scene3d.js](scene3d.js) / [watchHardware3d.js](watchHardware3d.js)）**
  - 无边框（Borderless）Off-Axis Portal Frustum 空间纵深投影、3D 雕刻表壳（Series 10 / Ultra 2 / 钛金属金 / 无框预览）、各向异性拉丝金属与数字表冠、2.5D 蓝宝石玻璃封装。
  - 集成 `N8AO`（`vendor/n8ao.module.js`）半分辨率实时环境光遮蔽、`three-mesh-bvh`（`vendor/three-mesh-bvh.module.js`）多回弹钻石内部光线追踪，`EffectComposer` + 克制 HDR `UnrealBloomPass` + `Neutral` / `AgX` / `ACES Filmic` 色调映射。
- **5 大影棚级纯净物理主题（`pristine_v16` · [textures3d.js](textures3d.js)）**
  - `01 网球`：洁净 US Open 荧光黄羊毛毡 + 3D 壳层绒毛（Shell Fur）+ 无痕 EPDM 橡胶颗粒球场。
  - `02 钻石`：无双 Gamma 失真的 5 波段白平衡色散 BVH 钻石（Ultra-Restrained `0.06` Bloom）+ 4 色高定天鹅绒软垫（玄黑 / 酒红 / 午夜蓝 / 祖母绿）。
  - `03 篮球`：饱满橘红全粒面荔枝纹真皮 + 室内清漆枫木地板。
  - `04 金条`：24K 物理黄金反射率拉丝金锭 + 浅金凹凸印章 + 去色偏 Nero Marquina 黑曜石金库（零泛光、零热点斑）。
  - `05 足球`：精雕 32 块拼接珍珠白/曜黑比赛球 + 实时交互式 3D 短草草叶分离地面。
- **完整交互与 Tweaks 实时控制台（[app.js](app.js) / [index.html](index.html)）**
  - 拖拽旋转 3D 表体、自动 360° 摇摆录屏模式、移动设备陀螺仪接入、数字表冠点击/滚轮切场景、Web Audio 物理碰撞声效，以及右侧 `Tweaks` 实时调参控制台。

### 2. 原生 iOS 17+ 伴侣工坊 & watchOS 10+ 3D 表盘双端工程（[apple/](apple/)）

- **双 Target XcodeGen 工程（[apple/project.yml](apple/project.yml)）**
  - `GravityWatchStudio`（iOS 17.0+）：iPhone 实时 3D 交互工坊，支持实时调参、`WatchConnectivity` 毫秒级双端同步，以及一键以 `SCNRenderer` 高清离屏渲染导出精确匹配 Apple Watch **41mm / 42mm / 45mm / 46mm / 49mm Ultra 2** 分辨率的无字「照片表盘」原生壁纸。
  - `GravityWatchFaceWatch`（watchOS 10.0+）：Apple Watch 独立 60Hz `CoreMotion` 重力物理引擎、Digital Crown 切换 5 大主题、Always-On Display（AOD）自动降亮度功耗控制，与 Web `pristine_v16` 1:1 对齐自定义 Metal MSL 钻石光线追踪与 3D 交互短草着色器。
- **App Store 合规与 macOS 云端自动编译**
  - 内置完整 `PrivacyInfo.xcprivacy` 隐私清单与 [apple/APP_STORE_CHECKLIST.md](apple/APP_STORE_CHECKLIST.md) 4.2.4 审核合规清单。
  - 每次推送由 [.github/workflows/apple-ci.yml](.github/workflows/apple-ci.yml) 在官方 `macos-15`（Xcode 16 + XcodeGen）runner 上自动生成 `.xcodeproj` 并实编译 **iOS 模拟器**、**watchOS 模拟器** 与 **watchOS arm64 真机 Target**，同时上传 `GravityWatchStudio-xcodeproj` 构建产物。
- 详细说明请参阅 [apple/README.md](apple/README.md)。

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
├── .github/
│   └── workflows/
│       └── apple-ci.yml    # GitHub Actions macOS-15 (Xcode 16 + XcodeGen) iOS/watchOS 编译
├── index.html              # 主页面结构与 importmap 配置
├── styles.css              # 海报式排版与 Tweaks 控件样式
├── boot.js                 # ESM 引导（Three.js r187 + Rapier 0.21.0 WASM 初始化）
├── app.js                  # 状态管理、交互事件、陀螺仪与 Tweaks 控制台联动
├── scene3d.js              # 离轴空间投影、N8AO / BVH 钻石、交互短草与 HDR 合成
├── textures3d.js           # 5 大主题贴图/法线/粗糙度合成与天鹅绒/金库参数预设
├── physics3d.js            # Rapier3D WASM 刚体世界与 Analytic 3D 解析求解器
├── watchHardware3d.js      # Apple Watch 3D 表壳/表冠/表带/蓝宝石玻璃几何构建
├── vendor/                 # 本地化 Three.js r187、JSM addons、N8AO、three-mesh-bvh 与 Rapier 0.21.0
├── assets/
│   ├── hdr/                # studio_small_08 / studio_small_09 (CC0, Poly Haven)
│   └── textures/           # 12 组纯净实拍/程序 PBR 贴图（红土/枫木/深木/黑大理石/草坪/丝绒/毛毡/皮革/金属/橡胶）
└── apple/                  # iOS 17+ 伴侣工坊 & watchOS 10+ 原生 3D 应用工程
    ├── project.yml
    ├── README.md
    ├── APP_STORE_CHECKLIST.md
    ├── Shared/
    ├── iOSApp/
    ├── WatchApp/
    └── scripts/
```

---

## 致谢与资源许可

- 本项目内置使用的 HDRI 环境贴图与扫描 PBR 材质纹理来自 [Poly Haven](https://polyhaven.com/)（CC0 许可）。
- 3D 渲染基于 [Three.js r187](https://github.com/mrdoob/three.js)、`N8AO` 与 `three-mesh-bvh`，刚体物理基于 [Rapier](https://github.com/dimforge/rapier)。
