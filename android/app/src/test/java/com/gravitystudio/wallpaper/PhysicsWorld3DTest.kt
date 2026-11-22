package com.gravitystudio.wallpaper.physics

import com.gravitystudio.wallpaper.model.DensityPreset
import com.gravitystudio.wallpaper.model.WallpaperTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.sqrt

class PhysicsWorld3DTest {

    @Test
    fun rebuildPopulatesAllSixThemesWithExpectedCounts() {
        val world = PhysicsWorld3D()
        world.updateBounds(1080f / 2400f)

        for (theme in WallpaperTheme.entries) {
            for (density in DensityPreset.entries) {
                world.rebuild(theme, density, restitutionScale = 1.0f)
                assertEquals(
                    "Unexpected body count for $theme / $density",
                    theme.objectCount(density),
                    world.bodies.size
                )
            }
        }
    }

    @Test
    fun bodiesRespondToGravityAndStayInsideBounds() {
        val world = PhysicsWorld3D()
        world.updateBounds(0.50f)
        world.rebuild(WallpaperTheme.CYBER_CIRCUIT, DensityPreset.CINEMATIC, 1.0f)
        world.setGravity(0.6f, -0.8f, -0.5f)

        val initialMeanX = world.bodies.map { it.x }.average()
        repeat(90) {
            world.step(1f / 60f)
        }
        val finalMeanX = world.bodies.map { it.x }.average()

        assertTrue("Bodies should drift toward positive X gravity", finalMeanX > initialMeanX)

        for (b in world.bodies) {
            assertTrue("x out of left/right wall: ${b.x}", abs(b.x) <= world.halfWidth)
            assertTrue("y out of top/bottom wall: ${b.y}", abs(b.y) <= world.halfHeight)
            assertTrue("z below floor: ${b.z}", b.z >= b.halfZ - 0.001f)
            assertTrue("z above ceiling: ${b.z}", b.z <= world.cavityDepth - b.halfZ + 0.001f)

            val qLen = sqrt(b.qx * b.qx + b.qy * b.qy + b.qz * b.qz + b.qw * b.qw)
            assertTrue("Quaternion must remain normalized", abs(qLen - 1f) < 0.01f)
        }
    }

    @Test
    fun shakeImpulseIncreasesKineticEnergyAndMaintainsBounds() {
        val world = PhysicsWorld3D()
        world.updateBounds(0.55f)
        world.rebuild(WallpaperTheme.DIAMOND, DensityPreset.CINEMATIC, 1.0f)
        world.applyShakeImpulse(ax = 2.0f, ay = 3.0f, az = 4.0f)

        val speedSum = world.bodies.sumOf {
            sqrt((it.vx * it.vx + it.vy * it.vy + it.vz * it.vz).toDouble())
        }
        assertTrue("Shake impulse must inject upward/lateral kinetic energy", speedSum > 10.0)

        repeat(45) {
            world.step(1f / 60f)
        }
        for (b in world.bodies) {
            assertTrue(abs(b.x) <= world.halfWidth + 0.001f)
            assertTrue(abs(b.y) <= world.halfHeight + 0.001f)
        }
    }
}
