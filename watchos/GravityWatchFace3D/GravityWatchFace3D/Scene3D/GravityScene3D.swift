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
    private let ambientLightNode = SCNNode()
    private let vaultLightNode = SCNNode()
    private let floorNode = SCNNode()

    private var dynamicNodes: [SCNNode] = []
    private var decalNodes: [SCNNode] = []
    private var activeSharedMaterial: SCNMaterial?
    private let standardFloorMaterial = SCNMaterial()
    private var activeVelvetMaterial: SCNMaterial?

    private let cavityWidth: Float = 4.0
    private let cavityHeight: Float = 4.88
    private let cavityDepth: Float = 1.08

    private var currentTheme: WatchFaceTheme
    private var currentDensity: DensityPreset
    private var isLuminanceReduced = false
    private var baseFloorSelfIllumIntensity: CGFloat = 0.26

    private var smoothedEyeX: Float = 0.0
    private var smoothedEyeY: Float = -0.35
    private var currentObjectHalfZ: Float = 0.36
    private var currentGoldHalfExtents: (hx: Float, hy: Float, hz: Float) = (0.52, 0.23, 0.14)

    init(theme: WatchFaceTheme, density: DensityPreset) {
        self.currentTheme = theme
        self.currentDensity = density
        super.init()
        setupScene()
        rebuildObjects()
    }

    required init?(coder: NSCoder) {
        self.currentTheme = .tennis
        self.currentDensity = .cinematic
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

        let keyLight = SCNLight()
        keyLight.type = .directional
        keyLight.color = CGColor(red: 1.0, green: 0.97, blue: 0.92, alpha: 1.0)
        keyLight.intensity = 1450
        keyLight.castsShadow = false
        keyLightNode.light = keyLight
        keyLightNode.position = SCNVector3(-2.4, 3.6, 7.6)
        keyLightNode.look(at: SCNVector3(0, 0, 0))
        rootNode.addChildNode(keyLightNode)

        let fillLight = SCNLight()
        fillLight.type = .directional
        fillLight.color = CGColor(red: 0.76, green: 0.87, blue: 1.0, alpha: 1.0)
        fillLight.intensity = 450
        fillLightNode.light = fillLight
        fillLightNode.position = SCNVector3(3.4, -2.6, 4.8)
        fillLightNode.look(at: SCNVector3(0, 0, 0))
        rootNode.addChildNode(fillLightNode)

        let ambient = SCNLight()
        ambient.type = .ambient
        ambient.intensity = 240
        ambientLightNode.light = ambient
        rootNode.addChildNode(ambientLightNode)

        let vaultLight = SCNLight()
        vaultLight.type = .omni
        vaultLight.intensity = 0
        vaultLightNode.light = vaultLight
        vaultLightNode.position = SCNVector3(0, -1.0, 3.0)
        rootNode.addChildNode(vaultLightNode)

        setupSeamlessFloorAndColliders()

        let syncAction = SCNAction.repeatForever(
            SCNAction.customAction(duration: 1.0) { [weak self] _, _ in
                self?.syncDecalsToPresentation()
            }
        )
        rootNode.runAction(syncAction, forKey: "decalSync")
    }

    private func setupSeamlessFloorAndColliders() {
        // 1.5x extended floor (6.00 x 7.32) ensures zero borders or visible wall seams during off-axis tilt
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

        // Invisible ceiling & perimeter physics bounds (flush un-hollowed portal)
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

        // 45-degree rounded-corner bevel colliders matching Apple Watch case radius
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
        let targetX = max(-2.05, min(2.05, -gx * 1.65))
        let targetY = max(-2.05, min(2.05, -gy * 1.65))
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

    func updateTheme(_ theme: WatchFaceTheme, density: DensityPreset) {
        guard theme != currentTheme || density != currentDensity else { return }
        currentTheme = theme
        currentDensity = density
        rebuildObjects()
    }

    func setLuminanceReduced(_ reduced: Bool) {
        isLuminanceReduced = reduced
        applyLightingAndExposure()
    }

    private func applyLightingAndExposure() {
        let dimFactor: Float = isLuminanceReduced ? 0.45 : 1.0
        let isLuxury = currentTheme.showsLuxuryComplications

        lightingEnvironment.intensity = CGFloat((isLuminanceReduced ? 0.56 : 1.18))
        keyLightNode.light?.intensity = CGFloat(1450.0 * dimFactor)
        fillLightNode.light?.intensity = CGFloat((isLuxury ? 380.0 : 450.0) * dimFactor)
        ambientLightNode.light?.intensity = CGFloat((isLuxury ? 190.0 : 250.0) * dimFactor)

        standardFloorMaterial.selfIllumination.intensity = baseFloorSelfIllumIntensity * CGFloat(dimFactor)

        if currentTheme == .goldBar {
            vaultLightNode.light?.color = CGColor(red: 1.0, green: 0.80, blue: 0.30, alpha: 1.0)
            vaultLightNode.light?.intensity = CGFloat(680.0 * dimFactor)
        } else if currentTheme == .diamond {
            vaultLightNode.light?.color = CGColor(red: 0.72, green: 0.93, blue: 1.0, alpha: 1.0)
            vaultLightNode.light?.intensity = CGFloat(560.0 * dimFactor)
        } else {
            vaultLightNode.light?.intensity = 0
        }

        if currentTheme == .diamond {
            activeSharedMaterial?.setValue(NSNumber(value: isLuminanceReduced ? Float(0.58) : Float(1.18)), forKey: "u_exposure")
            activeVelvetMaterial?.setValue(NSNumber(value: isLuminanceReduced ? Float(0.54) : Float(1.18)), forKey: "u_exposure")
        }
    }

    func updateMotion(gravity normalized: SCNVector3, userAcceleration: SCNVector3) {
        physicsWorld.gravity = SCNVector3(
            normalized.x * Self.gravityMultiplier,
            normalized.y * Self.gravityMultiplier,
            normalized.z * Self.gravityMultiplier
        )

        // Apply wrist-flick d'Alembert inertial impulse when moving briskly
        let accelMag = sqrtf(
            userAcceleration.x * userAcceleration.x +
            userAcceleration.y * userAcceleration.y +
            userAcceleration.z * userAcceleration.z
        )
        if accelMag > 0.35 {
            let spec = physicsSpec(for: currentTheme)
            let impulseScale = -Float(spec.mass) * 1.4
            let impulse = SCNVector3(
                userAcceleration.x * impulseScale,
                userAcceleration.y * impulseScale,
                max(-userAcceleration.z * impulseScale, 0)
            )
            for node in dynamicNodes {
                node.physicsBody?.applyForce(impulse, asImpulse: true)
            }
        }

        applyOffAxisPortalProjection(gx: normalized.x, gy: normalized.y)
        let keyPos = SCNVector3(-2.4 - normalized.x * 1.4, 3.6 - normalized.y * 1.2, 7.6)
        keyLightNode.position = keyPos
        keyLightNode.look(at: SCNVector3(0, 0, 0))
        if currentTheme == .diamond {
            activeVelvetMaterial?.setValue(keyPos, forKey: "u_keyLightPos")
        }
    }

    private func physicsSpec(for theme: WatchFaceTheme) -> MaterialPhysicsSpec {
        switch theme {
        case .tennis:
            return MaterialPhysicsSpec(
                mass: 0.058,
                restitution: 0.50,
                friction: 0.52,
                rollingFriction: 0.045,
                linearDamping: 0.28,
                angularDamping: 0.34
            )
        case .diamond:
            return MaterialPhysicsSpec(
                mass: 0.14,
                restitution: 0.36,
                friction: 0.24,
                rollingFriction: 0.065,
                linearDamping: 0.12,
                angularDamping: 0.28
            )
        case .basketball:
            return MaterialPhysicsSpec(
                mass: 0.62,
                restitution: 0.60,
                friction: 0.48,
                rollingFriction: 0.016,
                linearDamping: 0.16,
                angularDamping: 0.20
            )
        case .goldBar:
            return MaterialPhysicsSpec(
                mass: 1.85,
                restitution: 0.18,
                friction: 0.34,
                rollingFriction: 0.09,
                linearDamping: 0.06,
                angularDamping: 0.58
            )
        case .soccer:
            return MaterialPhysicsSpec(
                mass: 0.43,
                restitution: 0.54,
                friction: 0.44,
                rollingFriction: 0.032,
                linearDamping: 0.18,
                angularDamping: 0.24
            )
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

    private func syncDecalsToPresentation() {
        let count = min(dynamicNodes.count, decalNodes.count)
        guard count > 0 else { return }

        let baseAlpha: Float = currentTheme == .diamond ? 0.92 : 0.58
        for i in 0..<count {
            let p = dynamicNodes[i].presentation.position
            let decal = decalNodes[i]
            let floorDist = max(Float(0.0), p.z - currentObjectHalfZ)
            let contactFade = max(Float(0.08), 1.0 - floorDist * 0.90)
            let expand = 1.0 + floorDist * 0.35

            decal.position = SCNVector3(p.x + 0.045, p.y - 0.055, 0.008)
            if currentTheme == .goldBar {
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
    }

    private func rebuildObjects() {
        for node in dynamicNodes {
            node.removeFromParentNode()
        }
        for decal in decalNodes {
            decal.removeFromParentNode()
        }
        dynamicNodes.removeAll()
        decalNodes.removeAll()

        let floorPBR = ProceduralTextureGenerator.floorPBR(for: currentTheme)
        if currentTheme == .diamond {
            let velvetMat = activeVelvetMaterial ?? DiamondShader3D.makeVelvetFloorMaterial(pbr: floorPBR)
            activeVelvetMaterial = velvetMat
            floorNode.geometry?.materials = [velvetMat]
        } else {
            standardFloorMaterial.diffuse.contents = floorPBR.diffuse
            standardFloorMaterial.selfIllumination.contents = floorPBR.diffuse
            standardFloorMaterial.normal.contents = floorPBR.normal
            standardFloorMaterial.normal.intensity = currentTheme == .basketball ? 0.65 : 0.90
            standardFloorMaterial.roughness.contents = floorPBR.roughness
            standardFloorMaterial.metalness.contents = 0.04
            floorNode.geometry?.materials = [standardFloorMaterial]
        }
        baseFloorSelfIllumIntensity = currentTheme.showsLuxuryComplications ? 0.08 : 0.26

        let count = currentTheme.objectCount(for: currentDensity)
        let baseRadius: Float = currentDensity == .dense40 ? 0.24 : 0.36
        currentObjectHalfZ = baseRadius

        let sharedMaterial = makeMaterial(for: currentTheme, radius: baseRadius, floorDiffuse: floorPBR.diffuse)
        activeSharedMaterial = sharedMaterial

        let sharedGeometry: SCNGeometry
        let physicsShape: SCNPhysicsShape

        switch currentTheme {
        case .tennis:
            let sphereGeo = GeometryFactory3D.makeSculptedTennisBallGeometry(radius: baseRadius)
            sphereGeo.materials = [sharedMaterial]
            sharedGeometry = sphereGeo
            physicsShape = SCNPhysicsShape(geometry: SCNSphere(radius: CGFloat(baseRadius)), options: nil)
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
            let hx: Float = currentDensity == .dense40 ? 0.36 : 0.52
            let hy: Float = currentDensity == .dense40 ? 0.16 : 0.23
            let hz: Float = currentDensity == .dense40 ? 0.10 : 0.14
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

        let decalImage = currentTheme == .diamond
            ? ProceduralTextureGenerator.diamondCausticTexture()
            : ProceduralTextureGenerator.contactShadowTexture()

        let cols = currentTheme == .goldBar ? 3 : 4
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

            let spec = physicsSpec(for: currentTheme)
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

        syncDecalsToPresentation()
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
            mat.normal.intensity = 1.15
            mat.roughness.contents = ProceduralTextureGenerator.tennisBallRoughness()
            mat.metalness.contents = 0.0
        case .basketball:
            mat.diffuse.contents = ProceduralTextureGenerator.basketballDiffuse()
            mat.normal.contents = ProceduralTextureGenerator.basketballNormal()
            mat.normal.intensity = 1.25
            mat.roughness.contents = ProceduralTextureGenerator.basketballRoughness()
            mat.metalness.contents = 0.04
        case .soccer:
            mat.diffuse.contents = ProceduralTextureGenerator.soccerBallDiffuse()
            mat.normal.contents = ProceduralTextureGenerator.soccerBallNormal()
            mat.normal.intensity = 1.15
            mat.roughness.contents = ProceduralTextureGenerator.soccerBallRoughness()
            mat.metalness.contents = 0.05
            mat.clearCoat.contents = 0.35
            mat.clearCoatRoughness.contents = 0.25
        case .goldBar:
            mat.diffuse.contents = ProceduralTextureGenerator.goldPlateDiffuse()
            mat.normal.contents = ProceduralTextureGenerator.goldPlateNormal()
            mat.normal.intensity = 1.10
            mat.roughness.contents = ProceduralTextureGenerator.goldPlateRoughness()
            mat.metalness.contents = 0.99
        case .diamond:
            break
        }

        return mat
    }
}
