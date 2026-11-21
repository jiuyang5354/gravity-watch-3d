import CoreGraphics
import Foundation
import SceneKit

final class GravityScene3D: SCNScene {
    private struct MaterialPhysicsSpec {
        let mass: CGFloat
        let restitution: CGFloat
        let friction: CGFloat
        let rollingFriction: CGFloat
        let linearDamping: CGFloat
        let angularDamping: CGFloat
    }

    static let gravityMultiplier: Float = 14.5

    let cameraNode = SCNNode()
    private let keyLightNode = SCNNode()
    private let fillLightNode = SCNNode()
    private let rimLightNode = SCNNode()
    private let ambientLightNode = SCNNode()
    private let floorNode = SCNNode()

    private var grassFieldNode: SCNNode?
    private var grassMaterial: SCNMaterial?

    private var dynamicNodes: [SCNNode] = []
    private var decalNodes: [SCNNode] = []
    private var fuzzNodes: [SCNNode] = []

    private var activeSharedMaterial: SCNMaterial?
    private var activeVelvetMaterial: SCNMaterial?
    private let standardFloorMaterial = SCNMaterial()

    private let cavityWidth: Float = 4.0
    private let cavityHeight: Float = 4.88
    private let cavityDepth: Float = 1.08

    private var config: GravitySyncConfig
    private var isLuminanceReduced = false
    private var baseFloorSelfIllumIntensity: CGFloat = 0.10
    private var sceneStartTime: TimeInterval = ProcessInfo.processInfo.systemUptime

    private var smoothedEyeX: Float = 0.0
    private var smoothedEyeY: Float = -0.35
    private var currentObjectHalfZ: Float = 0.36
    private var currentGoldHalfExtents: (hx: Float, hy: Float, hz: Float) = (0.52, 0.23, 0.14)

    var onCollisionImpact: ((Float) -> Void)?

    init(config: GravitySyncConfig = .load()) {
        self.config = config
        super.init()
        setupScene()
        rebuildObjects()
    }

    required init?(coder: NSCoder) {
        self.config = .load()
        super.init(coder: coder)
        setupScene()
        rebuildObjects()
    }

    private func setupScene() {
        background.contents = CGColor(red: 0.016, green: 0.020, blue: 0.031, alpha: 1.0)
        lightingEnvironment.contents = ProceduralTextureGenerator.studioEnvironmentContents()
        lightingEnvironment.intensity = 1.18
        physicsWorld.gravity = SCNVector3(0, -Self.gravityMultiplier, -Self.gravityMultiplier * 0.68)

        let camera = SCNCamera()
        camera.zNear = 1.2
        camera.zFar = 24.0
        cameraNode.camera = camera
        rootNode.addChildNode(cameraNode)
        applyOffAxisPortalProjection(gx: 0.0, gy: -0.22, snap: true)

        // Clean 3-point luxury product studio lighting (overhead key, cool fill, opposing edge rim kicker)
        let keyLight = SCNLight()
        keyLight.type = .directional
        keyLight.color = CGColor(red: 1.0, green: 0.98, blue: 0.95, alpha: 1.0)
        keyLight.intensity = 1480
        keyLight.castsShadow = false
        keyLightNode.light = keyLight
        keyLightNode.position = SCNVector3(-4.4, 4.6, 5.2)
        keyLightNode.look(at: SCNVector3(0, 0, 0))
        rootNode.addChildNode(keyLightNode)

        let fillLight = SCNLight()
        fillLight.type = .directional
        fillLight.color = CGColor(red: 0.85, green: 0.91, blue: 1.0, alpha: 1.0)
        fillLight.intensity = 520
        fillLightNode.light = fillLight
        fillLightNode.position = SCNVector3(3.4, -2.6, 4.8)
        fillLightNode.look(at: SCNVector3(0, 0, 0))
        rootNode.addChildNode(fillLightNode)

        let rimLight = SCNLight()
        rimLight.type = .directional
        rimLight.color = CGColor(red: 1.0, green: 0.96, blue: 0.86, alpha: 1.0)
        rimLight.intensity = 780
        rimLight.castsShadow = false
        rimLightNode.light = rimLight
        rimLightNode.position = SCNVector3(4.8, -4.0, 1.35)
        rimLightNode.look(at: SCNVector3(0, 0, 0))
        rootNode.addChildNode(rimLightNode)

        let ambient = SCNLight()
        ambient.type = .ambient
        ambient.color = CGColor(red: 0.96, green: 0.98, blue: 1.0, alpha: 1.0)
        ambient.intensity = 340
        ambientLightNode.light = ambient
        rootNode.addChildNode(ambientLightNode)

        setupSeamlessFloorAndColliders()

        let syncAction = SCNAction.repeatForever(
            SCNAction.customAction(duration: 1.0) { [weak self] _, _ in
                self?.syncPerFrameVisuals()
            }
        )
        rootNode.runAction(syncAction, forKey: "perFrameSync")
    }

    private func setupSeamlessFloorAndColliders() {
        // 1.5x extended floor (6.00 x 7.32) keeps off-axis parallax 100% borderless with zero walls
        let floorPlane = SCNPlane(width: 6.0, height: 7.32)
        standardFloorMaterial.lightingModel = .physicallyBased
        standardFloorMaterial.roughness.contents = 0.82
        standardFloorMaterial.metalness.contents = 0.04
        floorPlane.materials = [standardFloorMaterial]

        floorNode.geometry = floorPlane
        floorNode.position = SCNVector3(0, 0, 0)
        floorNode.renderingOrder = -2
        floorNode.physicsBody = SCNPhysicsBody.static()
        rootNode.addChildNode(floorNode)

        // Invisible ceiling & perimeter bounds strictly confining bodies inside watch glass
        let ceiling = makeInvisibleCollider(width: cavityWidth + 0.4, height: cavityHeight + 0.4, thickness: 0.24)
        ceiling.position = SCNVector3(0, 0, cavityDepth + 0.12)
        rootNode.addChildNode(ceiling)

        let leftWall = makeInvisibleCollider(width: 0.24, height: cavityHeight, thickness: cavityDepth)
        leftWall.position = SCNVector3(-cavityWidth * 0.5 - 0.12, 0, cavityDepth * 0.5)
        rootNode.addChildNode(leftWall)

        let rightWall = makeInvisibleCollider(width: 0.24, height: cavityHeight, thickness: cavityDepth)
        rightWall.position = SCNVector3(cavityWidth * 0.5 + 0.12, 0, cavityDepth * 0.5)
        rootNode.addChildNode(rightWall)

        let topWall = makeInvisibleCollider(width: cavityWidth, height: 0.24, thickness: cavityDepth)
        topWall.position = SCNVector3(0, cavityHeight * 0.5 + 0.12, cavityDepth * 0.5)
        rootNode.addChildNode(topWall)

        let bottomWall = makeInvisibleCollider(width: cavityWidth, height: 0.24, thickness: cavityDepth)
        bottomWall.position = SCNVector3(0, -cavityHeight * 0.5 - 0.12, cavityDepth * 0.5)
        rootNode.addChildNode(bottomWall)

        let bevelPositions: [(Float, Float, Float)] = [
            (-1.79, 2.23, Float.pi * 0.25),
            (1.79, 2.23, -Float.pi * 0.25),
            (-1.79, -2.23, -Float.pi * 0.25),
            (1.79, -2.23, Float.pi * 0.25)
        ]
        for bevel in bevelPositions {
            let cornerNode = makeInvisibleCollider(width: 0.92, height: 0.24, thickness: cavityDepth)
            cornerNode.position = SCNVector3(bevel.0, bevel.1, cavityDepth * 0.5)
            cornerNode.eulerAngles = SCNVector3(0, 0, bevel.2)
            rootNode.addChildNode(cornerNode)
        }
    }

    private func makeInvisibleCollider(width: Float, height: Float, thickness: Float) -> SCNNode {
        let box = SCNBox(
            width: CGFloat(width),
            height: CGFloat(height),
            length: CGFloat(thickness),
            chamferRadius: 0
        )
        let mat = SCNMaterial()
        mat.lightingModel = .constant
        mat.colorBufferWriteMask = []
        mat.writesToDepthBuffer = false
        mat.readsFromDepthBuffer = false
        box.materials = [mat]

        let node = SCNNode(geometry: box)
        let shape = SCNPhysicsShape(geometry: box, options: nil)
        let body = SCNPhysicsBody(type: .static, shape: shape)
        body.restitution = 0.42
        body.friction = 0.45
        node.physicsBody = body
        return node
    }

    private func makeAsymmetricFrustum(
        left l: Float,
        right r: Float,
        bottom b: Float,
        top t: Float,
        near n: Float,
        far f: Float
    ) -> SCNMatrix4 {
        SCNMatrix4(
            m11: (2.0 * n) / (r - l), m12: 0.0, m13: 0.0, m14: 0.0,
            m21: 0.0, m22: (2.0 * n) / (t - b), m23: 0.0, m24: 0.0,
            m31: (r + l) / (r - l), m32: (t + b) / (t - b), m33: -(f + n) / (f - n), m34: -1.0,
            m41: 0.0, m42: 0.0, m43: -(2.0 * f * n) / (f - n), m44: 0.0
        )
    }

    private func applyOffAxisPortalProjection(gx: Float, gy: Float, snap: Bool = false) {
        let pScale = Float(config.parallaxStrength)
        let targetX = max(-2.15, min(2.15, -gx * 1.75 * pScale))
        let targetY = max(-2.15, min(2.15, -gy * 1.75 * pScale))
        if snap {
            smoothedEyeX = targetX
            smoothedEyeY = targetY
        } else {
            smoothedEyeX += (targetX - smoothedEyeX) * 0.22
            smoothedEyeY += (targetY - smoothedEyeY) * 0.22
        }

        let zWin: Float = 1.12
        let eyeZ: Float = 6.92
        let dWin = eyeZ - zWin
        let halfW: Float = 2.00
        let halfH: Float = 2.44
        let near: Float = 1.2
        let far: Float = 24.0
        let k = near / dWin

        cameraNode.position = SCNVector3(smoothedEyeX, smoothedEyeY, eyeZ)
        cameraNode.eulerAngles = SCNVector3(0, 0, 0)
        cameraNode.camera?.projectionTransform = makeAsymmetricFrustum(
            left: (-halfW - smoothedEyeX) * k,
            right: (halfW - smoothedEyeX) * k,
            bottom: (-halfH - smoothedEyeY) * k,
            top: (halfH - smoothedEyeY) * k,
            near: near,
            far: far
        )
    }

    func applyConfiguration(_ newConfig: GravitySyncConfig) {
        let needsRebuild =
            newConfig.theme != config.theme ||
            newConfig.density != config.density ||
            abs(newConfig.restitutionScale - config.restitutionScale) > 0.02

        let velvetChanged = newConfig.velvetPreset != config.velvetPreset
        let fuzzChanged = newConfig.enableTennisFuzz != config.enableTennisFuzz
        let grassChanged = newConfig.enableInteractiveGrass != config.enableInteractiveGrass

        config = newConfig

        if needsRebuild {
            rebuildObjects()
            return
        }

        if velvetChanged && config.theme == .diamond {
            let floorPBR = ProceduralTextureGenerator.floorPBR(for: .diamond, velvetPreset: config.velvetPreset)
            if let velvetMat = activeVelvetMaterial {
                DiamondShader3D.updateVelvetFloorMaterial(
                    velvetMat,
                    pbr: floorPBR,
                    preset: config.velvetPreset,
                    keyLightPos: keyLightNode.position,
                    exposure: isLuminanceReduced ? 0.56 : 1.02
                )
            }
            activeSharedMaterial?.setValue(SCNMaterialProperty(contents: floorPBR.diffuse), forKey: "u_floorTex")
        }

        if fuzzChanged {
            for fuzzNode in fuzzNodes {
                fuzzNode.isHidden = !config.enableTennisFuzz
            }
        }

        if grassChanged {
            grassFieldNode?.isHidden = !(config.theme == .soccer && config.enableInteractiveGrass)
        }
    }

    func setLuminanceReduced(_ reduced: Bool) {
        isLuminanceReduced = reduced
        applyLightingAndExposure()
    }

    func prepareFrameForSnapshot() {
        syncPerFrameVisuals()
    }

    /// Creates a lightweight physics-free clone capturing exact `presentation` transforms for pixel-accurate wallpaper export.
    func makeSnapshotScene() -> (scene: SCNScene, camera: SCNNode) {
        syncPerFrameVisuals()

        let snap = SCNScene()
        snap.background.contents = background.contents
        snap.lightingEnvironment.contents = lightingEnvironment.contents
        snap.lightingEnvironment.intensity = lightingEnvironment.intensity

        let snapCam = SCNNode()
        if let srcCam = cameraNode.camera {
            let cam = SCNCamera()
            cam.zNear = srcCam.zNear
            cam.zFar = srcCam.zFar
            cam.projectionTransform = srcCam.projectionTransform
            snapCam.camera = cam
        }
        snapCam.position = cameraNode.position
        snapCam.eulerAngles = cameraNode.eulerAngles
        snap.rootNode.addChildNode(snapCam)

        for srcLightNode in [keyLightNode, fillLightNode, rimLightNode, ambientLightNode] {
            let lNode = SCNNode()
            lNode.light = srcLightNode.light?.copy() as? SCNLight
            lNode.position = srcLightNode.position
            lNode.orientation = srcLightNode.orientation
            snap.rootNode.addChildNode(lNode)
        }

        let snapFloor = SCNNode(geometry: floorNode.geometry)
        snapFloor.position = floorNode.position
        snapFloor.renderingOrder = floorNode.renderingOrder
        snap.rootNode.addChildNode(snapFloor)

        if let gNode = grassFieldNode, !gNode.isHidden {
            let snapGrass = SCNNode(geometry: gNode.geometry)
            snapGrass.position = gNode.position
            snapGrass.renderingOrder = gNode.renderingOrder
            snap.rootNode.addChildNode(snapGrass)
        }

        for i in 0..<dynamicNodes.count {
            let src = dynamicNodes[i]
            let clone = SCNNode(geometry: src.geometry)
            clone.position = src.presentation.position
            clone.orientation = src.presentation.orientation
            for child in src.childNodes where !child.isHidden {
                let childClone = SCNNode(geometry: child.geometry)
                childClone.position = child.position
                childClone.orientation = child.orientation
                clone.addChildNode(childClone)
            }
            snap.rootNode.addChildNode(clone)
        }

        for decal in decalNodes {
            let dClone = SCNNode(geometry: decal.geometry)
            dClone.position = decal.position
            dClone.scale = decal.scale
            dClone.eulerAngles = decal.eulerAngles
            dClone.opacity = decal.opacity
            dClone.renderingOrder = decal.renderingOrder
            snap.rootNode.addChildNode(dClone)
        }

        return (snap, snapCam)
    }

    private func applyLightingAndExposure() {
        let dimFactor: Float = isLuminanceReduced ? 0.46 : 1.0
        let isLuxury = config.theme.showsLuxuryComplications

        lightingEnvironment.intensity = CGFloat(isLuminanceReduced ? 0.58 : 1.24)
        keyLightNode.light?.color = isLuxury
            ? CGColor(red: 1.0, green: 0.98, blue: 0.95, alpha: 1.0)
            : CGColor(red: 1.0, green: 0.97, blue: 0.93, alpha: 1.0)

        let baseKey: Float
        let baseHemi: Float
        let baseFill: Float
        let baseRim: Float
        let rimColor: CGColor
        let rimPos: SCNVector3

        switch config.theme {
        case .goldBar:
            baseKey = 1480; baseHemi = 460; baseFill = 620; baseRim = 980
            rimColor = CGColor(red: 1.0, green: 0.94, blue: 0.80, alpha: 1.0)
            rimPos = SCNVector3(4.2, -3.4, 2.8)
        case .diamond:
            baseKey = 1460; baseHemi = 260; baseFill = 360; baseRim = 680
            rimColor = CGColor(red: 0.80, green: 0.91, blue: 1.0, alpha: 1.0)
            rimPos = SCNVector3(4.2, -3.4, 2.8)
        case .basketball:
            baseKey = 1580; baseHemi = 410; baseFill = 520; baseRim = 890
            rimColor = CGColor(red: 1.0, green: 0.89, blue: 0.77, alpha: 1.0)
            rimPos = SCNVector3(4.8, -4.0, 1.35)
        case .soccer:
            baseKey = 1540; baseHemi = 430; baseFill = 540; baseRim = 870
            rimColor = CGColor(red: 0.92, green: 0.96, blue: 1.0, alpha: 1.0)
            rimPos = SCNVector3(4.8, -4.0, 1.35)
        case .tennis:
            baseKey = 1500; baseHemi = 400; baseFill = 490; baseRim = 820
            rimColor = CGColor(red: 0.95, green: 1.0, blue: 0.81, alpha: 1.0)
            rimPos = SCNVector3(4.8, -4.0, 1.35)
        }

        keyLightNode.light?.intensity = CGFloat(baseKey * dimFactor)
        ambientLightNode.light?.intensity = CGFloat(baseHemi * dimFactor)
        fillLightNode.light?.intensity = CGFloat(baseFill * dimFactor)
        rimLightNode.light?.color = rimColor
        rimLightNode.light?.intensity = CGFloat(baseRim * dimFactor)
        rimLightNode.position = rimPos
        rimLightNode.look(at: SCNVector3(0, 0, 0))

        standardFloorMaterial.selfIllumination.intensity = baseFloorSelfIllumIntensity * CGFloat(dimFactor)

        if config.theme == .diamond {
            let exp: Float = isLuminanceReduced ? 0.56 : 1.02
            activeSharedMaterial?.setValue(NSNumber(value: exp), forKey: "u_exposure")
            activeVelvetMaterial?.setValue(NSNumber(value: exp), forKey: "u_exposure")
        } else if config.theme == .tennis {
            let exp: Float = isLuminanceReduced ? 0.62 : 1.04
            for fuzzNode in fuzzNodes {
                for mat in fuzzNode.geometry?.materials ?? [] {
                    mat.setValue(NSNumber(value: exp), forKey: "u_exposure")
                }
            }
        }
    }

    func updateMotion(gravity normalized: SCNVector3, userAcceleration: SCNVector3) {
        physicsWorld.gravity = SCNVector3(
            normalized.x * Self.gravityMultiplier,
            normalized.y * Self.gravityMultiplier,
            normalized.z * Self.gravityMultiplier
        )

        let accelMag = sqrtf(
            userAcceleration.x * userAcceleration.x +
            userAcceleration.y * userAcceleration.y +
            userAcceleration.z * userAcceleration.z
        )
        if accelMag > 0.35 {
            let spec = physicsSpec(for: config.theme)
            let impulseScale = -Float(spec.mass) * 1.4
            let impulse = SCNVector3(
                userAcceleration.x * impulseScale,
                userAcceleration.y * impulseScale,
                max(-userAcceleration.z * impulseScale, 0)
            )
            for node in dynamicNodes {
                node.physicsBody?.applyForce(impulse, asImpulse: true)
            }
            onCollisionImpact?(accelMag)
        }

        applyOffAxisPortalProjection(gx: normalized.x, gy: normalized.y)
        let keyPos = SCNVector3(-4.4 - normalized.x * 1.4, 4.6 - normalized.y * 1.2, 5.2)
        keyLightNode.position = keyPos
        keyLightNode.look(at: SCNVector3(0, 0, 0))

        if config.theme == .diamond {
            activeVelvetMaterial?.setValue(NSValue(scnVector3: keyPos), forKey: "u_keyLightPos")
        } else if config.theme == .tennis {
            for fuzzNode in fuzzNodes {
                for mat in fuzzNode.geometry?.materials ?? [] {
                    mat.setValue(NSValue(scnVector3: keyPos), forKey: "u_keyLightPos")
                }
            }
        }
    }

    private func physicsSpec(for theme: WatchFaceTheme) -> MaterialPhysicsSpec {
        let restScale = CGFloat(max(0.2, min(1.4, config.restitutionScale)))
        switch theme {
        case .tennis:
            return MaterialPhysicsSpec(mass: 0.058, restitution: min(0.92, 0.50 * restScale), friction: 0.52, rollingFriction: 0.045, linearDamping: 0.28, angularDamping: 0.34)
        case .diamond:
            return MaterialPhysicsSpec(mass: 0.14, restitution: min(0.92, 0.36 * restScale), friction: 0.24, rollingFriction: 0.065, linearDamping: 0.12, angularDamping: 0.28)
        case .basketball:
            return MaterialPhysicsSpec(mass: 0.62, restitution: min(0.92, 0.60 * restScale), friction: 0.48, rollingFriction: 0.016, linearDamping: 0.16, angularDamping: 0.20)
        case .goldBar:
            return MaterialPhysicsSpec(mass: 1.85, restitution: min(0.92, 0.18 * restScale), friction: 0.34, rollingFriction: 0.09, linearDamping: 0.06, angularDamping: 0.58)
        case .soccer:
            return MaterialPhysicsSpec(mass: 0.43, restitution: min(0.92, 0.54 * restScale), friction: 0.44, rollingFriction: 0.032, linearDamping: 0.18, angularDamping: 0.24)
        }
    }

    func applyShakeImpulse() {
        for node in dynamicNodes {
            node.physicsBody?.applyForce(
                SCNVector3(
                    Float.random(in: -3.5...3.5),
                    Float.random(in: -3.5...3.5),
                    Float.random(in: 2.5...4.5)
                ),
                asImpulse: true
            )
            node.physicsBody?.applyTorque(
                SCNVector4(
                    Float.random(in: -1...1),
                    Float.random(in: -1...1),
                    Float.random(in: -1...1),
                    Float.random(in: 0.5...1.6)
                ),
                asImpulse: true
            )
        }
    }

    private func ensureGrassFieldIfNeeded() {
        if grassFieldNode == nil {
            #if os(watchOS)
            let bladeCount = 2600
            #else
            let bladeCount = 4600
            #endif
            let grassGeo = GeometryFactory3D.makeManicuredGrassFieldGeometry(bladeCount: bladeCount)
            let grassMat = DiamondShader3D.makeInteractiveGrassMaterial()
            grassGeo.materials = [grassMat]

            let node = SCNNode(geometry: grassGeo)
            node.position = SCNVector3(0, 0, 0)
            node.renderingOrder = 0
            rootNode.addChildNode(node)
            grassFieldNode = node
            grassMaterial = grassMat
        }
        grassFieldNode?.isHidden = !(config.theme == .soccer && config.enableInteractiveGrass)
    }

    private func syncPerFrameVisuals() {
        let count = min(dynamicNodes.count, decalNodes.count)
        let baseAlpha: Float
        switch config.theme {
        case .diamond: baseAlpha = 0.80
        case .goldBar: baseAlpha = 0.38
        case .soccer:  baseAlpha = 0.30
        case .basketball: baseAlpha = 0.46
        case .tennis:  baseAlpha = 0.44
        }

        for i in 0..<count {
            let p = dynamicNodes[i].presentation.position
            let decal = decalNodes[i]
            let floorDist = max(Float(0.0), p.z - currentObjectHalfZ)
            let contactFade = max(Float(0.08), 1.0 - floorDist * 0.90)
            let expand = 1.0 + floorDist * 0.35

            decal.position = SCNVector3(p.x + 0.045, p.y - 0.055, 0.008)
            if config.theme == .goldBar {
                let q = dynamicNodes[i].presentation.orientation
                decal.scale = SCNVector3(
                    currentGoldHalfExtents.hx * 2.5 * expand,
                    currentGoldHalfExtents.hy * 2.7 * expand,
                    1.0
                )
                decal.eulerAngles = SCNVector3(
                    0.0,
                    0.0,
                    atan2f(2.0 * (q.w * q.z + q.x * q.y), 1.0 - 2.0 * (q.y * q.y + q.z * q.z))
                )
            } else {
                let s = currentObjectHalfZ * 2.5 * expand
                decal.scale = SCNVector3(s, s, 1.0)
            }
            decal.opacity = CGFloat(baseAlpha * contactFade)
        }

        if config.theme == .soccer,
           config.enableInteractiveGrass,
           let gMat = grassMaterial {
            let elapsed = Float(ProcessInfo.processInfo.systemUptime - sceneStartTime)
            let activeCount = min(12, dynamicNodes.count)
            gMat.setValue(NSNumber(value: elapsed), forKey: "u_time")
            gMat.setValue(NSNumber(value: Float(activeCount)), forKey: "u_ballCount")
            for i in 0..<activeCount {
                let p = dynamicNodes[i].presentation.position
                gMat.setValue(
                    NSValue(scnVector4: SCNVector4(p.x, p.y, p.z, currentObjectHalfZ)),
                    forKey: "u_ball\(i)"
                )
            }
        }
    }

    private func rebuildObjects() {
        for node in dynamicNodes { node.removeFromParentNode() }
        for decal in decalNodes { decal.removeFromParentNode() }
        dynamicNodes.removeAll()
        decalNodes.removeAll()
        fuzzNodes.removeAll()

        let floorPBR = ProceduralTextureGenerator.floorPBR(for: config.theme, velvetPreset: config.velvetPreset)
        if config.theme == .diamond {
            let velvetMat = activeVelvetMaterial ?? DiamondShader3D.makeVelvetFloorMaterial(pbr: floorPBR, preset: config.velvetPreset)
            DiamondShader3D.updateVelvetFloorMaterial(
                velvetMat,
                pbr: floorPBR,
                preset: config.velvetPreset,
                keyLightPos: keyLightNode.position,
                exposure: isLuminanceReduced ? 0.56 : 1.02
            )
            activeVelvetMaterial = velvetMat
            floorNode.geometry?.materials = [velvetMat]
        } else {
            standardFloorMaterial.diffuse.contents = floorPBR.diffuse
            standardFloorMaterial.selfIllumination.contents = floorPBR.diffuse
            standardFloorMaterial.normal.contents = floorPBR.normal
            standardFloorMaterial.normal.intensity = config.theme == .basketball ? 0.44 : config.theme == .goldBar ? 0.42 : 0.85
            standardFloorMaterial.roughness.contents = floorPBR.roughness
            standardFloorMaterial.metalness.contents = config.theme == .goldBar ? 0.08 : 0.02
            floorNode.geometry?.materials = [standardFloorMaterial]
        }
        baseFloorSelfIllumIntensity = config.theme.showsLuxuryComplications ? 0.04 : 0.09

        ensureGrassFieldIfNeeded()

        let count = config.theme.objectCount(for: config.density)
        let baseRadius: Float
        switch config.density {
        case .lite:      baseRadius = 0.40
        case .cinematic: baseRadius = 0.36
        case .dense:     baseRadius = 0.25
        }
        currentObjectHalfZ = baseRadius

        let sharedMaterial = makeMaterial(for: config.theme, radius: baseRadius, floorDiffuse: floorPBR.diffuse)
        activeSharedMaterial = sharedMaterial

        let sharedGeometry: SCNGeometry
        let physicsShape: SCNPhysicsShape
        var fuzzShellTemplate: SCNGeometry?

        switch config.theme {
        case .tennis:
            let sphereGeo = GeometryFactory3D.makeSculptedTennisBallGeometry(radius: baseRadius)
            sphereGeo.materials = [sharedMaterial]
            sharedGeometry = sphereGeo
            physicsShape = SCNPhysicsShape(geometry: SCNSphere(radius: CGFloat(baseRadius)), options: nil)

            let shellGeo = GeometryFactory3D.makeTennisFuzzShellGeometry(radius: baseRadius)
            shellGeo.materials = DiamondShader3D.makeTennisFuzzMaterials(
                colorTexture: ProceduralTextureGenerator.tennisBallDiffuse(),
                seamTexture: ProceduralTextureGenerator.tennisBallSeamMask()
            )
            fuzzShellTemplate = shellGeo

        case .basketball:
            let sphereGeo = GeometryFactory3D.makeSculptedBasketballGeometry(radius: baseRadius)
            sphereGeo.materials = [sharedMaterial]
            sharedGeometry = sphereGeo
            physicsShape = SCNPhysicsShape(geometry: SCNSphere(radius: CGFloat(baseRadius)), options: nil)

        case .soccer:
            let sphereGeo = GeometryFactory3D.makeSculptedSoccerBallGeometry(radius: baseRadius)
            sphereGeo.materials = [sharedMaterial]
            sharedGeometry = sphereGeo
            physicsShape = SCNPhysicsShape(geometry: SCNSphere(radius: CGFloat(baseRadius)), options: nil)

        case .goldBar:
            let scale: Float = config.density == .dense ? 0.72 : (config.density == .lite ? 1.08 : 1.00)
            let hx: Float = 0.52 * scale
            let hy: Float = 0.23 * scale
            let hz: Float = 0.14 * scale
            currentGoldHalfExtents = (hx, hy, hz)
            currentObjectHalfZ = hz
            let barGeo = GeometryFactory3D.makeGoldBullionGeometry(halfX: hx, halfY: hy, halfZ: hz)
            barGeo.materials = [sharedMaterial]
            sharedGeometry = barGeo
            let collisionBox = SCNBox(
                width: CGFloat(hx * 2.0),
                height: CGFloat(hy * 2.0),
                length: CGFloat(hz * 2.0),
                chamferRadius: 0.03
            )
            physicsShape = SCNPhysicsShape(geometry: collisionBox, options: nil)

        case .diamond:
            let diaGeo = GeometryFactory3D.makeDiamondGeometry(radius: baseRadius)
            diaGeo.materials = [sharedMaterial]
            sharedGeometry = diaGeo
            physicsShape = SCNPhysicsShape(
                geometry: diaGeo,
                options: [SCNPhysicsShape.Option.type: SCNPhysicsShape.ShapeType.convexHull]
            )
        }

        let decalImage = config.theme == .diamond
            ? ProceduralTextureGenerator.diamondCausticTexture()
            : ProceduralTextureGenerator.contactShadowTexture()

        let cols = config.theme == .goldBar ? 3 : 4
        let stepX = (cavityWidth - baseRadius * 2.6) / Float(cols)

        for i in 0..<count {
            let col = i % cols
            let row = (i / cols) % 4
            let layer = i / (cols * 4)

            let node = SCNNode(geometry: sharedGeometry)
            let x = -cavityWidth * 0.5 + baseRadius * 1.3 + (Float(col) + 0.5) * stepX + Float.random(in: -0.05...0.05)
            let y = -cavityHeight * 0.30 + Float(row) * (baseRadius * 2.0) + Float.random(in: -0.05...0.05)
            let z = baseRadius + 0.08 + Float(layer) * (baseRadius * 1.95)
            node.position = SCNVector3(x, y, min(z, cavityDepth - baseRadius - 0.05))
            node.eulerAngles = SCNVector3(
                Float.random(in: 0...(Float.pi * 2)),
                Float.random(in: 0...(Float.pi * 2)),
                Float.random(in: 0...(Float.pi * 2))
            )

            if let fuzzGeo = fuzzShellTemplate {
                let fuzzChild = SCNNode(geometry: fuzzGeo)
                fuzzChild.isHidden = !config.enableTennisFuzz
                node.addChildNode(fuzzChild)
                fuzzNodes.append(fuzzChild)
            }

            let spec = physicsSpec(for: config.theme)
            let body = SCNPhysicsBody(type: .dynamic, shape: physicsShape)
            body.mass = spec.mass
            body.restitution = spec.restitution
            body.friction = spec.friction
            body.rollingFriction = spec.rollingFriction
            body.damping = spec.linearDamping
            body.angularDamping = spec.angularDamping
            body.allowsResting = false
            node.physicsBody = body

            rootNode.addChildNode(node)
            dynamicNodes.append(node)

            let decalPlane = SCNPlane(width: 1.0, height: 1.0)
            let decalMat = SCNMaterial()
            decalMat.lightingModel = .constant
            decalMat.diffuse.contents = decalImage
            decalMat.writesToDepthBuffer = false
            decalMat.readsFromDepthBuffer = true
            decalMat.blendMode = .alpha
            decalPlane.materials = [decalMat]

            let decalNode = SCNNode(geometry: decalPlane)
            decalNode.renderingOrder = -1
            decalNode.position = SCNVector3(x + 0.045, y - 0.055, 0.008)
            rootNode.addChildNode(decalNode)
            decalNodes.append(decalNode)
        }

        syncPerFrameVisuals()
        applyLightingAndExposure()
    }

    private func makeMaterial(for theme: WatchFaceTheme, radius: Float, floorDiffuse: CGImage) -> SCNMaterial {
        if theme == .diamond {
            return DiamondShader3D.makeDiamondMaterial(radius: radius, floorTexture: floorDiffuse)
        }

        let mat = SCNMaterial()
        mat.lightingModel = .physicallyBased

        switch theme {
        case .tennis:
            mat.diffuse.contents = ProceduralTextureGenerator.tennisBallDiffuse()
            mat.normal.contents = ProceduralTextureGenerator.tennisBallNormal()
            mat.normal.intensity = 0.95
            mat.roughness.contents = ProceduralTextureGenerator.tennisBallRoughness()
            mat.metalness.contents = 0.0
        case .basketball:
            mat.diffuse.contents = ProceduralTextureGenerator.basketballDiffuse()
            mat.normal.contents = ProceduralTextureGenerator.basketballNormal()
            mat.normal.intensity = 1.05
            mat.roughness.contents = ProceduralTextureGenerator.basketballRoughness()
            mat.metalness.contents = 0.02
            mat.clearCoat.contents = 0.22
            mat.clearCoatRoughness.contents = 0.32
        case .soccer:
            mat.diffuse.contents = ProceduralTextureGenerator.soccerBallDiffuse()
            mat.normal.contents = ProceduralTextureGenerator.soccerBallNormal()
            mat.normal.intensity = 1.05
            mat.roughness.contents = ProceduralTextureGenerator.soccerBallRoughness()
            mat.metalness.contents = 0.03
            mat.clearCoat.contents = 0.32
            mat.clearCoatRoughness.contents = 0.22
        case .goldBar:
            // White/neutral base preserves full 24K Swiss bullion F0 reflectance without copper darkening
            mat.diffuse.contents = ProceduralTextureGenerator.goldPlateDiffuse()
            mat.normal.contents = ProceduralTextureGenerator.goldPlateNormal()
            mat.normal.intensity = 0.95
            mat.roughness.contents = ProceduralTextureGenerator.goldPlateRoughness()
            mat.metalness.contents = 0.99
        case .diamond:
            break
        }

        return mat
    }
}
