package com.gravitystudio.wallpaper.physics

import com.gravitystudio.wallpaper.model.DensityPreset
import com.gravitystudio.wallpaper.model.WallpaperTheme
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * Pure Kotlin 3D rigid body simulator (zero Android dependencies for fast JVM unit testing).
 * Handles fixed-timestep sub-stepping, wall/corner-bevel containment, pairwise collisions,
 * rotational rolling inertia, and shake impulses inside the watch/phone 3D cavity.
 */
class PhysicsWorld3D {

    data class Body3D(
        var x: Float,
        var y: Float,
        var z: Float,
        var vx: Float = 0f,
        var vy: Float = 0f,
        var vz: Float = 0f,
        var qx: Float = 0f,
        var qy: Float = 0f,
        var qz: Float = 0f,
        var qw: Float = 1f,
        var wx: Float = 0f,
        var wy: Float = 0f,
        var wz: Float = 0f,
        val radius: Float,
        val halfZ: Float,
        val mass: Float,
        val restitution: Float,
        val friction: Float,
        val linearDamping: Float,
        val angularDamping: Float,
        val halfX: Float = radius,
        val halfY: Float = radius
    )

    data class ThemePhysicsProfile(
        val mass: Float,
        val restitution: Float,
        val friction: Float,
        val linearDamping: Float,
        val angularDamping: Float
    )

    val bodies = mutableListOf<Body3D>()

    var halfWidth: Float = 2.0f
        private set
    var halfHeight: Float = 3.55f
        private set
    var cavityDepth: Float = 1.24f
        private set

    var gravityX: Float = 0f
        private set
    var gravityY: Float = -11.5f
        private set
    var gravityZ: Float = -8.2f
        private set

    private var goldScale: Float = 1.0f

    fun updateBounds(aspectRatio: Float) {
        val safeAspect = aspectRatio.coerceIn(0.40f, 2.20f)
        halfWidth = 2.0f
        halfHeight = max(2.15f, 2.0f / safeAspect)
    }

    fun setGravity(nx: Float, ny: Float, nz: Float) {
        val len = max(0.001f, sqrt(nx * nx + ny * ny + nz * nz))
        val gMag = 14.5f
        gravityX = (nx / len) * gMag
        gravityY = (ny / len) * gMag
        gravityZ = (nz / len) * gMag
    }

    fun rebuild(
        theme: WallpaperTheme,
        density: DensityPreset,
        restitutionScale: Float,
        seed: Int = 20261122
    ) {
        bodies.clear()
        val rng = Random(seed)
        val count = theme.objectCount(density)
        val profile = profileFor(theme, restitutionScale)

        val baseRadius = when (density) {
            DensityPreset.LITE -> 0.42f
            DensityPreset.CINEMATIC -> 0.36f
            DensityPreset.DENSE -> 0.25f
        }

        val scale = when {
            density == DensityPreset.DENSE -> 0.74f
            density == DensityPreset.LITE -> 1.08f
            else -> 1.00f
        }
        goldScale = scale

        val (objRadius, objHalfX, objHalfY, objHalfZ) = when (theme) {
            WallpaperTheme.GOLD_BAR -> {
                val hx = 0.52f * scale
                val hy = 0.23f * scale
                val hz = 0.14f * scale
                QuadSize(radius = 0.46f * scale, hx = hx, hy = hy, hz = hz)
            }
            WallpaperTheme.CYBER_CIRCUIT -> {
                val hx = 0.34f * scale
                val hy = 0.34f * scale
                val hz = 0.13f * scale
                QuadSize(radius = 0.41f * scale, hx = hx, hy = hy, hz = hz)
            }
            WallpaperTheme.DIAMOND -> {
                QuadSize(radius = baseRadius * 0.96f, hx = baseRadius, hy = baseRadius, hz = baseRadius * 0.72f)
            }
            else -> QuadSize(radius = baseRadius, hx = baseRadius, hy = baseRadius, hz = baseRadius)
        }

        val cols = if (theme == WallpaperTheme.GOLD_BAR || theme == WallpaperTheme.CYBER_CIRCUIT) 3 else 4
        val usableW = max(1.0f, (halfWidth - objRadius * 1.15f) * 2f)
        val stepX = usableW / cols

        for (i in 0 until count) {
            val col = i % cols
            val row = (i / cols) % 5
            val layer = i / (cols * 5)

            val x = -usableW * 0.5f + (col + 0.5f) * stepX + (rng.nextFloat() - 0.5f) * 0.06f
            val y = -halfHeight * 0.48f + row * (objRadius * 2.15f) + (rng.nextFloat() - 0.5f) * 0.06f
            val z = objHalfZ + 0.08f + layer * (objHalfZ * 2.15f)

            val ax = rng.nextFloat() * 6.283f
            val ay = rng.nextFloat() * 6.283f
            val az = rng.nextFloat() * 6.283f
            val q = eulerToQuat(ax, ay, az)

            bodies += Body3D(
                x = x.coerceIn(-halfWidth + objRadius, halfWidth - objRadius),
                y = y.coerceIn(-halfHeight + objRadius, halfHeight - objRadius),
                z = min(z, cavityDepth - objHalfZ - 0.04f),
                vx = (rng.nextFloat() - 0.5f) * 0.45f,
                vy = (rng.nextFloat() - 0.5f) * 0.45f,
                vz = 0f,
                qx = q[0],
                qy = q[1],
                qz = q[2],
                qw = q[3],
                wx = (rng.nextFloat() - 0.5f) * 1.8f,
                wy = (rng.nextFloat() - 0.5f) * 1.8f,
                wz = (rng.nextFloat() - 0.5f) * 1.8f,
                radius = objRadius,
                halfZ = objHalfZ,
                mass = profile.mass,
                restitution = profile.restitution,
                friction = profile.friction,
                linearDamping = profile.linearDamping,
                angularDamping = profile.angularDamping,
                halfX = objHalfX,
                halfY = objHalfY
            )
        }
    }

    fun applyShakeImpulse(ax: Float = 0f, ay: Float = 0f, az: Float = 3.2f, rng: Random = Random.Default) {
        for (b in bodies) {
            val jx = if (abs(ax) > 0.05f) ax * 0.55f + (rng.nextFloat() - 0.5f) * 2.2f else (rng.nextFloat() - 0.5f) * 4.5f
            val jy = if (abs(ay) > 0.05f) ay * 0.55f + (rng.nextFloat() - 0.5f) * 2.2f else (rng.nextFloat() - 0.5f) * 4.5f
            val jz = max(1.8f, az * 0.65f + rng.nextFloat() * 2.0f)
            b.vx += jx
            b.vy += jy
            b.vz += jz
            b.wx += (rng.nextFloat() - 0.5f) * 8.0f
            b.wy += (rng.nextFloat() - 0.5f) * 8.0f
            b.wz += (rng.nextFloat() - 0.5f) * 6.0f
        }
    }

    fun step(deltaSeconds: Float) {
        val dtTotal = deltaSeconds.coerceIn(0.001f, 0.033f)
        val substeps = 3
        val dt = dtTotal / substeps

        for (stepIdx in 0 until substeps) {
            integrateForcesAndMotion(dt)
            solvePairwiseCollisions()
            solveBoundaryContainment()
        }
    }

    private fun integrateForcesAndMotion(dt: Float) {
        for (b in bodies) {
            val linDecay = max(0.0f, 1.0f - b.linearDamping * dt)
            val angDecay = max(0.0f, 1.0f - b.angularDamping * dt)

            b.vx = (b.vx + gravityX * dt) * linDecay
            b.vy = (b.vy + gravityY * dt) * linDecay
            b.vz = (b.vz + gravityZ * dt) * linDecay

            b.x += b.vx * dt
            b.y += b.vy * dt
            b.z += b.vz * dt

            // Integrate quaternion from angular velocity: dq/dt = 0.5 * w * q
            val halfDt = 0.5f * dt
            val dqx = (b.wx * b.qw + b.wy * b.qz - b.wz * b.qy) * halfDt
            val dqy = (b.wy * b.qw - b.wx * b.qz + b.wz * b.qx) * halfDt
            val dqz = (b.wz * b.qw + b.wx * b.qy - b.wy * b.qx) * halfDt
            val dqw = (-b.wx * b.qx - b.wy * b.qy - b.wz * b.qz) * halfDt

            var nqx = b.qx + dqx
            var nqy = b.qy + dqy
            var nqz = b.qz + dqz
            var nqw = b.qw + dqw
            val qLen = max(0.0001f, sqrt(nqx * nqx + nqy * nqy + nqz * nqz + nqw * nqw))
            b.qx = nqx / qLen
            b.qy = nqy / qLen
            b.qz = nqz / qLen
            b.qw = nqw / qLen

            b.wx *= angDecay
            b.wy *= angDecay
            b.wz *= angDecay
        }
    }

    private fun solvePairwiseCollisions() {
        val count = bodies.size
        for (i in 0 until count) {
            val a = bodies[i]
            for (j in (i + 1) until count) {
                val b = bodies[j]
                val dx = b.x - a.x
                val dy = b.y - a.y
                val dz = b.z - a.z
                val minDist = (a.radius + b.radius) * 0.96f
                val distSq = dx * dx + dy * dy + dz * dz
                if (distSq >= minDist * minDist) continue

                val dist = sqrt(max(1e-6f, distSq))
                val nx: Float
                val ny: Float
                val nz: Float
                if (dist > 0.0005f) {
                    nx = dx / dist
                    ny = dy / dist
                    nz = dz / dist
                } else {
                    nx = 1f; ny = 0f; nz = 0f
                }

                // Positional separation weighted cleanly
                val overlap = minDist - dist
                val corr = overlap * 0.52f
                a.x -= nx * corr
                a.y -= ny * corr
                a.z -= nz * corr
                b.x += nx * corr
                b.y += ny * corr
                b.z += nz * corr

                val rvx = b.vx - a.vx
                val rvy = b.vy - a.vy
                val rvz = b.vz - a.vz
                val velAlongNormal = rvx * nx + rvy * ny + rvz * nz
                if (velAlongNormal > 0f) continue

                val e = min(a.restitution, b.restitution)
                val invMassSum = (1f / a.mass) + (1f / b.mass)
                val impulseMag = -(1f + e) * velAlongNormal / invMassSum
                val ix = impulseMag * nx
                val iy = impulseMag * ny
                val iz = impulseMag * nz

                a.vx -= ix / a.mass
                a.vy -= iy / a.mass
                a.vz -= iz / a.mass
                b.vx += ix / b.mass
                b.vy += iy / b.mass
                b.vz += iz / b.mass

                // Tangential friction spin coupling
                val tx = rvx - velAlongNormal * nx
                val ty = rvy - velAlongNormal * ny
                val tz = rvz - velAlongNormal * nz
                val tLen = sqrt(tx * tx + ty * ty + tz * tz)
                if (tLen > 0.001f) {
                    val fScale = min(a.friction, b.friction) * 0.25f
                    val uTx = tx / tLen
                    val uTy = ty / tLen
                    val uTz = tz / tLen
                    a.wx += (ny * uTz - nz * uTy) * fScale
                    a.wy += (nz * uTx - nx * uTz) * fScale
                    b.wx -= (ny * uTz - nz * uTy) * fScale
                    b.wy -= (nz * uTx - nx * uTz) * fScale
                }
            }
        }
    }

    private fun solveBoundaryContainment() {
        val cornerBevelOffset = halfWidth + halfHeight - 0.65f
        val invSqrt2 = 0.70710677f

        for (b in bodies) {
            val floorZ = b.halfZ
            val ceilZ = cavityDepth - b.halfZ
            val wallX = halfWidth - b.radius * 0.94f
            val wallY = halfHeight - b.radius * 0.94f

            // Floor contact + realistic rolling spin
            if (b.z < floorZ) {
                b.z = floorZ
                if (b.vz < 0f) {
                    b.vz = if (abs(b.vz) > 0.35f) -b.vz * b.restitution else 0f
                }
                val floorGrip = 1.0f - min(0.20f, b.friction * 0.14f)
                b.vx *= floorGrip
                b.vy *= floorGrip
                val spinGain = 1.0f / max(0.14f, b.radius)
                b.wy = b.wy * 0.72f + (b.vx * spinGain) * 0.28f
                b.wx = b.wx * 0.72f - (b.vy * spinGain) * 0.28f
            } else if (b.z > ceilZ) {
                b.z = ceilZ
                if (b.vz > 0f) b.vz = -b.vz * b.restitution * 0.65f
            }

            if (b.x < -wallX) {
                b.x = -wallX
                if (b.vx < 0f) b.vx = -b.vx * b.restitution
            } else if (b.x > wallX) {
                b.x = wallX
                if (b.vx > 0f) b.vx = -b.vx * b.restitution
            }

            if (b.y < -wallY) {
                b.y = -wallY
                if (b.vy < 0f) b.vy = -b.vy * b.restitution
            } else if (b.y > wallY) {
                b.y = wallY
                if (b.vy > 0f) b.vy = -b.vy * b.restitution
            }

            // Rounded phone/watch bezel corners (45-degree bevel planes)
            val cornerDist = (abs(b.x) + abs(b.y)) * invSqrt2
            val maxCorner = cornerBevelOffset * invSqrt2 - b.radius
            if (cornerDist > maxCorner) {
                val push = cornerDist - maxCorner
                val sx = if (b.x >= 0f) 1f else -1f
                val sy = if (b.y >= 0f) 1f else -1f
                b.x -= sx * invSqrt2 * push
                b.y -= sy * invSqrt2 * push
                val vn = b.vx * sx * invSqrt2 + b.vy * sy * invSqrt2
                if (vn > 0f) {
                    val bounce = (1f + b.restitution) * vn
                    b.vx -= sx * invSqrt2 * bounce
                    b.vy -= sy * invSqrt2 * bounce
                }
            }
        }
    }

    private fun profileFor(theme: WallpaperTheme, restitutionScale: Float): ThemePhysicsProfile {
        val rs = restitutionScale.coerceIn(0.2f, 1.5f)
        return when (theme) {
            WallpaperTheme.TENNIS -> ThemePhysicsProfile(0.058f, min(0.92f, 0.54f * rs), 0.52f, 0.28f, 0.34f)
            WallpaperTheme.DIAMOND -> ThemePhysicsProfile(0.14f, min(0.92f, 0.38f * rs), 0.24f, 0.14f, 0.28f)
            WallpaperTheme.BASKETBALL -> ThemePhysicsProfile(0.62f, min(0.92f, 0.62f * rs), 0.48f, 0.16f, 0.20f)
            WallpaperTheme.GOLD_BAR -> ThemePhysicsProfile(1.85f, min(0.92f, 0.20f * rs), 0.36f, 0.10f, 0.58f)
            WallpaperTheme.SOCCER -> ThemePhysicsProfile(0.43f, min(0.92f, 0.56f * rs), 0.44f, 0.18f, 0.24f)
            WallpaperTheme.CYBER_CIRCUIT -> ThemePhysicsProfile(0.32f, min(0.92f, 0.44f * rs), 0.30f, 0.14f, 0.32f)
        }
    }

    private fun eulerToQuat(rx: Float, ry: Float, rz: Float): FloatArray {
        val cx = cos(rx * 0.5f); val sx = sin(rx * 0.5f)
        val cy = cos(ry * 0.5f); val sy = sin(ry * 0.5f)
        val cz = cos(rz * 0.5f); val sz = sin(rz * 0.5f)
        return floatArrayOf(
            sx * cy * cz - cx * sy * sz,
            cx * sy * cz + sx * cy * sz,
            cx * cy * sz - sx * sy * cz,
            cx * cy * cz + sx * sy * sz
        )
    }

    private data class QuadSize(val radius: Float, val hx: Float, val hy: Float, val hz: Float)
}
