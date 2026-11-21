import CoreGraphics
import SwiftUI

enum WatchFaceTheme: String, CaseIterable, Identifiable, Codable, Sendable {
    case tennis = "tennis"
    case diamond = "diamond"
    case basketball = "basketball"
    case goldBar = "goldBar"
    case soccer = "soccer"

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

    var englishTitle: String {
        switch self {
        case .tennis:
            return "Tennis"
        case .diamond:
            return "Diamond"
        case .basketball:
            return "Basketball"
        case .goldBar:
            return "Bullion"
        case .soccer:
            return "Soccer"
        }
    }

    var subtitle: String {
        switch self {
        case .tennis:
            return "Rubber Granule Court"
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

    var shortCode: String {
        switch self {
        case .tennis:
            return "01"
        case .diamond:
            return "02"
        case .basketball:
            return "03"
        case .goldBar:
            return "04"
        case .soccer:
            return "05"
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
        case (.diamond, .lite):
            return 9
        case (_, .lite):
            return 8
        case (.tennis, .cinematic):
            return 13
        case (.diamond, .cinematic):
            return 13
        case (.basketball, .cinematic):
            return 12
        case (.goldBar, .cinematic):
            return 11
        case (.soccer, .cinematic):
            return 13
        case (.goldBar, .dense):
            return 20
        case (.diamond, .dense):
            return 24
        case (.basketball, .dense):
            return 24
        case (_, .dense):
            return 26
        }
    }
}

enum VelvetPreset: String, CaseIterable, Identifiable, Codable, Sendable {
    case obsidian = "obsidian"
    case burgundy = "burgundy"
    case sapphire = "sapphire"
    case emerald = "emerald"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .obsidian:
            return "玄黑天鹅绒"
        case .burgundy:
            return "高定酒红"
        case .sapphire:
            return "皇家午夜蓝"
        case .emerald:
            return "帝王祖母绿"
        }
    }

    var previewSwatchColor: Color {
        switch self {
        case .obsidian:
            return Color(red: 0.14, green: 0.15, blue: 0.20)
        case .burgundy:
            return Color(red: 0.48, green: 0.08, blue: 0.15)
        case .sapphire:
            return Color(red: 0.11, green: 0.24, blue: 0.56)
        case .emerald:
            return Color(red: 0.09, green: 0.40, blue: 0.22)
        }
    }

    var coreLinearRGB: (Float, Float, Float) {
        switch self {
        case .obsidian: return (0.0012, 0.0014, 0.0024)
        case .burgundy: return (0.0060, 0.0003, 0.0010)
        case .sapphire: return (0.0008, 0.0022, 0.0085)
        case .emerald:  return (0.0006, 0.0045, 0.0022)
        }
    }

    var midLinearRGB: (Float, Float, Float) {
        switch self {
        case .obsidian: return (0.0075, 0.0085, 0.0135)
        case .burgundy: return (0.0420, 0.0022, 0.0065)
        case .sapphire: return (0.0055, 0.0160, 0.0550)
        case .emerald:  return (0.0040, 0.0320, 0.0160)
        }
    }

    var sheenLinearRGB: (Float, Float, Float) {
        switch self {
        case .obsidian: return (0.095, 0.105, 0.140)
        case .burgundy: return (0.240, 0.022, 0.052)
        case .sapphire: return (0.045, 0.110, 0.280)
        case .emerald:  return (0.035, 0.160, 0.088)
        }
    }

    var rimLinearRGB: (Float, Float, Float) {
        switch self {
        case .obsidian: return (0.140, 0.155, 0.200)
        case .burgundy: return (0.340, 0.045, 0.088)
        case .sapphire: return (0.085, 0.180, 0.400)
        case .emerald:  return (0.075, 0.250, 0.140)
        }
    }
}

enum DensityPreset: String, CaseIterable, Identifiable, Codable, Sendable {
    case lite = "lite"
    case cinematic = "cinematic"
    case dense = "dense"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .lite:
            return "轻量省电 (~8颗)"
        case .cinematic:
            return "电影质感 (~13颗)"
        case .dense:
            return "高密度 (~24颗)"
        }
    }

    var shortLabel: String {
        switch self {
        case .lite: return "轻量 8 颗"
        case .cinematic: return "标准 13 颗"
        case .dense: return "高密 24+ 颗"
        }
    }
}

enum ComplicationsDisplayMode: String, CaseIterable, Identifiable, Codable, Sendable {
    case auto = "auto"
    case alwaysShow = "show"
    case alwaysHide = "hide"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .auto:
            return "自动 (奢华表盘显示)"
        case .alwaysShow:
            return "始终显示"
        case .alwaysHide:
            return "始终隐藏"
        }
    }
}

enum AppleWatchModelSpec: String, CaseIterable, Identifiable, Codable, Sendable {
    case series10_46mm = "series10_46"
    case series10_42mm = "series10_42"
    case ultra2_49mm = "ultra2_49"
    case series9_45mm = "series9_45"
    case se_44mm = "se_44"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .series10_46mm:
            return "Apple Watch Series 10 (46mm)"
        case .series10_42mm:
            return "Apple Watch Series 10 (42mm)"
        case .ultra2_49mm:
            return "Apple Watch Ultra 2 (49mm)"
        case .series9_45mm:
            return "Apple Watch Series 9 (45mm)"
        case .se_44mm:
            return "Apple Watch SE (44mm)"
        }
    }

    /// Exact hardware screen dimensions in pixels (portrait aspect matching 4.00 : 4.88 cavity).
    var pixelSize: CGSize {
        switch self {
        case .series10_46mm:
            return CGSize(width: 416, height: 496)
        case .series10_42mm:
            return CGSize(width: 374, height: 446)
        case .ultra2_49mm:
            return CGSize(width: 410, height: 502)
        case .series9_45mm:
            return CGSize(width: 396, height: 484)
        case .se_44mm:
            return CGSize(width: 368, height: 448)
        }
    }

    var dimensionLabel: String {
        "\(Int(pixelSize.width)) × \(Int(pixelSize.height)) px"
    }
}
