import Foundation
import SceneKit

enum GeometryFactory3D {
    private static func buildDisplacedSphere(
        radius: Float,
        rings: Int = 28,
        segments: Int = 40,
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
        let samples = 140
        for s in 0..<samples {
            let t = Float(s) / Float(samples) * Float.pi * 2.0
            seamPts.append((
                (cosf(t) + k * cosf(3 * t)) / norm,
                (sinf(t) - k * sinf(3 * t)) / norm,
                (cz * sinf(2 * t)) / norm
            ))
        }

        return buildDisplacedSphere(radius: radius) { nx, ny, nz in
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

    static func makeSculptedBasketballGeometry(radius: Float) -> SCNGeometry {
        buildDisplacedSphere(radius: radius) { nx, ny, nz in
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

        return buildDisplacedSphere(radius: radius) { nx, ny, nz in
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

        for ring in rings {
            for pt in ring.pts {
                vertices.append(SCNVector3(pt.0, pt.1, ring.z))
                texCoords.append(CGPoint(x: 0.04, y: 0.04))
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
        texCoords.append(CGPoint(x: 0.04, y: 0.04))

        let botStart = Int32(vertices.count)
        for pt in botRing.pts {
            vertices.append(SCNVector3(pt.0, pt.1, botRing.z))
            texCoords.append(CGPoint(x: 0.04, y: 0.04))
        }
        for i in 0..<ringLen {
            let next = Int32((i + 1) % ringLen)
            indices.append(contentsOf: [botCenter, botStart + next, botStart + Int32(i)])
        }

        // Compute smooth vertex normals
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
}
