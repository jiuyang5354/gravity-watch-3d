# Apple App Store & TestFlight 提交核对清单

由于 watchOS 目前尚未向第三方开放系统原生表盘库（`.watchface` / 替换系统表盘主界面）API，本工程采用 **“3D 物理互动工坊 + 原生「照片表盘」高清壁纸生成器”** 合规双端架构，确保个人自用、TestFlight 内测与 App Store 正式审核均可顺畅通过。

---

## 1. 规避 App Store 审核规则 **4.2.4** 核心要点

Apple App Store 审核指南 `4.2.4` 禁止“主要功能仅仅是模仿系统标准表盘或宣称可替换系统原生表盘”的独立手表应用。提交审核时请遵循以下定位：

- **应用定位文案建议**：
  - 副标题/描述应强调 **“3D 物理桌面重力互动工坊与 Apple Watch 高清照片表盘壁纸制作工具”**（核心价值在于 iPhone 端 3D 物理材质调试 + 一键导出适配全系 Apple Watch 分辨率的纯净无遮挡高清壁纸，并附带独立腕上 3D 物理解压把玩模式）。
  - 切勿在应用名称、截图或描述中宣称“安装原生系统表盘”、“替代官方表盘库”或提供虚假系统数字复杂度交互误导。
- **Reviewer Notes（审核备注模板）**：
  > This app is an interactive 3D physics studio and Apple Watch Photos wallpaper generator. On iPhone, users customize 5 physically-based 3D dioramas (tennis felt, GIA brilliant diamond shader, basketball leather, brushed 24K bullion, and soccer pitch), adjust tilt/scatter arrangements, and export pixel-accurate portrait images (`PHPhotoLibrary` add-only permission) designed to be set as standard Apple Watch Photos watch faces. The companion watchOS app provides an interactive CoreMotion 3D physics experience while foregrounded with Digital Crown scene switching and reduced-luminance Always-On support.

---

## 2. 权限声明与隐私清单核对（已内建于工程）

| 项目 | iOS (`iOSApp/`) | watchOS (`WatchApp/`) | 用途说明 |
|---|---|---|---|
| `PrivacyInfo.xcprivacy` | 已包含 (`CA92.1`) | 已包含 (`CA92.1`) | 声明仅使用 `UserDefaults` 存储本地主题偏好，无任何第三方追踪 |
| `NSMotionUsageDescription` | 已配置 | 已配置 | 读取 60Hz 陀螺仪/重力向量驱动 3D 物理空间 |
| `NSPhotoLibraryAddUsageDescription` | 已配置 | 不适用 | 仅申请相册写入权限（Add-Only），用于保存高清壁纸 |
| `WKRunsIndependentlyOfCompanionApp` | 不适用 | `true` | 手表端可独立于 iPhone 启动使用 |

---

## 3. 上架前必改配置（使用 Mac Xcode 操作）

1. 在 Xcode 中选中根目录 `GravityWatchStudio` → 分别修改两个 Target 的 Bundle Identifier 为你自己的唯一域名：
   - iOS Target：`com.<yourname>.gravitywatchstudio`
   - watchOS Target：`com.<yourname>.gravitywatchstudio.watchkitapp`
   - **关键点**：务必同时将 watchOS Target `Build Settings → COMPANION_APP_BUNDLE_IDENTIFIER`（对应 `Info.plist` 中的 `WKCompanionAppBundleIdentifier`）改为与 iOS Target 完全一致！
2. 在 **Signing & Capabilities** 为两个 Target 勾选 **Automatically manage signing** 并选择你的付费 Apple Developer Team（免费账号支持真机自用 7 天，付费账号 `$99/年` 支持 TestFlight 与 App Store 上架）。
3. 首次测试请同时检查 iPhone「照片表盘」导出流程：保存后在系统照片点击 **“创建表盘 → 照片表盘”**，确认右上角时间位置留白清晰不遮挡物体。
