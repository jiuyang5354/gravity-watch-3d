import SwiftUI

enum WatchFaceTheme: String, CaseIterable, Identifiable {
    case tennis = "tennis"
    case diamond = "diamond"
    case basketball = "basketball"
    case goldBar = "goldBar"
    case soccer = "soccer"

    static let themeStorageKey = "selectedWatchFaceTheme3D"
    static let densityStorageKey = "selectedDensityPreset3D"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .tennis:
            return "网球"
        case .diamond:
            return "钻石"
        case .basketball:
            return "篮球"
        case .goldBar:
            return "金条"
        case .soccer:
            return "足球"
        }
    }

    var subtitle: String {
        switch self {
        case .tennis:
            return "Clay Court"
        case .diamond:
            return "Velvet Cushion"
        case .basketball:
            return "Hardwood Court"
        case .goldBar:
            return "Bullion Vault"
        case .soccer:
            return "Grass Pitch"
        }
    }

    var showsLuxuryComplications: Bool {
        self == .diamond || self == .goldBar
    }

    var accentColor: Color {
        switch self {
        case .tennis:
            return Color(red: 0.84, green: 0.96, blue: 0.18)
        case .diamond:
            return Color(red: 0.66, green: 0.93, blue: 1.00)
        case .basketball:
            return Color(red: 1.00, green: 0.52, blue: 0.16)
        case .goldBar:
            return Color(red: 1.00, green: 0.84, blue: 0.35)
        case .soccer:
            return Color(red: 0.60, green: 0.96, blue: 0.41)
        }
    }

    func objectCount(for preset: DensityPreset) -> Int {
        switch (self, preset) {
        case (.tennis, .cinematic):
            return 17
        case (.diamond, .cinematic):
            return 19
        case (.basketball, .cinematic):
            return 16
        case (.goldBar, .cinematic):
            return 15
        case (.soccer, .cinematic):
            return 17
        case (.goldBar, .dense40):
            return 28
        case (.diamond, .dense40):
            return 36
        case (_, .dense40):
            return 40
        }
    }
}

enum DensityPreset: String, CaseIterable, Identifiable {
    case cinematic = "cinematic"
    case dense40 = "dense40"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .cinematic:
            return "原视频大尺寸 (~16颗)"
        case .dense40:
            return "高密度 40 颗模式"
        }
    }
}
