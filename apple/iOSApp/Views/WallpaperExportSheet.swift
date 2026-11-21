import SwiftUI

#if os(iOS)
import UIKit
#endif

struct WallpaperExportSheet: View {
    let config: GravitySyncConfig
    @ObservedObject var controller: StudioSceneController

    @State private var selectedModel: AppleWatchModelSpec = .series10_46mm
    @State private var showClockSafeZone: Bool = true
    @State private var renderedPreview: UIImage?
    @State private var isSaving: Bool = false
    @State private var statusMessage: String?
    @State private var isErrorMessage: Bool = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    VStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 34, style: .continuous)
                                .fill(Color(white: 0.08))
                                .frame(width: 210, height: 252)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 34, style: .continuous)
                                        .strokeBorder(Color.white.opacity(0.18), lineWidth: 1.5)
                                )

                            if let image = renderedPreview {
                                Image(uiImage: image)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: 196, height: 238)
                                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                            } else {
                                ProgressView("正在准备高清壁纸…")
                            }

                            if showClockSafeZone {
                                VStack {
                                    HStack {
                                        Spacer()
                                        VStack(alignment: .trailing, spacing: -2) {
                                            Text("SAT 21")
                                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                                .foregroundStyle(.white.opacity(0.75))
                                            Text("10:09")
                                                .font(.system(size: 34, weight: .bold, design: .rounded))
                                                .foregroundStyle(.white.opacity(0.75))
                                        }
                                        .padding(6)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .strokeBorder(Color.cyan.opacity(0.65), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                                        )
                                    }
                                    .padding(.top, 14)
                                    .padding(.trailing, 14)

                                    Spacer()
                                }
                                .frame(width: 196, height: 238)
                                .allowsHitTesting(false)
                            }
                        }

                        Text("\(selectedModel.displayName) · \(selectedModel.dimensionLabel)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        Picker("Apple Watch 机型尺寸", selection: $selectedModel) {
                            ForEach(AppleWatchModelSpec.allCases) { spec in
                                Text("\(spec.displayName) (\(spec.dimensionLabel))").tag(spec)
                            }
                        }
                        .pickerStyle(.menu)
                        .padding(12)
                        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                        Toggle("预览系统「照片表盘」时间安全区（不写入导出图）", isOn: $showClockSafeZone)
                            .font(.subheadline)
                            .padding(12)
                            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }

                    HStack(spacing: 12) {
                        Button {
                            refreshSnapshot()
                        } label: {
                            Label("重抓当前姿态", systemImage: "camera.aperture")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        if let image = renderedPreview {
                            let swiftUIImage = Image(uiImage: image)
                            ShareLink(
                                item: swiftUIImage,
                                preview: SharePreview("GravityWatch \(config.theme.displayName)", image: swiftUIImage)
                            ) {
                                Label("分享 / 隔空投送", systemImage: "square.and.arrow.up")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 13)
                                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    Button {
                        Task { await saveWallpaper() }
                    } label: {
                        HStack {
                            if isSaving {
                                ProgressView()
                                    .tint(.black)
                            } else {
                                Image(systemName: "photo.badge.plus.fill")
                            }
                            Text(isSaving ? "正在写入相册…" : "一键保存高清壁纸到系统相册")
                                .font(.headline)
                        }
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(config.theme.accentColor, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(isSaving)

                    if let msg = statusMessage {
                        Text(msg)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(isErrorMessage ? .red : .green)
                            .multilineTextAlignment(.center)
                    }

                    // 3-step Apple Photos Watch Face setup guide
                    VStack(alignment: .leading, spacing: 10) {
                        Label("如何在 Apple Watch 上设为系统「照片表盘」", systemImage: "applewatch.watchface")
                            .font(.subheadline.weight(.bold))

                        guideRow(step: "1", text: "点击上方绿色按钮，将纯净无字 3D 高清图存入 iPhone「照片」。")
                        guideRow(step: "2", text: "打开图片左下角分享 → 选择「创建表盘 → 照片表盘」。")
                        guideRow(step: "3", text: "将时间位置设为「顶部」，字体选粗圆体即可与系统表盘完全融为一体；若需 60Hz 陀螺仪重力互动，请直接在手表打开本 App 配合下一标签页「返回时钟」技巧。")
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .padding()
            }
            .navigationTitle("照片表盘高清壁纸导出")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(.systemGroupedBackground))
            .onAppear {
                refreshSnapshot()
            }
            .onChange(of: selectedModel) { _, _ in
                refreshSnapshot()
            }
            .onChange(of: config) { _, _ in
                refreshSnapshot()
            }
        }
    }

    private func guideRow(step: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(step)
                .font(.caption.bold())
                .foregroundStyle(.black)
                .frame(width: 20, height: 20)
                .background(config.theme.accentColor, in: Circle())

            Text(text)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @MainActor
    private func refreshSnapshot() {
        #if os(iOS)
        renderedPreview = WallpaperExporter.renderWallpaper(from: controller.scene, model: selectedModel)
        #endif
    }

    @MainActor
    private func saveWallpaper() async {
        #if os(iOS)
        isSaving = true
        statusMessage = nil
        isErrorMessage = false
        defer { isSaving = false }

        guard let image = renderedPreview ?? WallpaperExporter.renderWallpaper(from: controller.scene, model: selectedModel) else {
            isErrorMessage = true
            statusMessage = WallpaperExportError.renderFailed.localizedDescription
            return
        }
        renderedPreview = image
        do {
            try await WallpaperExporter.saveToPhotos(image)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            statusMessage = "已保存 \(selectedModel.dimensionLabel) 高清壁纸到系统相册！请在「照片」中设为 Apple Watch 照片表盘。"
        } catch {
            isErrorMessage = true
            statusMessage = error.localizedDescription
        }
        #endif
    }
}
