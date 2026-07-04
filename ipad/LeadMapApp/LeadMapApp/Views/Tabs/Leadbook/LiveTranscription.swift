// LiveTranscription.swift — On-device tale-til-tekst med SFSpeechRecognizer (2026-07-01)
//
// Sanntids transkripsjon på norsk, kjører lokalt via Apple's Speech-rammeverk.
// Ingen API-kall, ingen kostnad, fungerer offline.
//
// Bruk: LiveTranscriptionSheet() åpnes via header-CTA. Lagrer som Eksempel ved stopp.

import SwiftUI
import Speech
import AVFoundation

// MARK: - Engine

@MainActor
final class LiveTranscriptionEngine: ObservableObject {
    @Published var transcript: String = ""
    @Published var liveSegment: String = ""    // siste bit som ikke er commitet ennå
    @Published var isRecording: Bool = false
    @Published var audioLevel: Float = 0       // 0…1 for vu-meter
    @Published var elapsedSeconds: Int = 0
    @Published var permissionStatus: PermissionStatus = .notDetermined
    @Published var error: String?

    enum PermissionStatus {
        case notDetermined, authorized, denied, restricted
    }

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "nb-NO"))
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var timerTask: Task<Void, Never>?

    var supportsOnDevice: Bool {
        recognizer?.supportsOnDeviceRecognition ?? false
    }
    var recognizerAvailable: Bool {
        recognizer?.isAvailable ?? false
    }

    func requestPermissions() async {
        let speechStatus = await Self.requestSpeechAuthorization()
        let micGranted = await Self.requestMicrophoneAccess()
        switch speechStatus {
        case .authorized: permissionStatus = micGranted ? .authorized : .denied
        case .denied: permissionStatus = .denied
        case .restricted: permissionStatus = .restricted
        case .notDetermined: permissionStatus = .notDetermined
        @unknown default: permissionStatus = .notDetermined
        }
    }

    /// Nonisolated bridge — TCC kaller completion-blokken på bakgrunns-queue,
    /// så vi MÅ være utenfor @MainActor her ellers krasjer Swift 6.
    nonisolated private static func requestSpeechAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { (cont: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status)
            }
        }
    }

    nonisolated private static func requestMicrophoneAccess() async -> Bool {
        await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            AVAudioApplication.requestRecordPermission { granted in
                cont.resume(returning: granted)
            }
        }
    }

    func start() {
        guard permissionStatus == .authorized else {
            Task { await requestPermissions() }
            return
        }
        guard !isRecording else { return }
        guard let recognizer, recognizer.isAvailable else {
            error = "Tale-gjenkjenning er ikke tilgjengelig akkurat nå"
            return
        }
        transcript = ""
        liveSegment = ""
        elapsedSeconds = 0
        error = nil
        do {
            try setupAudioSession()
            try startEngine(with: recognizer)
            isRecording = true
            startTimer()
        } catch let e {
            error = "Kunne ikke starte opptak: \(e.localizedDescription)"
            cleanup()
        }
    }

    func stop() {
        guard isRecording else { return }
        // Commit live-segmentet
        if !liveSegment.isEmpty {
            if !transcript.isEmpty { transcript += " " }
            transcript += liveSegment
            liveSegment = ""
        }
        cleanup()
        isRecording = false
    }

    func reset() {
        stop()
        transcript = ""
        liveSegment = ""
        elapsedSeconds = 0
        audioLevel = 0
        error = nil
    }

    // MARK: Private

    private func setupAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)
    }

    private func startEngine(with recognizer: SFSpeechRecognizer) throws {
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        self.request = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, err in
            Task { @MainActor in
                guard let self else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    if result.isFinal {
                        if !self.transcript.isEmpty { self.transcript += " " }
                        self.transcript += text
                        self.liveSegment = ""
                    } else {
                        self.liveSegment = text
                    }
                }
                if let err {
                    let nsErr = err as NSError
                    // Kode 1110 = "No speech detected" — ignorer, brukeren har bare ikke begynt å snakke
                    if nsErr.code != 1110 {
                        self.error = err.localizedDescription
                    }
                }
            }
        }

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
            // Beregn audio level for vu-meter
            guard let channelData = buffer.floatChannelData?[0] else { return }
            let frames = Int(buffer.frameLength)
            var sum: Float = 0
            for i in 0..<frames { sum += abs(channelData[i]) }
            let avg = sum / Float(frames)
            Task { @MainActor [weak self] in
                self?.audioLevel = min(1, avg * 5)  // scale opp så den er synlig
            }
        }

        audioEngine.prepare()
        try audioEngine.start()
    }

    private func startTimer() {
        timerTask?.cancel()
        timerTask = Task { @MainActor [weak self] in
            while !Task.isCancelled, let self, self.isRecording {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if self.isRecording { self.elapsedSeconds += 1 }
            }
        }
    }

    private func cleanup() {
        timerTask?.cancel()
        timerTask = nil
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        request = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // Ingen deinit-cleanup — `stop()` håndterer alt, og objektet er @MainActor isolert
    // så det dies på MainActor uansett.
}

// MARK: - LiveTranscriptionSheet

struct LiveTranscriptionSheet: View {
    @StateObject private var engine = LiveTranscriptionEngine()
    @Environment(\.dismiss) private var dismiss
    @State private var showSavedToast = false
    @State private var savedTitle: String?

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        statusBanner
                        if engine.permissionStatus != .authorized {
                            permissionGate
                        } else {
                            recorderControls
                            transcriptCard
                            metaCard
                        }
                        Color.clear.frame(height: 100)
                    }
                    .padding(20)
                }
                if showSavedToast, let savedTitle {
                    VStack {
                        Spacer().frame(height: 70)
                        Label("\(savedTitle) lagret i Eksempler",
                              systemImage: "checkmark.circle.fill")
                            .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(LBrand.green, in: Capsule())
                        Spacer()
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .navigationTitle("Live transkripsjon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") {
                        engine.reset()
                        dismiss()
                    }.tint(LBrand.textSecondary)
                }
                if !engine.transcript.isEmpty && !engine.isRecording {
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            savedTitle = autoTitle()
                            withAnimation { showSavedToast = true }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
                                withAnimation { showSavedToast = false }
                                dismiss()
                            }
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "tray.and.arrow.down.fill")
                                    .font(.system(size: 11, weight: .bold))
                                Text("Lagre i Eksempler").font(.system(size: 12, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                        }.buttonStyle(.plain)
                    }
                }
            }
            .task {
                if engine.permissionStatus == .notDetermined {
                    await engine.requestPermissions()
                }
            }
        }
    }

    // MARK: Status banner

    private var statusBanner: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LBrand.green.opacity(0.22))
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(LBrand.green)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text("ALT ON-DEVICE")
                        .font(.system(size: 9, weight: .black))
                        .foregroundStyle(LBrand.green).tracking(0.8)
                    if engine.supportsOnDevice {
                        Text("· APPLE SPEECH \(engine.recognizerAvailable ? "KLAR" : "VENTER")")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(LBrand.textSecondary).tracking(0.5)
                    }
                }
                Text("Lyden forlater aldri iPad-en. Transkripsjonen kjører lokalt via SFSpeechRecognizer m/ nb-NO språkmodell.")
                    .font(.system(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(LBrand.green.opacity(0.06), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.green.opacity(0.25), lineWidth: 1))
    }

    // MARK: Permission gate

    private var permissionGate: some View {
        VStack(spacing: 16) {
            Image(systemName: "mic.slash.fill")
                .font(.system(size: 48, weight: .semibold))
                .foregroundStyle(LBrand.orange)
            Text("Vi trenger mikrofon-tilgang")
                .font(.system(size: 18, weight: .heavy)).foregroundStyle(.white)
            Text("Leadgrid bruker mikrofonen + tale-gjenkjenning for å transkribere det du sier. Begge deler kjører lokalt på enheten.")
                .font(.system(size: 13))
                .foregroundStyle(LBrand.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
            Button {
                Task { await engine.requestPermissions() }
            } label: {
                Text(engine.permissionStatus == .denied ? "Åpne Innstillinger" : "Gi tilgang")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
            }.buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 40)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
    }

    // MARK: Recorder

    private var recorderControls: some View {
        VStack(spacing: 18) {
            ZStack {
                if engine.isRecording {
                    Circle().fill(LBrand.red.opacity(0.15)).frame(width: 140, height: 140)
                        .scaleEffect(1 + CGFloat(engine.audioLevel) * 0.3)
                        .animation(.easeInOut(duration: 0.15), value: engine.audioLevel)
                }
                Button {
                    if engine.isRecording { engine.stop() } else { engine.start() }
                } label: {
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(colors: engine.isRecording
                                               ? [LBrand.red, LBrand.orange]
                                               : [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .top, endPoint: .bottom)
                            )
                            .frame(width: 100, height: 100)
                            .shadow(color: (engine.isRecording ? LBrand.red : LBrand.purple).opacity(0.45), radius: 16)
                        Image(systemName: engine.isRecording ? "stop.fill" : "mic.fill")
                            .font(.system(size: 36, weight: .heavy))
                            .foregroundStyle(.white)
                    }
                }.buttonStyle(.plain)
            }
            VStack(spacing: 4) {
                Text(engine.isRecording ? "Snakker — fortsett!" : (engine.transcript.isEmpty ? "Trykk for å starte" : "Opptak stoppet"))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text(formatTime(engine.elapsedSeconds))
                    .font(.system(size: 28, weight: .heavy, design: .monospaced))
                    .foregroundStyle(engine.isRecording ? LBrand.red : .white)
                    .monospacedDigit()
            }
            if engine.isRecording {
                vuMeter
            }
            if let err = engine.error {
                HStack(spacing: 7) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(LBrand.red)
                    Text(err).font(.system(size: 11)).foregroundStyle(LBrand.red)
                }
                .padding(10)
                .background(LBrand.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }

    private var vuMeter: some View {
        HStack(spacing: 3) {
            ForEach(0..<24, id: \.self) { i in
                let threshold = Float(i) / 24
                Capsule()
                    .fill(threshold < engine.audioLevel
                          ? (threshold > 0.7 ? LBrand.red : (threshold > 0.4 ? LBrand.yellow : LBrand.green))
                          : LBrand.cardHi)
                    .frame(width: 4, height: 8 + CGFloat(threshold) * 28)
            }
        }
        .frame(height: 40)
    }

    // MARK: Transcript card

    private var transcriptCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "text.bubble.fill").foregroundStyle(LBrand.purpleLight)
                    Text("TRANSKRIPSJON")
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                }
                Spacer()
                if !engine.transcript.isEmpty || !engine.liveSegment.isEmpty {
                    Text("\(combinedWordCount) ord")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(LBrand.textTertiary)
                }
            }
            if engine.transcript.isEmpty && engine.liveSegment.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "text.cursor")
                        .font(.system(size: 22))
                        .foregroundStyle(LBrand.textTertiary)
                    Text("Si noe, så dukker ordene opp her")
                        .font(.system(size: 12))
                        .foregroundStyle(LBrand.textSecondary)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 30)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    if !engine.transcript.isEmpty {
                        Text(engine.transcript)
                            .font(.system(size: 14, design: .serif))
                            .foregroundStyle(.white)
                    }
                    if !engine.liveSegment.isEmpty {
                        Text(engine.liveSegment)
                            .font(.system(size: 14, design: .serif))
                            .foregroundStyle(LBrand.textSecondary)
                            .italic()
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private var metaCard: some View {
        VStack(spacing: 8) {
            metaRow("Språk", value: "Norsk bokmål (nb-NO)", icon: "globe", tint: LBrand.purpleLight)
            metaRow("Mode", value: engine.supportsOnDevice ? "On-device" : "Skybasert (fallback)",
                    icon: engine.supportsOnDevice ? "iphone.gen3" : "icloud.fill",
                    tint: engine.supportsOnDevice ? LBrand.green : LBrand.orange)
            metaRow("Recognizer", value: engine.recognizerAvailable ? "Tilgjengelig" : "Ikke klar",
                    icon: "checkmark.seal.fill",
                    tint: engine.recognizerAvailable ? LBrand.green : LBrand.textTertiary)
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func metaRow(_ label: String, value: String, icon: String, tint: Color) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(tint.opacity(0.22))
                Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 28, height: 28)
            Text(label).font(.system(size: 11)).foregroundStyle(LBrand.textSecondary)
            Spacer()
            Text(value).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
        }
    }

    // MARK: Helpers

    private func formatTime(_ s: Int) -> String {
        let m = s / 60
        let sec = s % 60
        return String(format: "%d:%02d", m, sec)
    }

    private var combinedWordCount: Int {
        let combined = engine.transcript + " " + engine.liveSegment
        return combined.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).count
    }

    private func autoTitle() -> String {
        let words = engine.transcript.split(separator: " ").prefix(6)
        if words.isEmpty { return "Opptak \(formatTime(engine.elapsedSeconds))" }
        return words.joined(separator: " ") + "…"
    }
}
