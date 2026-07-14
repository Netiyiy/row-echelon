import SwiftUI

enum GameLoadState: Equatable {
    case loading
    case ready
    case failed(String)
}

struct GameContainerView: View {
    @State private var loadState: GameLoadState = .loading
    @State private var reloadToken = UUID()

    var body: some View {
        ZStack {
            Color(red: 74 / 255, green: 48 / 255, blue: 38 / 255)
                .ignoresSafeArea()

            GameWebView(loadState: $loadState, reloadToken: reloadToken)
                .ignoresSafeArea()

            switch loadState {
            case .loading:
                ProgressView()
                    .tint(Color(red: 1, green: 232 / 255, blue: 189 / 255))
                    .controlSize(.large)
                    .accessibilityLabel("Loading Row Echelon")
            case .failed(let message):
                ContentUnavailableView {
                    Label("Unable to Open Game", systemImage: "exclamationmark.triangle.fill")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try Again") {
                        loadState = .loading
                        reloadToken = UUID()
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(28)
            case .ready:
                EmptyView()
            }
        }
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
    }
}
