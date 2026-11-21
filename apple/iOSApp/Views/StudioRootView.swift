import SwiftUI

#if os(iOS)
import UIKit
#endif

struct StudioRootView: View {
    @State private var config: GravitySyncConfig
    @State private var previewAOD: Bool = false
    @State private var isApplyingRemoteSync: Bool = false
    @StateObject private var controller: StudioSceneController
    @ObservedObject private var sessionManager = WatchSessionManager.shared

    init() {
        let initial = GravitySyncConfig.load()
        _config = State(initialValue: initial)
        _controller = StateObject(wrappedValue: StudioSceneController(initialConfig: initial))
    }

    var body: some View {
        TabView {
            workshopTab
                .tabItem {
                    Label("3D 工坊", systemImage: "cube.fill")
                }

            WallpaperExportSheet(config: config, controller: controller)
                .tabItem {
                    Label("壁纸导出", systemImage: "photo.on.rectangle.angled")
                }

            WatchSetupGuideView(config: config, sessionManager: sessionManager)
                .tabItem {
                    Label("手表联动", systemImage: "applewatch")
                }
        }
        .tint(config.theme.accentColor)
        .preferredColorScheme(.dark)
        .onAppear {
            sessionManager.activate()
            sessionManager.onRemoteConfigReceived = { incoming in
                if incoming != config && incoming.updatedAt > config.updatedAt + 0.001 {
                    isApplyingRemoteSync = true
                    config = incoming
                    controller.applyConfiguration(incoming)
                }
            }
        }
        .onChange(of: config) { _, newValue in
            if isApplyingRemoteSync {
                isApplyingRemoteSync = false
                return
            }
            var stamped = newValue
            stamped.updatedAt = Date().timeIntervalSince1970
            stamped.save()
            controller.applyConfiguration(stamped)
            sessionManager.sendConfiguration(stamped)
        }
    }

    private var workshopTab: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    LiveWatchPreviewCard(
                        config: config,
                        controller: controller,
                        previewAOD: $previewAOD
                    )
                    .padding(.top, 6)

                    // 5 Theme Cards strip matching pristine_v16 lineup
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("材质与物理场景 (5 主题)")
                                .font(.subheadline.weight(.bold))
                            Spacer()
                            Text(config.theme.subtitle)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 4)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(WatchFaceTheme.allCases) { theme in
                                    Button {
                                        #if os(iOS)
                                        UISelectionFeedbackGenerator().selectionChanged()
                                        #endif
                                        config.theme = theme
                                    } label: {
                                        VStack(spacing: 6) {
                                            Image(decorative: ProceduralTextureGenerator.previewIcon(for: theme), scale: 2.0)
                                                .resizable()
                                                .interpolation(.high)
                                                .frame(width: 34, height: 34)

                                            Text("\(theme.shortCode) \(theme.displayName)")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(config.theme == theme ? .primary : .secondary)
                                        }
                                        .frame(width: 74, height: 74)
                                        .background(
                                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                                .fill(Color(.secondarySystemGroupedBackground))
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                                .strokeBorder(
                                                    config.theme == theme ? theme.accentColor : Color.white.opacity(0.08),
                                                    lineWidth: config.theme == theme ? 2.0 : 1.0
                                                )
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }

                    if config.theme == .diamond {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("钻石天鹅绒底衬 (4 种色系)")
                                .font(.subheadline.weight(.bold))
                                .padding(.horizontal, 4)

                            HStack(spacing: 8) {
                                ForEach(VelvetPreset.allCases) { preset in
                                    Button {
                                        #if os(iOS)
                                        UISelectionFeedbackGenerator().selectionChanged()
                                        #endif
                                        config.velvetPreset = preset
                                    } label: {
                                        VStack(spacing: 5) {
                                            Circle()
                                                .fill(preset.previewSwatchColor)
                                                .frame(width: 24, height: 24)
                                                .overlay(
                                                    Circle()
                                                        .strokeBorder(
                                                            config.velvetPreset == preset ? Color.white : Color.white.opacity(0.25),
                                                            lineWidth: config.velvetPreset == preset ? 2 : 1
                                                        )
                                                )
                                            Text(preset.displayName)
                                                .font(.caption2.weight(.medium))
                                                .lineLimit(1)
                                        }
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    // Density & Parameters Card
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("物体尺寸与数量")
                                .font(.subheadline.weight(.bold))
                            Picker("密度预设", selection: $config.density) {
                                ForEach(DensityPreset.allCases) { preset in
                                    Text(preset.shortLabel).tag(preset)
                                }
                            }
                            .pickerStyle(.segmented)
                        }

                        Divider()

                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("裸眼 3D 视差强度")
                                    .font(.subheadline)
                                Spacer()
                                Text(String(format: "%.1f×", config.parallaxStrength))
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            Slider(value: $config.parallaxStrength, in: 0.0...1.5, step: 0.1)
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("碰撞回弹系数")
                                    .font(.subheadline)
                                Spacer()
                                Text(String(format: "%.1f×", config.restitutionScale))
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            Slider(value: $config.restitutionScale, in: 0.4...1.4, step: 0.1)
                        }

                        Divider()

                        Picker("表盘复杂功能角标", selection: $config.complicationsMode) {
                            ForEach(ComplicationsDisplayMode.allCases) { mode in
                                Text(mode.displayName).tag(mode)
                            }
                        }

                        Toggle("网球 3D 壳层绒毛 (Shell Fur)", isOn: $config.enableTennisFuzz)
                            .font(.subheadline)

                        Toggle("足球短草实时分草物理", isOn: $config.enableInteractiveGrass)
                            .font(.subheadline)
                    }
                    .padding(14)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .navigationTitle("GravityWatch 工坊")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(.systemGroupedBackground))
        }
    }
}
