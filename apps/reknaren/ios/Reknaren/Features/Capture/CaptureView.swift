import SwiftUI
import UIKit

@MainActor
@Observable
final class CaptureViewModel {
    enum Status: Equatable { case idle, uploading, done(String), failed(String) }
    var status: Status = .idle

    func upload(orgId: String, imageData: Data) async {
        status = .uploading
        struct Body: Encodable { let filename: String; let mimeType: String; let contentBase64: String; let source: String }
        let name = "kvittering-\(Int(Date().timeIntervalSince1970)).jpg"
        let body = Body(filename: name, mimeType: "image/jpeg", contentBase64: imageData.base64EncodedString(), source: "mobile")
        do {
            let _: Empty = try await APIClient.shared.post("/api/organizations/\(orgId)/documents", body: body)
            status = .done("Kvitteringen er lastet opp. Vi leser den nå, og den dukker opp under avstemming.")
        } catch {
            status = .failed(error.localizedDescription)
        }
    }
}

/// Snap en kvittering med kameraet (eller velg fra bilder) → lastes opp og tolkes.
/// Dette er mobil-killeren: du står i butikken, tar bildet, ferdig.
struct CaptureView: View {
    let orgId: String
    @State private var model = CaptureViewModel()
    @State private var showCamera = false
    @State private var showLibrary = false

    private var hasCamera: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "doc.viewfinder")
                .font(.system(size: 56))
                .foregroundStyle(Color(red: 0.12, green: 0.30, blue: 0.23))
            Text("Ta bilde av kvitteringen").font(.title3.bold())
            Text("Vi leser beløp, dato og leverandør automatisk, og kobler den mot betalingen i banken.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center).padding(.horizontal)

            switch model.status {
            case .uploading:
                ProgressView("Laster opp…")
            case .done(let msg):
                ContentUnavailableView("Takk!", systemImage: "checkmark.seal.fill", description: Text(msg))
                    .frame(maxHeight: 200)
            case .failed(let msg):
                Text(msg).font(.footnote).foregroundStyle(.red)
            case .idle:
                EmptyView()
            }

            VStack(spacing: 10) {
                if hasCamera {
                    Button { showCamera = true } label: {
                        Label("Ta bilde", systemImage: "camera").frame(maxWidth: .infinity)
                    }.buttonStyle(.borderedProminent)
                }
                Button { showLibrary = true } label: {
                    Label("Velg fra bilder", systemImage: "photo").frame(maxWidth: .infinity)
                }.buttonStyle(.bordered)
            }
            .frame(maxWidth: 360)
            Spacer()
        }
        .padding()
        .navigationTitle("Ny kvittering")
        .sheet(isPresented: $showCamera) {
            ImagePicker(source: .camera) { data in Task { await model.upload(orgId: orgId, imageData: data) } }
                .ignoresSafeArea()
        }
        .sheet(isPresented: $showLibrary) {
            ImagePicker(source: .photoLibrary) { data in Task { await model.upload(orgId: orgId, imageData: data) } }
                .ignoresSafeArea()
        }
    }
}
