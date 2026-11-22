package com.gravitystudio.wallpaper.parallax

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import com.gravitystudio.wallpaper.R
import com.gravitystudio.wallpaper.model.CustomLayerSlot
import com.gravitystudio.wallpaper.model.ParallaxPreset
import com.gravitystudio.wallpaper.model.WallpaperConfig
import com.gravitystudio.wallpaper.model.WallpaperConfigStore
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.sin

/**
 * Pure Android Canvas 3-layer 3D depth parallax renderer:
 * - Background layer shifts +5%
 * - Glow layer shifts +12% with a 4-second 70%–100% breathing pulse
 * - Foreground drop shadow shifts dynamically with tilt to convey elevation
 * - Foreground cutout shifts -25% opposite to background for enhanced 3D separation
 * Zero heap allocations per frame during 60fps WallpaperService rendering.
 */
class ParallaxCanvasRenderer(private val context: Context) {

    private val bgPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val glowPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val shadowPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val fgPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val matrix = Matrix()

    private var bgBitmap: Bitmap? = null
    private var glowBitmap: Bitmap? = null
    private var fgBitmap: Bitmap? = null
    private var fgShadowBitmap: Bitmap? = null

    private var loadedPreset: ParallaxPreset? = null
    private var loadedCustomRevision: Long = -1L
    private var viewW: Int = 0
    private var viewH: Int = 0

    private var bgDrawScale = 1f
    private var glowDrawScale = 1f
    private var fgDrawScale = 1f

    private var bgBaseX = 0f; private var bgBaseY = 0f
    private var glowBaseX = 0f; private var glowBaseY = 0f
    private var fgBaseX = 0f; private var fgBaseY = 0f

    private val startMs = System.currentTimeMillis()

    fun updateViewport(width: Int, height: Int, config: WallpaperConfig) {
        val safeW = max(1, width)
        val safeH = max(1, height)
        val presetChanged = config.parallaxPreset != loadedPreset ||
            config.customLayerRevision != loadedCustomRevision
        val sizeChanged = safeW != viewW || safeH != viewH

        if (!presetChanged && !sizeChanged) return

        if (presetChanged) {
            reloadLayers(config)
            loadedPreset = config.parallaxPreset
            loadedCustomRevision = config.customLayerRevision
        }
        viewW = safeW
        viewH = safeH
        recomputeCoverTransforms()
    }

    fun drawFrame(canvas: Canvas, config: WallpaperConfig, tiltX: Float, tiltY: Float) {
        if (viewW <= 0 || viewH <= 0) return
        canvas.drawColor(Color.BLACK)

        val strength = config.depthStrength.coerceIn(0.5f, 2.0f)
        val dxBase = tiltX.coerceIn(-1f, 1f) * viewW * strength
        val dyBase = tiltY.coerceIn(-1f, 1f) * viewH * strength

        // Background: +5% travel
        bgBitmap?.let { bmp ->
            matrix.reset()
            matrix.postScale(bgDrawScale, bgDrawScale)
            matrix.postTranslate(bgBaseX + dxBase * 0.05f, bgBaseY + dyBase * 0.05f)
            canvas.drawBitmap(bmp, matrix, bgPaint)
        }

        // Glow: +12% travel + 4s 70%–100% breathing pulse
        glowBitmap?.let { bmp ->
            val tSec = ((System.currentTimeMillis() - startMs) % 4000L) / 4000.0
            val breath01 = (0.5 + 0.5 * sin(tSec * 2.0 * PI)).toFloat()
            val alpha = ((0.70f + 0.30f * breath01) * 255f).toInt().coerceIn(0, 255)
            glowPaint.alpha = alpha

            matrix.reset()
            matrix.postScale(glowDrawScale, glowDrawScale)
            matrix.postTranslate(glowBaseX + dxBase * 0.12f, glowBaseY + dyBase * 0.12f)
            canvas.drawBitmap(bmp, matrix, glowPaint)
        }

        // Foreground opposite travel (-25%) + floating drop shadow beneath
        val fgShiftX = -dxBase * 0.25f
        val fgShiftY = -dyBase * 0.25f

        fgShadowBitmap?.let { shadowBmp ->
            val shOffX = viewW * 0.018f - dxBase * 0.04f
            val shOffY = viewH * 0.020f - dyBase * 0.04f
            shadowPaint.alpha = 148
            matrix.reset()
            matrix.postScale(fgDrawScale, fgDrawScale)
            matrix.postTranslate(fgBaseX + fgShiftX + shOffX, fgBaseY + fgShiftY + shOffY)
            canvas.drawBitmap(shadowBmp, matrix, shadowPaint)
        }

        fgBitmap?.let { bmp ->
            matrix.reset()
            matrix.postScale(fgDrawScale, fgDrawScale)
            matrix.postTranslate(fgBaseX + fgShiftX, fgBaseY + fgShiftY)
            canvas.drawBitmap(bmp, matrix, fgPaint)
        }
    }

    fun release() {
        bgBitmap?.recycle(); bgBitmap = null
        glowBitmap?.recycle(); glowBitmap = null
        fgBitmap?.recycle(); fgBitmap = null
        fgShadowBitmap?.recycle(); fgShadowBitmap = null
        loadedPreset = null
    }

    private fun reloadLayers(config: WallpaperConfig) {
        release()
        val res = context.resources

        val (defaultBgId, defaultGlowId, defaultFgId) = when (config.parallaxPreset) {
            ParallaxPreset.GOLD_MINIMAL -> Triple(
                R.drawable.parallax_gold_bg,
                R.drawable.parallax_gold_glow,
                R.drawable.parallax_gold_fg
            )
            else -> Triple(
                R.drawable.parallax_cyber_bg,
                R.drawable.parallax_cyber_glow,
                R.drawable.parallax_cyber_fg
            )
        }

        if (config.parallaxPreset == ParallaxPreset.CUSTOM) {
            bgBitmap = decodeCustomOrFallback(CustomLayerSlot.BACKGROUND, defaultBgId)
            glowBitmap = decodeCustomOrFallback(CustomLayerSlot.GLOW, defaultGlowId)
            fgBitmap = decodeCustomOrFallback(CustomLayerSlot.FOREGROUND, defaultFgId)
        } else {
            bgBitmap = BitmapFactory.decodeResource(res, defaultBgId)
            glowBitmap = BitmapFactory.decodeResource(res, defaultGlowId)
            fgBitmap = BitmapFactory.decodeResource(res, defaultFgId)
        }

        fgShadowBitmap = fgBitmap?.let { createSoftDropShadowBitmap(it) }
    }

    private fun decodeCustomOrFallback(slot: CustomLayerSlot, fallbackResId: Int): Bitmap? {
        val file = WallpaperConfigStore.customLayerFile(context, slot)
        if (file.isFile && file.length() > 0L) {
            BitmapFactory.decodeFile(file.absolutePath)?.let { return it }
        }
        return BitmapFactory.decodeResource(context.resources, fallbackResId)
    }

    private fun createSoftDropShadowBitmap(fg: Bitmap): Bitmap {
        val out = Bitmap.createBitmap(fg.width, fg.height, Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            colorFilter = PorterDuffColorFilter(Color.BLACK, PorterDuff.Mode.SRC_IN)
            maskFilter = BlurMaskFilter(22f, BlurMaskFilter.Blur.NORMAL)
        }
        c.drawBitmap(fg, 0f, 0f, p)
        return out
    }

    private fun recomputeCoverTransforms() {
        // Overscan 1.24x guarantees zero border gaps even at maximum 2.0x depth travel
        val overscan = 1.24f
        bgBitmap?.let { bmp ->
            val s = coverScale(bmp.width, bmp.height, viewW, viewH) * overscan
            bgDrawScale = s
            bgBaseX = (viewW - bmp.width * s) * 0.5f
            bgBaseY = (viewH - bmp.height * s) * 0.5f
        }
        glowBitmap?.let { bmp ->
            val s = coverScale(bmp.width, bmp.height, viewW, viewH) * overscan
            glowDrawScale = s
            glowBaseX = (viewW - bmp.width * s) * 0.5f
            glowBaseY = (viewH - bmp.height * s) * 0.5f
        }
        fgBitmap?.let { bmp ->
            val s = coverScale(bmp.width, bmp.height, viewW, viewH) * 1.06f
            fgDrawScale = s
            fgBaseX = (viewW - bmp.width * s) * 0.5f
            fgBaseY = (viewH - bmp.height * s) * 0.5f
        }
    }

    private fun coverScale(srcW: Int, srcH: Int, dstW: Int, dstH: Int): Float =
        max(dstW.toFloat() / max(1, srcW), dstH.toFloat() / max(1, srcH))
}
