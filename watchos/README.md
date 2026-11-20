# GravityWatchFace3D (watchOS 10+ Native SceneKit + Metal 3D App)

与 Web 3D 交互演示器完全对齐的 **Apple Watch 原生 watchOS 10+ 工程**，支持真实手腕 60Hz 陀螺仪/加速度计重力物理、表冠旋钮切场景与常亮显示（Always-On Display）。

## 核心架构升级（与 Web 版 1:1 光学与材质对齐）

1. **满屏齐平非对称视锥空间投影（Off-Axis Portal Frustum）**
   - 位于 `GravityScene3D.swift`：`SCNCamera.projectionTransform` 动态计算虚拟视点与 `4.00 × 4.88` 屏幕窗面的离轴非对称透视矩阵，配合 `1.5×`（`6.00 × 7.32`）无缝延展地面，消除“盒壁镂空感”。
   - 物理边界改为隐形 `SCNBox` 碰撞体 + 四角 `45°` 圆角斜切护栏（`colorBufferWriteMask = []`），确保球体、钻石与金条严格在手表圆角屏幕内滚动。

2. **Metal 3-Bounce GIA 48 面凸多面体实时光线追踪钻石着色器**
   - 位于 `DiamondShader3D.swift`：通过 `SCNShaderModifierEntryPoint.fragment` 编写纯 MSL（Metal Shading Language）光线追踪核心。
   - 真实穿透钻石内部并折射采样本机黑色天鹅绒底垫贴图 `u_floorTex`，同时计算 3 次内全反射（TIR）、RGB 色散火彩（`IOR 2.38 / 2.42 / 2.47`）与 Schlick Fresnel 镜面反射。

3. **CC0 真实摄影棚 HDRI 与扫描 PBR 贴图打包**
   - 位于 `GravityWatchFace3D/PBRTextures/`（26 个已裁切至 512px 的轻量级资源，总计约 2.62 MB）：包含 Poly Haven `studio_small_09.hdr` 以及红土、深木、草坪、黑丝绒、网球毛毡、棕/白皮革与拉丝金属扫描贴图。
   - `ProceduralTextureGenerator.swift` 在运行时将实拍漫反射、法线（切线空间混合）与粗糙度贴图合成为 3D 物理材质，并在无包环境（如 Xcode SwiftUI Preview）下自动无缝回退至程序化纹理。

4. **60fps 接地接触阴影与钻石焦散光斑**
   - `GravityScene3D` 通过 `SCNAction.repeatForever` 每帧读取 `node.presentation`，驱动底部 `decalNodes` 实时同步地面投影与钻石冰蓝焦散星芒，绕过 watchOS 部分机型对 `SCNLight` 阴影贴图的限制，兼顾 60fps 流畅度。

5. **表冠（Digital Crown）与常亮屏（AOD）支持**
   - `WatchFace3DView.swift` 支持旋转表冠切换 5 大主题并触发 `.click` 触感反馈，长按屏幕或点击底部按钮打开设置面板；在 `isLuminanceReduced` 状态下自动压低场景曝光、自发光强度与钻石 `u_exposure`。

---

## 安装进真实 Apple Watch 步骤（Xcode 15 / 16）

1. 将整个 `GravityWatchFace3D/` 目录复制到 **Mac** 本地，双击打开 `GravityWatchFace3D.xcodeproj`。
2. 在 Xcode 左侧选择 **GravityWatchFace3D** 工程根节点 → **Targets → GravityWatchFace3D → Signing & Capabilities**：
   - 勾选 **Automatically manage signing**
   - **Team** 选择你的 Apple Developer 账号（免费个人 Apple ID 也可真机安装 7 天；付费开发者账号有效期 1 年）
   - 若提示 Bundle ID 冲突，将 `com.example.GravityWatchFace3D` 改为唯一标识（如 `com.yourname.GravityWatchFace3D`）
3. iPhone 与 Apple Watch 均开启「设置 → 隐私与安全性 → 开发者模式」，将 Xcode 顶部运行目标选为你的 **Apple Watch（真机）**。
4. 点击 **Run (`⌘R`)** 编译并安装到手表（约 15–30 秒，包含 2.62 MB `PBRTextures` 与 Metal 着色器打包）。
5. 首次在手表上运行后，如受系统安全策略提示，请在 iPhone「设置 → 通用 → VPN 与设备管理」中信任开发者证书；随后晃动、倾斜手腕或旋转表冠即可体验。
