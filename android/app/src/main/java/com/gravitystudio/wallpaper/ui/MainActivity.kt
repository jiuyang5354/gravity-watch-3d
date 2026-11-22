package com.gravitystudio.wallpaper.ui

import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.button.MaterialButtonToggleGroup
import com.google.android.material.slider.Slider
import com.gravitystudio.wallpaper.R
import com.gravitystudio.wallpaper.gl.GravityGLRenderer
import com.gravitystudio.wallpaper.model.CustomLayerSlot
import com.gravitystudio.wallpaper.model.DensityPreset
import com.gravitystudio.wallpaper.model.EngineMode
import com.gravitystudio.wallpaper.model.ParallaxPreset
import com.gravitystudio.wallpaper.model.VelvetPreset
import com.gravitystudio.wallpaper.model.WallpaperConfig
import com.gravitystudio.wallpaper.model.WallpaperConfigStore
import com.gravitystudio.wallpaper.model.WallpaperTheme
import com.gravitystudio.wallpaper.sensor.OrientationSensorHelper
import com.gravitystudio.wallpaper.service.GravityWallpaperService
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class MainActivity : AppCompatActivity(), OrientationSensorHelper.Listener {

    private lateinit var config: WallpaperConfig
    private lateinit var glRenderer: GravityGLRenderer
    private lateinit var glSurfaceView: GLSurfaceView
    private lateinit var parallaxPreviewView: ParallaxPreviewView
    private lateinit var sensorHelper: OrientationSensorHelper

    private var useLiveGyro: Boolean = false
    private var pendingSlot: CustomLayerSlot = CustomLayerSlot.FOREGROUND

    private lateinit var gyroToggleBtn: MaterialButton
    private lateinit var engineToggleGroup: MaterialButtonToggleGroup
    private lateinit var btnEngine3D: MaterialButton
    private lateinit var btnEngineParallax: MaterialButton

    private lateinit var section3DControls: LinearLayout
    private lateinit var sectionParallaxControls: LinearLayout
    private lateinit var velvetRowContainer: LinearLayout
    private lateinit var velvetButtons: MutableMap<VelvetPreset, MaterialButton>
    private lateinit var themeButtons: MutableMap<WallpaperTheme, MaterialButton>
    private lateinit var densityToggleGroup: MaterialButtonToggleGroup
    private lateinit var densityButtons: MutableMap<DensityPreset, MaterialButton>
    private lateinit var parallaxPresetGroup: MaterialButtonToggleGroup
    private lateinit var parallaxPresetButtons: MutableMap<ParallaxPreset, MaterialButton>
    private lateinit var depthLabelValue: TextView
    private lateinit var depthSlider: Slider
    private lateinit var restitutionLabelValue: TextView
    private lateinit var restitutionSlider: Slider
    private lateinit var customLayerStatusText: TextView

    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            importCustomLayer(pendingSlot, uri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        config = WallpaperConfigStore.load(this)
        sensorHelper = OrientationSensorHelper(this, this)

        velvetButtons = LinkedHashMap()
        themeButtons = LinkedHashMap()
        densityButtons = LinkedHashMap()
        parallaxPresetButtons = LinkedHashMap()

        buildStudioUi()
        syncUiState()
    }

    override fun onResume() {
        super.onResume()
        if (config.engineMode == EngineMode.PHYSICS_3D) {
            glSurfaceView.onResume()
        } else {
            parallaxPreviewView.startLoop()
        }
        if (useLiveGyro) {
            sensorHelper.start()
        }
    }

    override fun onPause() {
        sensorHelper.stop()
        parallaxPreviewView.stopLoop()
        glSurfaceView.onPause()
        super.onPause()
    }

    override fun onTiltUpdated(tiltX: Float, tiltY: Float) {
        if (!useLiveGyro) return
        glRenderer.updateTilt(tiltX, tiltY)
        parallaxPreviewView.updateTilt(tiltX, tiltY)
    }

    override fun onGravityUpdated(gx: Float, gy: Float, gz: Float) {
        if (!useLiveGyro) return
        glRenderer.updateGravity(gx, gy, gz)
    }

    override fun onShakeImpulse(ax: Float, ay: Float, az: Float) {
        if (!useLiveGyro) return
        glRenderer.triggerShakeImpulse(ax, ay, az)
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    private fun buildStudioUi() {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(getColor(R.color.studio_bg))
            isFillViewport = true
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(28))
        }
        scroll.addView(root)

        // Header bar
        val headerTitle = TextView(this).apply {
            text = "GravityWallpaper 工坊"
            textSize = 20f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.WHITE)
        }
        val headerSub = TextView(this).apply {
            text = "OpenGL ES 3D 重力物理 + 三层 PNG 裸眼视差引擎"
            textSize = 12f
            setTextColor(Color.parseColor("#9BA6BE"))
            setPadding(0, dp(2), 0, dp(12))
        }
        root.addView(headerTitle)
        root.addView(headerSub)

        // Live phone bezel preview card
        root.addView(buildPreviewBezel())

        // Quick action row (Shake + Gyro vs Drag toggle)
        root.addView(buildQuickActionRow())

        // Primary CTA: Set as Live Wallpaper
        val setWallpaperBtn = MaterialButton(this).apply {
            text = "一键设为手机动态壁纸 (主屏 / 锁屏)"
            textSize = 15f
            setTypeface(null, Typeface.BOLD)
            setTextColor(getColor(R.color.studio_on_primary))
            setBackgroundColor(getColor(R.color.studio_primary))
            cornerRadius = dp(16)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(52)
            ).apply {
                topMargin = dp(12)
                bottomMargin = dp(14)
            }
            setOnClickListener { launchLiveWallpaperPicker() }
        }
        root.addView(setWallpaperBtn)

        // Engine switcher card
        root.addView(buildEngineSelectorCard())

        // Shared Depth Slider card (0.5x .. 2.0x)
        root.addView(buildDepthCard())

        // 3D Physics Section
        section3DControls = build3DControlsSection()
        root.addView(section3DControls)

        // 3-Layer Parallax Section
        sectionParallaxControls = buildParallaxControlsSection()
        root.addView(sectionParallaxControls)

        setContentView(scroll)
    }

    private fun buildPreviewBezel(): View {
        val wrapper = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val bezelW = dp(204)
        val bezelH = dp(372)
        val phoneBezel = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(bezelW, bezelH, Gravity.CENTER_HORIZONTAL)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#111622"))
                cornerRadius = dp(30).toFloat()
                setStroke(dp(2), Color.parseColor("#35415C"))
            }
            setPadding(dp(7), dp(7), dp(7), dp(7))
            clipToOutline = true
        }

        val screenContainer = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            background = GradientDrawable().apply {
                setColor(Color.BLACK)
                cornerRadius = dp(24).toFloat()
            }
            clipToOutline = true
        }

        glRenderer = GravityGLRenderer(this, config)
        glSurfaceView = GLSurfaceView(this).apply {
            setEGLContextClientVersion(3)
            preserveEGLContextOnPause = true
            setRenderer(glRenderer)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }

        parallaxPreviewView = ParallaxPreviewView(this, config)

        screenContainer.addView(
            glSurfaceView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        screenContainer.addView(
            parallaxPreviewView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        // Subtle mock clock overlay for home/lock preview framing
        val clockOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(22), 0, 0)
            isClickable = false
        }
        clockOverlay.addView(TextView(this).apply {
            text = "10:09"
            textSize = 36f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.argb(228, 255, 255, 255))
            setShadowLayer(8f, 0f, 3f, Color.argb(140, 0, 0, 0))
            gravity = Gravity.CENTER
        })
        clockOverlay.addView(TextView(this).apply {
            text = "周日 · 手指拖动预览倾斜视差"
            textSize = 10f
            setTextColor(Color.argb(190, 235, 242, 255))
            setShadowLayer(4f, 0f, 1f, Color.argb(140, 0, 0, 0))
            gravity = Gravity.CENTER
        })
        screenContainer.addView(clockOverlay)

        // Interactive touch-to-tilt simulation inside preview bezel
        screenContainer.setOnTouchListener { v, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                    v.parent?.requestDisallowInterceptTouchEvent(true)
                    if (!useLiveGyro && v.width > 0 && v.height > 0) {
                        val rawX = ((event.x / v.width) - 0.5f) * 2.1f
                        val rawY = (0.5f - (event.y / v.height)) * 2.1f
                        val len = max(0.001f, sqrt(rawX * rawX + rawY * rawY))
                        val mag = min(len, 1.0f)
                        val nx = (rawX / len) * mag
                        val ny = (rawY / len) * mag
                        glRenderer.updateTilt(nx, ny)
                        parallaxPreviewView.updateTilt(nx, ny)
                        val gz = -0.68f
                        val gLen = max(0.001f, sqrt(nx * nx + ny * ny + gz * gz))
                        glRenderer.updateGravity(nx / gLen, ny / gLen, gz / gLen)
                    }
                    true
                }
                else -> false
            }
        }

        phoneBezel.addView(screenContainer)
        wrapper.addView(phoneBezel)
        return wrapper
    }

    private fun buildQuickActionRow(): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, 0)
        }

        val shakeBtn = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
            text = "摇一摇抛散"
            textSize = 12f
            cornerRadius = dp(20)
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(0, dp(40), 1f).apply { rightMargin = dp(8) }
            setOnClickListener {
                if (config.engineMode == EngineMode.PHYSICS_3D) {
                    glRenderer.triggerShakeImpulse(0f, 0f, 3.6f)
                } else {
                    sensorHelper.recenterParallax()
                    Toast.makeText(this@MainActivity, "已校准三层视差中心基准位", Toast.LENGTH_SHORT).show()
                }
            }
        }

        gyroToggleBtn = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
            text = "指尖拖拽模式"
            textSize = 12f
            cornerRadius = dp(20)
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(0, dp(40), 1f)
            setOnClickListener {
                useLiveGyro = !useLiveGyro
                if (useLiveGyro) {
                    sensorHelper.start()
                } else {
                    sensorHelper.stop()
                }
                updateGyroButtonVisual()
            }
        }

        row.addView(shakeBtn)
        row.addView(gyroToggleBtn)
        return row
    }

    private fun buildEngineSelectorCard(): View {
        val card = makeSectionCard("核心渲染引擎切换")
        engineToggleGroup = MaterialButtonToggleGroup(this).apply {
            isSingleSelection = true
            isSelectionRequired = true
        }

        btnEngine3D = makeToggleOptionButton("3D 重力物理 (OpenGL)")
        btnEngineParallax = makeToggleOptionButton("3层 PNG 视差 (Canvas)")
        engineToggleGroup.addView(btnEngine3D)
        engineToggleGroup.addView(btnEngineParallax)

        engineToggleGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            val targetMode = if (checkedId == btnEngine3D.id) EngineMode.PHYSICS_3D else EngineMode.PARALLAX_3LAYER
            if (targetMode != config.engineMode) {
                updateConfig(config.copy(engineMode = targetMode))
            }
        }

        card.addView(engineToggleGroup)
        return card
    }

    private fun buildDepthCard(): View {
        val card = makeSectionCard("视差景深强度 (0.5x – 2.0x)")
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        depthLabelValue = TextView(this).apply {
            text = String.format("%.1fx", config.depthStrength)
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(getColor(R.color.studio_primary))
            layoutParams = LinearLayout.LayoutParams(dp(46), LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        depthSlider = Slider(this).apply {
            valueFrom = 0.5f
            valueTo = 2.0f
            stepSize = 0.1f
            value = config.depthStrength
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            addOnChangeListener { _, value, fromUser ->
                depthLabelValue.text = String.format("%.1fx", value)
                if (fromUser) {
                    updateConfig(config.copy(depthStrength = value))
                }
            }
        }
        row.addView(depthSlider)
        row.addView(depthLabelValue)
        card.addView(row)
        return card
    }

    private fun build3DControlsSection(): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        // Theme cards strip
        val themeCard = makeSectionCard("3D 材质主题 (6 大高精度物理场景)")
        val hScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
        }
        val strip = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        for (theme in WallpaperTheme.entries) {
            val btn = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
                text = "${theme.shortCode} ${theme.displayName}"
                textSize = 12f
                cornerRadius = dp(14)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    dp(44)
                ).apply { rightMargin = dp(8) }
                setOnClickListener {
                    updateConfig(config.copy(theme = theme))
                }
            }
            themeButtons[theme] = btn
            strip.addView(btn)
        }
        hScroll.addView(strip)
        themeCard.addView(hScroll)
        container.addView(themeCard)

        // Velvet preset row (shown only for Diamond theme)
        velvetRowContainer = makeSectionCard("钻石天鹅绒底衬 (4 色高定)")
        val velvetRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        for (preset in VelvetPreset.entries) {
            val vBtn = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
                text = preset.displayName.take(4)
                textSize = 11f
                cornerRadius = dp(12)
                setPadding(dp(4), 0, dp(4), 0)
                layoutParams = LinearLayout.LayoutParams(0, dp(38), 1f).apply { rightMargin = dp(6) }
                setOnClickListener { updateConfig(config.copy(velvetPreset = preset)) }
            }
            velvetButtons[preset] = vBtn
            velvetRow.addView(vBtn)
        }
        velvetRowContainer.addView(velvetRow)
        container.addView(velvetRowContainer)

        // Density + Restitution card
        val physCard = makeSectionCard("粒子数量 & 碰撞回弹参数")
        densityToggleGroup = MaterialButtonToggleGroup(this).apply {
            isSingleSelection = true
            isSelectionRequired = true
        }
        for (preset in DensityPreset.entries) {
            val dBtn = makeToggleOptionButton(preset.label)
            densityButtons[preset] = dBtn
            densityToggleGroup.addView(dBtn)
        }
        densityToggleGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            val match = densityButtons.entries.firstOrNull { it.value.id == checkedId }?.key ?: return@addOnButtonCheckedListener
            if (match != config.density) {
                updateConfig(config.copy(density = match))
            }
        }
        physCard.addView(densityToggleGroup)

        val restRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(10), 0, 0)
        }
        restRow.addView(TextView(this).apply {
            text = "回弹"
            textSize = 12f
            setTextColor(Color.parseColor("#B5BFD6"))
        })
        restitutionSlider = Slider(this).apply {
            valueFrom = 0.4f
            valueTo = 1.4f
            stepSize = 0.1f
            value = config.restitutionScale
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            addOnChangeListener { _, value, fromUser ->
                restitutionLabelValue.text = String.format("%.1fx", value)
                if (fromUser) {
                    updateConfig(config.copy(restitutionScale = value))
                }
            }
        }
        restitutionLabelValue = TextView(this).apply {
            text = String.format("%.1fx", config.restitutionScale)
            textSize = 12f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.WHITE)
        }
        restRow.addView(restitutionSlider)
        restRow.addView(restitutionLabelValue)
        physCard.addView(restRow)

        container.addView(physCard)
        return container
    }

    private fun buildParallaxControlsSection(): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        val presetCard = makeSectionCard("三层视差方案 (背景 +5% · 呼吸辉光 +12% · 反向悬浮前景 -25%)")
        parallaxPresetGroup = MaterialButtonToggleGroup(this).apply {
            isSingleSelection = true
            isSelectionRequired = true
        }
        for (preset in ParallaxPreset.entries) {
            val btn = makeToggleOptionButton(preset.label)
            parallaxPresetButtons[preset] = btn
            parallaxPresetGroup.addView(btn)
        }
        parallaxPresetGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            val match = parallaxPresetButtons.entries.firstOrNull { it.value.id == checkedId }?.key ?: return@addOnButtonCheckedListener
            if (match != config.parallaxPreset) {
                updateConfig(config.copy(parallaxPreset = match))
            }
        }
        presetCard.addView(parallaxPresetGroup)
        container.addView(presetCard)

        val customCard = makeSectionCard("替换你自己的三张分层图 (支持相册透明 PNG)")
        customLayerStatusText = TextView(this).apply {
            textSize = 12f
            setTextColor(Color.parseColor("#9BA6BE"))
            setPadding(0, 0, 0, dp(10))
        }
        customCard.addView(customLayerStatusText)

        for (slot in CustomLayerSlot.entries) {
            val pickBtn = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
                text = "从相册选择 ${slot.label}"
                textSize = 12f
                cornerRadius = dp(12)
                setTextColor(Color.WHITE)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(42)
                ).apply { bottomMargin = dp(6) }
                setOnClickListener {
                    pendingSlot = slot
                    pickImageLauncher.launch(arrayOf("image/*"))
                }
            }
            customCard.addView(pickBtn)
        }

        val resetBtn = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
            text = "清除自定义图层 · 恢复内置赛博主板"
            textSize = 12f
            cornerRadius = dp(12)
            setTextColor(Color.parseColor("#FFD659"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(40)
            )
            setOnClickListener {
                CustomLayerSlot.entries.forEach { slot ->
                    WallpaperConfigStore.customLayerFile(this@MainActivity, slot).delete()
                }
                updateConfig(
                    config.copy(
                        parallaxPreset = ParallaxPreset.CYBER_CIRCUIT,
                        customLayerRevision = System.currentTimeMillis()
                    )
                )
            }
        }
        customCard.addView(resetBtn)
        container.addView(customCard)
        return container
    }

    private fun makeSectionCard(title: String): LinearLayout {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(getColor(R.color.studio_surface))
                cornerRadius = dp(16).toFloat()
                setStroke(dp(1), getColor(R.color.studio_outline))
            }
            setPadding(dp(14), dp(12), dp(14), dp(12))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(12) }
        }
        card.addView(TextView(this).apply {
            text = title
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.WHITE)
            setPadding(0, 0, 0, dp(8))
        })
        return card
    }

    private fun makeToggleOptionButton(label: String): MaterialButton =
        MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
            id = View.generateViewId()
            text = label
            textSize = 11f
            setPadding(dp(6), 0, dp(6), 0)
            layoutParams = LinearLayout.LayoutParams(0, dp(42), 1f)
        }

    private fun updateConfig(newConfig: WallpaperConfig) {
        val modeChanged = newConfig.engineMode != config.engineMode
        config = newConfig
        WallpaperConfigStore.save(this, newConfig)

        glRenderer.applyConfig(newConfig)
        parallaxPreviewView.applyConfig(newConfig)

        if (modeChanged) {
            if (newConfig.engineMode == EngineMode.PHYSICS_3D) {
                parallaxPreviewView.stopLoop()
                glSurfaceView.onResume()
            } else {
                glSurfaceView.onPause()
                parallaxPreviewView.startLoop()
            }
        }
        syncUiState()
    }

    private fun syncUiState() {
        val is3D = config.engineMode == EngineMode.PHYSICS_3D

        engineToggleGroup.check(if (is3D) btnEngine3D.id else btnEngineParallax.id)
        glSurfaceView.visibility = if (is3D) View.VISIBLE else View.GONE
        parallaxPreviewView.visibility = if (is3D) View.GONE else View.VISIBLE

        section3DControls.visibility = if (is3D) View.VISIBLE else View.GONE
        sectionParallaxControls.visibility = if (is3D) View.GONE else View.VISIBLE

        velvetRowContainer.visibility = if (is3D && config.theme == WallpaperTheme.DIAMOND) View.VISIBLE else View.GONE

        for ((theme, btn) in themeButtons) {
            val selected = theme == config.theme
            btn.setTextColor(if (selected) Color.BLACK else Color.WHITE)
            btn.setBackgroundColor(if (selected) theme.accentArgb else Color.TRANSPARENT)
        }

        for ((preset, btn) in velvetButtons) {
            val selected = preset == config.velvetPreset
            btn.setTextColor(Color.WHITE)
            btn.setBackgroundColor(if (selected) preset.swatchArgb else Color.TRANSPARENT)
        }

        densityButtons[config.density]?.let { densityToggleGroup.check(it.id) }
        parallaxPresetButtons[config.parallaxPreset]?.let { parallaxPresetGroup.check(it.id) }

        val customCount = CustomLayerSlot.entries.count {
            WallpaperConfigStore.customLayerFile(this, it).let { f -> f.isFile && f.length() > 0L }
        }
        customLayerStatusText.text = if (customCount == 0) {
            "当前使用内置图层。可用 AI 抠图工具导出透明前景后点下方按钮替换（已导入 $customCount/3 层）"
        } else {
            "已导入自定义图层：$customCount/3 层（未导入的层自动回退内置图层）"
        }

        updateGyroButtonVisual()
    }

    private fun updateGyroButtonVisual() {
        gyroToggleBtn.text = if (useLiveGyro) "真机陀螺仪运行中" else "指尖拖拽预览"
        gyroToggleBtn.setTextColor(
            if (useLiveGyro) getColor(R.color.studio_primary) else Color.WHITE
        )
    }

    private fun importCustomLayer(slot: CustomLayerSlot, uri: Uri) {
        try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            val maxDim = max(bounds.outWidth, bounds.outHeight).coerceAtLeast(1)
            var sampleSize = 1
            while (maxDim / sampleSize > 1600) {
                sampleSize *= 2
            }

            val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val bmp = contentResolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, decodeOpts)
            } ?: return

            val outFile = WallpaperConfigStore.customLayerFile(this, slot)
            FileOutputStream(outFile).use { fos ->
                bmp.compress(Bitmap.CompressFormat.PNG, 95, fos)
            }
            bmp.recycle()

            updateConfig(
                config.copy(
                    parallaxPreset = ParallaxPreset.CUSTOM,
                    customLayerRevision = System.currentTimeMillis()
                )
            )
            Toast.makeText(this, "已载入 ${slot.label}", Toast.LENGTH_SHORT).show()
        } catch (exc: Exception) {
            Toast.makeText(this, "图片读取失败: ${exc.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }

    private fun launchLiveWallpaperPicker() {
        WallpaperConfigStore.save(this, config)
        val component = ComponentName(this, GravityWallpaperService::class.java)
        val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
            putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, component)
        }
        try {
            startActivity(intent)
        } catch (_: Exception) {
            try {
                startActivity(Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER))
            } catch (_: Exception) {
                Toast.makeText(
                    this,
                    "请前往系统「设置 → 壁纸 → 动态壁纸」选择「Gravity 3D」",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }
}
