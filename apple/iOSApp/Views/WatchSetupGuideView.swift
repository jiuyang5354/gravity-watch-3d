import SwiftUI

struct WatchSetupGuideView: View {
    let config: GravitySyncConfig
    @ObservedObject var sessionManager: WatchSessionManager

    var body: some View {
        NavigationStack {
            List {
                Section("Apple Watch 连接状态") {
                    #if os(iOS)
                    statusRow(title: "WatchConnectivity 支持", ok: sessionManager.isSupported, detail: sessionManager.isSupported ? "可用" : "当前设备不支持")
                    statusRow(title: "已配对 Apple Watch", ok: sessionManager.isPaired, detail: sessionManager.isPaired ? "已配对" : "未检测到配对")
                    statusRow(title: "手表端 App 已安装", ok: sessionManager.isWatchAppInstalled, detail: sessionManager.isWatchAppInstalled ? "GravityWatchFaceWatch 就绪" : "请在 Watch App 安装")
                    statusRow(title: "手表实时通信通道", ok: sessionManager.isReachable, detail: sessionManager.isReachable ? "实时连通（毫秒级同步）" : "后台上下文排队同步")
                    #else
                    statusRow(title: "iPhone 伴侣同步", ok: sessionManager.isReachable, detail: sessionManager.isReachable ? "已连接" : "等待 iPhone 同步")
                    #endif

                    if let syncedAt = sessionManager.lastSyncedAt {
                        HStack {
                            Text("最近同步时间")
                            Spacer()
                            Text(syncedAt, style: .time)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Button {
                        sessionManager.sendConfiguration(config)
                    } label: {
                        Label("立即推送当前「\(config.theme.displayName)」配置到手表", systemImage: "applewatch.radiowaves.left.and.right")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(config.theme.accentColor)
                    }
                }

                Section("让 watchOS 实时 3D 重力表盘「长期停留桌面」设置方法") {
                    guideItem(
                        icon: "clock.arrow.circlepath",
                        title: "1. 开启「返回时钟 1 小时」",
                        detail: "由于苹果系统安全规范，第三方 App 无法替换系统原生表盘槽位。但在 iPhone「Watch App → 通用 → 返回时钟」中，向下找到本应用并将返回时间设为「1 小时后」，抬腕看表时即可长期保持在全屏 60Hz 真 3D 重力物理空间内。"
                    )
                    guideItem(
                        icon: "dial.medium",
                        title: "2. 手表端表冠 / 手势快捷操控",
                        detail: "旋转数字表冠可直接切换 5 大材质场景（带 Taptic Engine 轻微机械棘轮震动）；长按表盘或点击底部按钮可微调 4 种天鹅绒配色、物体密度、毛毡绒毛与草皮开关；晃动手腕即刻激发惯性抛射。"
                    )
                    guideItem(
                        icon: "moon.zzz",
                        title: "3. 常亮屏（Always-On Display）低功耗保护",
                        detail: "垂腕进入 AOD 状态时，手表端会自动暂停物理步进与降低场景曝光强度，兼顾全天续航。"
                    )
                }

                Section("两条路线搭配建议（符合 App Store 4.2.4 规范）") {
                    guideItem(
                        icon: "sparkles.rectangle.stack",
                        title: "日常极简省电 → 用「壁纸导出」设系统照片表盘",
                        detail: "在上一页一键生成无时间遮挡的高清 3D 静态壁纸，作为原生「照片表盘」全天候驻留，零额外耗电。"
                    )
                    guideItem(
                        icon: "cube.transparent",
                        title: "把玩/炫酷展示 → 直接在手表运行 3D 重力工坊",
                        detail: "需要展示真实陀螺仪 60fps 滚动、钻石 3 次内全反射火彩、短草实时分草与网球壳层绒毛时，抬腕即可互动。"
                    )
                }
            }
            .navigationTitle("手表联动与使用指南")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func statusRow(title: String, ok: Bool, detail: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Label(detail, systemImage: ok ? "checkmark.circle.fill" : "clock.badge.exclamationmark")
                .font(.caption.weight(.medium))
                .foregroundStyle(ok ? .green : .orange)
        }
    }

    private func guideItem(icon: String, title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: icon)
                .font(.subheadline.weight(.semibold))
            Text(detail)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 4)
    }
}
