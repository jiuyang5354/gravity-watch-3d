import SceneKit
import SwiftUI

#if os(iOS)
import UIKit
#endif

final class StudioSceneController: ObservableObject {
    let scene: GravityScene3D
    private let motionManager = MotionManager3D()
    @Published var isGyroDriven: Bool = false

    init(initialConfig: GravitySyncConfig) {
        self.scene = GravityScene3D(config: initialConfig)
        motionManager.onMotionUpdate = { [weak self] gravity, userAccel in
            guard let self, self.isGyroDriven else { return }
            self.scene.updateMotion(gravity: gravity, userAcceleration: userAccel)
        }
    }

    func applyConfiguration(_ config: GravitySyncConfig) {
        scene.applyConfiguration(config)
    }

    func setGyroDriven(_ enabled: Bool) {
        isGyroDriven = enabled
        if enabled {
            motionManager.start()
        } else {
            motionManager.stop()
        }
    }

    func setLuminanceReduced(_ reduced: Bool) {
        scene.setLuminanceReduced(reduced)
    }

    func simulateTilt(gx: Float, gy: Float) {
        let len = max(sqrtf(gx * gx + gy * gy + 0.68 * 0.68), 0.001)
        scene.updateMotion(
            gravity: SCNVector3(gx / len, gy / len, -0.68 / len),
            userAcceleration: SCNVector3(0, 0, 0)
        )
    }

    func resetNeutralTilt() {
        simulateTilt(gx: 0.0, gy: -0.73)
    }

    func shake() {
        scene.applyShakeImpulse()
    }
}

struct LiveWatchPreviewCard: View {
    let config: GravitySyncConfig
    @ObservedObject var controller: StudioSceneController
    @Binding var previewAOD: Bool

    var body: some View {
        VStack(spacing: 14) {
            ZStack(alignment: .trailing) {
                // Digital Crown + Side Button silhouette on right of titanium hardware case
                VStack(spacing: 14) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color(white: 0.72), Color(white: 0.30), Color(white: 0.56)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: 9, height: 36)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                .strokeBorder(Color.white.opacity(0.28), lineWidth: 0.6)
                        )

                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(Color(white: 0.24))
                        .frame(width: 5, height: 42)
                }
                .offset(x: 7, y: -12)

                // Outer Brushed Titanium Case Bezel wrapping edge-to-edge 3D OLED Cavity
                ZStack {
                    RoundedRectangle(cornerRadius: 44, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 0.26, green: 0.28, blue: 0.33), Color(red: 0.08, green: 0.09, blue: 0.12)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 228, height: 274)
                        .overlay(
                            RoundedRectangle(cornerRadius: 44, style: .continuous)
                                .strokeBorder(
                                    LinearGradient(
                                        colors: [.white.opacity(0.45), .white.opacity(0.08), .white.opacity(0.26)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1.5
                                )
                        )
                        .shadow(color: config.theme.accentColor.opacity(0.14), radius: 24, x: 0, y: 12)
                        .shadow(color: .black.opacity(0.55), radius: 18, x: 0, y: 10)

                    // Inner Sapphire Glass Screen Cavity (matches 4.00 : 4.88 hardware ratio)
                    ZStack {
                        GeometryReader { geo in
                            SceneView(
                                scene: controller.scene,
                                pointOfView: controller.scene.cameraNode,
                                options: [],
                                preferredFramesPerSecond: 60
                            )
                            .gesture(
                                DragGesture(minimumDistance: 2)
                                    .onChanged { value in
                                        guard !controller.isGyroDriven else { return }
                                        let w = max(geo.size.width, 1)
                                        let h = max(geo.size.height, 1)
                                        let rawX = Float((value.location.x / w - 0.5) * 2.1)
                                        let rawY = Float((0.5 - value.location.y / h) * 2.1)
                                        let len = max(sqrtf(rawX * rawX + rawY * rawY), 0.001)
                                        let mag = min(len, 1.05)
                                        controller.simulateTilt(gx: (rawX / len) * mag, gy: (rawY / len) * mag)
                                    }
                            )
                        }

                        // Subtle sapphire specular edge highlight
                        RoundedRectangle(cornerRadius: 36, style: .continuous)
                            .strokeBorder(
                                LinearGradient(
                                    colors: [.white.opacity(0.24), .clear, .white.opacity(0.10)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1.0
                            )
                            .allowsHitTesting(false)

                        WatchPreviewClockOverlay(config: config, isAOD: previewAOD)
                    }
                    .frame(width: 204, height: 248)
                    .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
                }
            }

            // Compact quick action bar beneath Watch preview
            HStack(spacing: 10) {
                Button {
                    #if os(iOS)
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    #endif
                    controller.shake()
                } label: {
                    Label("摇一摇打散", systemImage: "sparkles")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(.ultraThinMaterial, in: Capsule())
                }

                Button {
                    #if os(iOS)
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    #endif
                    controller.setGyroDriven(!controller.isGyroDriven)
                } label: {
                    Label(
                        controller.isGyroDriven ? "真机陀螺仪" : "指尖拖拽",
                        systemImage: controller.isGyroDriven ? "gyroscope" : "hand.draw"
                    )
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(controller.isGyroDriven ? config.theme.accentColor : .primary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(.ultraThinMaterial, in: Capsule())
                }

                Button {
                    previewAOD.toggle()
                    controller.setLuminanceReduced(previewAOD)
                } label: {
                    Label("AOD", systemImage: previewAOD ? "moon.fill" : "sun.max.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(previewAOD ? .cyan : .primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(.ultraThinMaterial, in: Capsule())
                }
            }
            .buttonStyle(.plain)
        }
    }
}

private struct WatchPreviewClockOverlay: View {
    let config: GravitySyncConfig
    let isAOD: Bool

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1.0)) { context in
            ZStack {
                VStack {
                    HStack {
                        Spacer()
                        VStack(alignment: .trailing, spacing: -4) {
                            Text(formattedDate(context.date))
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .textCase(.uppercase)
                                .tracking(0.5)
                                .foregroundStyle(.white.opacity(isAOD ? 0.50 : 0.92))
                                .shadow(color: .black.opacity(0.65), radius: 3, x: 0, y: 1)

                            Text(formattedTime(context.date))
                                .font(.system(size: 38, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(.white.opacity(isAOD ? 0.72 : 1.0))
                                .shadow(color: .black.opacity(0.70), radius: 6, x: 0, y: 2)
                        }
                    }
                    .padding(.top, 10)
                    .padding(.trailing, 14)

                    Spacer()
                }

                if config.shouldShowComplications {
                    complicationsLayer
                        .opacity(isAOD ? 0.45 : 1.0)
                }
            }
        }
        .allowsHitTesting(false)
    }

    private var complicationsLayer: some View {
        VStack {
            HStack {
                miniBadge(systemName: "sunset.fill", text: "5:42")
                Spacer()
            }
            .padding(.top, 14)
            .padding(.leading, 14)

            Spacer()

            HStack {
                miniRingBadge(systemName: "mountain.2.fill")
                Spacer()
                miniRingsTriple
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 12)
        }
    }

    private func miniBadge(systemName: String, text: String) -> some View {
        ZStack {
            Circle()
                .fill(Color.black.opacity(0.56))
                .overlay(Circle().strokeBorder(.white.opacity(0.22), lineWidth: 1))
            VStack(spacing: 1) {
                Image(systemName: systemName)
                    .font(.system(size: 9, weight: .semibold))
                Text(text)
                    .font(.system(size: 8, weight: .bold, design: .rounded))
            }
            .foregroundStyle(.white.opacity(0.92))
        }
        .frame(width: 28, height: 28)
    }

    private func miniRingBadge(systemName: String) -> some View {
        ZStack {
            Circle()
                .fill(Color.black.opacity(0.56))
                .overlay(Circle().strokeBorder(.white.opacity(0.22), lineWidth: 1))
            Circle()
                .trim(from: 0, to: 0.68)
                .stroke(.white, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(-110))
                .padding(3)
            Image(systemName: systemName)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.white)
        }
        .frame(width: 28, height: 28)
    }

    private var miniRingsTriple: some View {
        ZStack {
            Circle()
                .fill(Color.black.opacity(0.56))
                .overlay(Circle().strokeBorder(.white.opacity(0.22), lineWidth: 1))
            Circle().trim(from: 0, to: 0.74).stroke(.white, style: StrokeStyle(lineWidth: 2, lineCap: .round)).rotationEffect(.degrees(-90)).padding(3)
            Circle().trim(from: 0, to: 0.62).stroke(.white.opacity(0.84), style: StrokeStyle(lineWidth: 2, lineCap: .round)).rotationEffect(.degrees(-90)).padding(6)
            Circle().trim(from: 0, to: 0.50).stroke(.white.opacity(0.68), style: StrokeStyle(lineWidth: 2, lineCap: .round)).rotationEffect(.degrees(-90)).padding(9)
        }
        .frame(width: 28, height: 28)
    }

    private func formattedDate(_ date: Date) -> String {
        date.formatted(.dateTime.weekday(.abbreviated).day())
    }

    private func formattedTime(_ date: Date) -> String {
        date.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits))
    }
}
