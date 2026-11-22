# 重力壁纸 3D · GravityLiveWallpaper3D (Android 原生动态壁纸)

基于 Android 原生 `WallpaperService` 打造的 **双引擎 60fps 3D 重力与裸眼视差动态壁纸应用**（`Kotlin + OpenGL ES 3.0 / EGL14 + 纯 Canvas 三层视差 + Material 3 控制台`），可直接设置为 Android 主屏与锁屏壁纸。

## 双引擎模式（支持热切换）

### 引擎 A：真 3D 重力物理空间（OpenGL ES 3.0）
- **离轴非对称视锥空间投影 (`Matrix.frustumM`)**：随手腕/手机倾斜实现真实裸眼窗格透视（`0.5x – 2.0x` 景深强度可调）。
- **纯 Kotlin 3D 刚体仿真 (`PhysicsWorld3D`)**：固定时间步长、碰撞反弹、旋转滚转惯性、震动抛散与零耗时 JVM 单元测试。
- **6 大物理材质主题**：
  - `01 网球`：光学荧光黄毛毡 + 白硫化胶缝 + EPDM 橡胶颗粒球场
  - `02 钻石`：3 回弹 5 波段白平衡色散光线追踪 + 4 色高定天鹅绒软垫
  - `03 篮球`：全粒面荔枝纹真皮 + 室内清漆枫木地板
  - `04 金条`：24K 物理黄金反射率拉丝金锭 + 去色偏 Nero Marquina 黑曜金库
  - `05 足球`：32 块截角二十面体拼接比赛球 + 修剪草场
  - `06 透明主板`（Cyber Circuit）：多层级发光赛博主板 + 脉冲电流波纹 + 悬浮全息蓝宝石核心

### 引擎 B：三层 PNG 裸眼视差（纯 `Canvas` + `TYPE_ROTATION_VECTOR`）
- **多层差速视差与悬浮投影**：
  - `background`：随倾斜同向移动 **+5%**
  - `glow`：同向移动 **+12%**，并叠加 4 秒 **70%–100%** 呼吸光晕脉冲
  - `foreground`：反向移动 **-25%** 制造强烈立体悬浮分离，并在前景下方绘制随倾斜动态偏移的软投影
- **省电与高自由度**：`onVisibilityChanged(false)` 立即注销陀螺仪/重力传感器并挂起渲染线程；内置 **赛博透明主板** 与 **流金极简浮雕** 两套三层资源，亦可通过相册直接替换自定义 `background.png`、`glow.png` 与 AI 抠图前景 `foreground.png`。

## 云端编译与 APK 获取

- 推送至 GitHub 后，`.github/workflows/android-ci.yml` 会在 `ubuntu-latest`（JDK 17 + Gradle 8.10.2）自动执行单元测试并产出 `GravityWallpaper3D-debug-apk` 可直接下载安装至 Android 手机。
- 本地构建命令（需配置 JDK 17 与 Android SDK 35）：

```bash
python scripts/validate_android_project.py
gradle testDebugUnitTest assembleDebug
```
