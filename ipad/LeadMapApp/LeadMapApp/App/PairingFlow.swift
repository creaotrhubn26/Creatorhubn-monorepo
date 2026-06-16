// PairingFlow.swift
//
// QR-scan-flow for å koble iPad til en eksisterende web-konto. Web
// Admin Room viser en kort-levd QR-kode → vi scanner med iPad-kamera →
// utveksler scan-data mot et permanent bearer-token.
//
// SKELETON. Faktisk QR-kamera-implementasjonen kommer i fase 1.

import SwiftUI
import AVFoundation

struct PairingView: View {
    @Environment(AppState.self) private var appState
    @State private var manualToken: String = ""
    @State private var manualEmail: String = ""
    @State private var isPairing = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "map.fill")
                .font(.system(size: 64))
                .foregroundStyle(.tint)
            Text("Lead Map")
                .font(.largeTitle.bold())
            Text("Koble iPad til Lead Map-kontoen din")
                .foregroundStyle(.secondary)

            // TODO Fase 1: erstatt med ekte QR-scanner (AVCaptureSession)
            ScannerStub()
                .frame(maxWidth: 420, maxHeight: 280)

            VStack(spacing: 12) {
                Text("Eller lim inn token manuelt")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextField("Bearer-token", text: $manualToken)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                TextField("E-post", text: $manualEmail)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                Button {
                    Task { await signInManually() }
                } label: {
                    if isPairing {
                        ProgressView().progressViewStyle(.circular)
                    } else {
                        Text("Logg inn")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(manualToken.isEmpty || isPairing)

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }
            .padding(.horizontal, 32)

            Spacer()
        }
        .padding(.top, 60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func signInManually() async {
        guard !manualToken.isEmpty else { return }
        isPairing = true
        errorMessage = nil
        await appState.signIn(token: manualToken, email: manualEmail.isEmpty ? nil : manualEmail)
        isPairing = false
    }
}

/// Placeholder for ekte QR-scanner. Fase 1 erstatter med AVCaptureSession.
private struct ScannerStub: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 16)
            .strokeBorder(.secondary, style: StrokeStyle(lineWidth: 2, dash: [8, 6]))
            .overlay(
                VStack(spacing: 8) {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 48))
                    Text("Kamera-scanner kommer")
                        .foregroundStyle(.secondary)
                }
            )
            .background(Color.black.opacity(0.2))
    }
}
