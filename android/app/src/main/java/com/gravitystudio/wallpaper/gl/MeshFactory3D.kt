package com.gravitystudio.wallpaper.gl

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Generates interleaved vertex (pos3 + norm3 + uv2 = 8 floats) & short index buffers
 * for studio spheres, 57-facet GIA diamonds, chamfered gold ingots, cyber chips, and floor planes.
 */
object MeshFactory3D {

    class MeshData(
        val vertices: FloatArray,
        val indices: ShortArray
    ) {
        val indexCount: Int get() = indices.size
    }

    fun createUnitSphere(rings: Int = 28, segments: Int = 40): MeshData {
        val verts = ArrayList<Float>((rings + 1) * (segments + 1) * 8)
        val inds = ArrayList<Short>(rings * segments * 6)

        for (y in 0..rings) {
            val v = y.toFloat() / rings
            val lat = (0.5f - v) * PI.toFloat()
            val cosLat = cos(lat)
            val ny = sin(lat)
            for (x in 0..segments) {
                val u = x.toFloat() / segments
                val lon = (u - 0.5f) * PI.toFloat() * 2f
                val nx = cosLat * cos(lon)
                val nz = cosLat * sin(lon)

                verts += nx; verts += ny; verts += nz
                verts += nx; verts += ny; verts += nz
                verts += u; verts += v
            }
        }

        val stride = segments + 1
        for (y in 0 until rings) {
            for (x in 0 until segments) {
                val a = y * stride + x
                val b = (y + 1) * stride + x
                val c = (y + 1) * stride + x + 1
                val d = y * stride + x + 1
                if (y > 0) {
                    inds += a.toShort(); inds += b.toShort(); inds += d.toShort()
                }
                if (y < rings - 1) {
                    inds += b.toShort(); inds += c.toShort(); inds += d.toShort()
                }
            }
        }

        return MeshData(verts.toFloatArray(), inds.toShortArray())
    }

    /**
     * 57-facet GIA Round Brilliant Cut diamond aligned cleanly with internal raytracer convex hull.
     */
    fun createDiamondMesh(radius: Float): MeshData {
        val tableR = radius * 0.55f
        val starR = radius * 0.78f
        val girdleR = radius * 1.00f

        val crownZ = radius * 0.50f
        val starZ = radius * 0.36f
        val girdleTopZ = radius * 0.13f
        val girdleBotZ = radius * 0.07f
        val pavLowerZ = -radius * 0.31f
        val culetZ = -radius * 0.76f

        val tableCenter = floatArrayOf(0f, 0f, crownZ)
        val culet = floatArrayOf(0f, 0f, culetZ)

        val tPts = Array(8) { i ->
            val a = i / 8f * PI.toFloat() * 2f
            floatArrayOf(cos(a) * tableR, sin(a) * tableR, crownZ)
        }
        val sPts = Array(8) { i ->
            val a = (i + 0.5f) / 8f * PI.toFloat() * 2f
            floatArrayOf(cos(a) * starR, sin(a) * starR, starZ)
        }
        val pavMid = Array(8) { i ->
            val a = (i + 0.5f) / 8f * PI.toFloat() * 2f
            floatArrayOf(cos(a) * radius * 0.53f, sin(a) * radius * 0.53f, pavLowerZ)
        }
        val gTop = Array(16) { k ->
            val a = k / 16f * PI.toFloat() * 2f
            floatArrayOf(cos(a) * girdleR, sin(a) * girdleR, girdleTopZ)
        }
        val gBot = Array(16) { k ->
            val a = k / 16f * PI.toFloat() * 2f
            floatArrayOf(cos(a) * girdleR, sin(a) * girdleR, girdleBotZ)
        }

        val verts = ArrayList<Float>(360 * 8)
        val inds = ArrayList<Short>(360)

        fun addTri(a: FloatArray, b: FloatArray, c: FloatArray) {
            val ux = b[0] - a[0]; val uy = b[1] - a[1]; val uz = b[2] - a[2]
            val vx = c[0] - a[0]; val vy = c[1] - a[1]; val vz = c[2] - a[2]
            val nx = uy * vz - uz * vy
            val ny = uz * vx - ux * vz
            val nz = ux * vy - uy * vx
            val len = maxOf(0.0001f, sqrt(nx * nx + ny * ny + nz * nz))
            val nnx = nx / len; val nny = ny / len; val nnz = nz / len
            val baseIdx = (verts.size / 8).toShort()
            for (p in arrayOf(a, b, c)) {
                verts += p[0]; verts += p[1]; verts += p[2]
                verts += nnx; verts += nny; verts += nnz
                verts += (p[0] / (2f * radius) + 0.5f); verts += (p[1] / (2f * radius) + 0.5f)
            }
            inds += baseIdx
            inds += (baseIdx + 1).toShort()
            inds += (baseIdx + 2).toShort()
        }

        for (i in 0 until 8) {
            val next = (i + 1) % 8
            val k0 = i * 2
            val k1 = (i * 2 + 1) % 16
            val k2 = (i * 2 + 2) % 16

            addTri(tableCenter, tPts[i], tPts[next])
            addTri(tPts[i], sPts[i], tPts[next])
            addTri(tPts[i], gTop[k0], sPts[i])
            addTri(sPts[i], gTop[k0], gTop[k1])
            addTri(tPts[next], sPts[i], gTop[k2])
            addTri(sPts[i], gTop[k1], gTop[k2])

            addTri(gTop[k0], gBot[k0], gBot[k1])
            addTri(gTop[k0], gBot[k1], gTop[k1])
            addTri(gTop[k1], gBot[k1], gBot[k2])
            addTri(gTop[k1], gBot[k2], gTop[k2])

            addTri(gBot[k0], pavMid[i], gBot[k1])
            addTri(gBot[k1], pavMid[i], gBot[k2])
            addTri(gBot[k0], culet, pavMid[i])
            addTri(pavMid[i], culet, gBot[k2])
        }

        return MeshData(verts.toFloatArray(), inds.toShortArray())
    }

    fun createGoldBullionMesh(halfX: Float, halfY: Float, halfZ: Float): MeshData {
        val profiles = arrayOf(
            floatArrayOf(-halfZ, 0.96f, 0.94f, 0.045f),
            floatArrayOf(-halfZ * 0.72f, 1.00f, 1.00f, 0.055f),
            floatArrayOf(halfZ * 0.58f, 0.85f, 0.79f, 0.050f),
            floatArrayOf(halfZ * 0.88f, 0.81f, 0.74f, 0.045f),
            floatArrayOf(halfZ, 0.77f, 0.69f, 0.040f)
        )
        return buildBeveledLoftedPrism(halfX, halfY, profiles)
    }

    fun createCyberModuleMesh(halfX: Float, halfY: Float, halfZ: Float): MeshData {
        val profiles = arrayOf(
            floatArrayOf(-halfZ, 0.92f, 0.92f, 0.06f),
            floatArrayOf(-halfZ * 0.55f, 1.00f, 1.00f, 0.07f),
            floatArrayOf(halfZ * 0.55f, 1.00f, 1.00f, 0.07f),
            floatArrayOf(halfZ, 0.86f, 0.86f, 0.05f)
        )
        return buildBeveledLoftedPrism(halfX, halfY, profiles)
    }

    fun createPlaneMesh(width: Float, height: Float): MeshData {
        val hw = width * 0.5f
        val hh = height * 0.5f
        val verts = floatArrayOf(
            -hw, -hh, 0f,  0f, 0f, 1f,  0f, 1f,
             hw, -hh, 0f,  0f, 0f, 1f,  1f, 1f,
             hw,  hh, 0f,  0f, 0f, 1f,  1f, 0f,
            -hw,  hh, 0f,  0f, 0f, 1f,  0f, 0f
        )
        val inds = shortArrayOf(0, 1, 2, 0, 2, 3)
        return MeshData(verts, inds)
    }

    private fun sampleRoundedRectLoop(rx: Float, ry: Float, cornerR: Float, segsPerCorner: Int = 4): List<FloatArray> {
        val cr = min(cornerR, min(rx * 0.48f, ry * 0.48f))
        val ix = rx - cr
        val iy = ry - cr
        val pts = ArrayList<FloatArray>((segsPerCorner + 1) * 4)
        val corners = arrayOf(
            floatArrayOf(ix, iy, 0f),
            floatArrayOf(-ix, iy, PI.toFloat() * 0.5f),
            floatArrayOf(-ix, -iy, PI.toFloat()),
            floatArrayOf(ix, -iy, PI.toFloat() * 1.5f)
        )
        for (c in corners) {
            for (s in 0..segsPerCorner) {
                val a = c[2] + s.toFloat() / segsPerCorner * (PI.toFloat() * 0.5f)
                pts += floatArrayOf(c[0] + cos(a) * cr, c[1] + sin(a) * cr)
            }
        }
        return pts
    }

    private fun buildBeveledLoftedPrism(halfX: Float, halfY: Float, profiles: Array<FloatArray>): MeshData {
        val rings = profiles.map { p ->
            p[0] to sampleRoundedRectLoop(halfX * p[1], halfY * p[2], p[3])
        }
        val ringLen = rings[0].second.size
        val positions = ArrayList<FloatArray>()
        val uvs = ArrayList<FloatArray>()
        val indices = ArrayList<Int>()

        for ((rIdx, ring) in rings.withIndex()) {
            val z = ring.first
            val bv = 0.02f + (rIdx.toFloat() / maxOf(1, rings.size - 1)) * 0.04f
            for ((i, pt) in ring.second.withIndex()) {
                val bu = 0.02f + (i.toFloat() / ringLen) * 0.04f
                positions += floatArrayOf(pt[0], pt[1], z)
                uvs += floatArrayOf(bu, bv)
            }
        }

        for (r in 0 until (rings.size - 1)) {
            val rowA = r * ringLen
            val rowB = (r + 1) * ringLen
            for (i in 0 until ringLen) {
                val next = (i + 1) % ringLen
                indices += rowA + i; indices += rowA + next; indices += rowB + next
                indices += rowA + i; indices += rowB + next; indices += rowB + i
            }
        }

        // Top plateau
        val topRing = rings.last()
        val topCenter = positions.size
        positions += floatArrayOf(0f, 0f, topRing.first)
        uvs += floatArrayOf(0.5f, 0.5f)
        val topTx = maxOf(0.05f, halfX * 0.78f)
        val topTy = maxOf(0.05f, halfY * 0.72f)
        val topStart = positions.size
        for (pt in topRing.second) {
            positions += floatArrayOf(pt[0], pt[1], topRing.first)
            uvs += floatArrayOf(pt[0] / (topTx * 2f) + 0.5f, 0.5f - pt[1] / (topTy * 2f))
        }
        for (i in 0 until ringLen) {
            val next = (i + 1) % ringLen
            indices += topCenter; indices += topStart + i; indices += topStart + next
        }

        // Bottom cap
        val botRing = rings.first()
        val botCenter = positions.size
        positions += floatArrayOf(0f, 0f, botRing.first)
        uvs += floatArrayOf(0.03f, 0.03f)
        val botStart = positions.size
        for (pt in botRing.second) {
            positions += floatArrayOf(pt[0], pt[1], botRing.first)
            uvs += floatArrayOf(0.03f, 0.015f)
        }
        for (i in 0 until ringLen) {
            val next = (i + 1) % ringLen
            indices += botCenter; indices += botStart + next; indices += botStart + i
        }

        val accumNormals = Array(positions.size) { floatArrayOf(0f, 0f, 0f) }
        for (t in 0 until indices.size step 3) {
            val ia = indices[t]; val ib = indices[t + 1]; val ic = indices[t + 2]
            val pa = positions[ia]; val pb = positions[ib]; val pc = positions[ic]
            val ux = pb[0] - pa[0]; val uy = pb[1] - pa[1]; val uz = pb[2] - pa[2]
            val vx = pc[0] - pa[0]; val vy = pc[1] - pa[1]; val vz = pc[2] - pa[2]
            val nx = uy * vz - uz * vy
            val ny = uz * vx - ux * vz
            val nz = ux * vy - uy * vx
            for (k in intArrayOf(ia, ib, ic)) {
                accumNormals[k][0] += nx
                accumNormals[k][1] += ny
                accumNormals[k][2] += nz
            }
        }

        val verts = FloatArray(positions.size * 8)
        for (i in positions.indices) {
            val p = positions[i]
            val n = accumNormals[i]
            val nLen = maxOf(0.0001f, sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]))
            val uv = uvs[i]
            val off = i * 8
            verts[off + 0] = p[0]; verts[off + 1] = p[1]; verts[off + 2] = p[2]
            verts[off + 3] = n[0] / nLen; verts[off + 4] = n[1] / nLen; verts[off + 5] = n[2] / nLen
            verts[off + 6] = uv[0]; verts[off + 7] = uv[1]
        }

        return MeshData(verts, indices.map { it.toShort() }.toShortArray())
    }
}
