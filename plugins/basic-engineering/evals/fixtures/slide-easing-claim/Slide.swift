import SwiftUI

/// The advance slide. On each playhead change the outgoing content leaves toward
/// the leading edge while the incoming enters from the trailing edge, both fading.
/// The caller passes its own measured container width as `distance` — the incoming
/// content starts fully off-screen and slides in from the edge.
/// One-shot; symmetric `easeInOut` over `duration`.
enum Slide {
    static let duration = 0.35

    static func transition(distance: CGFloat) -> AnyTransition {
        .asymmetric(
            insertion: .offset(x: distance).combined(with: .opacity),
            removal: .offset(x: -distance).combined(with: .opacity)
        )
    }
}
