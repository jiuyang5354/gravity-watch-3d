package com.gravitystudio.wallpaper.service

import android.content.SharedPreferences
import android.graphics.Canvas
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
import com.gravitystudio.wallpaper.gl.GravityGLRenderer
import com.gravitystudio.wallpaper.model.EngineMode
import com.gravitystudio.wallpaper.model.WallpaperConfig
import com.gravitystudio.wallpaper.model.WallpaperConfigStore
import com.gravitystudio.wallpaper.parallax.ParallaxCanvasRenderer
import com.gravitystudio.wallpaper.sensor.OrientationSensorHelper
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Native Android Live Wallpaper service supporting hot-switching between:
 * - True 3D OpenGL ES 3.0 rigid body + off-axis portal frustum physics
 * - Pure Canvas 3-layer parallax depth effect (background / glow / floating foreground)
 * Strictly pauses rendering and unregisters IMU sensors when invisible.
 */
class GravityWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = GravityEngine()

    inner class GravityEngine : Engine(), OrientationSensorHelper.Listener {

        private val stateLock = ReentrantLock()
        private val wakeCondition = stateLock.newCondition()

        private var sensorHelper: OrientationSensorHelper? = null
        private var renderThread: RenderThread? = null

        @Volatile
        private var currentConfig: WallpaperConfig = WallpaperConfigStore.load(applicationContext)
        @Volatile
        private var surfaceReady = false
        @Volatile
        private var isVisibleEngine = false
        @Volatile
        private var surfaceWidth = 1080
        @Volatile
        private var surfaceHeight = 1920
        @Volatile
        private var sizeDirty = true

        @Volatile
        private var tiltX = 0f
        @Volatile
        private var tiltY = 0f
        @Volatile
        private var gravityX = 0f
        @Volatile
        private var gravityY = -0.78f
        @Volatile
        private var gravityZ = -0.62f

        private var glRenderer: GravityGLRenderer? = null

        // Strong reference kept because SharedPreferences keeps WeakHashMap of listeners
        private val prefListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val updated = WallpaperConfigStore.load(applicationContext)
            currentConfig = updated
            glRenderer?.applyConfig(updated)
            stateLock.withLock { wakeCondition.signalAll() }
        }

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            sensorHelper = OrientationSensorHelper(applicationContext, this)
            WallpaperConfigStore.prefs(applicationContext).registerOnSharedPreferenceChangeListener(prefListener)
        }

        override fun onSurfaceCreated(holder: SurfaceHolder) {
            super.onSurfaceCreated(holder)
            surfaceReady = true
            sizeDirty = true
            startRenderThreadIfNeeded(holder)
            stateLock.withLock { wakeCondition.signalAll() }
        }

        override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            super.onSurfaceChanged(holder, format, width, height)
            surfaceWidth = width
            surfaceHeight = height
            sizeDirty = true
            stateLock.withLock { wakeCondition.signalAll() }
        }

        override fun onVisibilityChanged(visible: Boolean) {
            super.onVisibilityChanged(visible)
            isVisibleEngine = visible
            if (visible) {
                sensorHelper?.start()
            } else {
                sensorHelper?.stop()
            }
            stateLock.withLock { wakeCondition.signalAll() }
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder) {
            super.onSurfaceDestroyed(holder)
            surfaceReady = false
            stopRenderThread()
        }

        override fun onDestroy() {
            sensorHelper?.stop()
            WallpaperConfigStore.prefs(applicationContext).unregisterOnSharedPreferenceChangeListener(prefListener)
            stopRenderThread()
            super.onDestroy()
        }

        override fun onTiltUpdated(tiltX: Float, tiltY: Float) {
            this.tiltX = tiltX
            this.tiltY = tiltY
            glRenderer?.updateTilt(tiltX, tiltY)
        }

        override fun onGravityUpdated(gx: Float, gy: Float, gz: Float) {
            gravityX = gx
            gravityY = gy
            gravityZ = gz
            glRenderer?.updateGravity(gx, gy, gz)
        }

        override fun onShakeImpulse(ax: Float, ay: Float, az: Float) {
            glRenderer?.triggerShakeImpulse(ax, ay, az)
        }

        private fun startRenderThreadIfNeeded(holder: SurfaceHolder) {
            if (renderThread != null) return
            renderThread = RenderThread(holder).apply { start() }
        }

        private fun stopRenderThread() {
            val thread = renderThread ?: return
            thread.running = false
            stateLock.withLock { wakeCondition.signalAll() }
            try {
                thread.join(1200)
            } catch (_: InterruptedException) {
            }
            renderThread = null
        }

        private inner class RenderThread(
            private val holder: SurfaceHolder
        ) : Thread("GravityWallpaperLoop") {

            @Volatile
            var running = true

            private var eglDisplay: EGLDisplay = EGL14.EGL_NO_DISPLAY
            private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
            private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE
            private var activeGlMode = false

            private var parallaxRenderer: ParallaxCanvasRenderer? = null

            override fun run() {
                try {
                    while (running) {
                        stateLock.withLock {
                            while (running && (!surfaceReady || !isVisibleEngine)) {
                                wakeCondition.await()
                            }
                        }
                        if (!running) break

                        val frameStartNs = System.nanoTime()
                        val cfg = currentConfig

                        if (cfg.engineMode == EngineMode.PHYSICS_3D) {
                            renderGlFrame(cfg)
                        } else {
                            renderParallaxFrame(cfg)
                        }

                        val elapsedMs = (System.nanoTime() - frameStartNs) / 1_000_000L
                        val sleepMs = (16L - elapsedMs).coerceAtLeast(1L)
                        try {
                            sleep(sleepMs)
                        } catch (_: InterruptedException) {
                            break
                        }
                    }
                } finally {
                    teardownGl()
                    parallaxRenderer?.release()
                    parallaxRenderer = null
                }
            }

            private fun renderGlFrame(cfg: WallpaperConfig) {
                if (!activeGlMode) {
                    parallaxRenderer?.release()
                    parallaxRenderer = null
                    if (!initGl(cfg)) return
                    activeGlMode = true
                    sizeDirty = true
                }
                val renderer = glRenderer ?: return
                if (sizeDirty) {
                    renderer.onSurfaceChanged(null, surfaceWidth, surfaceHeight)
                    sizeDirty = false
                }
                renderer.updateTilt(tiltX, tiltY)
                renderer.updateGravity(gravityX, gravityY, gravityZ)
                renderer.onDrawFrame(null)
                if (eglDisplay != EGL14.EGL_NO_DISPLAY && eglSurface != EGL14.EGL_NO_SURFACE) {
                    EGL14.eglSwapBuffers(eglDisplay, eglSurface)
                }
            }

            private fun renderParallaxFrame(cfg: WallpaperConfig) {
                if (activeGlMode) {
                    teardownGl()
                    activeGlMode = false
                    sizeDirty = true
                }
                val renderer = parallaxRenderer ?: ParallaxCanvasRenderer(applicationContext).also {
                    parallaxRenderer = it
                }
                renderer.updateViewport(surfaceWidth, surfaceHeight, cfg)

                var canvas: Canvas? = null
                try {
                    canvas = holder.lockHardwareCanvas()
                } catch (_: Throwable) {
                    try {
                        canvas = holder.lockCanvas()
                    } catch (_: Throwable) {
                    }
                }
                if (canvas != null) {
                    try {
                        renderer.drawFrame(canvas, cfg, tiltX, tiltY)
                    } finally {
                        try {
                            holder.unlockCanvasAndPost(canvas)
                        } catch (_: Throwable) {
                        }
                    }
                }
            }

            private fun initGl(cfg: WallpaperConfig): Boolean {
                val display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
                if (display == EGL14.EGL_NO_DISPLAY) return false
                val version = IntArray(2)
                if (!EGL14.eglInitialize(display, version, 0, version, 1)) return false

                val attribs = intArrayOf(
                    EGL14.EGL_RED_SIZE, 8,
                    EGL14.EGL_GREEN_SIZE, 8,
                    EGL14.EGL_BLUE_SIZE, 8,
                    EGL14.EGL_ALPHA_SIZE, 8,
                    EGL14.EGL_DEPTH_SIZE, 24,
                    EGL14.EGL_RENDERABLE_TYPE, EGLExt.EGL_OPENGL_ES3_BIT_KHR,
                    EGL14.EGL_NONE
                )
                val configs = arrayOfNulls<EGLConfig>(1)
                val numConfigs = IntArray(1)
                if (!EGL14.eglChooseConfig(display, attribs, 0, configs, 0, 1, numConfigs, 0) || numConfigs[0] <= 0) {
                    return false
                }
                val eglConfig = configs[0] ?: return false

                val ctxAttribs = intArrayOf(
                    EGL14.EGL_CONTEXT_CLIENT_VERSION, 3,
                    EGL14.EGL_NONE
                )
                val context = EGL14.eglCreateContext(display, eglConfig, EGL14.EGL_NO_CONTEXT, ctxAttribs, 0)
                if (context == EGL14.EGL_NO_CONTEXT) return false

                val surfAttribs = intArrayOf(EGL14.EGL_NONE)
                val surface = EGL14.eglCreateWindowSurface(display, eglConfig, holder, surfAttribs, 0)
                if (surface == EGL14.EGL_NO_SURFACE) {
                    EGL14.eglDestroyContext(display, context)
                    return false
                }
                if (!EGL14.eglMakeCurrent(display, surface, surface, context)) {
                    EGL14.eglDestroySurface(display, surface)
                    EGL14.eglDestroyContext(display, context)
                    return false
                }

                eglDisplay = display
                eglContext = context
                eglSurface = surface

                val renderer = GravityGLRenderer(applicationContext, cfg)
                renderer.onSurfaceCreated(null, null)
                renderer.onSurfaceChanged(null, surfaceWidth, surfaceHeight)
                glRenderer = renderer
                return true
            }

            private fun teardownGl() {
                if (eglDisplay != EGL14.EGL_NO_DISPLAY) {
                    EGL14.eglMakeCurrent(
                        eglDisplay,
                        EGL14.EGL_NO_SURFACE,
                        EGL14.EGL_NO_SURFACE,
                        EGL14.EGL_NO_CONTEXT
                    )
                    glRenderer?.releaseGlResources()
                    glRenderer = null
                    if (eglSurface != EGL14.EGL_NO_SURFACE) {
                        EGL14.eglDestroySurface(eglDisplay, eglSurface)
                        eglSurface = EGL14.EGL_NO_SURFACE
                    }
                    if (eglContext != EGL14.EGL_NO_CONTEXT) {
                        EGL14.eglDestroyContext(eglDisplay, eglContext)
                        eglContext = EGL14.EGL_NO_CONTEXT
                    }
                    EGL14.eglTerminate(eglDisplay)
                    eglDisplay = EGL14.EGL_NO_DISPLAY
                }
            }
        }
    }
}
