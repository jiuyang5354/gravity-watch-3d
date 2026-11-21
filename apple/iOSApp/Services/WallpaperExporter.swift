#if os(iOS)
import Foundation
import Metal
import Photos
import SceneKit
import UIKit

enum WallpaperExportError: LocalizedError {
    case photoPermissionDenied
    case renderFailed
    case saveFailed(Error)

    var errorDescription: String? {
        switch self {
        case .photoPermissionDenied:
            return "请在 iPhone「设置 → 隐私与安全性 → 照片」中允许仅添加照片权限。"
        case .renderFailed:
            return "渲染 Apple Watch 高清壁纸失败，请重试。"
        case .saveFailed(let err):
            return "保存到系统相册失败：\(err.localizedDescription)"
        }
    }
}

@MainActor
enum WallpaperExporter {
    /// Renders a pixel-exact portrait wallpaper matching the target Apple Watch screen dimensions
    /// from the current live 3D scene arrangement (preserving tilted piles & settled physics poses).
    static func renderWallpaper(
        from liveScene: GravityScene3D,
        model: AppleWatchModelSpec,
        scaleMultiplier: CGFloat = 1.0
    ) -> UIImage? {
        let snapshot = liveScene.makeSnapshotScene()
        let device = MTLCreateSystemDefaultDevice()
        let renderer = SCNRenderer(device: device, options: nil)
        renderer.scene = snapshot.scene
        renderer.pointOfView = snapshot.camera
        renderer.autoenablesDefaultLighting = false

        let targetSize = CGSize(
            width: model.pixelSize.width * scaleMultiplier,
            height: model.pixelSize.height * scaleMultiplier
        )
        return renderer.snapshot(
            atTime: 0.0,
            with: targetSize,
            antialiasingMode: .multisampling4X
        )
    }

    static func saveToPhotos(_ image: UIImage) async throws {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            throw WallpaperExportError.photoPermissionDenied
        }

        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }
        } catch {
            throw WallpaperExportError.saveFailed(error)
        }
    }
}
#endif
