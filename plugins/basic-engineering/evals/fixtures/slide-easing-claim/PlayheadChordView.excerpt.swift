import SwiftUI

struct PlayheadChordView: View {
    let state: PlayheadChordState
    let chord: Chord
    @State private var slideDistance: CGFloat = 0

    var body: some View {
        ZStack {
            ChordLetterView(chord: chord, feedback: .idle)
                .frame(width: 260, height: 260)
                .id(state.currentEvent.id)
                .transition(Slide.transition(distance: slideDistance))
        }
        .frame(maxWidth: .infinity)
        .clipped()
        .animation(.easeInOut(duration: Slide.duration), value: state.currentEvent.id)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { slideDistance = $0 }
    }
}
