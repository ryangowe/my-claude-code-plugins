import Foundation

/// Deterministic fake hit-timing model for tests and previews.
struct MockDetector {
    let onBeatWindow: Duration
    let freeReactionOffset: Duration
    let freeJitter: Duration

    /// Timing spread sized so the on-beat window spans `z` sigmas.
    private func timingSigma(z: Double) -> Duration {
        .seconds(onBeatWindow.inSeconds / z)
    }

    func onBeatHit(anchor: Duration, g: Double, z: Double) -> Duration {
        anchor + .seconds(g * timingSigma(z: z).inSeconds)
    }

    func freeHit(base: Duration, g: Double) -> Duration {
        let offset = max(0, freeReactionOffset.inSeconds + g * freeJitter.inSeconds)
        return base + .seconds(offset)
    }
}
