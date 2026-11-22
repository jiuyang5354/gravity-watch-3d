package com.gravitystudio.wallpaper.model

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import java.io.File

enum class EngineMode(val id: String, val label: String) {
    PHYSICS_3D("physics_3d", "真 3D 重力物理 (OpenGL ES)"),
    PARALLAX_3LAYER("parallax_3layer", "3 层 PNG 裸眼视差 (Canvas)");

    companion object {
        fun fromId(id: String?): EngineMode = entries.firstOrNull { it.id == id } ?: PHYSICS_3D
    }
}

enum class WallpaperTheme(
    val id: String,
    val shortCode: String,
    val displayName: String,
    val subtitle: String,
    val accentArgb: Int,
    val floorMode: Int
) {
    TENNIS("tennis", "01", "网球", "EPDM 橡胶球场", Color.rgb(214, 245, 46), 0),
    DIAMOND("diamond", "02", "钻石", "57面火彩 · 丝绒底衬", Color.rgb(168, 238, 255), 1),
    BASKETBALL("basketball", "03", "篮球", "清漆枫木地板", Color.rgb(255, 134, 42), 2),
    GOLD_BAR("goldBar", "04", "金条", "999.9 瑞士铸金 · 黑曜金库", Color.rgb(255, 214, 89), 3),
    SOCCER("soccer", "05", "足球", "绿茵修剪草场", Color.rgb(154, 245, 105), 4),
    CYBER_CIRCUIT("cyberCircuit", "06", "透明主板", "全息玻璃 · 脉冲电路板", Color.rgb(73, 226, 255), 5);

    fun objectCount(density: DensityPreset): Int = when (this to density) {
        DIAMOND to DensityPreset.LITE -> 9
        GOLD_BAR to DensityPreset.LITE -> 7
        CYBER_CIRCUIT to DensityPreset.LITE -> 7
        TENNIS to DensityPreset.LITE, BASKETBALL to DensityPreset.LITE, SOCCER to DensityPreset.LITE -> 8

        TENNIS to DensityPreset.CINEMATIC -> 13
        DIAMOND to DensityPreset.CINEMATIC -> 13
        BASKETBALL to DensityPreset.CINEMATIC -> 12
        GOLD_BAR to DensityPreset.CINEMATIC -> 11
        SOCCER to DensityPreset.CINEMATIC -> 13
        CYBER_CIRCUIT to DensityPreset.CINEMATIC -> 10

        GOLD_BAR to DensityPreset.DENSE -> 18
        CYBER_CIRCUIT to DensityPreset.DENSE -> 16
        DIAMOND to DensityPreset.DENSE -> 24
        BASKETBALL to DensityPreset.DENSE -> 22
        else -> 24
    }

    companion object {
        fun fromId(id: String?): WallpaperTheme = entries.firstOrNull { it.id == id } ?: CYBER_CIRCUIT
    }
}

enum class VelvetPreset(
    val id: String,
    val displayName: String,
    val swatchArgb: Int,
    val coreRgb: FloatArray,
    val midRgb: FloatArray,
    val sheenRgb: FloatArray,
    val rimRgb: FloatArray
) {
    OBSIDIAN(
        "obsidian",
        "玄黑天鹅绒",
        Color.rgb(36, 39, 52),
        floatArrayOf(0.0014f, 0.0016f, 0.0028f),
        floatArrayOf(0.0085f, 0.0095f, 0.0150f),
        floatArrayOf(0.095f, 0.105f, 0.140f),
        floatArrayOf(0.140f, 0.155f, 0.200f)
    ),
    BURGUNDY(
        "burgundy",
        "高定酒红",
        Color.rgb(122, 20, 38),
        floatArrayOf(0.0060f, 0.0004f, 0.0012f),
        floatArrayOf(0.0420f, 0.0022f, 0.0065f),
        floatArrayOf(0.240f, 0.022f, 0.052f),
        floatArrayOf(0.340f, 0.045f, 0.088f)
    ),
    SAPPHIRE(
        "sapphire",
        "皇家午夜蓝",
        Color.rgb(28, 61, 143),
        floatArrayOf(0.0008f, 0.0022f, 0.0085f),
        floatArrayOf(0.0055f, 0.0160f, 0.0550f),
        floatArrayOf(0.045f, 0.110f, 0.280f),
        floatArrayOf(0.085f, 0.180f, 0.400f)
    ),
    EMERALD(
        "emerald",
        "帝王祖母绿",
        Color.rgb(23, 102, 56),
        floatArrayOf(0.0006f, 0.0045f, 0.0022f),
        floatArrayOf(0.0040f, 0.0320f, 0.0160f),
        floatArrayOf(0.035f, 0.160f, 0.088f),
        floatArrayOf(0.075f, 0.250f, 0.140f)
    );

    companion object {
        fun fromId(id: String?): VelvetPreset = entries.firstOrNull { it.id == id } ?: OBSIDIAN
    }
}

enum class DensityPreset(val id: String, val label: String) {
    LITE("lite", "轻量省电"),
    CINEMATIC("cinematic", "标准电影感"),
    DENSE("dense", "高密丰富");

    companion object {
        fun fromId(id: String?): DensityPreset = entries.firstOrNull { it.id == id } ?: CINEMATIC
    }
}

enum class ParallaxPreset(val id: String, val label: String) {
    CYBER_CIRCUIT("cyber_circuit", "赛博透明主板"),
    GOLD_MINIMAL("gold_minimal", "流金极简浮雕"),
    CUSTOM("custom", "自定义相册三图层");

    companion object {
        fun fromId(id: String?): ParallaxPreset = entries.firstOrNull { it.id == id } ?: CYBER_CIRCUIT
    }
}

data class WallpaperConfig(
    val engineMode: EngineMode = EngineMode.PHYSICS_3D,
    val theme: WallpaperTheme = WallpaperTheme.CYBER_CIRCUIT,
    val velvetPreset: VelvetPreset = VelvetPreset.OBSIDIAN,
    val density: DensityPreset = DensityPreset.CINEMATIC,
    val parallaxPreset: ParallaxPreset = ParallaxPreset.CYBER_CIRCUIT,
    val depthStrength: Float = 1.0f,
    val restitutionScale: Float = 1.0f,
    val customLayerRevision: Long = 0L
)

object WallpaperConfigStore {
    const val PREFS_NAME = "gravity_wallpaper_prefs"

    private const val KEY_ENGINE_MODE = "engine_mode"
    private const val KEY_THEME = "theme"
    private const val KEY_VELVET = "velvet"
    private const val KEY_DENSITY = "density"
    private const val KEY_PARALLAX_PRESET = "parallax_preset"
    private const val KEY_DEPTH_STRENGTH = "depth_strength"
    private const val KEY_RESTITUTION_SCALE = "restitution_scale"
    private const val KEY_CUSTOM_REVISION = "custom_layer_revision"

    fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(context: Context): WallpaperConfig {
        val sp = prefs(context)
        return WallpaperConfig(
            engineMode = EngineMode.fromId(sp.getString(KEY_ENGINE_MODE, null)),
            theme = WallpaperTheme.fromId(sp.getString(KEY_THEME, null)),
            velvetPreset = VelvetPreset.fromId(sp.getString(KEY_VELVET, null)),
            density = DensityPreset.fromId(sp.getString(KEY_DENSITY, null)),
            parallaxPreset = ParallaxPreset.fromId(sp.getString(KEY_PARALLAX_PRESET, null)),
            depthStrength = sp.getFloat(KEY_DEPTH_STRENGTH, 1.0f).coerceIn(0.5f, 2.0f),
            restitutionScale = sp.getFloat(KEY_RESTITUTION_SCALE, 1.0f).coerceIn(0.4f, 1.4f),
            customLayerRevision = sp.getLong(KEY_CUSTOM_REVISION, 0L)
        )
    }

    fun save(context: Context, config: WallpaperConfig) {
        prefs(context).edit()
            .putString(KEY_ENGINE_MODE, config.engineMode.id)
            .putString(KEY_THEME, config.theme.id)
            .putString(KEY_VELVET, config.velvetPreset.id)
            .putString(KEY_DENSITY, config.density.id)
            .putString(KEY_PARALLAX_PRESET, config.parallaxPreset.id)
            .putFloat(KEY_DEPTH_STRENGTH, config.depthStrength.coerceIn(0.5f, 2.0f))
            .putFloat(KEY_RESTITUTION_SCALE, config.restitutionScale.coerceIn(0.4f, 1.4f))
            .putLong(KEY_CUSTOM_REVISION, config.customLayerRevision)
            .apply()
    }

    fun customLayerDir(context: Context): File =
        File(context.applicationContext.filesDir, "parallax_custom").apply { mkdirs() }

    fun customLayerFile(context: Context, slot: CustomLayerSlot): File =
        File(customLayerDir(context), slot.fileName)
}

enum class CustomLayerSlot(val fileName: String, val label: String) {
    BACKGROUND("custom_bg.png", "背景层 (background.png)"),
    GLOW("custom_glow.png", "辉光层 (glow.png)"),
    FOREGROUND("custom_fg.png", "透明前景 (foreground.png)")
}
