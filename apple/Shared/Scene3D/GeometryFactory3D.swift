import Foundation
import SceneKit

enum GeometryFactory3D {
    private static func buildDisplacedSphere(
        radius: Float,
        rings: Int = 32,
        segments: Int = 44,
        radiusAtDirection: (Float, Float, Float) -> Float
    ) -> SCNGeometry {
        var vertices: [SCNVector3] = []
        var texCoords: [CGPoint] = []
        var gridIndices: [[Int32]] = []

        for y in 0...rings {
            let v = Float(y) / Float(rings)
            let lat = (0.5 - v) * Float.pi
            let cosLat = cosf(lat)
            let ny = sinf(lat)
            var row: [Int32] = []

            for x in 0...segments {
                let u = Float(x) / Float(segments)
                let lon = (u - 0.5) * Float.pi * 2.0
                let nx = cosLat * cosf(lon)
                let nz = cosLat * sinf(lon)

                let r = radiusAtDirection(nx, ny, nz)
                let idx = Int32(vertices.count)
                vertices.append(SCNVector3(nx * r, ny * r, nz * r))
                texCoords.append(CGPoint(x: CGFloat(u), y: CGFloat(v)))
                row.append(idx)
            }
            gridIndices.append(row)
        }

        var accumNormals = Array(repeating: SCNVector3(0, 0, 0), count: vertices.count)
        var indices: [Int32] = []

        func addFace(_ a: Int32, _ b: Int32, _ c: Int32) {
            indices.append(contentsOf: [a, b, c])
            let pa = vertices[Int(a)]
            let pb = vertices[Int(b)]
            let pc = vertices[Int(c)]
            let ux = pb.x - pa.x, uy = pb.y - pa.y, uz = pb.z - pa.z
            let vx = pc.x - pa.x, vy = pc.y - pa.y, vz = pc.z - pa.z
            let nx = uy * vz - uz * vy
            let ny = uz * vx - ux * vz
            let nz = ux * vy - uy * vx

            for idx in [Int(a), Int(b), Int(c)] {
                accumNormals[idx].x += nx
                accumNormals[idx].y += ny
                accumNormals[idx].z += nz
            }
        }

        for y in 0..<rings {
            for x in 0..<segments {
                let a = gridIndices[y][x]
                let b = gridIndices[y + 1][x]
                let c = gridIndices[y + 1][x + 1]
                let d = gridIndices[y][x + 1]
                if y > 0 { addFace(a, b, d) }
                if y < rings - 1 { addFace(b, c, d) }
            }
        }

        // Stitch horizontal UV wrap seam normals cleanly
        for y in 0...rings {
            let first = Int(gridIndices[y][0])
            let last = Int(gridIndices[y][segments])
            let sx = accumNormals[first].x + accumNormals[last].x
            let sy = accumNormals[first].y + accumNormals[last].y
            let sz = accumNormals[first].z + accumNormals[last].z
            accumNormals[first] = SCNVector3(sx, sy, sz)
            accumNormals[last] = SCNVector3(sx, sy, sz)
        }

        let normals = accumNormals.map { n -> SCNVector3 in
            let len = max(sqrtf(n.x * n.x + n.y * n.y + n.z * n.z), 0.0001)
            return SCNVector3(n.x / len, n.y / len, n.z / len)
        }

        let vSrc = SCNGeometrySource(vertices: vertices)
        let nSrc = SCNGeometrySource(normals: normals)
        let tSrc = SCNGeometrySource(textureCoordinates: texCoords)
        let elem = SCNGeometryElement(indices: indices, primitiveType: .triangles)
        return SCNGeometry(sources: [vSrc, nSrc, tSrc], elements: [elem])
    }

    static func makeSculptedTennisBallGeometry(radius: Float) -> SCNGeometry {
        let k: Float = 0.36
        let norm: Float = 1.0 + k
        let cz: Float = 2.0 * sqrtf(k)
        var seamPts: [(Float, Float, Float)] = []
        let samples = 160
        for s in 0..<samples {
            let t = Float(s) / Float(samples) * Float.pi * 2.0
            seamPts.append((
                (cosf(t) + k * cosf(3 * t)) / norm,
                (sinf(t) - k * sinf(3 * t)) / norm,
                (cz * sinf(2 * t)) / norm
            ))
        }

        return buildDisplacedSphere(radius: radius, rings: 30, segments: 44) { nx, ny, nz in
            var minD2: Float = 99.0
            for sp in seamPts {
                let dx = nx - sp.0, dy = ny - sp.1, dz = nz - sp.2
                let d2 = dx * dx + dy * dy + dz * dz
                if d2 < minD2 { minD2 = d2 }
            }
            if minD2 < 0.0036 {
                let t = max(0, 1.0 - minD2 / 0.0036)
                return radius * (1.0 - 0.025 * t * t)
            }
            return radius
        }
    }

    /// 4 concentric shell layers in a single SCNGeometry per tennis ball for delicate halo fuzz.
    static func makeTennisFuzzShellGeometry(
        radius: Float,
        layers: [Float] = [0.25, 0.50, 0.75, 1.00]
    ) -> SCNGeometry {
        let rings = 20
        let segments = 28

        var vertices: [SCNVector3] = []
        var normals: [SCNVector3] = []
        var texCoords: [CGPoint] = []
        var elements: [SCNGeometryElement] = []

        for layer in layers {
            let shellRadius = radius * (1.0 + 0.036 * layer)
            let baseVertexOffset = Int32(vertices.count)
            var gridIndices: [[Int32]] = []

            for y in 0...rings {
                let v = Float(y) / Float(rings)
                let lat = (0.5 - v) * Float.pi
                let cosLat = cosf(lat)
                let ny = sinf(lat)
                var row: [Int32] = []

                for x in 0...segments {
                    let u = Float(x) / Float(segments)
                    let lon = (u - 0.5) * Float.pi * 2.0
                    let nx = cosLat * cosf(lon)
                    let nz = cosLat * sinf(lon)

                    let idx = Int32(vertices.count)
                    vertices.append(SCNVector3(nx * shellRadius, ny * shellRadius, nz * shellRadius))
                    normals.append(SCNVector3(nx, ny, nz))
                    texCoords.append(CGPoint(x: CGFloat(u), y: CGFloat(v)))
                    row.append(idx)
                }
                gridIndices.append(row)
            }

            var layerIndices: [Int32] = []
            for y in 0..<rings {
                for x in 0..<segments {
                    let a = gridIndices[y][x]
                    let b = gridIndices[y + 1][x]
                    let c = gridIndices[y + 1][x + 1]
                    let d = gridIndices[y][x + 1]
                    if y > 0 {
                        layerIndices.append(contentsOf: [a, b, d])
                    }
                    if y < rings - 1 {
                        layerIndices.append(contentsOf: [b, c, d])
                    }
                }
            }
            _ = baseVertexOffset
            elements.append(SCNGeometryElement(indices: layerIndices, primitiveType: .triangles))
        }

        return SCNGeometry(
            sources: [
                SCNGeometrySource(vertices: vertices),
                SCNGeometrySource(normals: normals),
                SCNGeometrySource(textureCoordinates: texCoords)
            ],
            elements: elements
        )
    }

    static func makeSculptedBasketballGeometry(radius: Float) -> SCNGeometry {
        buildDisplacedSphere(radius: radius, rings: 30, segments: 44) { nx, ny, nz in
            let dEq = abs(ny)
            let dMer = abs(nz)
            let dSide = abs(ny) < 0.9 ? abs(abs(nx) - (0.58 - 0.25 * ny * ny)) : 99.0
            let channelDist = min(dEq, min(dMer, dSide))
            if channelDist < 0.05 {
                let t = max(0, 1.0 - channelDist / 0.05)
                return radius * (1.0 - 0.028 * t * t)
            }
            return radius
        }
    }

    static func makeSculptedSoccerBallGeometry(radius: Float) -> SCNGeometry {
        let phi: Float = (1.0 + sqrtf(5.0)) * 0.5
        let rawV: [(Float, Float, Float)] = [
            (0, 1, phi), (0, -1, phi), (0, 1, -phi), (0, -1, -phi),
            (1, phi, 0), (-1, phi, 0), (1, -phi, 0), (-1, -phi, 0),
            (phi, 0, 1), (-phi, 0, 1), (phi, 0, -1), (-phi, 0, -1)
        ]
        let verts = rawV.map { v -> (Float, Float, Float) in
            let l = sqrtf(v.0 * v.0 + v.1 * v.1 + v.2 * v.2)
            return (v.0 / l, v.1 / l, v.2 / l)
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

        // High-precision 36x52 spherical mesh matching Web v16 panel pillowing
        return buildDisplacedSphere(radius: radius, rings: 36, segments: 52) { nx, ny, nz in
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
            let edgeDist = pentGap > 0 ? abs(pentGap) : min(abs(pentGap), bestF - secondF)
            let cushion = min(1.0, edgeDist / 0.055)
            return radius * (0.974 + 0.042 * sqrtf(cushion))
        }
    }

    private static func sampleRoundedRectLoop(
        rx: Float,
        ry: Float,
        cornerR: Float,
        segsPerCorner: Int
    ) -> [(Float, Float)] {
        let cr = min(cornerR, min(rx * 0.48, ry * 0.48))
        let ix = rx - cr
        let iy = ry - cr
        var pts: [(Float, Float)] = []
        let corners: [(Float, Float, Float)] = [
            (ix, iy, 0),
            (-ix, iy, Float.pi * 0.5),
            (-ix, -iy, Float.pi),
            (ix, -iy, Float.pi * 1.5)
        ]
        for corner in corners {
            for s in 0...segsPerCorner {
                let a = corner.2 + Float(s) / Float(segsPerCorner) * (Float.pi * 0.5)
                pts.append((corner.0 + cosf(a) * cr, corner.1 + sinf(a) * cr))
            }
        }
        return pts
    }

    static func makeGoldBullionGeometry(halfX: Float, halfY: Float, halfZ: Float) -> SCNGeometry {
        let profiles: [(z: Float, sx: Float, sy: Float, cr: Float)] = [
            (-halfZ, 0.96, 0.94, 0.045),
            (-halfZ * 0.72, 1.0, 1.0, 0.055),
            (halfZ * 0.58, 0.85, 0.79, 0.05),
            (halfZ * 0.88, 0.81, 0.74, 0.045),
            (halfZ, 0.77, 0.69, 0.04)
        ]

        let rings = profiles.map { p in
            (z: p.z, pts: sampleRoundedRectLoop(rx: halfX * p.sx, ry: halfY * p.sy, cornerR: p.cr, segsPerCorner: 4))
        }
        let ringLen = rings[0].pts.count

        var vertices: [SCNVector3] = []
        var texCoords: [CGPoint] = []
        var indices: [Int32] = []

        for rIdx in 0..<rings.count {
            let ring = rings[rIdx]
            let borderV = 0.012 + (Float(rIdx) / Float(max(1, rings.count - 1))) * 0.036
            for i in 0..<ringLen {
                let pt = ring.pts[i]
                let borderU = 0.012 + (Float(i) / Float(ringLen)) * 0.036
                vertices.append(SCNVector3(pt.0, pt.1, ring.z))
                texCoords.append(CGPoint(x: CGFloat(borderU), y: CGFloat(borderV)))
            }
        }

        for r in 0..<(rings.count - 1) {
            let rowA = Int32(r * ringLen)
            let rowB = Int32((r + 1) * ringLen)
            for i in 0..<ringLen {
                let next = Int32((i + 1) % ringLen)
                let ii = Int32(i)
                indices.append(contentsOf: [rowA + ii, rowA + next, rowB + next, rowA + ii, rowB + next, rowB + ii])
            }
        }

        // Top stamped plateau
        let topRing = rings[rings.count - 1]
        let topCenter = Int32(vertices.count)
        vertices.append(SCNVector3(0, 0, topRing.z))
        texCoords.append(CGPoint(x: 0.5, y: 0.5))

        let topTx = halfX * 0.77
        let topTy = halfY * 0.69
        let topStart = Int32(vertices.count)
        for pt in topRing.pts {
            vertices.append(SCNVector3(pt.0, pt.1, topRing.z))
            texCoords.append(CGPoint(x: CGFloat((pt.0 / (topTx * 2.0)) + 0.5), y: CGFloat(0.5 - (pt.1 / (topTy * 2.0)))))
        }
        for i in 0..<ringLen {
            let next = Int32((i + 1) % ringLen)
            indices.append(contentsOf: [topCenter, topStart + Int32(i), topStart + next])
        }

        // Bottom cap
        let botRing = rings[0]
        let botCenter = Int32(vertices.count)
        vertices.append(SCNVector3(0, 0, botRing.z))
        texCoords.append(CGPoint(x: 0.03, y: 0.03))

        let botStart = Int32(vertices.count)
        for pt in botRing.pts {
            vertices.append(SCNVector3(pt.0, pt.1, botRing.z))
            texCoords.append(CGPoint(x: 0.03, y: 0.012))
        }
        for i in 0..<ringLen {
            let next = Int32((i + 1) % ringLen)
            indices.append(contentsOf: [botCenter, botStart + next, botStart + Int32(i)])
        }

        var accumNormals = Array(repeating: SCNVector3(0, 0, 0), count: vertices.count)
        for t in stride(from: 0, to: indices.count, by: 3) {
            let ia = Int(indices[t]), ib = Int(indices[t + 1]), ic = Int(indices[t + 2])
            let pa = vertices[ia], pb = vertices[ib], pc = vertices[ic]
            let ux = pb.x - pa.x, uy = pb.y - pa.y, uz = pb.z - pa.z
            let vx = pc.x - pa.x, vy = pc.y - pa.y, vz = pc.z - pa.z
            let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
            for k in [ia, ib, ic] {
                accumNormals[k].x += nx
                accumNormals[k].y += ny
                accumNormals[k].z += nz
            }
        }
        let normals = accumNormals.map { n -> SCNVector3 in
            let len = max(sqrtf(n.x * n.x + n.y * n.y + n.z * n.z), 0.0001)
            return SCNVector3(n.x / len, n.y / len, n.z / len)
        }

        return SCNGeometry(
            sources: [
                SCNGeometrySource(vertices: vertices),
                SCNGeometrySource(normals: normals),
                SCNGeometrySource(textureCoordinates: texCoords)
            ],
            elements: [SCNGeometryElement(indices: indices, primitiveType: .triangles)]
        )
    }

    static func makeDiamondGeometry(radius: Float) -> SCNGeometry {
        // 57-facet GIA Round Brilliant-Cut gemstone (34.5 deg crown, 40.75 deg pavilion)
        let tableR = radius * 0.55
        let starR = radius * 0.78
        let girdleR = radius * 1.00

        let crownZ = radius * 0.50
        let starZ = radius * 0.36
        let girdleTopZ = radius * 0.13
        let girdleBotZ = radius * 0.07
        let pavLowerZ = -radius * 0.31
        let culetZ = -radius * 0.76

        let tableCenter = SCNVector3(0, 0, crownZ)
        let culet = SCNVector3(0, 0, culetZ)

        var tPts: [SCNVector3] = []
        var sPts: [SCNVector3] = []
        var gTop: [SCNVector3] = []
        var gBot: [SCNVector3] = []
        var pavMid: [SCNVector3] = []

        for i in 0..<8 {
            let a = Float(i) / 8.0 * Float.pi * 2.0
            let aMid = (Float(i) + 0.5) / 8.0 * Float.pi * 2.0
            tPts.append(SCNVector3(cosf(a) * tableR, sinf(a) * tableR, crownZ))
            sPts.append(SCNVector3(cosf(aMid) * starR, sinf(aMid) * starR, starZ))
            pavMid.append(SCNVector3(cosf(aMid) * radius * 0.53, sinf(aMid) * radius * 0.53, pavLowerZ))
        }
        for k in 0..<16 {
            let ak = Float(k) / 16.0 * Float.pi * 2.0
            gTop.append(SCNVector3(cosf(ak) * girdleR, sinf(ak) * girdleR, girdleTopZ))
            gBot.append(SCNVector3(cosf(ak) * girdleR, sinf(ak) * girdleR, girdleBotZ))
        }

        var vertices: [SCNVector3] = []
        var normals: [SCNVector3] = []

        func appendTriangle(_ a: SCNVector3, _ b: SCNVector3, _ c: SCNVector3) {
            let ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z
            let vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z
            let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
            let len = max(sqrtf(nx * nx + ny * ny + nz * nz), 0.0001)
            let normal = SCNVector3(nx / len, ny / len, nz / len)
            vertices.append(contentsOf: [a, b, c])
            normals.append(contentsOf: [normal, normal, normal])
        }

        for i in 0..<8 {
            let next = (i + 1) % 8
            let k0 = i * 2
            let k1 = (i * 2 + 1) % 16
            let k2 = (i * 2 + 2) % 16

            appendTriangle(tableCenter, tPts[i], tPts[next])
            appendTriangle(tPts[i], sPts[i], tPts[next])
            appendTriangle(tPts[i], gTop[k0], sPts[i])
            appendTriangle(sPts[i], gTop[k0], gTop[k1])
            appendTriangle(tPts[next], sPts[i], gTop[k2])
            appendTriangle(sPts[i], gTop[k1], gTop[k2])

            appendTriangle(gTop[k0], gBot[k0], gBot[k1])
            appendTriangle(gTop[k0], gBot[k1], gTop[k1])
            appendTriangle(gTop[k1], gBot[k1], gBot[k2])
            appendTriangle(gTop[k1], gBot[k2], gTop[k2])

            appendTriangle(gBot[k0], pavMid[i], gBot[k1])
            appendTriangle(gBot[k1], pavMid[i], gBot[k2])
            appendTriangle(gBot[k0], culet, pavMid[i])
            appendTriangle(pavMid[i], culet, gBot[k2])
        }

        let indices: [Int32] = (0..<Int32(vertices.count)).map { $0 }
        return SCNGeometry(
            sources: [SCNGeometrySource(vertices: vertices), SCNGeometrySource(normals: normals)],
            elements: [SCNGeometryElement(indices: indices, primitiveType: .triangles)]
        )
    }

    /// Single merged SCNGeometry of manicured 25mm squircle-culled grass blades (3 triangles each).
    /// Encodes height fraction t in texcoord.x, packed blade phase in texcoord.y, and chlorophyll RGBA in .color.
    static func makeManicuredGrassFieldGeometry(bladeCount: Int) -> SCNGeometry {
        let cols = 86
        let rows = 102
        let spanX: Float = 4.66
        let spanY: Float = 5.56
        let stepX = spanX / Float(cols)
        let stepY = spanY / Float(rows)

        // Squircle cavity visibility bounds
        let cullHx: Float = 2.28
        let cullHy: Float = 2.72
        let cullCr: Float = 0.80

        var seed: UInt32 = 1337421
        func rand() -> Float {
            seed = seed &* 1664525 &+ 1013904223
            return Float(seed) / Float(UInt32.max)
        }

        struct BladeSpec {
            let rx: Float
            let ry: Float
            let h: Float
            let w: Float
            let yaw: Float
            let bend: Float
            let colorVar: Float
            let phase: Float
        }

        var candidates: [BladeSpec] = []
        candidates.reserveCapacity(cols * rows)

        for r in 0..<rows {
            for c in 0..<cols {
                let rx = -spanX * 0.5 + (Float(c) + 0.5) * stepX + (rand() - 0.5) * stepX * 0.94
                let ry = -spanY * 0.5 + (Float(r) + 0.5) * stepY + (rand() - 0.5) * stepY * 0.94

                let qx = abs(rx) - (cullHx - cullCr)
                let qy = abs(ry) - (cullHy - cullCr)
                let sdf = hypotf(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - cullCr
                if sdf > 0.0 { continue }

                let clump = 0.5 + 0.5 * sinf(rx * 5.8 + cosf(ry * 4.7)) * cosf(ry * 6.2 - rx * 3.9)
                let bladeH: Float = 0.068 + rand() * 0.036 + clump * 0.012
                let bladeW: Float = 0.030 + rand() * 0.014
                let yaw: Float = rand() * Float.pi * 2.0
                let bend: Float = 0.28 + rand() * 0.34
                let colorVar = rand() * 0.72 + clump * 0.28
                let phase = rand()
                candidates.append(BladeSpec(rx: rx, ry: ry, h: bladeH, w: bladeW, yaw: yaw, bend: bend, colorVar: colorVar, phase: phase))
            }
        }

        // Deterministic Fisher-Yates shuffle for even spatial coverage at any budget
        if candidates.count > 1 {
            for i in stride(from: candidates.count - 1, through: 1, by: -1) {
                let j = Int(rand() * Float(i + 1)) % (i + 1)
                if i != j { candidates.swapAt(i, j) }
            }
        }

        let targetCount = min(bladeCount, candidates.count)
        var vertices: [SCNVector3] = []
        var normals: [SCNVector3] = []
        var texCoords: [CGPoint] = []
        var colorFloats: [Float] = []
        var indices: [Int32] = []

        vertices.reserveCapacity(targetCount * 5)
        normals.reserveCapacity(targetCount * 5)
        texCoords.reserveCapacity(targetCount * 5)
        colorFloats.reserveCapacity(targetCount * 5 * 4)
        indices.reserveCapacity(targetCount * 9)

        for i in 0..<targetCount {
            let b = candidates[i]
            let pitchUvY = b.ry / 7.32 + 0.5
            let stripeIdx = floorf((1.0 - pitchUvY) * 14.0)
            let stripeMod: Float = (Int(stripeIdx) & 1) == 0 ? 1.13 : 0.87

            let yawDirX = cosf(b.yaw)
            let yawDirY = sinf(b.yaw)
            let mowerSign: Float = (Int(stripeIdx) & 1) == 0 ? 1.0 : -1.0
            let leanX = (yawDirX * 0.24) * b.bend
            let leanY = (yawDirY * 0.24 + mowerSign * 0.40) * b.bend
            let bendLen = max(0.0001, hypotf(leanX, leanY))
            let bendDirX = leanX / bendLen
            let bendDirY = leanY / bendLen
            let bendAngle = min(1.35, bendLen * 1.05)

            let sideDirX = -bendDirY
            let sideDirY = bendDirX

            // Lush emerald chlorophyll palette (matching pristine_v16 GrassShader)
            let rootR: Float = 0.022, rootG: Float = 0.068, rootB: Float = 0.010
            let midR = 0.058 + (0.112 - 0.058) * b.colorVar
            let midG = 0.195 + (0.280 - 0.195) * b.colorVar
            let midB = 0.020 + (0.030 - 0.020) * b.colorVar
            let tipR = 0.140 + (0.245 - 0.140) * b.colorVar
            let tipG = 0.340 + (0.410 - 0.340) * b.colorVar
            let tipB = 0.034 + (0.054 - 0.034) * b.colorVar

            let baseVertex = Int32(vertices.count)
            let heights: [Float] = [0.0, 0.0, 0.5, 0.5, 1.0]
            let sides: [Float] = [-1.0, 1.0, -1.0, 1.0, 0.0]

            for k in 0..<5 {
                let t = heights[k]
                let s = sides[k]
                let theta = bendAngle * (0.30 * t + 0.70 * t * t)
                let horiz = b.h * (t * sinf(theta) * 0.96)
                let vertZ = max(0.002, b.h * (t * cosf(theta * 0.88)))
                let wHalf = b.w * (1.0 - powf(t, 1.35) * 0.88)

                let px = b.rx + bendDirX * horiz + sideDirX * (s * wHalf)
                let py = b.ry + bendDirY * horiz + sideDirY * (s * wHalf)
                vertices.append(SCNVector3(px, py, vertZ))

                let nx = -bendDirX * sinf(theta) + sideDirX * (s * 0.28)
                let ny = -bendDirY * sinf(theta) + sideDirY * (s * 0.28)
                let nz = max(0.32, cosf(theta))
                let nInv = 1.0 / hypotf(nx, hypotf(ny, nz))
                normals.append(SCNVector3(nx * nInv, ny * nInv, nz * nInv))

                texCoords.append(CGPoint(x: CGFloat(t), y: CGFloat(b.phase)))

                let (rCol, gCol, bCol): (Float, Float, Float)
                if t < 0.1 {
                    (rCol, gCol, bCol) = (rootR, rootG, rootB)
                } else if t < 0.75 {
                    (rCol, gCol, bCol) = (midR, midG, midB)
                } else {
                    (rCol, gCol, bCol) = (tipR, tipG, tipB)
                }
                let rootAO: Float = 0.38 + 0.62 * sqrtf(max(0.04, t))
                let shade = stripeMod * rootAO
                colorFloats.append(rCol * shade)
                colorFloats.append(gCol * shade)
                colorFloats.append(bCol * shade)
                colorFloats.append(1.0)
            }

            indices.append(contentsOf: [
                baseVertex + 0, baseVertex + 1, baseVertex + 3,
                baseVertex + 0, baseVertex + 3, baseVertex + 2,
                baseVertex + 2, baseVertex + 3, baseVertex + 4
            ])
        }

        let colorData = colorFloats.withUnsafeBytes { Data($0) }
        let colorSrc = SCNGeometrySource(
            data: colorData,
            semantic: .color,
            vectorCount: vertices.count,
            usesFloatComponents: true,
            componentsPerVector: 4,
            bytesPerComponent: MemoryLayout<Float>.size,
            dataOffset: 0,
            dataStride: MemoryLayout<Float>.size * 4
        )

        return SCNGeometry(
            sources: [
                SCNGeometrySource(vertices: vertices),
                SCNGeometrySource(normals: normals),
                SCNGeometrySource(textureCoordinates: texCoords),
                colorSrc
            ],
            elements: [SCNGeometryElement(indices: indices, primitiveType: .triangles)]
        )
    }
}
