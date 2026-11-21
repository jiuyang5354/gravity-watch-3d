import SwiftUI
import WatchKit

struct ThemeSettingsView: View {
    @Binding var config: GravitySyncConfig
    let onShake: () -> Void

    @ObservedObject private var sessionManager = WatchSessionManager.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(WatchFaceTheme.allCases) { theme in
                        Button {
                            config.theme = theme
                            WKInterfaceDevice.current().play(.click)
                            dismiss()
                        } label: {
                            HStack(spacing: 10) {
                                Image(decorative: ProceduralTextureGenerator.previewIcon(for: theme), scale: 2.0)
                                    .resizable()
                                    .interpolation(.high)
                                    .frame(width: 26, height: 26)

                                VStack(alignment: .leading, spacing: 1) {
                                    Text(theme.displayName)
                                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                                        .foregroundStyle(.primary)

                                    Text(theme.subtitle)
                                        .font(.system(size: 11, weight: .medium, design: .rounded))
                                        .foregroundStyle(.secondary)
                                }

                                Spacer()

                                if theme == config.theme {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(theme.accentColor)
                                }
                            }
                            .padding(.vertical, 2)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("3D 表盘场景")
                }

                if config.theme == .diamond {
                    Section("丝绒底衬") {
                        ForEach(VelvetPreset.allCases) { preset in
                            Button {
                                config.velvetPreset = preset
                                WKInterfaceDevice.current().play(.click)
                            } label: {
                                HStack {
                                    Circle()
                                        .fill(preset.previewSwatchColor)
                                        .frame(width: 16, height: 16)
                                    Text(preset.displayName)
                                        .font(.system(size: 14, weight: .medium, design: .rounded))
                                    Spacer()
                                    if preset == config.velvetPreset {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(config.theme.accentColor)
                                    }
                                }
                            }
                        }
                    }
                }

                Section("物理与效果") {
                    Picker("物体数量", selection: $config.density) {
                        ForEach(DensityPreset.allCases) { preset in
                            Text(preset.shortLabel).tag(preset)
                        }
                    }

                    Picker("复杂功能角标", selection: $config.complicationsMode) {
                        ForEach(ComplicationsDisplayMode.allCases) { mode in
                            Text(mode.displayName).tag(mode)
                        }
                    }

                    Toggle("网球 3D 绒毛", isOn: $config.enableTennisFuzz)
                    Toggle("足球实时 3D 短草", isOn: $config.enableInteractiveGrass)

                    Button {
                        WKInterfaceDevice.current().play(.click)
                        onShake()
                        dismiss()
                    } label: {
                        Label("摇一摇抛飞物体", systemImage: "sparkles")
                            .foregroundStyle(config.theme.accentColor)
                    }
                }

                Section("iPhone 同步状态") {
                    HStack {
                        Image(systemName: sessionManager.isReachable ? "iphone.radiowaves.left.and.right" : "iphone")
                            .foregroundStyle(sessionManager.isReachable ? .green : .secondary)
                        Text(sessionManager.isReachable ? "iPhone 工坊已实时连接" : "支持从 iPhone 远程换肤")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("3D 重力工坊")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
