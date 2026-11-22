package com.gravitystudio.wallpaper.sensor

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Unified IMU helper reading TYPE_ROTATION_VECTOR (smoothed tilt for parallax & camera)
 * plus TYPE_GRAVITY / TYPE_ACCELEROMETER and TYPE_LINEAR_ACCELERATION (impulse shakes).
 * Strictly unregisters all sensors in stop() to conserve battery when invisible.
 */
class OrientationSensorHelper(
    context: Context,
    private val listener: Listener
) : SensorEventListener {

    interface Listener {
        fun onTiltUpdated(tiltX: Float, tiltY: Float)
        fun onGravityUpdated(gx: Float, gy: Float, gz: Float)
        fun onShakeImpulse(ax: Float, ay: Float, az: Float)
    }

    private val sensorManager: SensorManager =
        context.applicationContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    private val rotationSensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    private val gravitySensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY)
    private val accelSensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val linearAccelSensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)

    private var isStarted = false
    private val rotMatrix = FloatArray(9)
    private val orientationAngles = FloatArray(3)
    private var hasReferenceAngles = false
    private var refPitch = 0f
    private var refRoll = 0f

    private var smoothTiltX = 0f
    private var smoothTiltY = 0f
    private var lastShakeTimeMs = 0L

    fun start() {
        if (isStarted) return
        isStarted = true
        hasReferenceAngles = false

        rotationSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
        val gravOrAccel = gravitySensor ?: accelSensor
        gravOrAccel?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
        linearAccelSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    fun stop() {
        if (!isStarted) return
        isStarted = false
        sensorManager.unregisterListener(this)
    }

    fun recenterParallax() {
        hasReferenceAngles = false
    }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR -> handleRotationVector(event.values)
            Sensor.TYPE_GRAVITY, Sensor.TYPE_ACCELEROMETER -> handleGravityVector(event.values)
            Sensor.TYPE_LINEAR_ACCELERATION -> handleLinearAcceleration(event.values)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun handleRotationVector(values: FloatArray) {
        SensorManager.getRotationMatrixFromVector(rotMatrix, values)
        SensorManager.getOrientation(rotMatrix, orientationAngles)

        // orientationAngles[1] = pitch (-pi/2..pi/2), orientationAngles[2] = roll (-pi..pi)
        val pitch = orientationAngles[1]
        val roll = orientationAngles[2]

        if (!hasReferenceAngles) {
            refPitch = pitch
            refRoll = roll
            hasReferenceAngles = true
        }

        // Gently adapt reference toward sustained holding posture while tracking quick wrist tilts cleanly
        val dRoll = wrapAngle(roll - refRoll)
        val dPitch = pitch - refPitch
        refRoll = wrapAngle(refRoll + dRoll * 0.015f)
        refPitch += dPitch * 0.015f

        val rawTiltX = (dRoll / 0.55f).coerceIn(-1f, 1f)
        val rawTiltY = (-dPitch / 0.55f).coerceIn(-1f, 1f)

        val alpha = 0.16f
        smoothTiltX += (rawTiltX - smoothTiltX) * alpha
        smoothTiltY += (rawTiltY - smoothTiltY) * alpha
        listener.onTiltUpdated(smoothTiltX, smoothTiltY)

        if (gravitySensor == null && accelSensor == null) {
            // Derive synthetic downward vector if accelerometer unavailable
            val gx = (-rotMatrix[2]).coerceIn(-1f, 1f)
            val gy = (-rotMatrix[5]).coerceIn(-1f, 1f)
            val gz = (-0.65f)
            val len = max(0.001f, sqrt(gx * gx + gy * gy + gz * gz))
            listener.onGravityUpdated(gx / len, gy / len, gz / len)
        }
    }

    private fun handleGravityVector(values: FloatArray) {
        // Android device coordinates: +X right, +Y up (towards top earpiece), +Z out of screen.
        // Invert to get downward gravity vector so balls fall toward the tilted bottom edge.
        val gx = -values[0]
        val gy = -values[1]
        val gz = if (values[2] > 1.8f) -1.8f else -max(1.8f, values[2])
        val len = max(0.001f, sqrt(gx * gx + gy * gy + gz * gz))
        listener.onGravityUpdated(gx / len, gy / len, gz / len)
    }

    private fun handleLinearAcceleration(values: FloatArray) {
        val mag = sqrt(values[0] * values[0] + values[1] * values[1] + values[2] * values[2])
        if (mag > 4.2f) {
            val now = System.currentTimeMillis()
            if (now - lastShakeTimeMs > 180L) {
                lastShakeTimeMs = now
                listener.onShakeImpulse(-values[0], -values[1], max(2.2f, -values[2]))
            }
        }
    }

    private fun wrapAngle(angle: Float): Float {
        var a = angle
        while (a > Math.PI.toFloat()) a -= (Math.PI * 2.0).toFloat()
        while (a < -Math.PI.toFloat()) a += (Math.PI * 2.0).toFloat()
        return a
    }
}
