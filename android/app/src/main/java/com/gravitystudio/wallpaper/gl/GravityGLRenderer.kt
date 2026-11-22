package com.gravitystudio.wallpaper.gl

import android.content.Context
import android.graphics.BitmapFactory
import android.opengl.GLES30
import android.opengl.GLSurfaceView
import android.opengl.GLUtils
import android.opengl.Matrix
import com.gravitystudio.wallpaper.model.WallpaperConfig
import com.gravitystudio.wallpaper.model.WallpaperTheme
import com.gravitystudio.wallpaper.physics.PhysicsWorld3D
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.max

/**
 * Shared OpenGL ES 3.0 renderer powering both MainActivity preview (GLSurfaceView)
 * and GravityWallpaperService (EGL14 hardware live wallpaper thread).
 */
class GravityGLRenderer(
    private val context: Context,
    initialConfig: WallpaperConfig
) : GLSurfaceView.Renderer {

    private class GpuMesh(mesh: MeshFactory3D.MeshData) {
        val vboId: Int
        val eboId: Int
        val indexCount: Int = mesh.indexCount

        init {
            val ids = IntArray(2)
            GLES30.glGenBuffers(2, ids, 0)
            vboId = ids[0]
            eboId = ids[1]

            val vb = ByteBuffer.allocateDirect(mesh.vertices.size * 4)
                .order(ByteOrder.nativeOrder())
                .asFloatBuffer()
                .apply { put(mesh.vertices); position(0) }
            val ib = ByteBuffer.allocateDirect(mesh.indices.size * 2)
                .order(ByteOrder.nativeOrder())
                .asShortBuffer()
                .apply { put(mesh.indices); position(0) }

            GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, vboId)
            GLES30.glBufferData(GLES30.GL_ARRAY_BUFFER, mesh.vertices.size * 4, vb, GLES30.GL_STATIC_DRAW)

            GLES30.glBindBuffer(GLES30.GL_ELEMENT_ARRAY_BUFFER, eboId)
            GLES30.glBufferData(GLES30.GL_ELEMENT_ARRAY_BUFFER, mesh.indices.size * 2, ib, GLES30.GL_STATIC_DRAW)

            GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, 0)
            GLES30.glBindBuffer(GLES30.GL_ELEMENT_ARRAY_BUFFER, 0)
        }

        fun bindAndDraw() {
            GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, vboId)
            GLES30.glBindBuffer(GLES30.GL_ELEMENT_ARRAY_BUFFER, eboId)

            val stride = 8 * 4
            GLES30.glEnableVertexAttribArray(0)
            GLES30.glVertexAttribPointer(0, 3, GLES30.GL_FLOAT, false, stride, 0)
            GLES30.glEnableVertexAttribArray(1)
            GLES30.glVertexAttribPointer(1, 3, GLES30.GL_FLOAT, false, stride, 3 * 4)
            GLES30.glEnableVertexAttribArray(2)
            GLES30.glVertexAttribPointer(2, 2, GLES30.GL_FLOAT, false, stride, 6 * 4)

            GLES30.glDrawElements(GLES30.GL_TRIANGLES, indexCount, GLES30.GL_UNSIGNED_SHORT, 0)
        }

        fun release() {
            GLES30.glDeleteBuffers(2, intArrayOf(vboId, eboId), 0)
        }
    }

    private val lock = Any()
    private val physics = PhysicsWorld3D()

    @Volatile
    private var config: WallpaperConfig = initialConfig
    @Volatile
    private var needsRebuild = true

    private var viewportW = 1080
    private var viewportH = 1920

    private var tiltX = 0f
    private var tiltY = -0.25f
    private var smoothEyeX = 0f
    private var smoothEyeY = -0.25f

    private var pbrProgram: ShaderPrograms3D.ProgramHandle? = null
    private var diamondProgram: ShaderPrograms3D.ProgramHandle? = null
    private var floorProgram: ShaderPrograms3D.ProgramHandle? = null
    private var decalProgram: ShaderPrograms3D.ProgramHandle? = null

    private var sphereMesh: GpuMesh? = null
    private var diamondMesh: GpuMesh? = null
    private var goldBarMesh: GpuMesh? = null
    private var cyberChipMesh: GpuMesh? = null
    private var floorMesh: GpuMesh? = null
    private var decalMesh: GpuMesh? = null

    private var currentDiamondRadius = 0.36f
    private val textures = HashMap<String, Int>()

    private val projMat = FloatArray(16)
    private val viewMat = FloatArray(16)
    private val vpMat = FloatArray(16)
    private val modelMat = FloatArray(16)
    private val mvpMat = FloatArray(16)
    private val rotMat = FloatArray(16)
    private val normalMat = FloatArray(9)

    private var lastFrameNs = System.nanoTime()
    private val startNs = lastFrameNs

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES30.glEnable(GLES30.GL_DEPTH_TEST)
        GLES30.glEnable(GLES30.GL_CULL_FACE)
        GLES30.glCullFace(GLES30.GL_BACK)
        GLES30.glClearColor(0.02f, 0.028f, 0.045f, 1.0f)

        pbrProgram = ShaderPrograms3D.buildPbrObjectProgram()
        diamondProgram = ShaderPrograms3D.buildDiamondProgram()
        floorProgram = ShaderPrograms3D.buildFloorProgram()
        decalProgram = ShaderPrograms3D.buildDecalProgram()

        sphereMesh = GpuMesh(MeshFactory3D.createUnitSphere(26, 36))
        floorMesh = GpuMesh(MeshFactory3D.createPlaneMesh(9.0f, 16.0f))
        decalMesh = GpuMesh(MeshFactory3D.createPlaneMesh(1.0f, 1.0f))

        loadAllTextures()
        lastFrameNs = System.nanoTime()
        needsRebuild = true
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        viewportW = max(1, width)
        viewportH = max(1, height)
        GLES30.glViewport(0, 0, viewportW, viewportH)
        synchronized(lock) {
            val aspect = viewportW.toFloat() / viewportH.toFloat()
            physics.updateBounds(aspect)
        }
    }

    override fun onDrawFrame(gl: GL10?) {
        val nowNs = System.nanoTime()
        val dt = ((nowNs - lastFrameNs) / 1_000_000_000.0).toFloat().coerceIn(0.001f, 0.033f)
        val elapsedSec = ((nowNs - startNs) / 1_000_000_000.0).toFloat()
        lastFrameNs = nowNs

        val cfg = config
        if (needsRebuild) {
            synchronized(lock) {
                rebuildSceneMeshesAndBodies(cfg)
                needsRebuild = false
            }
        }

        GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT or GLES30.GL_DEPTH_BUFFER_BIT)

        updateOffAxisPortalMatrix(cfg.depthStrength)

        val keyPosX = -4.2f - tiltX * 1.4f
        val keyPosY = 4.6f - tiltY * 1.2f
        val keyPosZ = 5.2f

        synchronized(lock) {
            physics.step(dt)

            // 1. Borderless studio floor
            drawFloor(cfg, keyPosX, keyPosY, keyPosZ, elapsedSec)

            // 2. Contact shadow decals (depth test on, depth write off)
            drawDecals(cfg.theme)

            // 3. Dynamic 3D rigid bodies
            drawBodies(cfg.theme, keyPosX, keyPosY, keyPosZ, elapsedSec)
        }
    }

    fun applyConfig(newConfig: WallpaperConfig) {
        val old = config
        val structuralChange =
            newConfig.theme != old.theme ||
            newConfig.density != old.density ||
            kotlin.math.abs(newConfig.restitutionScale - old.restitutionScale) > 0.02f
        config = newConfig
        if (structuralChange) {
            needsRebuild = true
        }
    }

    fun updateTilt(nx: Float, ny: Float) {
        tiltX = nx.coerceIn(-1f, 1f)
        tiltY = ny.coerceIn(-1f, 1f)
    }

    fun updateGravity(gx: Float, gy: Float, gz: Float) {
        synchronized(lock) {
            physics.setGravity(gx, gy, gz)
        }
    }

    fun triggerShakeImpulse(ax: Float = 0f, ay: Float = 0f, az: Float = 3.2f) {
        synchronized(lock) {
            physics.applyShakeImpulse(ax, ay, az)
        }
    }

    fun releaseGlResources() {
        sphereMesh?.release(); sphereMesh = null
        diamondMesh?.release(); diamondMesh = null
        goldBarMesh?.release(); goldBarMesh = null
        cyberChipMesh?.release(); cyberChipMesh = null
        floorMesh?.release(); floorMesh = null
        decalMesh?.release(); decalMesh = null

        val texIds = textures.values.toIntArray()
        if (texIds.isNotEmpty()) {
            GLES30.glDeleteTextures(texIds.size, texIds, 0)
            textures.clear()
        }
    }

    private fun rebuildSceneMeshesAndBodies(cfg: WallpaperConfig) {
        physics.rebuild(cfg.theme, cfg.density, cfg.restitutionScale)

        val first = physics.bodies.firstOrNull() ?: return
        diamondMesh?.release(); diamondMesh = null
        goldBarMesh?.release(); goldBarMesh = null
        cyberChipMesh?.release(); cyberChipMesh = null

        when (cfg.theme) {
            WallpaperTheme.DIAMOND -> {
                currentDiamondRadius = first.radius
                diamondMesh = GpuMesh(MeshFactory3D.createDiamondMesh(first.radius))
            }
            WallpaperTheme.GOLD_BAR -> {
                goldBarMesh = GpuMesh(MeshFactory3D.createGoldBullionMesh(first.halfX, first.halfY, first.halfZ))
            }
            WallpaperTheme.CYBER_CIRCUIT -> {
                cyberChipMesh = GpuMesh(MeshFactory3D.createCyberModuleMesh(first.halfX, first.halfY, first.halfZ))
            }
            else -> Unit
        }
    }

    private fun updateOffAxisPortalMatrix(depthStrength: Float) {
        val targetX = (-tiltX * 1.65f * depthStrength).coerceIn(-2.25f, 2.25f)
        val targetY = (-tiltY * 1.65f * depthStrength).coerceIn(-2.25f, 2.25f)
        smoothEyeX += (targetX - smoothEyeX) * 0.22f
        smoothEyeY += (targetY - smoothEyeY) * 0.22f

        val zWin = 1.24f
        val eyeZ = 7.10f
        val dWin = eyeZ - zWin
        val halfW = physics.halfWidth
        val halfH = physics.halfHeight
        val near = 1.2f
        val far = 26.0f
        val k = near / dWin

        Matrix.frustumM(
            projMat,
            0,
            (-halfW - smoothEyeX) * k,
            (halfW - smoothEyeX) * k,
            (-halfH - smoothEyeY) * k,
            (halfH - smoothEyeY) * k,
            near,
            far
        )
        Matrix.setLookAtM(
            viewMat,
            0,
            smoothEyeX, smoothEyeY, eyeZ,
            smoothEyeX, smoothEyeY, 0.0f,
            0f, 1f, 0f
        )
        Matrix.multiplyMM(vpMat, 0, projMat, 0, viewMat, 0)
    }

    private fun drawFloor(cfg: WallpaperConfig, kx: Float, ky: Float, kz: Float, elapsed: Float) {
        val prog = floorProgram ?: return
        val mesh = floorMesh ?: return
        GLES30.glUseProgram(prog.id)

        Matrix.setIdentityM(modelMat, 0)
        Matrix.multiplyMM(mvpMat, 0, vpMat, 0, modelMat, 0)
        setNormalMatIdentity()

        GLES30.glUniformMatrix4fv(prog.uMvp, 1, false, mvpMat, 0)
        GLES30.glUniformMatrix4fv(prog.uModel, 1, false, modelMat, 0)
        GLES30.glUniformMatrix3fv(prog.uNormalMat, 1, false, normalMat, 0)
        GLES30.glUniform3f(prog.uCameraPos, smoothEyeX, smoothEyeY, 7.10f)
        GLES30.glUniform3f(prog.uKeyLightPos, kx, ky, kz)
        GLES30.glUniform1f(prog.uExposure, 1.05f)
        GLES30.glUniform1f(prog.uTime, elapsed)
        GLES30.glUniform1i(prog.uFloorMode, cfg.theme.floorMode)

        val vp = cfg.velvetPreset
        GLES30.glUniform3fv(prog.uVelvetCore, 1, vp.coreRgb, 0)
        GLES30.glUniform3fv(prog.uVelvetMid, 1, vp.midRgb, 0)
        GLES30.glUniform3fv(prog.uVelvetSheen, 1, vp.sheenRgb, 0)
        GLES30.glUniform3fv(prog.uVelvetRim, 1, vp.rimRgb, 0)

        val (diffName, norName) = floorTextureNames(cfg.theme)
        bindTexture(prog.uDiffuseTex, 0, diffName)
        bindTexture(prog.uNormalTex, 1, norName)
        bindTexture(prog.uGlowMaskTex, 2, "circuit_board_glow.jpg")

        mesh.bindAndDraw()
    }

    private fun drawDecals(theme: WallpaperTheme) {
        val prog = decalProgram ?: return
        val mesh = decalMesh ?: return
        GLES30.glUseProgram(prog.id)
        GLES30.glEnable(GLES30.GL_BLEND)
        GLES30.glBlendFunc(GLES30.GL_SRC_ALPHA, GLES30.GL_ONE_MINUS_SRC_ALPHA)
        GLES30.glDepthMask(false)

        val isDia = theme == WallpaperTheme.DIAMOND
        val baseAlpha = when (theme) {
            WallpaperTheme.DIAMOND -> 0.55f
            WallpaperTheme.GOLD_BAR -> 0.36f
            WallpaperTheme.CYBER_CIRCUIT -> 0.42f
            else -> 0.40f
        }
        GLES30.glUniform1i(prog.uIsCaustic, if (isDia) 1 else 0)
        GLES30.glUniform1f(prog.uAspect, if (theme == WallpaperTheme.GOLD_BAR) 1.65f else 1.0f)

        for (b in physics.bodies) {
            val floorDist = max(0f, b.z - b.halfZ)
            val fade = max(0.08f, 1.0f - floorDist * 0.90f)
            val expand = 1.0f + floorDist * 0.35f
            val sx = b.halfX * 2.55f * expand
            val sy = b.halfY * 2.55f * expand

            Matrix.setIdentityM(modelMat, 0)
            Matrix.translateM(modelMat, 0, b.x + 0.045f, b.y - 0.055f, 0.008f)
            Matrix.scaleM(modelMat, 0, sx, sy, 1f)
            Matrix.multiplyMM(mvpMat, 0, vpMat, 0, modelMat, 0)

            GLES30.glUniformMatrix4fv(prog.uMvp, 1, false, mvpMat, 0)
            GLES30.glUniform1f(prog.uAlpha, baseAlpha * fade)
            mesh.bindAndDraw()
        }

        GLES30.glDepthMask(true)
        GLES30.glDisable(GLES30.GL_BLEND)
    }

    private fun drawBodies(theme: WallpaperTheme, kx: Float, ky: Float, kz: Float, elapsed: Float) {
        if (theme == WallpaperTheme.DIAMOND) {
            val prog = diamondProgram ?: return
            val mesh = diamondMesh ?: return
            GLES30.glUseProgram(prog.id)
            GLES30.glUniform1f(prog.uInvRadius, 1.0f / max(0.01f, currentDiamondRadius))
            GLES30.glUniform1f(prog.uExposure, 1.04f)
            GLES30.glUniform3f(prog.uCameraPos, smoothEyeX, smoothEyeY, 7.10f)
            bindTexture(prog.uFloorTex, 0, "velvet_diff.jpg")

            for (b in physics.bodies) {
                buildBodyMatrices(b, scaleRadius = false)
                GLES30.glUniformMatrix4fv(prog.uMvp, 1, false, mvpMat, 0)
                GLES30.glUniformMatrix4fv(prog.uModel, 1, false, modelMat, 0)
                GLES30.glUniformMatrix3fv(prog.uNormalMat, 1, false, normalMat, 0)
                mesh.bindAndDraw()
            }
            return
        }

        val prog = pbrProgram ?: return
        GLES30.glUseProgram(prog.id)
        GLES30.glUniform1i(prog.uObjMode, theme.floorMode)
        GLES30.glUniform3f(prog.uCameraPos, smoothEyeX, smoothEyeY, 7.10f)
        GLES30.glUniform3f(prog.uKeyLightPos, kx, ky, kz)
        GLES30.glUniform1f(prog.uExposure, 1.06f)
        GLES30.glUniform1f(prog.uTime, elapsed)

        val (diffTex, norTex) = objectTextureNames(theme)
        bindTexture(prog.uDiffuseTex, 0, diffTex)
        bindTexture(prog.uNormalTex, 1, norTex)

        val (mesh, isUnitSphere) = when (theme) {
            WallpaperTheme.GOLD_BAR -> goldBarMesh to false
            WallpaperTheme.CYBER_CIRCUIT -> cyberChipMesh to false
            else -> sphereMesh to true
        }
        val activeMesh = mesh ?: return

        for (b in physics.bodies) {
            buildBodyMatrices(b, scaleRadius = isUnitSphere)
            GLES30.glUniformMatrix4fv(prog.uMvp, 1, false, mvpMat, 0)
            GLES30.glUniformMatrix4fv(prog.uModel, 1, false, modelMat, 0)
            GLES30.glUniformMatrix3fv(prog.uNormalMat, 1, false, normalMat, 0)
            activeMesh.bindAndDraw()
        }
    }

    private fun buildBodyMatrices(b: PhysicsWorld3D.Body3D, scaleRadius: Boolean) {
        quatToMatrix4(b.qx, b.qy, b.qz, b.qw, rotMat)
        Matrix.setIdentityM(modelMat, 0)
        Matrix.translateM(modelMat, 0, b.x, b.y, b.z)
        Matrix.multiplyMM(modelMat, 0, modelMat, 0, rotMat, 0)
        if (scaleRadius) {
            Matrix.scaleM(modelMat, 0, b.radius, b.radius, b.radius)
        }
        Matrix.multiplyMM(mvpMat, 0, vpMat, 0, modelMat, 0)

        // rotMat is pure orthonormal rotation -> upper-left 3x3 IS inverse-transpose normal matrix!
        normalMat[0] = rotMat[0]; normalMat[1] = rotMat[1]; normalMat[2] = rotMat[2]
        normalMat[3] = rotMat[4]; normalMat[4] = rotMat[5]; normalMat[5] = rotMat[6]
        normalMat[6] = rotMat[8]; normalMat[7] = rotMat[9]; normalMat[8] = rotMat[10]
    }

    private fun setNormalMatIdentity() {
        normalMat[0] = 1f; normalMat[1] = 0f; normalMat[2] = 0f
        normalMat[3] = 0f; normalMat[4] = 1f; normalMat[5] = 0f
        normalMat[6] = 0f; normalMat[7] = 0f; normalMat[8] = 1f
    }

    private fun quatToMatrix4(x: Float, y: Float, z: Float, w: Float, m: FloatArray) {
        val xx = x * x; val yy = y * y; val zz = z * z
        val xy = x * y; val xz = x * z; val yz = y * z
        val wx = w * x; val wy = w * y; val wz = w * z

        m[0] = 1f - 2f * (yy + zz); m[4] = 2f * (xy - wz);      m[8] = 2f * (xz + wy);       m[12] = 0f
        m[1] = 2f * (xy + wz);      m[5] = 1f - 2f * (xx + zz); m[9] = 2f * (yz - wx);       m[13] = 0f
        m[2] = 2f * (xz - wy);      m[6] = 2f * (yz + wx);      m[10] = 1f - 2f * (xx + yy); m[14] = 0f
        m[3] = 0f;                  m[7] = 0f;                  m[11] = 0f;                  m[15] = 1f
    }

    private fun floorTextureNames(theme: WallpaperTheme): Pair<String, String> = when (theme) {
        WallpaperTheme.TENNIS -> "rubber_diff.jpg" to "rubber_nor.jpg"
        WallpaperTheme.DIAMOND -> "velvet_diff.jpg" to "velvet_nor.jpg"
        WallpaperTheme.BASKETBALL -> "maple_diff.jpg" to "maple_nor.jpg"
        WallpaperTheme.GOLD_BAR -> "marble_diff.jpg" to "marble_nor.jpg"
        WallpaperTheme.SOCCER -> "grass_diff.jpg" to "grass_nor.jpg"
        WallpaperTheme.CYBER_CIRCUIT -> "circuit_board_diff.jpg" to "metal_nor.jpg"
    }

    private fun objectTextureNames(theme: WallpaperTheme): Pair<String, String> = when (theme) {
        WallpaperTheme.TENNIS -> "felt_diff.jpg" to "felt_nor.jpg"
        WallpaperTheme.BASKETBALL -> "bball_leather_diff.jpg" to "bball_leather_nor.jpg"
        WallpaperTheme.GOLD_BAR -> "marble_diff.jpg" to "metal_nor.jpg"
        WallpaperTheme.SOCCER -> "velvet_diff.jpg" to "leather_white_nor.jpg"
        WallpaperTheme.CYBER_CIRCUIT -> "circuit_board_diff.jpg" to "metal_nor.jpg"
        WallpaperTheme.DIAMOND -> "velvet_diff.jpg" to "velvet_nor.jpg"
    }

    private fun loadAllTextures() {
        val assetFiles = context.assets.list("textures") ?: emptyArray()
        for (file in assetFiles) {
            context.assets.open("textures/$file").use { stream ->
                val bmp = BitmapFactory.decodeStream(stream) ?: return@use
                val texIds = IntArray(1)
                GLES30.glGenTextures(1, texIds, 0)
                val texId = texIds[0]
                GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, texId)
                GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_LINEAR_MIPMAP_LINEAR)
                GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MAG_FILTER, GLES30.GL_LINEAR)
                GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_REPEAT)
                GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_REPEAT)
                GLUtils.texImage2D(GLES30.GL_TEXTURE_2D, 0, bmp, 0)
                GLES30.glGenerateMipmap(GLES30.GL_TEXTURE_2D)
                bmp.recycle()
                textures[file] = texId
            }
        }
    }

    private fun bindTexture(uniformLoc: Int, unit: Int, assetName: String) {
        val texId = textures[assetName] ?: textures.values.firstOrNull() ?: return
        GLES30.glActiveTexture(GLES30.GL_TEXTURE0 + unit)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, texId)
        GLES30.glUniform1i(uniformLoc, unit)
    }
}
