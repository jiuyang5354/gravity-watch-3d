# Gravity Watch 3D · 重力表盘与壁纸 3D

[![Apple iOS & watchOS CI Build](https://github.com/jiuyang5354/gravity-watch-3d/actions/workflows/apple-ci.yml/badge.svg)](https://github.com/jiuyang5354/gravity-watch-3d/actions/workflows/apple-ci.yml)
[![Android Live Wallpaper CI Build](https://github.com/jiuyang5354/gravity-watch-3d/actions/workflows/android-ci.yml/badge.svg)](https://github.com/jiuyang5354/gravity-watch-3d/actions/workflows/android-ci.yml)

跨端 3D 重力物理交互与壁纸套件：包含 **WebGL ESM 3D 演示器**（`Three.js r187` + `Rapier3D 0.21.0` WASM，`pristine_v16`）、**Apple iOS 17+ 伴侣工坊 & watchOS 10+ SceneKit/Metal 应用工程**（`GravityWatchStudio`），以及 **Android 原生双引擎动态壁纸 App**（`GravityLiveWallpaper3D`）。

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

### 3. Android 原生双引擎 3D 重力与裸眼视差动态壁纸（[android/](android/)）

- **双渲染引擎一键热切换（`GravityWallpaperService`）**
  - **引擎 A · 真 3D 重力物理空间（OpenGL ES 3.0 + EGL14）**：含 `01 网球`、`02 钻石`（3 回弹 5 波段白平衡色散光线追踪 + 4 色天鹅绒）、`03 篮球`、`04 金条`、`05 足球` 与 **`06 透明主板 (Cyber Circuit)`**（发光全息玻璃芯片 + 脉冲电流电路板底衬）。
  - **引擎 B · 三层 PNG 裸眼视差（Pure `Canvas` + `TYPE_ROTATION_VECTOR`）**：支持背景层（`+5%`）、4 秒 70%–100% 呼吸辉光层（`+12%`）、反向悬浮透明前景层（`-25%`）及动态偏移软阴影，提供 `0.5x–2.0x` 景深滑块与相册自定义 3 张 PNG 图层替换，并在息屏/后台（`onVisibilityChanged(false)`）自动注销全部传感器。
- **云端自动产出可安装 APK**
  - 由 [.github/workflows/android-ci.yml](.github/workflows/android-ci.yml) 在 `ubuntu-latest`（JDK 17 + Gradle 8.10.2）自动执行 JVM 物理引擎单元测试与 APK 打包，可在 Actions 页面直接下载 `GravityWallpaper3D-debug-apk` 安装至 Android 手机为主屏与锁屏设置动态壁纸。
- 详细说明请参阅 [android/README.md](android/README.md)。

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
│       ├── apple-ci.yml    # GitHub Actions macOS-15 (Xcode 16 + XcodeGen) iOS/watchOS 编译
│       └── android-ci.yml  # GitHub Actions ubuntu-latest (JDK 17 + Gradle 8.10) APK 编译
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
├── apple/                  # iOS 17+ 伴侣工坊 & watchOS 10+ 原生 3D 应用工程
│   ├── project.yml
│   ├── README.md
│   ├── APP_STORE_CHECKLIST.md
│   ├── Shared/
│   ├── iOSApp/
│   ├── WatchApp/
│   └── scripts/
└── android/                # Android 原生 OpenGL ES 3D + 三层 PNG 视差动态壁纸工程
    ├── build.gradle.kts
    ├── settings.gradle.kts
    ├── README.md
    ├── app/
    └── scripts/
```

---

## 致谢与资源许可

- 本项目内置使用的 HDRI 环境贴图与扫描 PBR 材质纹理来自 [Poly Haven](https://polyhaven.com/)（CC0 许可）。
- 3D 渲染基于 [Three.js r187](https://github.com/mrdoob/three.js)、`N8AO` 与 `three-mesh-bvh`，刚体物理基于 [Rapier](https://github.com/dimforge/rapier)。
