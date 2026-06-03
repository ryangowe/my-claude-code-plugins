import Foundation

extension Duration {
    /// This duration as a Double count of seconds.
    var inSeconds: Double {
        let c = components
        return Double(c.seconds) + Double(c.attoseconds) * 1e-18
    }
}
