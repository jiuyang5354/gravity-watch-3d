import CoreGraphics
import CoreText
import Foundation
import ImageIO

enum ProceduralTextureGenerator {
    struct FloorPBRSet {
        let diffuse: CGImage
        let normal: CGImage
        let roughness: CGImage
    }

    private static var bundleImageCache: [String: CGImage] = [:]
    private static var floorPBRCache: [String: FloorPBRSet] = [:]
    private static var iconCache: [WatchFaceTheme: CGImage] = [:]

    private static var tennisDiffuseCache: CGImage?
    private static var tennisNormalCache: CGImage?
    private static var tennisRoughnessCache: CGImage?
    private static var tennisSeamMaskCache: CGImage?

    private static var basketballDiffuseCache: CGImage?
    private static var basketballNormalCache: CGImage?
    private static var basketballRoughnessCache: CGImage?

    private static var soccerDiffuseCache: CGImage?
    private static var soccerNormalCache: CGImage?
    private static var soccerRoughnessCache: CGImage?

    private static var goldPlateDiffuseCache: CGImage?
    private static var goldNormalCache: CGImage?
    private static var goldRoughnessCache: CGImage?

    private static var studioEnvCache: CGImage?
    private static var contactShadowCache: CGImage?
    private static var diamondCausticCache: CGImage?

    // MARK: - Public Accessors

    static func floorImage(for theme: WatchFaceTheme, velvetPreset: VelvetPreset = .obsidian) -> CGImage {
        floorPBR(for: theme, velvetPreset: velvetPreset).diffuse
    }

    static func floorPBR(for theme: WatchFaceTheme, velvetPreset: VelvetPreset = .obsidian) -> FloorPBRSet {
        let key: String
        switch theme {
        case .diamond:
            key = "diamond_\(velvetPreset.rawValue)"
        case .goldBar:
            key = "vault"
        default:
            key = theme.rawValue
        }
        if let cached = floorPBRCache[key] { return cached }

        let result: FloorPBRSet
        switch theme {
        case .tennis:
            result = renderClayCourtPBR()
        case .basketball:
            result = renderHardwoodCourtPBR()
        case .soccer:
            result = renderSoccerPitchPBR()
        case .diamond:
            result = renderDiamondVelvetPBR(preset: velvetPreset)
        case .goldBar:
            result = renderObsidianVaultPBR()
        }
        floorPBRCache[key] = result
        return result
    }

    static func previewIcon(for theme: WatchFaceTheme) -> CGImage {
        if let cached = iconCache[theme] { return cached }
        let image = renderPreviewIcon(for: theme)
        iconCache[theme] = image
        return image
    }

    static func tennisBallDiffuse() -> CGImage {
        if let cached = tennisDiffuseCache { return cached }
        ensureTennisBallMaps()
        return tennisDiffuseCache!
    }

    static func tennisBallNormal() -> CGImage {
        if let cached = tennisNormalCache { return cached }
        ensureTennisBallMaps()
        return tennisNormalCache!
    }

    static func tennisBallRoughness() -> CGImage {
        if let cached = tennisRoughnessCache { return cached }
        ensureTennisBallMaps()
        return tennisRoughnessCache!
    }

    static func tennisBallSeamMask() -> CGImage {
        if let cached = tennisSeamMaskCache { return cached }
        ensureTennisBallMaps()
        return tennisSeamMaskCache!
    }

    static func basketballDiffuse() -> CGImage {
        if let cached = basketballDiffuseCache { return cached }
        ensureBasketballMaps()
        return basketballDiffuseCache!
    }

    static func basketballNormal() -> CGImage {
        if let cached = basketballNormalCache { return cached }
        ensureBasketballMaps()
        return basketballNormalCache!
    }

    static func basketballRoughness() -> CGImage {
        if let cached = basketballRoughnessCache { return cached }
        ensureBasketballMaps()
        return basketballRoughnessCache!
    }

    static func soccerBallDiffuse() -> CGImage {
        if let cached = soccerDiffuseCache { return cached }
        ensureSoccerBallMaps()
        return soccerDiffuseCache!
    }

    static func soccerBallNormal() -> CGImage {
        if let cached = soccerNormalCache { return cached }
        ensureSoccerBallMaps()
        return soccerNormalCache!
    }

    static func soccerBallRoughness() -> CGImage {
        if let cached = soccerRoughnessCache { return cached }
        ensureSoccerBallMaps()
        return soccerRoughnessCache!
    }

    static func goldPlateDiffuse() -> CGImage {
        if let cached = goldPlateDiffuseCache { return cached }
        ensureGoldMaps()
        return goldPlateDiffuseCache!
    }

    static func goldPlateNormal() -> CGImage {
        if let cached = goldNormalCache { return cached }
        ensureGoldMaps()
        return goldNormalCache!
    }

    static func goldPlateRoughness() -> CGImage {
        if let cached = goldRoughnessCache { return cached }
        ensureGoldMaps()
        return goldRoughnessCache!
    }

    /// Returns bundled CC0 Poly Haven Radiance HDR URL (`studio_small_09.hdr`) when present,
    /// or falls back to procedural studio lighting CGImage (e.g. Xcode Previews).
    static func studioEnvironmentContents() -> Any {
        if let hdrURL = loadBundledURL(named: "studio_small_09", ext: "hdr") {
            return hdrURL
        }
        return studioEnvironmentMap()
    }

    static func studioEnvironmentMap() -> CGImage {
        if let cached = studioEnvCache { return cached }
        let image = renderStudioEnvironment()
        studioEnvCache = image
        return image
    }

    static func contactShadowTexture() -> CGImage {
        if let cached = contactShadowCache { return cached }
        let image = renderContactShadowTexture()
        contactShadowCache = image
        return image
    }

    static func diamondCausticTexture() -> CGImage {
        if let cached = diamondCausticCache { return cached }
        let image = renderDiamondCausticTexture()
        diamondCausticCache = image
        return image
    }

    // MARK: - Bundle & Image Helpers

    private static func loadBundledURL(named name: String, ext: String) -> URL? {
        if let url = Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "PBRTextures") {
            return url
        }
        return Bundle.main.url(forResource: name, withExtension: ext)
    }

    private static func loadBundledCGImage(named name: String, ext: String = "jpg") -> CGImage? {
        let key = "\(name).\(ext)"
        if let cached = bundleImageCache[key] { return cached }
        guard let url = loadBundledURL(named: name, ext: ext),
              let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
            return nil
        }
        bundleImageCache[key] = img
        return img
    }

    private static func makeContext(width: Int, height: Int) -> CGContext {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue)
        guard let ctx = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo.rawValue
        ) else {
            fatalError("Failed to allocate CoreGraphics bitmap context.")
        }
        ctx.setAllowsAntialiasing(true)
        ctx.setShouldAntialias(true)
        ctx.interpolationQuality = .high
        return ctx
    }

    private static func drawTiled(
        _ image: CGImage,
        in ctx: CGContext,
        width: Int,
        height: Int,
        tilesX: CGFloat,
        tilesY: CGFloat
    ) {
        let fw = CGFloat(width)
        let fh = CGFloat(height)
        let tileW = fw / max(tilesX, 0.5)
        let tileH = fh / max(tilesY, 0.5)
        let cols = Int(ceil(tilesX))
        let rows = Int(ceil(tilesY))

        for row in 0..<rows {
            for col in 0..<cols {
                let rect = CGRect(
                    x: CGFloat(col) * tileW,
                    y: CGFloat(row) * tileH,
                    width: tileW + 0.75,
                    height: tileH + 0.75
                )
                ctx.draw(image, in: rect)
            }
        }
    }

    private static func rasterizeTiledRGBA(
        _ image: CGImage,
        width: Int,
        height: Int,
        tilesX: CGFloat,
        tilesY: CGFloat
    ) -> [UInt8] {
        let ctx = makeContext(width: width, height: height)
        drawTiled(image, in: ctx, width: width, height: height, tilesX: tilesX, tilesY: tilesY)
        guard let data = ctx.data else {
            return Array(repeating: 128, count: width * height * 4)
        }
        let ptr = data.bindMemory(to: UInt8.self, capacity: width * height * 4)
        return Array(UnsafeBufferPointer(start: ptr, count: width * height * 4))
    }

    private static func buildNormalImage(
        height: [Float],
        width: Int,
        heightCount: Int,
        strength: Float,
        wrapX: Bool,
        detailRGBA: [UInt8]? = nil,
        detailStrength: Float = 0.42
    ) -> CGImage {
        let ctx = makeContext(width: width, height: heightCount)
        guard let data = ctx.data else { return ctx.makeImage()! }
        let buf = data.bindMemory(to: UInt8.self, capacity: width * heightCount * 4)

        func sample(_ x: Int, _ y: Int) -> Float {
            let sx = wrapX ? ((x % width) + width) % width : max(0, min(width - 1, x))
            let sy = max(0, min(heightCount - 1, y))
            return height[sy * width + sx]
        }

        for y in 0..<heightCount {
            for x in 0..<width {
                let tl = sample(x - 1, y - 1)
                let tc = sample(x, y - 1)
                let tr = sample(x + 1, y - 1)
                let ml = sample(x - 1, y)
                let mr = sample(x + 1, y)
                let bl = sample(x - 1, y + 1)
                let bc = sample(x, y + 1)
                let br = sample(x + 1, y + 1)

                let dx = (tr + 2 * mr + br) - (tl + 2 * ml + bl)
                let dy = (bl + 2 * bc + br) - (tl + 2 * tc + tr)

                var nx = -dx * strength
                var ny = -dy * strength
                var nz: Float = 1.0
                let baseInv = 1.0 / max(sqrtf(nx * nx + ny * ny + nz * nz), 0.0001)
                nx *= baseInv
                ny *= baseInv
                nz *= baseInv

                let idx = (y * width + x) * 4
                if let detail = detailRGBA {
                    let dnx = (Float(detail[idx]) / 255.0 * 2.0 - 1.0) * detailStrength
                    let dny = (Float(detail[idx + 1]) / 255.0 * 2.0 - 1.0) * detailStrength
                    let dnz = max(0.2, Float(detail[idx + 2]) / 255.0 * 2.0 - 1.0)
                    nx += dnx
                    ny += dny
                    nz *= dnz
                    let inv = 1.0 / max(sqrtf(nx * nx + ny * ny + nz * nz), 0.0001)
                    nx *= inv
                    ny *= inv
                    nz *= inv
                }

                buf[idx] = UInt8(clamping: Int((nx * 0.5 + 0.5) * 255.0))
                buf[idx + 1] = UInt8(clamping: Int((ny * 0.5 + 0.5) * 255.0))
                buf[idx + 2] = UInt8(clamping: Int((nz * 0.5 + 0.5) * 255.0))
                buf[idx + 3] = 255
            }
        }

        return ctx.makeImage()!
    }

    private static func buildGrayscaleImage(
        values: [Float],
        width: Int,
        height: Int,
        detailRGBA: [UInt8]? = nil,
        detailWeight: Float = 0.28
    ) -> CGImage {
        let ctx = makeContext(width: width, height: height)
        guard let data = ctx.data else { return ctx.makeImage()! }
        let buf = data.bindMemory(to: UInt8.self, capacity: width * height * 4)

        for i in 0..<(width * height) {
            var rv = values[i]
            if let detail = detailRGBA {
                let dr = Float(detail[i * 4]) / 255.0
                rv = rv * (1.0 - detailWeight) + dr * detailWeight
            }
            let v = UInt8(clamping: Int(rv * 255.0))
            let idx = i * 4
            buf[idx] = v
            buf[idx + 1] = v
            buf[idx + 2] = v
            buf[idx + 3] = 255
        }
        return ctx.makeImage()!
    }

    // MARK: - 1.5x Extended Seamless Floor PBR Sets

    private static func renderClayCourtPBR() -> FloorPBRSet {
        // Cushioned Acrylic / EPDM Rubber-Granule Tennis Court (zero dust, crisp lines, fine pellet relief)
        let w = 768
        let h = 936
        let fw = CGFloat(w)
        let fh = CGFloat(h)
        let ctx = makeContext(width: w, height: h)

        let cs = CGColorSpaceCreateDeviceRGB()
        if let grad = CGGradient(
            colorsSpace: cs,
            colors: [
                CGColor(red: 0.08, green: 0.20, blue: 0.11, alpha: 1.0),
                CGColor(red: 0.02, green: 0.06, blue: 0.03, alpha: 1.0)
            ] as CFArray,
            locations: [0.0, 1.0]
        ) {
            ctx.drawRadialGradient(
                grad,
                startCenter: CGPoint(x: fw * 0.5, y: fh * 0.5),
                startRadius: fw * 0.18,
                endCenter: CGPoint(x: fw * 0.5, y: fh * 0.5),
                endRadius: fw * 0.92,
                options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            )
        } else {
            ctx.setFillColor(red: 0.08, green: 0.20, blue: 0.11, alpha: 1.0)
            ctx.fill(CGRect(x: 0, y: 0, width: fw, height: fh))
        }

        let padX = fw * 0.225
        let padY = fh * 0.185
        let courtRect = CGRect(x: padX, y: padY, width: fw - padX * 2, height: fh - padY * 2)

        if let courtGrad = CGGradient(
            colorsSpace: cs,
            colors: [
                CGColor(red: 0.40, green: 0.14, blue: 0.09, alpha: 1.0),
                CGColor(red: 0.48, green: 0.18, blue: 0.11, alpha: 1.0),
                CGColor(red: 0.56, green: 0.22, blue: 0.14, alpha: 1.0)
            ] as CFArray,
            locations: [0.0, 0.5, 1.0]
        ) {
            ctx.saveGState()
            ctx.clip(to: courtRect)
            ctx.drawLinearGradient(
                courtGrad,
                start: CGPoint(x: 0, y: courtRect.minY),
                end: CGPoint(x: 0, y: courtRect.maxY),
                options: []
            )
            ctx.restoreGState()
        } else {
            ctx.setFillColor(red: 0.48, green: 0.18, blue: 0.11, alpha: 1.0)
            ctx.fill(courtRect)
        }

        if let rubberDiff = loadBundledCGImage(named: "rubber_diff") {
            ctx.saveGState()
            ctx.setAlpha(0.10)
            ctx.setBlendMode(.softLight)
            drawTiled(rubberDiff, in: ctx, width: w, height: h, tilesX: 8.0, tilesY: 9.6)
            ctx.restoreGState()
        }

        // Delicate EPDM rubber micro-granule speckles (deterministic hash)
        var seed: UInt32 = 918273
        func nextRand() -> CGFloat {
            seed = seed &* 1664525 &+ 1013904223
            return CGFloat(seed) / CGFloat(UInt32.max)
        }
        for i in 0..<11000 {
            let gx = nextRand() * fw
            let gy = nextRand() * fh
            let inCourt = courtRect.contains(CGPoint(x: gx, y: gy))
            let sz: CGFloat = (i % 6 == 0) ? 1.4 : 1.0
            if inCourt {
                if i % 3 == 0 {
                    ctx.setFillColor(red: 0.14, green: 0.05, blue: 0.04, alpha: 0.09)
                } else if i % 3 == 1 {
                    ctx.setFillColor(red: 0.85, green: 0.55, blue: 0.44, alpha: 0.07)
                } else {
                    ctx.setFillColor(red: 0.66, green: 0.30, blue: 0.20, alpha: 0.07)
                }
            } else {
                if i % 2 == 0 {
                    ctx.setFillColor(red: 0.02, green: 0.06, blue: 0.03, alpha: 0.10)
                } else {
                    ctx.setFillColor(red: 0.25, green: 0.50, blue: 0.30, alpha: 0.06)
                }
            }
            ctx.fill(CGRect(x: gx, y: gy, width: sz, height: sz))
        }

        ctx.setStrokeColor(red: 0.89, green: 0.90, blue: 0.87, alpha: 0.88)
        ctx.setLineWidth(3.2)
        ctx.stroke(courtRect)

        let singlesInset = courtRect.width * 0.135
        let leftSingles = courtRect.minX + singlesInset
        let rightSingles = courtRect.maxX - singlesInset
        let botService = courtRect.minY + courtRect.height * 0.235
        let topService = courtRect.minY + courtRect.height * 0.765

        ctx.move(to: CGPoint(x: leftSingles, y: courtRect.minY))
        ctx.addLine(to: CGPoint(x: leftSingles, y: courtRect.maxY))
        ctx.move(to: CGPoint(x: rightSingles, y: courtRect.minY))
        ctx.addLine(to: CGPoint(x: rightSingles, y: courtRect.maxY))
        ctx.move(to: CGPoint(x: leftSingles, y: botService))
        ctx.addLine(to: CGPoint(x: rightSingles, y: botService))
        ctx.move(to: CGPoint(x: leftSingles, y: topService))
        ctx.addLine(to: CGPoint(x: rightSingles, y: topService))
        ctx.move(to: CGPoint(x: fw * 0.5, y: botService))
        ctx.addLine(to: CGPoint(x: fw * 0.5, y: topService))
        ctx.move(to: CGPoint(x: fw * 0.5, y: courtRect.minY))
        ctx.addLine(to: CGPoint(x: fw * 0.5, y: courtRect.minY + 10))
        ctx.move(to: CGPoint(x: fw * 0.5, y: courtRect.maxY - 10))
        ctx.addLine(to: CGPoint(x: fw * 0.5, y: courtRect.maxY))
        ctx.strokePath()

        ctx.setStrokeColor(red: 0.04, green: 0.02, blue: 0.01, alpha: 0.34)
        ctx.setLineWidth(7.5)
        ctx.move(to: CGPoint(x: courtRect.minX - 10, y: fh * 0.5 - 3))
        ctx.addLine(to: CGPoint(x: courtRect.maxX + 10, y: fh * 0.5 - 3))
        ctx.strokePath()

        ctx.setStrokeColor(red: 0.90, green: 0.90, blue: 0.87, alpha: 0.52)
        ctx.setLineWidth(3.2)
        ctx.move(to: CGPoint(x: courtRect.minX - 10, y: fh * 0.5))
        ctx.addLine(to: CGPoint(x: courtRect.maxX + 10, y: fh * 0.5))
        ctx.strokePath()

        // Fine-grain cushioned EPDM pellet relief normal & roughness maps
        let nw = 384
        let nh = 468
        var heightArr = Array(repeating: Float(0.42), count: nw * nh)
        var roughArr = Array(repeating: Float(0.84), count: nw * nh)

        for i in 0..<11500 {
            let cx = Float(nextRand()) * Float(nw)
            let cy = Float(nextRand()) * Float(nh)
            let rad: Float = (i % 4 == 0) ? 1.25 : 0.90
            let peak: Float = 0.18 + Float(nextRand()) * 0.20
            let rInt = Int(ceilf(rad))
            let x0 = max(0, Int(floorf(cx)) - rInt)
            let x1 = min(nw - 1, Int(ceilf(cx)) + rInt)
            let y0 = max(0, Int(floorf(cy)) - rInt)
            let y1 = min(nh - 1, Int(ceilf(cy)) + rInt)
            let invR2 = 1.0 / (rad * rad)

            for py in y0...y1 {
                let dy = Float(py) - cy
                let dy2 = dy * dy
                let rowOff = py * nw
                for px in x0...x1 {
                    let dx = Float(px) - cx
                    let d2 = (dx * dx + dy2) * invR2
                    if d2 < 1.0 {
                        let dome = 0.42 + sqrtf(1.0 - d2) * peak
                        let pIdx = rowOff + px
                        if dome > heightArr[pIdx] { heightArr[pIdx] = dome }
                    }
                }
            }
        }

        for i in 0..<(nw * nh) {
            let grit = (Float(nextRand()) - 0.5) * 0.06
            let hv = max(0.0, min(1.0, heightArr[i] + grit))
            heightArr[i] = hv
            roughArr[i] = max(0.70, min(0.92, 0.88 - (hv - 0.42) * 0.28))
        }

        let rubberNor = loadBundledCGImage(named: "rubber_nor").map {
            rasterizeTiledRGBA($0, width: nw, height: nh, tilesX: 10.0, tilesY: 12.0)
        }
        let rubberRough = loadBundledCGImage(named: "rubber_rough").map {
            rasterizeTiledRGBA($0, width: nw, height: nh, tilesX: 10.0, tilesY: 12.0)
        }

        let normalMap = buildNormalImage(
            height: heightArr,
            width: nw,
            heightCount: nh,
            strength: 1.75,
            wrapX: false,
            detailRGBA: rubberNor,
            detailStrength: 0.34
        )
        let roughMap = buildGrayscaleImage(
            values: roughArr,
            width: nw,
            height: nh,
            detailRGBA: rubberRough,
            detailWeight: 0.18
        )

        return FloorPBRSet(diffuse: ctx.makeImage()!, normal: normalMap, roughness: roughMap)
    }

    private static func renderHardwoodCourtPBR() -> FloorPBRSet {
        let w = 768
        let h = 936
        let fw = CGFloat(w)
        let fh = CGFloat(h)
        let ctx = makeContext(width: w, height: h)

        let nw = 384
        let nh = 468
        let roughCtx = makeContext(width: nw, height: nh)

        if let mapleDiff = loadBundledCGImage(named: "maple_diff"),
           let mapleRough = loadBundledCGImage(named: "maple_rough") {
            drawTiled(mapleDiff, in: ctx, width: w, height: h, tilesX: 2.0, tilesY: 2.4)
            // Warm honey polyurethane varnish glaze preserving clean WoodFloor051 maple planks
            ctx.setFillColor(red: 0.88, green: 0.60, blue: 0.23, alpha: 0.11)
            ctx.fill(CGRect(x: 0, y: 0, width: fw, height: fh))

            drawTiled(mapleRough, in: roughCtx, width: nw, height: nh, tilesX: 2.0, tilesY: 2.4)
            roughCtx.setFillColor(red: 0.28, green: 0.28, blue: 0.28, alpha: 0.50)
            roughCtx.fill(CGRect(x: 0, y: 0, width: CGFloat(nw), height: CGFloat(nh)))
        } else {
            let plankW: CGFloat = 20
            var x: CGFloat = 0
            var colIndex = 0
            while x < fw {
                let tone = CGFloat(92 + (colIndex * 11) % 24) / 255.0
                ctx.setFillColor(red: tone + 0.14, green: tone + 0.04, blue: tone * 0.6, alpha: 1.0)
                ctx.fill(CGRect(x: x, y: 0, width: plankW - 1, height: fh))
                ctx.setFillColor(red: 0.16, green: 0.08, blue: 0.03, alpha: 0.55)
                ctx.fill(CGRect(x: x + plankW - 1, y: 0, width: 1, height: fh))
                x += plankW
                colIndex += 1
            }
            roughCtx.setFillColor(red: 0.26, green: 0.26, blue: 0.26, alpha: 1.0)
            roughCtx.fill(CGRect(x: 0, y: 0, width: CGFloat(nw), height: CGFloat(nh)))
        }

        let cs = CGColorSpaceCreateDeviceRGB()
        if let spot = CGGradient(
            colorsSpace: cs,
            colors: [
                CGColor(red: 0.57, green: 0.31, blue: 0.09, alpha: 0.10),
                CGColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.24)
            ] as CFArray,
            locations: [0.0, 1.0]
        ) {
            ctx.drawRadialGradient(
                spot,
                startCenter: CGPoint(x: fw * 0.5, y: fh * 0.46),
                startRadius: 48,
                endCenter: CGPoint(x: fw * 0.5, y: fh * 0.46),
                endRadius: fw * 0.78,
                options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            )
        }

        // Crisp white basketball court lines
        func drawLines(_ target: CGContext, scaleX: CGFloat, scaleY: CGFloat) {
            let tw = CGFloat(target.width)
            let th = CGFloat(target.height)
            let padX = tw * 0.20
            let baseY = th * 0.19
            let topY = th * 0.81
            let hoopY = baseY + 30.0 * scaleY

            target.stroke(CGRect(x: padX, y: baseY, width: tw - padX * 2, height: topY - baseY))
            let keyW = tw * 0.19
            let keyH = th * 0.22
            let keyX = (tw - keyW) * 0.5
            let keyTopY = baseY + keyH
            target.stroke(CGRect(x: keyX, y: baseY, width: keyW, height: keyH))

            target.addArc(center: CGPoint(x: tw * 0.5, y: keyTopY), radius: keyW * 0.5, startAngle: 0, endAngle: .pi, clockwise: false)
            target.strokePath()

            target.saveGState()
            target.setLineDash(phase: 0, lengths: [8 * scaleX, 8 * scaleX])
            target.addArc(center: CGPoint(x: tw * 0.5, y: keyTopY), radius: keyW * 0.5, startAngle: .pi, endAngle: 0, clockwise: false)
            target.strokePath()
            target.restoreGState()

            let threeR = tw * 0.25
            let cornerTopY = hoopY + 34.0 * scaleY
            target.move(to: CGPoint(x: tw * 0.5 + threeR, y: baseY))
            target.addLine(to: CGPoint(x: tw * 0.5 + threeR, y: cornerTopY))
            target.addArc(center: CGPoint(x: tw * 0.5, y: hoopY), radius: threeR, startAngle: 0, endAngle: .pi, clockwise: false)
            target.addLine(to: CGPoint(x: tw * 0.5 - threeR, y: baseY))
            target.strokePath()

            target.addArc(center: CGPoint(x: tw * 0.5, y: hoopY), radius: 28 * scaleX, startAngle: 0, endAngle: .pi, clockwise: false)
            target.strokePath()
            target.move(to: CGPoint(x: tw * 0.5 - 22 * scaleX, y: baseY + 18 * scaleY))
            target.addLine(to: CGPoint(x: tw * 0.5 + 22 * scaleX, y: baseY + 18 * scaleY))
            target.strokePath()
            target.addArc(center: CGPoint(x: tw * 0.5, y: hoopY), radius: 8 * scaleX, startAngle: 0, endAngle: .pi * 2, clockwise: false)
            target.strokePath()
        }

        ctx.setStrokeColor(red: 0.95, green: 0.95, blue: 0.93, alpha: 0.90)
        ctx.setLineWidth(3.0)
        drawLines(ctx, scaleX: 1.0, scaleY: 1.0)

        roughCtx.setStrokeColor(red: 0.62, green: 0.62, blue: 0.62, alpha: 1.0)
        roughCtx.setLineWidth(2.0)
        drawLines(roughCtx, scaleX: CGFloat(nw) / fw, scaleY: CGFloat(nh) / fh)

        let normalMap: CGImage
        if let mapleNor = loadBundledCGImage(named: "maple_nor") {
            let norCtx = makeContext(width: nw, height: nh)
            drawTiled(mapleNor, in: norCtx, width: nw, height: nh, tilesX: 2.0, tilesY: 2.4)
            normalMap = norCtx.makeImage()!
        } else {
            var hArr = Array(repeating: Float(0.5), count: nw * nh)
            for y in 0..<nh {
                for x in 0..<nw {
                    let seam: Float = (x % 12 == 0) ? -0.35 : 0.0
                    let grain = sinf(Float(x) * 1.9 + Float(y) * 0.05) * 0.04
                    hArr[y * nw + x] = 0.5 + seam + grain
                }
            }
            normalMap = buildNormalImage(height: hArr, width: nw, heightCount: nh, strength: 1.1, wrapX: false)
        }

        return FloorPBRSet(diffuse: ctx.makeImage()!, normal: normalMap, roughness: roughCtx.makeImage()!)
    }

    private static func renderSoccerPitchPBR() -> FloorPBRSet {
        let w = 768
        let h = 936
        let fw = CGFloat(w)
        let fh = CGFloat(h)
        let ctx = makeContext(width: w, height: h)

        let stripeCount = 14
        let stripeH = fh / CGFloat(stripeCount)
        if let grassDiff = loadBundledCGImage(named: "grass_diff") {
            drawTiled(grassDiff, in: ctx, width: w, height: h, tilesX: 4.0, tilesY: 4.8)
            ctx.setFillColor(red: 0.06, green: 0.14, blue: 0.03, alpha: 0.60)
            ctx.fill(CGRect(x: 0, y: 0, width: fw, height: fh))
            for i in 0..<stripeCount {
                if i % 2 == 0 {
                    ctx.setFillColor(red: 0.25, green: 0.49, blue: 0.11, alpha: 0.16)
                } else {
                    ctx.setFillColor(red: 0.02, green: 0.07, blue: 0.01, alpha: 0.26)
                }
                ctx.fill(CGRect(x: 0, y: CGFloat(i) * stripeH, width: fw, height: stripeH))
            }
        } else {
            for i in 0..<stripeCount {
                if i % 2 == 0 {
                    ctx.setFillColor(red: 0.14, green: 0.28, blue: 0.07, alpha: 1.0)
                } else {
                    ctx.setFillColor(red: 0.10, green: 0.21, blue: 0.05, alpha: 1.0)
                }
                ctx.fill(CGRect(x: 0, y: CGFloat(i) * stripeH, width: fw, height: stripeH))
            }
        }

        let cs = CGColorSpaceCreateDeviceRGB()
        if let vig = CGGradient(
            colorsSpace: cs,
            colors: [
                CGColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.0),
                CGColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.46)
            ] as CFArray,
            locations: [0.0, 1.0]
        ) {
            ctx.drawRadialGradient(
                vig,
                startCenter: CGPoint(x: fw * 0.5, y: fh * 0.5),
                startRadius: fw * 0.16,
                endCenter: CGPoint(x: fw * 0.5, y: fh * 0.5),
                endRadius: fw * 0.92,
                options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            )
        }

        let padX = fw * 0.20
        let botY = fh * 0.18
        let topY = fh * 0.80
        let pw = fw - padX * 2

        // Spotless stadium chalk lines (no mud spots)
        ctx.setStrokeColor(red: 0.91, green: 0.93, blue: 0.89, alpha: 0.86)
        ctx.setLineWidth(3.2)
        ctx.stroke(CGRect(x: padX, y: botY, width: pw, height: topY - botY))

        ctx.addArc(center: CGPoint(x: fw * 0.5, y: topY), radius: fw * 0.11, startAngle: .pi, endAngle: 0, clockwise: false)
        ctx.strokePath()

        ctx.setFillColor(red: 0.91, green: 0.93, blue: 0.89, alpha: 0.88)
        ctx.fillEllipse(in: CGRect(x: fw * 0.5 - 4, y: topY - 4, width: 8, height: 8))

        let boxW = pw * 0.62
        let boxH = fh * 0.17
        ctx.stroke(CGRect(x: (fw - boxW) * 0.5, y: botY, width: boxW, height: boxH))

        let goalW = pw * 0.28
        let goalH = fh * 0.06
        ctx.stroke(CGRect(x: (fw - goalW) * 0.5, y: botY, width: goalW, height: goalH))

        let penSpotY = botY + fh * 0.115
        ctx.fillEllipse(in: CGRect(x: fw * 0.5 - 3.5, y: penSpotY - 3.5, width: 7, height: 7))

        ctx.addArc(center: CGPoint(x: fw * 0.5, y: penSpotY), radius: fw * 0.10, startAngle: .pi * 0.18, endAngle: .pi * 0.82, clockwise: false)
        ctx.strokePath()

        let nw = 384
        let nh = 468
        let normalMap: CGImage
        let roughMap: CGImage
        if let grassNor = loadBundledCGImage(named: "grass_nor"),
           let grassRough = loadBundledCGImage(named: "grass_rough") {
            let nCtx = makeContext(width: nw, height: nh)
            drawTiled(grassNor, in: nCtx, width: nw, height: nh, tilesX: 4.0, tilesY: 4.8)
            normalMap = nCtx.makeImage()!

            let rCtx = makeContext(width: nw, height: nh)
            drawTiled(grassRough, in: rCtx, width: nw, height: nh, tilesX: 4.0, tilesY: 4.8)
            roughMap = rCtx.makeImage()!
        } else {
            var hArr = Array(repeating: Float(0.5), count: nw * nh)
            var rArr = Array(repeating: Float(0.90), count: nw * nh)
            for i in 0..<(nw * nh) {
                let blade = sinf(Float(i) * 1.13) * cosf(Float(i) * 0.53) * 0.17
                hArr[i] = 0.5 + blade
                rArr[i] = 0.88 + abs(blade) * 0.5
            }
            normalMap = buildNormalImage(height: hArr, width: nw, heightCount: nh, strength: 1.5, wrapX: false)
            roughMap = buildGrayscaleImage(values: rArr, width: nw, height: nh)
        }

        return FloorPBRSet(diffuse: ctx.makeImage()!, normal: normalMap, roughness: roughMap)
    }

    private static func renderObsidianVaultPBR() -> FloorPBRSet {
        // Honed Nero Marquina Black Marble Vault Floor for 04 Gold Bar (desaturated veins over obsidian stone)
        let w = 768
        let h = 936
        let fw = CGFloat(w)
        let fh = CGFloat(h)
        let ctx = makeContext(width: w, height: h)

        let nw = 384
        let nh = 468
        let roughCtx = makeContext(width: nw, height: nh)

        if let marbleDiff = loadBundledCGImage(named: "marble_diff"),
           let diffPtr = ctx.data {
            let marbleRGBA = rasterizeTiledRGBA(marbleDiff, width: w, height: h, tilesX: 2.0, tilesY: 2.4)
            let buf = diffPtr.bindMemory(to: UInt8.self, capacity: w * h * 4)
            let baseR: Float = 6.0
            let baseG: Float = 8.0
            let baseB: Float = 13.0
            for i in 0..<(w * h) {
                let idx = i * 4
                let r = Float(marbleRGBA[idx])
                let g = Float(marbleRGBA[idx + 1])
                let b = Float(marbleRGBA[idx + 2])
                let lum = 0.299 * r + 0.587 * g + 0.114 * b
                // Contrast-boosted desaturated marble veins over deep obsidian stone
                let stretched = max(0.0, min(255.0, (lum - 128.0) * 1.18 + 128.0))
                let veinR = stretched * 0.88 + r * 0.12
                let veinG = stretched * 0.88 + g * 0.12
                let veinB = stretched * 0.88 + b * 0.12
                buf[idx] = UInt8(clamping: Int(baseR * 0.66 + veinR * 0.34))
                buf[idx + 1] = UInt8(clamping: Int(baseG * 0.66 + veinG * 0.34))
                buf[idx + 2] = UInt8(clamping: Int(baseB * 0.66 + veinB * 0.34))
                buf[idx + 3] = 255
            }
        } else {
            ctx.setFillColor(red: 0.024, green: 0.031, blue: 0.051, alpha: 1.0)
            ctx.fill(CGRect(x: 0, y: 0, width: fw, height: fh))
        }

        let cs = CGColorSpaceCreateDeviceRGB()
        if let vig = CGGradient(
            colorsSpace: cs,
            colors: [
                CGColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.0),
                CGColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.48)
            ] as CFArray,
            locations: [0.28, 1.0]
        ) {
            ctx.drawRadialGradient(
                vig,
                startCenter: CGPoint(x: fw * 0.5, y: fh * 0.5),
                startRadius: fw * 0.24,
                endCenter: CGPoint(x: fw * 0.5, y: fh * 0.5),
                endRadius: fw * 0.88,
                options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            )
        }

        // Architectural CNC vault inset bevel
        let insetX = fw * 0.21
        let insetY = fh * 0.17
        let frameRect = CGRect(x: insetX, y: insetY, width: fw - insetX * 2, height: fh - insetY * 2)
        ctx.setStrokeColor(red: 0.015, green: 0.02, blue: 0.03, alpha: 0.78)
        ctx.setLineWidth(5.5)
        ctx.stroke(frameRect)
        ctx.setStrokeColor(red: 0.52, green: 0.58, blue: 0.70, alpha: 0.12)
        ctx.setLineWidth(1.5)
        ctx.stroke(frameRect.insetBy(dx: 5, dy: 5))

        // Clean honed stone roughness [0.32..0.44]
        roughCtx.setFillColor(red: 88.0 / 255.0, green: 88.0 / 255.0, blue: 88.0 / 255.0, alpha: 1.0)
        roughCtx.fill(CGRect(x: 0, y: 0, width: CGFloat(nw), height: CGFloat(nh)))
        if let marbleRough = loadBundledCGImage(named: "marble_rough") {
            roughCtx.saveGState()
            roughCtx.setAlpha(0.34)
            drawTiled(marbleRough, in: roughCtx, width: nw, height: nh, tilesX: 2.0, tilesY: 2.4)
            roughCtx.restore()
        }

        let normalMap: CGImage
        if let marbleNor = loadBundledCGImage(named: "marble_nor") {
            let nCtx = makeContext(width: nw, height: nh)
            nCtx.setFillColor(red: 0.5, green: 0.5, blue: 1.0, alpha: 1.0)
            nCtx.fill(CGRect(x: 0, y: 0, width: CGFloat(nw), height: CGFloat(nh)))
            nCtx.saveGState()
            nCtx.setAlpha(0.62)
            drawTiled(marbleNor, in: nCtx, width: nw, height: nh, tilesX: 2.0, tilesY: 2.4)
            nCtx.restore()
            normalMap = nCtx.makeImage()!
        } else {
            var hArr = Array(repeating: Float(0.5), count: nw * nh)
            for y in 0..<nh {
                let lathe = sinf(Float(y) * 0.55) * 0.02
                for x in 0..<nw {
                    hArr[y * nw + x] = 0.5 + lathe
                }
            }
            normalMap = buildNormalImage(height: hArr, width: nw, heightCount: nh, strength: 0.75, wrapX: false)
        }

        return FloorPBRSet(diffuse: ctx.makeImage()!, normal: normalMap, roughness: roughCtx.makeImage()!)
    }

    private static func evaluateVelvetDrape(u: Float, v: Float) -> (height: Float, foldAO: Float, napX: Float, napY: Float, napCloud: Float) {
        let warpA = 0.095 * sinf(u * 4.2 - v * 3.1 + 0.55) + 0.045 * cosf(u * 7.8 + v * 4.9 - 0.8)
        let warpB = 0.080 * cosf(u * 3.6 + v * 4.4 - 0.4)
        let phase1 = (u * 1.05 - v * 0.86 + warpA) * Float.pi * 2.15 + 0.35
        let phase2 = (u * 0.62 + v * 0.95 - warpB) * Float.pi * 1.65 + 1.05

        let pillow1 = powf(0.035 + 0.965 * abs(sinf(phase1)), 0.52)
        let pillow2 = powf(0.050 + 0.950 * abs(sinf(phase2)), 0.58)
        let rCushion = hypotf((u - 0.5) * 1.55, (v - 0.5) * 1.55)
        let centerCrown = 0.14 * cosf(min(Float.pi, rCushion * 1.45))
        let h = max(0.0, min(1.0, pillow1 * 0.62 + pillow2 * 0.28 + centerCrown))

        let napAngle = 1.9 * sinf(u * 4.8 + v * 3.4 + 0.5) + 1.1 * cosf(u * 11.2 - v * 9.3 - 0.4)
        let rawCloud = 0.5 + 0.32 * sinf(napAngle * 1.4) + 0.18 * cosf(u * 16.5 + v * 14.2)
        let napCloud = max(0.12, min(1.0, rawCloud))
        let foldAO = 0.18 + 0.82 * h
        return (h, foldAO, cosf(napAngle), sinf(napAngle), napCloud)
    }

    private static func renderDiamondVelvetPBR(preset: VelvetPreset) -> FloorPBRSet {
        let w = 640
        let h = 780
        let diffCtx = makeContext(width: w, height: h)
        guard let diffPtr = diffCtx.data else {
            return renderObsidianVaultPBR()
        }
        let diffBuf = diffPtr.bindMemory(to: UInt8.self, capacity: w * h * 4)

        let velvetDiffHi = loadBundledCGImage(named: "velvet_diff").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 2.6, tilesY: 3.1)
        }

        let core = preset.coreLinearRGB
        let mid = preset.midLinearRGB
        let sheen = preset.sheenLinearRGB

        for y in 0..<h {
            let vWorld = 1.0 - Float(y) / Float(h - 1)
            for x in 0..<w {
                let uWorld = Float(x) / Float(w - 1)
                let drape = evaluateVelvetDrape(u: uWorld, v: vWorld)
                let pIdx = y * w + x
                let idx = pIdx * 4

                var patchTone = drape.napCloud
                if let src = velvetDiffHi {
                    let rawR = Float(src[idx]) / 255.0
                    let dev = max(Float(-0.32), min(Float(0.32), (rawR - 0.44) * 3.6))
                    patchTone = max(0.14, min(1.0, drape.napCloud * 0.72 + 0.28 + dev))
                }

                let shoulderBand = powf(max(0.0, 1.0 - abs(drape.height - 0.66) * 2.8), 1.8)
                let sheenMix = shoulderBand * (0.22 + 0.55 * patchTone)
                let vigR = hypotf((uWorld - 0.5) * 1.42, (vWorld - 0.5) * 1.42)
                let vig = max(0.18, 1.0 - vigR * 0.55)

                let bodyW = drape.foldAO * (0.45 + 0.78 * patchTone)
                let rLin = max(0.0, min(1.0, (core.0 + (mid.0 - core.0) * bodyW + sheen.0 * sheenMix * 0.36) * vig))
                let gLin = max(0.0, min(1.0, (core.1 + (mid.1 - core.1) * bodyW + sheen.1 * sheenMix * 0.36) * vig))
                let bLin = max(0.0, min(1.0, (core.2 + (mid.2 - core.2) * bodyW + sheen.2 * sheenMix * 0.36) * vig))

                diffBuf[idx] = UInt8(clamping: Int(powf(rLin, 1.0 / 2.2) * 255.0))
                diffBuf[idx + 1] = UInt8(clamping: Int(powf(gLin, 1.0 / 2.2) * 255.0))
                diffBuf[idx + 2] = UInt8(clamping: Int(powf(bLin, 1.0 / 2.2) * 255.0))
                diffBuf[idx + 3] = 255
            }
        }

        let nw = 384
        let nh = 468
        var heightArr = Array(repeating: Float(0.5), count: nw * nh)
        let dataCtx = makeContext(width: nw, height: nh)
        guard let dataPtr = dataCtx.data else {
            return renderObsidianVaultPBR()
        }
        let dataBuf = dataPtr.bindMemory(to: UInt8.self, capacity: nw * nh * 4)

        let velvetDiffLo = loadBundledCGImage(named: "velvet_diff").map {
            rasterizeTiledRGBA($0, width: nw, height: nh, tilesX: 2.6, tilesY: 3.1)
        }
        let velvetRoughLo = loadBundledCGImage(named: "velvet_rough").map {
            rasterizeTiledRGBA($0, width: nw, height: nh, tilesX: 12.0, tilesY: 14.4)
        }
        let velvetNorLo = loadBundledCGImage(named: "velvet_nor").map {
            rasterizeTiledRGBA($0, width: nw, height: nh, tilesX: 12.0, tilesY: 14.4)
        }

        for y in 0..<nh {
            let vWorld = 1.0 - Float(y) / Float(nh - 1)
            for x in 0..<nw {
                let uWorld = Float(x) / Float(nw - 1)
                let drape = evaluateVelvetDrape(u: uWorld, v: vWorld)
                let pIdx = y * nw + x
                let idx = pIdx * 4

                let patchDev = velvetDiffLo != nil
                    ? max(Float(-0.32), min(Float(0.32), (Float(velvetDiffLo![idx]) / 255.0 - 0.44) * 3.6))
                    : 0.0
                let microGrain = velvetRoughLo != nil
                    ? Float(velvetRoughLo![idx]) / 255.0
                    : 0.65 + sinf(uWorld * 460.0 + vWorld * 210.0) * cosf(uWorld * 210.0 - vWorld * 490.0) * 0.30

                let combinedHeight = max(0.0, min(1.0, drape.height * 0.90 + patchDev * 0.06 + (microGrain - 0.5) * 0.04))
                heightArr[pIdx] = combinedHeight

                let fuzzIntensity = max(0.10, min(1.0, (drape.napCloud * 0.72 + 0.28 + patchDev) * (0.55 + 0.60 * microGrain)))

                dataBuf[idx] = UInt8(clamping: Int(combinedHeight * 255.0))
                dataBuf[idx + 1] = UInt8(clamping: Int((drape.napX * 0.5 + 0.5) * 255.0))
                dataBuf[idx + 2] = UInt8(clamping: Int((drape.napY * 0.5 + 0.5) * 255.0))
                dataBuf[idx + 3] = UInt8(clamping: Int(fuzzIntensity * 255.0))
            }
        }

        let norCtx = makeContext(width: nw, height: nh)
        let norBuf = norCtx.data!.bindMemory(to: UInt8.self, capacity: nw * nh * 4)
        func sampleH(_ x: Int, _ y: Int) -> Float {
            heightArr[max(0, min(nh - 1, y)) * nw + max(0, min(nw - 1, x))]
        }

        for y in 0..<nh {
            for x in 0..<nw {
                let tl = sampleH(x - 1, y - 1), tc = sampleH(x, y - 1), tr = sampleH(x + 1, y - 1)
                let ml = sampleH(x - 1, y), mr = sampleH(x + 1, y)
                let bl = sampleH(x - 1, y + 1), bc = sampleH(x, y + 1), br = sampleH(x + 1, y + 1)
                let dx = (tr + 2 * mr + br) - (tl + 2 * ml + bl)
                let dyWorldUp = (tl + 2 * tc + tr) - (bl + 2 * bc + br)

                var nx = -dx * 2.45
                var ny = -dyWorldUp * 2.45
                var nz: Float = 1.0
                let baseInv = 1.0 / max(sqrtf(nx * nx + ny * ny + nz * nz), 0.0001)
                nx *= baseInv; ny *= baseInv; nz *= baseInv

                let idx = (y * nw + x) * 4
                if let detail = velvetNorLo {
                    nx += (Float(detail[idx]) / 255.0 * 2.0 - 1.0) * 1.15
                    ny += (Float(detail[idx + 1]) / 255.0 * 2.0 - 1.0) * 1.15
                    nz *= max(0.2, Float(detail[idx + 2]) / 255.0 * 2.0 - 1.0)
                    let inv = 1.0 / max(sqrtf(nx * nx + ny * ny + nz * nz), 0.0001)
                    nx *= inv; ny *= inv; nz *= inv
                }

                norBuf[idx] = UInt8(clamping: Int((nx * 0.5 + 0.5) * 255.0))
                norBuf[idx + 1] = UInt8(clamping: Int((ny * 0.5 + 0.5) * 255.0))
                norBuf[idx + 2] = UInt8(clamping: Int((nz * 0.5 + 0.5) * 255.0))
                norBuf[idx + 3] = 255
            }
        }

        return FloorPBRSet(diffuse: diffCtx.makeImage()!, normal: norCtx.makeImage()!, roughness: dataCtx.makeImage()!)
    }

    // MARK: - Photorealistic Spotless Object PBR Maps (pristine_v16 parity)

    private static func ensureTennisBallMaps() {
        let w = 512
        let h = 256
        let ctx = makeContext(width: w, height: h)
        let seamCtx = makeContext(width: w, height: h)
        guard let data = ctx.data, let sData = seamCtx.data else { return }
        let buf = data.bindMemory(to: UInt8.self, capacity: w * h * 4)
        let seamBuf = sData.bindMemory(to: UInt8.self, capacity: w * h * 4)

        let feltDiffRGBA = loadBundledCGImage(named: "felt_diff").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 6.0, tilesY: 3.0)
        }
        let feltNorRGBA = loadBundledCGImage(named: "felt_nor").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 6.0, tilesY: 3.0)
        }
        let feltRoughRGBA = loadBundledCGImage(named: "felt_rough").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 6.0, tilesY: 3.0)
        }

        var feltMean: Float = 128.0
        if let fDiff = feltDiffRGBA {
            var sum: Float = 0.0
            let total = w * h
            for i in 0..<total {
                let kIdx = i * 4
                sum += Float(fDiff[kIdx]) * 0.5 + Float(fDiff[kIdx + 1]) * 0.5
            }
            feltMean = sum / Float(total)
        }

        var height = Array(repeating: Float(0.5), count: w * h)
        var rough = Array(repeating: Float(0.90), count: w * h)

        let k: Float = 0.36
        let norm: Float = 1.0 + k
        let cz: Float = 2.0 * sqrtf(k)
        var seam: [(Float, Float, Float)] = []
        let samples = 180
        for s in 0..<samples {
            let t = Float(s) / Float(samples) * Float.pi * 2.0
            seam.append((
                (cosf(t) + k * cosf(3 * t)) / norm,
                (sinf(t) - k * sinf(3 * t)) / norm,
                (cz * sinf(2 * t)) / norm
            ))
        }

        var rng: UInt32 = 424242
        func randSym() -> Float {
            rng = rng &* 1664525 &+ 1013904223
            return (Float(rng) / Float(UInt32.max)) - 0.5
        }

        for y in 0..<h {
            let lat = (0.5 - Float(y) / Float(h)) * Float.pi
            let cosLat = cosf(lat)
            let ny = sinf(lat)

            for x in 0..<w {
                let lon = (Float(x) / Float(w) - 0.5) * Float.pi * 2.0
                let nx = cosLat * cosf(lon)
                let nz = cosLat * sinf(lon)

                var minD2: Float = 99.0
                for pt in seam {
                    let dx = nx - pt.0, dy = ny - pt.1, dz = nz - pt.2
                    let d2 = dx * dx + dy * dy + dz * dz
                    if d2 < minD2 { minD2 = d2 }
                }

                let pIdx = y * w + x
                let idx = pIdx * 4
                let photoLuma: Float = feltDiffRGBA != nil
                    ? (Float(feltDiffRGBA![idx]) * 0.5 + Float(feltDiffRGBA![idx + 1]) * 0.5 - feltMean) * 0.48
                    : 0.0
                let microFuzz = randSym() * 0.36

                let seamVal: UInt8
                if minD2 < 0.0019 {
                    let rn = microFuzz * 8.0
                    buf[idx] = UInt8(clamping: Int(236.0 + rn))
                    buf[idx + 1] = UInt8(clamping: Int(236.0 + rn))
                    buf[idx + 2] = UInt8(clamping: Int(232.0 + rn))
                    height[pIdx] = 0.09 + microFuzz * 0.05
                    rough[pIdx] = 0.68
                    seamVal = 0
                } else if minD2 < 0.0044 {
                    let lip = (minD2 - 0.0019) / 0.0025
                    buf[idx] = UInt8(clamping: Int(126.0 + lip * 64.0))
                    buf[idx + 1] = UInt8(clamping: Int(154.0 + lip * 70.0))
                    buf[idx + 2] = UInt8(clamping: Int(22.0 + lip * 14.0))
                    height[pIdx] = 0.16 + lip * 0.46
                    rough[pIdx] = 0.90
                    let maskF = max(Float(0.0), min(Float(1.0), (minD2 - 0.0022) / 0.0030))
                    seamVal = UInt8(clamping: Int(maskF * 255.0))
                } else {
                    let tuft = sinf(nx * 168 + ny * 112) * cosf(nz * 162 - ny * 88) * 0.28
                    let clump = sinf(nx * 54 - ny * 60) * cosf(nz * 56 + nx * 42) * 0.20
                    let fiberStrand = sinf((nx * 240 - nz * 190) + tuft * 3.0) * 0.14
                    let weave = feltDiffRGBA != nil
                        ? photoLuma + (tuft + clump + fiberStrand) * 14.0 + microFuzz * 12.0
                        : (tuft + clump + fiberStrand + microFuzz) * 18.0
                    buf[idx] = UInt8(clamping: Int(192.0 + weave * 0.85))
                    buf[idx + 1] = UInt8(clamping: Int(226.0 + weave))
                    buf[idx + 2] = UInt8(clamping: Int(36.0 + weave * 0.22))
                    height[pIdx] = 0.62 + microFuzz * 0.44 + tuft * 0.28 + clump * 0.12 + fiberStrand * 0.12
                    rough[pIdx] = min(1.0, 0.90 + abs(microFuzz) * 0.08)
                    let maskF = minD2 < 0.0052 ? (minD2 - 0.0022) / 0.0030 : Float(1.0)
                    seamVal = UInt8(clamping: Int(maskF * 255.0))
                }
                buf[idx + 3] = 255
                seamBuf[idx] = seamVal
                seamBuf[idx + 1] = seamVal
                seamBuf[idx + 2] = seamVal
                seamBuf[idx + 3] = 255
            }
        }

        tennisDiffuseCache = ctx.makeImage()!
        tennisSeamMaskCache = seamCtx.makeImage()!
        tennisNormalCache = buildNormalImage(
            height: height,
            width: w,
            heightCount: h,
            strength: 3.4,
            wrapX: true,
            detailRGBA: feltNorRGBA,
            detailStrength: 0.58
        )
        tennisRoughnessCache = buildGrayscaleImage(
            values: rough,
            width: w,
            height: h,
            detailRGBA: feltRoughRGBA,
            detailWeight: 0.18
        )
    }

    private static func ensureBasketballMaps() {
        let w = 512
        let h = 256
        let ctx = makeContext(width: w, height: h)
        guard let data = ctx.data else { return }
        let buf = data.bindMemory(to: UInt8.self, capacity: w * h * 4)

        let leatherDiffRGBA = loadBundledCGImage(named: "bball_leather_diff").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 4.0, tilesY: 2.0)
        }
        let leatherNorRGBA = loadBundledCGImage(named: "bball_leather_nor").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 4.0, tilesY: 2.0)
        }
        let leatherRoughRGBA = loadBundledCGImage(named: "bball_leather_rough").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 4.0, tilesY: 2.0)
        }

        var leatherMean: Float = 81.0
        if let lDiff = leatherDiffRGBA {
            var sum: Float = 0.0
            let total = w * h
            for i in 0..<total {
                sum += Float(lDiff[i * 4])
            }
            leatherMean = sum / Float(total)
        }

        var height = Array(repeating: Float(0.5), count: w * h)
        var rough = Array(repeating: Float(0.58), count: w * h)

        var rng: UInt32 = 818181
        func randSym() -> Float {
            rng = rng &* 1664525 &+ 1013904223
            return (Float(rng) / Float(UInt32.max)) - 0.5
        }

        for y in 0..<h {
            let lat = (0.5 - Float(y) / Float(h)) * Float.pi
            let cosLat = max(0.18, cosf(lat))
            let ny = sinf(lat)

            for x in 0..<w {
                let lon = (Float(x) / Float(w) - 0.5) * Float.pi * 2.0
                let nx = cosf(lat) * cosf(lon)
                let nz = cosf(lat) * sinf(lon)

                let dEq = abs(ny)
                let dMer = abs(nz)
                let dSide = abs(ny) < 0.9 ? abs(abs(nx) - (0.58 - 0.25 * ny * ny)) : 99.0
                let channelDist = min(dEq, min(dMer, dSide))

                let latCell = lat * 80.0
                let rowParity = Float(Int(floorf(latCell)) & 1)
                let cellLon = ((lon * cosLat * 80.0 + rowParity * 0.5).truncatingRemainder(dividingBy: 1.0) + 1.0).truncatingRemainder(dividingBy: 1.0) - 0.5
                let cellLat = (latCell.truncatingRemainder(dividingBy: 1.0) + 1.0).truncatingRemainder(dividingBy: 1.0) - 0.5
                let pebbleR = hypotf(cellLon, cellLat)
                let dome = pebbleR < 0.44 ? sqrtf(max(0, 1.0 - (pebbleR / 0.44) * (pebbleR / 0.44))) : 0.0

                let pIdx = y * w + x
                let idx = pIdx * 4
                if channelDist < 0.025 {
                    let chGrain = Int(randSym() * 3.0)
                    buf[idx] = UInt8(clamping: 18 + chGrain)
                    buf[idx + 1] = UInt8(clamping: 18 + chGrain)
                    buf[idx + 2] = UInt8(clamping: 20 + chGrain)
                    height[pIdx] = 0.03
                    rough[pIdx] = 0.82
                } else if channelDist < 0.043 {
                    let bevel = (channelDist - 0.025) / 0.018
                    let shoulder = sinf(bevel * Float.pi) * 0.08
                    buf[idx] = UInt8(clamping: Int(116.0 + bevel * 98.0))
                    buf[idx + 1] = UInt8(clamping: Int(48.0 + bevel * 48.0))
                    buf[idx + 2] = UInt8(clamping: Int(16.0 + bevel * 14.0))
                    height[pIdx] = 0.24 + bevel * 0.22 + shoulder + dome * 0.14
                    rough[pIdx] = 0.72 - bevel * 0.12
                } else {
                    let photoShift = leatherDiffRGBA != nil ? (Float(leatherDiffRGBA![idx]) - leatherMean) * 0.28 : 0.0
                    let grain = randSym() * 4.0
                    let pebbleAO = 0.82 + 0.18 * powf(dome, 0.72)
                    let baseR = 224.0 * pebbleAO + photoShift * 0.95 + grain
                    let baseG = 102.0 * pebbleAO + photoShift * 0.44 + grain * 0.45
                    let baseB = 34.0 * pebbleAO + photoShift * 0.18 + grain * 0.2
                    buf[idx] = UInt8(clamping: Int(baseR))
                    buf[idx + 1] = UInt8(clamping: Int(baseG))
                    buf[idx + 2] = UInt8(clamping: Int(baseB))
                    height[pIdx] = 0.34 + dome * 0.66
                    rough[pIdx] = 0.68 - dome * 0.30
                }
                buf[idx + 3] = 255
            }
        }

        basketballDiffuseCache = ctx.makeImage()!
        basketballNormalCache = buildNormalImage(
            height: height,
            width: w,
            heightCount: h,
            strength: 3.4,
            wrapX: true,
            detailRGBA: leatherNorRGBA,
            detailStrength: 0.48
        )
        basketballRoughnessCache = buildGrayscaleImage(
            values: rough,
            width: w,
            height: h,
            detailRGBA: leatherRoughRGBA,
            detailWeight: 0.24
        )
    }

    private static func ensureSoccerBallMaps() {
        let w = 512
        let h = 256
        let ctx = makeContext(width: w, height: h)
        guard let data = ctx.data else { return }
        let buf = data.bindMemory(to: UInt8.self, capacity: w * h * 4)

        let leatherNorRGBA = loadBundledCGImage(named: "leather_white_nor").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 4.0, tilesY: 2.0)
        }
        let leatherRoughRGBA = loadBundledCGImage(named: "leather_white_rough").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 4.0, tilesY: 2.0)
        }

        var height = Array(repeating: Float(0.5), count: w * h)
        var rough = Array(repeating: Float(0.30), count: w * h)

        let phi: Float = (1.0 + sqrtf(5.0)) * 0.5
        let rawV: [(Float, Float, Float)] = [
            (0, 1, phi), (0, -1, phi), (0, 1, -phi), (0, -1, -phi),
            (1, phi, 0), (-1, phi, 0), (1, -phi, 0), (-1, -phi, 0),
            (phi, 0, 1), (-phi, 0, 1), (phi, 0, -1), (-phi, 0, -1)
        ]
        let verts: [(Float, Float, Float)] = rawV.map { v in
            let len = sqrtf(v.0 * v.0 + v.1 * v.1 + v.2 * v.2)
            return (v.0 / len, v.1 / len, v.2 / len)
        }

        var faces: [(Float, Float, Float)] = []
        for i in 0..<12 {
            for j in (i + 1)..<12 {
                if verts[i].0 * verts[j].0 + verts[i].1 * verts[j].1 + verts[i].2 * verts[j].2 < 0.35 { continue }
                for k in (j + 1)..<12 {
                    let dik = verts[i].0 * verts[k].0 + verts[i].1 * verts[k].1 + verts[i].2 * verts[k].2
                    let djk = verts[j].0 * verts[k].0 + verts[j].1 * verts[k].1 + verts[j].2 * verts[k].2
                    if dik > 0.35 && djk > 0.35 {
                        let fx = verts[i].0 + verts[j].0 + verts[k].0
                        let fy = verts[i].1 + verts[j].1 + verts[k].1
                        let fz = verts[i].2 + verts[j].2 + verts[k].2
                        let fl = sqrtf(fx * fx + fy * fy + fz * fz)
                        faces.append((fx / fl, fy / fl, fz / fl))
                    }
                }
            }
        }

        var rng: UInt32 = 555777
        func randSym() -> Float {
            rng = rng &* 1664525 &+ 1013904223
            return (Float(rng) / Float(UInt32.max)) - 0.5
        }

        for y in 0..<h {
            let lat = (0.5 - Float(y) / Float(h)) * Float.pi
            let cosLat = max(0.08, cosf(lat))
            let ny = sinf(lat)

            for x in 0..<w {
                let lon = (Float(x) / Float(w) - 0.5) * Float.pi * 2.0
                let nx = cosf(lat) * cosf(lon)
                let nz = cosf(lat) * sinf(lon)

                var bestV: Float = -1.0
                for v in verts {
                    let d = nx * v.0 + ny * v.1 + nz * v.2
                    if d > bestV { bestV = d }
                }

                var bestF: Float = -1.0
                var secondF: Float = -1.0
                for f in faces {
                    let d = nx * f.0 + ny * f.1 + nz * f.2
                    if d > bestF {
                        secondF = bestF
                        bestF = d
                    } else if d > secondF {
                        secondF = d
                    }
                }

                let pentGap = 1.0166 * bestV - bestF
                let isPentagon = pentGap > 0.0
                let edgeDist = isPentagon ? abs(pentGap) : min(abs(pentGap), bestF - secondF)
                let isSeam = edgeDist < 0.011
                let pillow = sqrtf(min(1.0, edgeDist / 0.068))
                let microGrain = randSym() * 4.0

                let puckerMask = edgeDist < 0.044 ? (1.0 - edgeDist / 0.044) : 0.0
                let pucker = puckerMask > 0.0 ? sinf(nx * 165 - ny * 145 + nz * 155) * 0.022 * puckerMask : 0.0

                let dimpLon = ((lon * cosLat * 84.0).truncatingRemainder(dividingBy: 1.0) + 1.0).truncatingRemainder(dividingBy: 1.0) - 0.5
                let dimpLat = ((lat * 84.0).truncatingRemainder(dividingBy: 1.0) + 1.0).truncatingRemainder(dividingBy: 1.0) - 0.5
                let dimpD = hypotf(dimpLon, dimpLat)
                let dimple = dimpD < 0.34 ? -0.045 * (1.0 - dimpD / 0.34) : 0.012

                let pIdx = y * w + x
                let idx = pIdx * 4

                if isSeam {
                    let stitch = sinf((nx + ny + nz) * 230.0) > 0.28
                    buf[idx] = stitch ? 104 : 16
                    buf[idx + 1] = stitch ? 108 : 18
                    buf[idx + 2] = stitch ? 114 : 22
                    height[pIdx] = stitch ? 0.24 : 0.05
                    rough[pIdx] = 0.78
                } else if isPentagon {
                    let pentAO = 0.78 + 0.22 * pillow
                    let base = Int(max(16.0, (24.0 + dimple * 10.0 + microGrain * 0.5) * pentAO))
                    buf[idx] = UInt8(clamping: base)
                    buf[idx + 1] = UInt8(clamping: base + 2)
                    buf[idx + 2] = UInt8(clamping: base + 8)
                    height[pIdx] = 0.24 + pillow * 0.72 + dimple + pucker
                    rough[pIdx] = min(0.85, 0.30 + (1.0 - pillow) * 0.18 - dimple * 0.5)
                } else {
                    let hexAO = 0.80 + 0.20 * pillow
                    let rawTone = (244.0 + dimple * 16.0 + microGrain * 0.5) * hexAO
                    let base = Int(min(250.0, max(188.0, rawTone)))
                    buf[idx] = UInt8(clamping: base)
                    buf[idx + 1] = UInt8(clamping: min(252, base + 1))
                    buf[idx + 2] = UInt8(clamping: min(255, base + 3))
                    height[pIdx] = 0.24 + pillow * 0.72 + dimple + pucker
                    rough[pIdx] = min(0.85, 0.26 + (1.0 - pillow) * 0.18 - dimple * 0.5)
                }
                buf[idx + 3] = 255
            }
        }

        soccerDiffuseCache = ctx.makeImage()!
        soccerNormalCache = buildNormalImage(
            height: height,
            width: w,
            heightCount: h,
            strength: 3.4,
            wrapX: true,
            detailRGBA: leatherNorRGBA,
            detailStrength: 0.30
        )
        soccerRoughnessCache = buildGrayscaleImage(
            values: rough,
            width: w,
            height: h,
            detailRGBA: leatherRoughRGBA,
            detailWeight: 0.18
        )
    }

    private static func drawCenteredSerif(
        _ string: String,
        size: CGFloat,
        centerX: CGFloat,
        baselineY: CGFloat,
        color: CGColor,
        in ctx: CGContext
    ) {
        let font = CTFontCreateWithName("Georgia-Bold" as CFString, size, nil)
        let attrs: [CFString: Any] = [
            kCTFontAttributeName: font,
            kCTForegroundColorAttributeName: color
        ]
        let attrStr = CFAttributedStringCreate(nil, string as CFString, attrs as CFDictionary)!
        let line = CTLineCreateWithAttributedString(attrStr)
        let bounds = CTLineGetBoundsWithOptions(line, [])
        ctx.saveGState()
        ctx.textMatrix = .identity
        ctx.textPosition = CGPoint(x: centerX - bounds.width * 0.5, y: baselineY)
        CTLineDraw(line, ctx)
        ctx.restoreGState()
    }

    private static func ensureGoldMaps() {
        // 24K Swiss Bullion Mint-Fresh Physical F0 Gold (#FFF2B8 -> #FFE27E -> #F4C550)
        let w = 512
        let h = 256
        let fw = CGFloat(w)
        let fh = CGFloat(h)
        let ctx = makeContext(width: w, height: h)
        let stampCtx = makeContext(width: w, height: h)

        let cs = CGColorSpaceCreateDeviceRGB()
        if let grad = CGGradient(
            colorsSpace: cs,
            colors: [
                CGColor(red: 1.0, green: 0.949, blue: 0.722, alpha: 1.0),
                CGColor(red: 1.0, green: 0.886, blue: 0.494, alpha: 1.0),
                CGColor(red: 0.957, green: 0.773, blue: 0.314, alpha: 1.0)
            ] as CFArray,
            locations: [0.0, 0.45, 1.0]
        ) {
            ctx.drawLinearGradient(
                grad,
                start: CGPoint(x: 0, y: fh),
                end: CGPoint(x: fw, y: 0),
                options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            )
        } else {
            ctx.setFillColor(red: 1.0, green: 0.886, blue: 0.494, alpha: 1.0)
            ctx.fill(CGRect(x: 0, y: 0, width: fw, height: fh))
        }

        // Ultra-fine clean horizontal satin brushing hairlines
        var rng: UInt32 = 998877
        func rand01() -> CGFloat {
            rng = rng &* 1664525 &+ 1013904223
            return CGFloat(rng) / CGFloat(UInt32.max)
        }
        for i in 0..<1200 {
            if i % 2 == 0 {
                ctx.setFillColor(red: 1.0, green: 0.992, blue: 0.933, alpha: 0.055)
            } else {
                ctx.setFillColor(red: 0.855, green: 0.635, blue: 0.180, alpha: 0.045)
            }
            ctx.fill(CGRect(x: rand01() * fw * 0.35, y: rand01() * fh, width: fw * 0.65, height: 1.0))
        }

        // Recessed height & roughness mask
        stampCtx.setFillColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0)
        stampCtx.fill(CGRect(x: 0, y: 0, width: fw, height: fh))
        stampCtx.setStrokeColor(red: 0.08, green: 0.08, blue: 0.08, alpha: 1.0)
        stampCtx.setLineWidth(7.0)
        stampCtx.stroke(CGRect(x: 36, y: 26, width: fw - 72, height: fh - 52))
        stampCtx.setLineWidth(3.0)
        stampCtx.stroke(CGRect(x: 48, y: 38, width: fw - 96, height: fh - 76))
        stampCtx.setLineWidth(2.5)
        stampCtx.stroke(CGRect(x: 66, y: fh - 90, width: 64, height: 36))

        let stampBlack = CGColor(red: 0.04, green: 0.04, blue: 0.04, alpha: 1.0)
        drawCenteredSerif("ASSAY", size: 14, centerX: 98, baselineY: fh - 78, color: stampBlack, in: stampCtx)
        drawCenteredSerif("SUISSE · 100g", size: 23, centerX: fw * 0.52, baselineY: fh * 0.66, color: stampBlack, in: stampCtx)
        drawCenteredSerif("FINE GOLD", size: 36, centerX: fw * 0.5, baselineY: fh * 0.44, color: stampBlack, in: stampCtx)
        drawCenteredSerif("999.9", size: 46, centerX: fw * 0.5, baselineY: fh * 0.22, color: stampBlack, in: stampCtx)
        drawCenteredSerif("A 048291 · MELTER", size: 13, centerX: fw * 0.5, baselineY: fh * 0.12, color: stampBlack, in: stampCtx)

        // Warm recessed gold die-stamp ink + crisp champagne bevel catchline
        ctx.saveGState()
        ctx.setAlpha(0.50)
        ctx.setStrokeColor(red: 0.58, green: 0.376, blue: 0.078, alpha: 1.0)
        ctx.setLineWidth(7.0)
        ctx.stroke(CGRect(x: 36, y: 26, width: fw - 72, height: fh - 52))
        ctx.setLineWidth(3.0)
        ctx.stroke(CGRect(x: 48, y: 38, width: fw - 96, height: fh - 76))
        ctx.setLineWidth(2.5)
        ctx.stroke(CGRect(x: 66, y: fh - 90, width: 64, height: 36))

        ctx.setStrokeColor(red: 1.0, green: 0.988, blue: 0.902, alpha: 0.78)
        ctx.setLineWidth(1.5)
        ctx.move(to: CGPoint(x: 49, y: 39))
        ctx.addLine(to: CGPoint(x: 49, y: fh - 39))
        ctx.addLine(to: CGPoint(x: fw - 49, y: fh - 39))
        ctx.strokePath()

        let goldStampTint = CGColor(red: 0.58, green: 0.376, blue: 0.078, alpha: 1.0)
        drawCenteredSerif("ASSAY", size: 14, centerX: 98, baselineY: fh - 78, color: goldStampTint, in: ctx)
        drawCenteredSerif("SUISSE · 100g", size: 23, centerX: fw * 0.52, baselineY: fh * 0.66, color: goldStampTint, in: ctx)
        drawCenteredSerif("FINE GOLD", size: 36, centerX: fw * 0.5, baselineY: fh * 0.44, color: goldStampTint, in: ctx)
        drawCenteredSerif("999.9", size: 46, centerX: fw * 0.5, baselineY: fh * 0.22, color: goldStampTint, in: ctx)
        drawCenteredSerif("A 048291 · MELTER", size: 13, centerX: fw * 0.5, baselineY: fh * 0.12, color: goldStampTint, in: ctx)
        ctx.restoreGState()

        var height = Array(repeating: Float(0.84), count: w * h)
        var rough = Array(repeating: Float(0.14), count: w * h)
        if let sData = stampCtx.data {
            let sBuf = sData.bindMemory(to: UInt8.self, capacity: w * h * 4)
            for y in 0..<h {
                let v = Float(y) / Float(h)
                let inYBorder = v < 0.095 || v > 0.905
                let brush = sinf(Float(y) * 0.84) * 0.011
                for x in 0..<w {
                    let u = Float(x) / Float(w)
                    let inBorder = inYBorder || u < 0.068 || u > 0.932
                    let pIdx = y * w + x
                    let stampVal = Float(sBuf[pIdx * 4]) / 255.0
                    height[pIdx] = 0.26 + stampVal * 0.58 + brush
                    if inBorder {
                        rough[pIdx] = 0.08 + abs(brush) * 0.45
                    } else if stampVal < 0.72 {
                        rough[pIdx] = 0.42 - stampVal * 0.10
                    } else {
                        rough[pIdx] = 0.14 + abs(brush) * 0.75
                    }
                }
            }
        }

        let metalNorRGBA = loadBundledCGImage(named: "metal_nor").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 2.0, tilesY: 1.0)
        }
        let metalRoughRGBA = loadBundledCGImage(named: "metal_rough").map {
            rasterizeTiledRGBA($0, width: w, height: h, tilesX: 2.0, tilesY: 1.0)
        }

        goldPlateDiffuseCache = ctx.makeImage()!
        goldNormalCache = buildNormalImage(
            height: height,
            width: w,
            heightCount: h,
            strength: 2.1,
            wrapX: false,
            detailRGBA: metalNorRGBA,
            detailStrength: 0.28
        )
        goldRoughnessCache = buildGrayscaleImage(
            values: rough,
            width: w,
            height: h,
            detailRGBA: metalRoughRGBA,
            detailWeight: 0.16
        )
    }

    // MARK: - Studio Environment Fallback & Contact / Caustic Decals

    private static func renderStudioEnvironment() -> CGImage {
        let w = 256
        let h = 128
        let ctx = makeContext(width: w, height: h)

        ctx.setFillColor(red: 0.03, green: 0.04, blue: 0.06, alpha: 1.0)
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))

        ctx.setFillColor(red: 1.0, green: 0.98, blue: 0.92, alpha: 1.0)
        ctx.fill(CGRect(x: 42, y: 74, width: 76, height: 34))
        ctx.setFillColor(red: 0.88, green: 0.95, blue: 1.0, alpha: 0.95)
        ctx.fill(CGRect(x: 150, y: 64, width: 64, height: 38))
        ctx.setFillColor(red: 1.0, green: 0.88, blue: 0.65, alpha: 0.9)
        ctx.fill(CGRect(x: 92, y: 18, width: 72, height: 22))

        return ctx.makeImage()!
    }

    private static func renderContactShadowTexture() -> CGImage {
        let size = 128
        let ctx = makeContext(width: size, height: size)
        guard let data = ctx.data else { return ctx.makeImage()! }
        let buf = data.bindMemory(to: UInt8.self, capacity: size * size * 4)

        for y in 0..<size {
            let dy = (Float(y) / Float(size) - 0.5) * 2.0
            for x in 0..<size {
                let dx = (Float(x) / Float(size) - 0.5) * 2.0
                let r2 = dx * dx + dy * dy
                var alpha: Float = 0.0
                if r2 < 1.0 {
                    let umbra = expf(-r2 * 11.5) * 0.52
                    let penumbra = expf(-r2 * 3.2) * (1.0 - r2) * 0.58
                    alpha = min(1.0, umbra + penumbra)
                }
                let idx = (y * size + x) * 4
                buf[idx] = 0
                buf[idx + 1] = 0
                buf[idx + 2] = 0
                buf[idx + 3] = UInt8(clamping: Int(alpha * 200.0))
            }
        }
        return ctx.makeImage()!
    }

    private static func renderDiamondCausticTexture() -> CGImage {
        let size = 128
        let fsize = CGFloat(size)
        let cx = fsize * 0.5
        let cy = fsize * 0.5
        let ctx = makeContext(width: size, height: size)
        let cs = CGColorSpaceCreateDeviceRGB()

        if let aoGrad = CGGradient(
            colorsSpace: cs,
            colors: [
                CGColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.0),
                CGColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.42),
                CGColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.0)
            ] as CFArray,
            locations: [0.0, 0.55, 1.0]
        ) {
            ctx.drawRadialGradient(
                aoGrad,
                startCenter: CGPoint(x: cx, y: cy),
                startRadius: fsize * 0.16,
                endCenter: CGPoint(x: cx, y: cy),
                endRadius: fsize * 0.48,
                options: []
            )
        }

        ctx.saveGState()
        ctx.setBlendMode(.screen)
        if let coreGrad = CGGradient(
            colorsSpace: cs,
            colors: [
                CGColor(red: 0.90, green: 0.96, blue: 1.0, alpha: 0.50),
                CGColor(red: 0.52, green: 0.84, blue: 1.0, alpha: 0.18),
                CGColor(red: 0.31, green: 0.63, blue: 1.0, alpha: 0.0)
            ] as CFArray,
            locations: [0.0, 0.50, 1.0]
        ) {
            ctx.drawRadialGradient(
                coreGrad,
                startCenter: CGPoint(x: cx + 2, y: cy + 2),
                startRadius: 1.0,
                endCenter: CGPoint(x: cx, y: cy),
                endRadius: fsize * 0.17,
                options: []
            )
        }

        for i in 0..<8 {
            let a = CGFloat(i) / 8.0 * (.pi * 2.0) + 0.18
            let sx = cx + cos(a) * fsize * 0.15
            let sy = cy + sin(a) * fsize * 0.15
            let spokeColor = i % 2 == 0
                ? CGColor(red: 0.94, green: 0.98, blue: 1.0, alpha: 0.40)
                : CGColor(red: 0.72, green: 0.91, blue: 1.0, alpha: 0.26)
            if let spokeGrad = CGGradient(
                colorsSpace: cs,
                colors: [spokeColor, CGColor(red: 0.47, green: 0.75, blue: 1.0, alpha: 0.0)] as CFArray,
                locations: [0.0, 1.0]
            ) {
                ctx.drawRadialGradient(
                    spokeGrad,
                    startCenter: CGPoint(x: sx, y: sy),
                    startRadius: 0.5,
                    endCenter: CGPoint(x: sx, y: sy),
                    endRadius: fsize * 0.075,
                    options: []
                )
            }
        }
        ctx.restoreGState()

        return ctx.makeImage()!
    }

    private static func renderPreviewIcon(for theme: WatchFaceTheme) -> CGImage {
        let size = 64
        let ctx = makeContext(width: size, height: size)
        let center = CGPoint(x: 32, y: 32)
        let radius: CGFloat = 26

        switch theme {
        case .tennis:
            ctx.setFillColor(red: 0.80, green: 0.94, blue: 0.18, alpha: 1.0)
            ctx.fillEllipse(in: CGRect(x: 6, y: 6, width: 52, height: 52))
            ctx.setStrokeColor(red: 0.96, green: 0.98, blue: 0.94, alpha: 1.0)
            ctx.setLineWidth(3)
            ctx.move(to: CGPoint(x: 16, y: 12))
            ctx.addQuadCurve(to: CGPoint(x: 16, y: 52), control: CGPoint(x: 32, y: 32))
            ctx.move(to: CGPoint(x: 48, y: 12))
            ctx.addQuadCurve(to: CGPoint(x: 48, y: 52), control: CGPoint(x: 32, y: 32))
            ctx.strokePath()
        case .diamond:
            ctx.setFillColor(red: 0.80, green: 0.94, blue: 1.0, alpha: 1.0)
            ctx.move(to: CGPoint(x: 20, y: 48))
            ctx.addLine(to: CGPoint(x: 44, y: 48))
            ctx.addLine(to: CGPoint(x: 56, y: 34))
            ctx.addLine(to: CGPoint(x: 32, y: 8))
            ctx.addLine(to: CGPoint(x: 8, y: 34))
            ctx.closePath()
            ctx.fillPath()
        case .basketball:
            ctx.setFillColor(red: 0.90, green: 0.40, blue: 0.12, alpha: 1.0)
            ctx.fillEllipse(in: CGRect(x: 6, y: 6, width: 52, height: 52))
            ctx.setStrokeColor(red: 0.10, green: 0.08, blue: 0.06, alpha: 1.0)
            ctx.setLineWidth(2.4)
            ctx.move(to: CGPoint(x: center.x, y: center.y - radius))
            ctx.addLine(to: CGPoint(x: center.x, y: center.y + radius))
            ctx.move(to: CGPoint(x: center.x - radius, y: center.y))
            ctx.addLine(to: CGPoint(x: center.x + radius, y: center.y))
            ctx.strokePath()
        case .goldBar:
            ctx.setFillColor(red: 0.98, green: 0.84, blue: 0.36, alpha: 1.0)
            ctx.fill(CGRect(x: 10, y: 18, width: 44, height: 28))
            ctx.setStrokeColor(red: 1.0, green: 0.96, blue: 0.80, alpha: 0.92)
            ctx.setLineWidth(2)
            ctx.stroke(CGRect(x: 14, y: 22, width: 36, height: 20))
        case .soccer:
            ctx.setFillColor(red: 0.96, green: 0.97, blue: 0.98, alpha: 1.0)
            ctx.fillEllipse(in: CGRect(x: 6, y: 6, width: 52, height: 52))
            ctx.setFillColor(red: 0.10, green: 0.11, blue: 0.14, alpha: 1.0)
            for i in 0..<5 {
                let angle = CGFloat(i) * (.pi * 2.0 / 5.0) + .pi * 0.5
                let pt = CGPoint(x: center.x + cos(angle) * 10, y: center.y + sin(angle) * 10)
                if i == 0 { ctx.move(to: pt) } else { ctx.addLine(to: pt) }
            }
            ctx.closePath()
            ctx.fillPath()
        }

        return ctx.makeImage()!
    }
}
