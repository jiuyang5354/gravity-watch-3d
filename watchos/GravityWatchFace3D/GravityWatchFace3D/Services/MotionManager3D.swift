import CoreMotion
import Foundation
import SceneKit
import WatchKit

final class MotionManager3D {
    private let motionManager = CMMotionManager()
    private let updateFrequencyHz: Double = 60.0
    private(set) var isRunning = false

    var onMotionUpdate: ((SCNVector3, SCNVector3) -> Void)?

    func start() {
        guard !isRunning else { return }
        guard motionManager.isDeviceMotionAvailable else { return }

        motionManager.deviceMotionUpdateInterval = 1.0 / updateFrequencyHz
        isRunning = true

        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, error in
            guard let self, let motion, error == nil else { return }

            var gx = Float(motion.gravity.x)
            var gy = Float(motion.gravity.y)
            let gz = Float(motion.gravity.z)

            var ax = Float(motion.userAcceleration.x)
            var ay = Float(motion.userAcceleration.y)
            let az = Float(motion.userAcceleration.z)

            // CoreMotion reports in hardware device axes; invert X/Y when Digital Crown is on the left.
            if WKInterfaceDevice.current().crownOrientation == .left {
                gx = -gx
                gy = -gy
                ax = -ax
                ay = -ay
            }

            // Normalize exact unit-sphere gravity vector while preserving slight inward Z floor component
            let clampedGz = gz > -0.15 ? Float(-0.15) : gz
            let len = max(sqrtf(gx * gx + gy * gy + clampedGz * clampedGz), 0.001)
            let unitGravity = SCNVector3(gx / len, gy / len, clampedGz / len)
            let userAccel = SCNVector3(ax, ay, az)

            self.onMotionUpdate?(unitGravity, userAccel)
        }
    }

    func stop() {
        guard isRunning else { return }
        motionManager.stopDeviceMotionUpdates()
        isRunning = false
    }

    deinit {
        stop()
    }
}
