# 重力表盘工坊 (GravityWatchStudio · iOS + watchOS 3D Wallpaper & Interactive App)

基于 `pristine_v16` 精致影棚级材质与光学标准打造的 **iPhone 伴侣工坊 + Apple Watch 原生 3D 物理交互表盘** 双端应用工程（`iOS 17+` & `watchOS 10+`，`SceneKit + Metal MSL + CoreMotion + WatchConnectivity`）。

## 双端协同体验

1. **路线 A（最省电原生壁纸）— iPhone 一键生成系统「照片表盘」高清图**
   - 在 iPhone 端自由摇晃、倾斜收集当前 3D 物体堆叠姿态，一键以 `SCNRenderer` 4×MSAA 导出精确匹配 **Series 10 (46mm / 42mm)**、**Ultra 2 (49mm)**、**Series 9 (45mm)**、**SE (44mm)** 原生分辨率的无字高清图到系统相册（或通过系统分享传给手表），零额外电量消耗设为系统原生「照片表盘」。
2. **路线 B（真 3D 实时把玩）— Apple Watch 独立 60Hz 物理空间**
   - 抬腕即享 60Hz `CoreMotion` 重力物理 + 裸眼 3D 离轴非对称视差投影 + 表冠（Digital Crown）丝滑切换 5 大材质场景 + 双击抛散 + 常亮屏（AOD）自动降功耗。
   - 通过 `WatchConnectivity` 与 iPhone 工坊毫秒级实时同步主题、4 色天鹅绒底衬、颗粒密度、3D 壳层绒毛与短草互动开关。

## 5 大精致材质与 Metal 着色器（与 Web `pristine_v16` 1:1 对齐）

- `01 网球`：洁净 US Open 荧光黄羊毛毡 + 奶白胶缝 + 4 层 3D Shell Fur 绒毛 + 无痕 EPDM 橡胶颗粒球场
- `02 钻石`：无双 Gamma 失真的 D 色 VVS1 3 次内全反射光线追踪 + 5 波段白平衡色散 + 4 色 Ashikhmin-Charlie 天鹅绒底衬
- `03 篮球`：饱满橘红全粒面荔枝纹皮革 + 清漆枫木地板与高对比标线
- `04 金条`：物理 24K 黄金反射率斜角拉丝 + `SUISSE 999.9` 浅金凹凸印章 + 去色偏 nero marquina 黑曜石金库（零点光源光斑与泛光）
- `05 足球`：36×52 精雕 32 块拼接珍珠白/曜黑比赛球 + 实时交互式短草分草 Metal 着色器

## 目录结构

```
├── project.yml                         # XcodeGen 双端工程生成配置
├── .github/workflows/apple-ci.yml      # GitHub Actions macOS-15 云端编译校验
├── APP_STORE_CHECKLIST.md              # App Store 4.2.4 与隐私合规核对清单
├── scripts/
│   ├── prepare_pbr_assets.py           # 提取与压缩 26 个无脏污 CC0 PBR 贴图/HDRI
│   ├── generate_app_icons.py           # 生成 iOS / watchOS 1024px Studio 图标
│   └── validate_project.py             # Windows 静态语法、跨端 API 与资源完整性校验
├── Shared/                             # iOS + watchOS 共享 3D 核心与纹理引擎
│   ├── Models/                         # 主题、天鹅绒预设、表盘型号与同步配置
│   ├── Scene3D/                        # 几何体、Metal MSL 着色器与 3D 物理场景
│   ├── Services/                       # CoreGraphics PBR 合成、CoreMotion、WatchConnectivity
│   └── Resources/PBRTextures/          # 2.55 MB 轻量实拍 PBR 贴图与 studio HDRI
├── iOSApp/                             # iPhone 工坊界面 + Metal 离屏壁纸导出器
└── WatchApp/                           # Apple Watch 独立 60fps 交互端
```

## Windows 无 Mac 云端校验 & 装入手表步骤

1. **Windows 校验（无需 Mac）**：运行 `python scripts/validate_project.py` 可即时完成全部 Swift / Metal MSL 语法、跨端 API 隔离与资源路径校验；将本目录推送至 GitHub 仓库后，`.github/workflows/apple-ci.yml` 会在官方 `macos-15` Xcode 16 环境中自动执行 `xcodegen generate` 并实编译 **iOS 模拟器**、**watchOS 模拟器** 与 **watchOS arm64 真机目标**，同时产出可下载的 `GravityWatchStudio.xcodeproj`。
2. **Mac 真机安装**：在 Mac 上执行 `xcodegen generate`（或直接下载 CI 产出的 `.xcodeproj`）并用 Xcode 打开，替换两个 Target 的 Team 与 Bundle ID 后连接 iPhone / Apple Watch 按 `⌘R` 安装，推荐在「Watch App → 通用 → 返回时钟」中将本应用设为 `1 小时` 以获得长驻腕上体验。
