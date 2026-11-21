import Foundation

struct GravitySyncConfig: Codable, Equatable, Sendable {
    var theme: WatchFaceTheme
    var density: DensityPreset
    var velvetPreset: VelvetPreset
    var complicationsMode: ComplicationsDisplayMode
    var enableTennisFuzz: Bool
    var enableInteractiveGrass: Bool
    var parallaxStrength: Double
    var restitutionScale: Double
    var updatedAt: TimeInterval

    static let storageKey = "gravityWatchStudio.config.v1"

    static let defaultConfig = GravitySyncConfig(
        theme: .tennis,
        density: .cinematic,
        velvetPreset: .obsidian,
        complicationsMode: .auto,
        enableTennisFuzz: true,
        enableInteractiveGrass: true,
        parallaxStrength: 1.0,
        restitutionScale: 1.0,
        updatedAt: 0
    )

    var shouldShowComplications: Bool {
        switch complicationsMode {
        case .auto:
            return theme.showsLuxuryComplications
        case .alwaysShow:
            return true
        case .alwaysHide:
            return false
        }
    }

    static func load(from defaults: UserDefaults = .standard) -> GravitySyncConfig {
        guard let data = defaults.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode(GravitySyncConfig.self, from: data) else {
            return .defaultConfig
        }
        return decoded
    }

    func save(to defaults: UserDefaults = .standard) {
        if let encoded = try? JSONEncoder().encode(self) {
            defaults.set(encoded, forKey: Self.storageKey)
        }
    }

    func toDictionary() -> [String: Any] {
        [
            "theme": theme.rawValue,
            "density": density.rawValue,
            "velvetPreset": velvetPreset.rawValue,
            "complicationsMode": complicationsMode.rawValue,
            "enableTennisFuzz": enableTennisFuzz,
            "enableInteractiveGrass": enableInteractiveGrass,
            "parallaxStrength": parallaxStrength,
            "restitutionScale": restitutionScale,
            "updatedAt": updatedAt
        ]
    }

    init(
        theme: WatchFaceTheme,
        density: DensityPreset,
        velvetPreset: VelvetPreset,
        complicationsMode: ComplicationsDisplayMode,
        enableTennisFuzz: Bool,
        enableInteractiveGrass: Bool,
        parallaxStrength: Double,
        restitutionScale: Double,
        updatedAt: TimeInterval
    ) {
        self.theme = theme
        self.density = density
        self.velvetPreset = velvetPreset
        self.complicationsMode = complicationsMode
        self.enableTennisFuzz = enableTennisFuzz
        self.enableInteractiveGrass = enableInteractiveGrass
        self.parallaxStrength = parallaxStrength
        self.restitutionScale = restitutionScale
        self.updatedAt = updatedAt
    }

    init?(dictionary: [String: Any]) {
        guard let themeRaw = dictionary["theme"] as? String,
              let theme = WatchFaceTheme(rawValue: themeRaw) else {
            return nil
        }
        let density = (dictionary["density"] as? String).flatMap(DensityPreset.init(rawValue:)) ?? .cinematic
        let velvet = (dictionary["velvetPreset"] as? String).flatMap(VelvetPreset.init(rawValue:)) ?? .obsidian
        let comp = (dictionary["complicationsMode"] as? String).flatMap(ComplicationsDisplayMode.init(rawValue:)) ?? .auto

        self.theme = theme
        self.density = density
        self.velvetPreset = velvet
        self.complicationsMode = comp
        self.enableTennisFuzz = (dictionary["enableTennisFuzz"] as? Bool) ?? true
        self.enableInteractiveGrass = (dictionary["enableInteractiveGrass"] as? Bool) ?? true
        self.parallaxStrength = (dictionary["parallaxStrength"] as? Double) ?? 1.0
        self.restitutionScale = (dictionary["restitutionScale"] as? Double) ?? 1.0
        self.updatedAt = (dictionary["updatedAt"] as? TimeInterval) ?? Date().timeIntervalSince1970
    }
}
