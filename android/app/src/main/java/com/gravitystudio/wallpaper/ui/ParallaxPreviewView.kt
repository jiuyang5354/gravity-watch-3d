package com.gravitystudio.wallpaper.ui

import android.content.Context
import android.graphics.Canvas
import android.view.View
import com.gravitystudio.wallpaper.model.WallpaperConfig
import com.gravitystudio.wallpaper.parallax.ParallaxCanvasRenderer

/**
 * 60fps Canvas preview widget for MainActivity matching the live WallpaperService parallax math.
 */
class ParallaxPreviewView(
    context: Context,
    initialConfig: WallpaperConfig
) : View(context) {

    private val renderer = ParallaxCanvasRenderer(context)
    private var config: WallpaperConfig = initialConfig
    private var tiltX: Float = 0f
    private var tiltY: Float = 0f
    private var isAnimating: Boolean = false

    fun applyConfig(newConfig: WallpaperConfig) {
        config = newConfig
        if (width > 0 && height > 0) {
            renderer.updateViewport(width, height, config)
        }
        invalidate()
    }

    fun updateTilt(nx: Float, ny: Float) {
        tiltX = nx.coerceIn(-1f, 1f)
        tiltY = ny.coerceIn(-1f, 1f)
    }

    fun startLoop() {
        if (isAnimating) return
        isAnimating = true
        postInvalidateOnAnimation()
    }

    fun stopLoop() {
        isAnimating = false
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w > 0 && h > 0) {
            renderer.updateViewport(w, h, config)
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (width > 0 && height > 0) {
            renderer.updateViewport(width, height, config)
            renderer.drawFrame(canvas, config, tiltX, tiltY)
        }
        if (isAnimating && visibility == VISIBLE) {
            postInvalidateOnAnimation()
        }
    }

    override fun onDetachedFromWindow() {
        isAnimating = false
        renderer.release()
        super.onDetachedFromWindow()
    }
}
