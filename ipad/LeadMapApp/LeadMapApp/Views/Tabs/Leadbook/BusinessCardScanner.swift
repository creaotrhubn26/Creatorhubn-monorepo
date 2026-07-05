// BusinessCardScanner.swift — Visittkort-skanner m/ on-device OCR (2026-06-30)
//
// Apple Vision OCR + NSDataDetector + Natural Language for å trekke ut
// navn, firma, tittel, telefon, e-post, nettside fra et visittkort-bilde.
//
// 4 inngangskilder: kamera · foto-galleri · skriv inn manuelt · test med eksempel
// Brukeren kan alltid redigere alle felter etter OCR.

import SwiftUI
import Vision
import PhotosUI
import UIKit

// MARK: - Datamodell

struct CardFields: Equatable {
    var firstName: String = ""
    var lastName: String = ""
    var title: String = ""
    var company: String = ""
    var email: String = ""
    var phone: String = ""
    var website: String = ""
    var address: String = ""

    var fullName: String {
        [firstName, lastName].filter { !$0.isEmpty }.joined(separator: " ")
    }
    var isEmpty: Bool {
        firstName.isEmpty && lastName.isEmpty && company.isEmpty && email.isEmpty && phone.isEmpty
    }
}

// MARK: - Hovedsheet

struct BusinessCardScannerSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var stage: Stage = .source
    @State private var image: UIImage?
    @State private var fields: CardFields = CardFields()
    @State private var ocrConfidence: Double = 0
    @State private var photoItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var showPhotoPicker = false
    @State private var toast: String?

    enum Stage {
        case source     // velg kilde
        case scanning   // OCR i gang
        case review     // se gjennom + lagre
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                Group {
                    switch stage {
                    case .source:    sourcePicker
                    case .scanning:  scanningView
                    case .review:    reviewForm
                    }
                }
                if let t = toast {
                    VStack {
                        Spacer().frame(height: 60)
                        Label(t, systemImage: "checkmark.circle.fill")
                            .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(LBrand.green, in: Capsule())
                        Spacer()
                    }
                }
            }
            .navigationTitle(navTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                if stage == .review {
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            saveLead()
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "checkmark").font(.appScaled(size: 11, weight: .black))
                                Text("Lagre lead").font(.appScaled(size: 12, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                            .opacity(fields.isEmpty ? 0.45 : 1)
                        }
                        .buttonStyle(.plain)
                        .disabled(fields.isEmpty)
                    }
                }
            }
            .sheet(isPresented: $showCamera) {
                CameraPicker { img in
                    self.image = img
                    runOCR()
                }
            }
            .photosPicker(isPresented: $showPhotoPicker, selection: $photoItem, matching: .images)
            .onChange(of: photoItem) { _, newItem in
                guard let newItem else { return }
                Task {
                    if let data = try? await newItem.loadTransferable(type: Data.self),
                       let img = UIImage(data: data) {
                        await MainActor.run {
                            self.image = img
                            runOCR()
                        }
                    }
                }
            }
        }
    }

    private var navTitle: String {
        switch stage {
        case .source: return "Ny lead"
        case .scanning: return "Leser visittkort…"
        case .review: return "Gjennomgå og lagre"
        }
    }

    // MARK: Steg 1 — kilde

    private var sourcePicker: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                hero
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    sourceCard(icon: "camera.fill", title: "Skann med kamera",
                               subtitle: "Pek mot visittkortet — OCR fyller felter automatisk",
                               tint: LBrand.purpleLight, badge: "ANBEFALT") {
                        showCamera = true
                    }
                    sourceCard(icon: "photo.fill", title: "Velg fra galleri",
                               subtitle: "Last opp et bilde du allerede har tatt",
                               tint: LBrand.blue, badge: nil) {
                        showPhotoPicker = true
                    }
                    sourceCard(icon: "keyboard.fill", title: "Skriv inn manuelt",
                               subtitle: "Fyll inn lead-detaljene fra scratch",
                               tint: LBrand.orange, badge: nil) {
                        fields = CardFields()
                        stage = .review
                    }
                    sourceCard(icon: "sparkles.tv.fill", title: "Test med eksempel",
                               subtitle: "Bruk et innebygd visittkort for å demonstrere OCR",
                               tint: LBrand.green, badge: "DEMO") {
                        image = SampleCardImage.render()
                        runOCR()
                    }
                }
                privacyNote
            }
            .padding(20)
        }
    }

    private var hero: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(LBrand.purple.opacity(0.22))
                Image(systemName: "rectangle.and.text.magnifyingglass")
                    .font(.appScaled(size: 22, weight: .bold))
                    .foregroundStyle(LBrand.purpleLight)
            }
            .frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 4) {
                Text("Fra visittkort til lead på 5 sekunder")
                    .font(.appScaled(size: 16, weight: .heavy))
                    .foregroundStyle(.white)
                Text("Vision finner navn, firma, telefon og e-post automatisk. Du gjennomgår alt før lagring.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
            }
        }
    }

    private func sourceCard(icon: String, title: String, subtitle: String,
                            tint: Color, badge: String?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            sourceCardLabel(icon: icon, title: title, subtitle: subtitle, tint: tint, badge: badge)
        }.buttonStyle(.plain)
    }

    private func sourceCardLabel(icon: String, title: String, subtitle: String,
                                 tint: Color, badge: String?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(tint.opacity(0.22))
                    Image(systemName: icon).font(.appScaled(size: 17, weight: .bold)).foregroundStyle(tint)
                }
                .frame(width: 42, height: 42)
                Spacer()
                if let badge {
                    Text(badge).font(.appScaled(size: 8, weight: .black))
                        .foregroundStyle(tint).tracking(0.6)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(tint.opacity(0.18), in: Capsule())
                        .overlay(Capsule().stroke(tint.opacity(0.4), lineWidth: 1))
                }
            }
            Text(title).font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
            Text(subtitle).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                .lineLimit(3).frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var privacyNote: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "lock.shield.fill").foregroundStyle(LBrand.green)
            VStack(alignment: .leading, spacing: 3) {
                Text("ALT ON-DEVICE").font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.green).tracking(0.8)
                Text("OCR + felt-deteksjon kjører lokalt på iPad-en. Bildet og data forlater aldri enheten før du trykker «Lagre lead».")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(LBrand.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.green.opacity(0.25), lineWidth: 1))
    }

    // MARK: Steg 2 — scanning

    private var scanningView: some View {
        VStack(spacing: 24) {
            Spacer()
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.purple.opacity(0.4), lineWidth: 2))
                    .padding(.horizontal, 30)
            }
            VStack(spacing: 10) {
                ProgressView().tint(LBrand.purpleLight).scaleEffect(1.4)
                Text("Leser tekst med Vision…")
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Identifiserer navn, firma, telefon og e-post")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
    }

    // MARK: Steg 3 — review

    private var reviewForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let image {
                    HStack(spacing: 12) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 96, height: 64)
                            .clipShape(RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.stroke, lineWidth: 1))
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 5) {
                                Image(systemName: "sparkles").foregroundStyle(LBrand.purpleLight)
                                    .font(.appScaled(size: 10))
                                Text("OCR-RESULTAT")
                                    .font(.appScaled(size: 9, weight: .black))
                                    .foregroundStyle(LBrand.purpleLight).tracking(0.8)
                            }
                            Text("Vision fant tekst i bildet")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.seal.fill")
                                    .font(.appScaled(size: 9)).foregroundStyle(LBrand.green)
                                Text("\(Int(ocrConfidence * 100)) % konfidens")
                                    .font(.appScaled(size: 10))
                                    .foregroundStyle(LBrand.green)
                            }
                        }
                        Spacer()
                        Button {
                            self.image = nil
                            fields = CardFields()
                            stage = .source
                        } label: {
                            Text("Endre").font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(LBrand.purpleLight)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(LBrand.purple.opacity(0.18), in: Capsule())
                        }.buttonStyle(.plain)
                    }
                    .padding(12)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                }

                Text("KONTAKTINFO").font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                HStack(spacing: 10) {
                    formField("Fornavn", text: $fields.firstName, icon: "person.fill", auto: !fields.firstName.isEmpty)
                    formField("Etternavn", text: $fields.lastName, icon: "person.fill", auto: !fields.lastName.isEmpty)
                }
                formField("Tittel", text: $fields.title, icon: "briefcase.fill", auto: !fields.title.isEmpty)
                formField("Firma", text: $fields.company, icon: "building.2.fill", auto: !fields.company.isEmpty)
                formField("E-post", text: $fields.email, icon: "envelope.fill", keyboard: .emailAddress, auto: !fields.email.isEmpty)
                formField("Telefon", text: $fields.phone, icon: "phone.fill", keyboard: .phonePad, auto: !fields.phone.isEmpty)
                formField("Nettside", text: $fields.website, icon: "globe", keyboard: .URL, auto: !fields.website.isEmpty)
                formField("Adresse", text: $fields.address, icon: "mappin.and.ellipse", auto: !fields.address.isEmpty)

                if image == nil {
                    HStack(spacing: 8) {
                        Image(systemName: "info.circle.fill").foregroundStyle(LBrand.blue)
                        Text("Manuell innfyllingsmodus — fyll inn detaljene over").font(.appScaled(size: 11))
                            .foregroundStyle(LBrand.textSecondary)
                        Spacer()
                    }
                    .padding(12)
                    .background(LBrand.blue.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
                }

                Color.clear.frame(height: 20)
            }
            .padding(20)
        }
    }

    private func formField(_ label: String, text: Binding<String>, icon: String,
                           keyboard: UIKeyboardType = .default, auto: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Text(label.uppercased()).font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                if auto {
                    HStack(spacing: 3) {
                        Image(systemName: "sparkles").font(.appScaled(size: 8))
                        Text("AUTO").font(.appScaled(size: 8, weight: .black))
                    }
                    .foregroundStyle(LBrand.purpleLight).tracking(0.5)
                    .padding(.horizontal, 4).padding(.vertical, 1)
                    .background(LBrand.purple.opacity(0.18), in: Capsule())
                }
                Spacer()
            }
            HStack(spacing: 9) {
                Image(systemName: icon).font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(auto ? LBrand.purpleLight : LBrand.textTertiary)
                    .frame(width: 18)
                TextField(label, text: text)
                    .keyboardType(keyboard)
                    .foregroundStyle(.white).textFieldStyle(.plain)
            }
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(
                auto ? LBrand.purple.opacity(0.35) : LBrand.stroke, lineWidth: 1
            ))
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: OCR + save

    private func runOCR() {
        guard let image else { return }
        stage = .scanning
        BusinessCardOCR.extractFields(from: image) { extracted, confidence in
            withAnimation(.easeInOut(duration: 0.25)) {
                fields = extracted
                ocrConfidence = confidence
                stage = .review
            }
        }
    }

    private func saveLead() {
        toast = "Lead «\(fields.fullName.isEmpty ? "uten navn" : fields.fullName)» lagret"
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            dismiss()
        }
    }
}

// MARK: - OCR engine

enum BusinessCardOCR {
    static func extractFields(from image: UIImage,
                              completion: @escaping @Sendable (CardFields, Double) -> Void) {
        guard let cg = image.cgImage else {
            DispatchQueue.main.async { completion(CardFields(), 0) }
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.recognitionLanguages = ["nb-NO", "en-US"]
            let handler = VNImageRequestHandler(cgImage: cg, orientation: .up, options: [:])
            try? handler.perform([request])
            let observations = request.results ?? []
            let lines: [(String, Float)] = observations.compactMap { obs in
                guard let candidate = obs.topCandidates(1).first else { return nil }
                return (candidate.string, candidate.confidence)
            }
            let avgConf = lines.map { Double($0.1) }.reduce(0, +)
                        / Double(max(1, lines.count))
            let (fields, _) = parseLines(lines.map { $0.0 })
            DispatchQueue.main.async {
                completion(fields, avgConf)
            }
        }
    }

    /// Parse OCR-linjer → CardFields ved hjelp av NSDataDetector + heuristikker.
    static func parseLines(_ lines: [String]) -> (CardFields, [String]) {
        var f = CardFields()
        var consumed = Set<Int>()

        // Telefon + lenke/e-post via NSDataDetector
        let dataDetector = try? NSDataDetector(types:
            NSTextCheckingResult.CheckingType.phoneNumber.rawValue
            | NSTextCheckingResult.CheckingType.link.rawValue)
        for (idx, line) in lines.enumerated() {
            let nsLine = line as NSString
            let range = NSRange(location: 0, length: nsLine.length)
            dataDetector?.enumerateMatches(in: line, range: range) { match, _, _ in
                guard let match else { return }
                if match.resultType == .phoneNumber, let phone = match.phoneNumber, f.phone.isEmpty {
                    f.phone = phone
                    consumed.insert(idx)
                }
                if match.resultType == .link, let url = match.url {
                    if url.scheme == "mailto", f.email.isEmpty {
                        f.email = url.absoluteString.replacingOccurrences(of: "mailto:", with: "")
                        consumed.insert(idx)
                    } else if (url.scheme == "http" || url.scheme == "https"), f.website.isEmpty {
                        f.website = url.absoluteString
                        consumed.insert(idx)
                    }
                }
            }
        }

        // Manuell e-post-regex (fanger linjer uten "mailto:")
        let emailRegex = try? NSRegularExpression(pattern: #"[A-Z0-9a-z._%+-]+@[A-Z0-9a-z.-]+\.[A-Za-z]{2,}"#)
        for (idx, line) in lines.enumerated() where f.email.isEmpty {
            if let m = emailRegex?.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
               let r = Range(m.range, in: line) {
                f.email = String(line[r])
                consumed.insert(idx)
            }
        }

        // Firma — linje med selskaps-suffiks
        let companySuffixes = ["AS", "ASA", "AB", "GmbH", "Inc", "Inc.", "Ltd", "Ltd.", "LLC", "ANS", "Co"]
        for (idx, line) in lines.enumerated() where !consumed.contains(idx) && f.company.isEmpty {
            if companySuffixes.contains(where: { line.contains(" \($0)") || line.hasSuffix($0) }) {
                f.company = line.trimmingCharacters(in: .whitespaces)
                consumed.insert(idx)
            }
        }

        // Tittel — linje med titteltips
        let titleHints = ["Director", "Manager", "Sjef", "Selger", "CEO", "CTO", "COO",
                          "Konsulent", "Partner", "Senior", "Junior", "VP", "President",
                          "Daglig leder", "Salgssjef", "Adm. dir", "Head of"]
        for (idx, line) in lines.enumerated() where !consumed.contains(idx) && f.title.isEmpty {
            if titleHints.contains(where: { line.localizedCaseInsensitiveContains($0) }) {
                f.title = line.trimmingCharacters(in: .whitespaces)
                consumed.insert(idx)
            }
        }

        // Navn — første ikke-konsumert linje med 2-3 ord, store bokstaver, ingen tall
        for (idx, line) in lines.enumerated() where !consumed.contains(idx) && f.firstName.isEmpty {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            let words = trimmed.split(separator: " ").map(String.init)
            let hasDigit = trimmed.rangeOfCharacter(from: .decimalDigits) != nil
            if (2...4).contains(words.count), !hasDigit, isLikelyName(words) {
                f.firstName = words.first ?? ""
                f.lastName = words.dropFirst().joined(separator: " ")
                consumed.insert(idx)
                break
            }
        }

        // Adresse — linje med tall + alfabet (typisk gateadresse)
        for (idx, line) in lines.enumerated() where !consumed.contains(idx) && f.address.isEmpty {
            let hasDigit = line.rangeOfCharacter(from: .decimalDigits) != nil
            let hasLetters = line.rangeOfCharacter(from: .letters) != nil
            if hasDigit && hasLetters && line.count > 6 {
                f.address = line.trimmingCharacters(in: .whitespaces)
                consumed.insert(idx)
                break
            }
        }

        let unmatched = lines.enumerated().compactMap { consumed.contains($0.offset) ? nil : $0.element }
        return (f, unmatched)
    }

    private static func isLikelyName(_ words: [String]) -> Bool {
        // Hvert ord starter med stor bokstav (eller hele ordet er stort)
        words.allSatisfy { word in
            guard let first = word.first else { return false }
            return first.isUppercase
        }
    }
}

// MARK: - Camera wrapper

struct CameraPicker: UIViewControllerRepresentable {
    var onCapture: (UIImage) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: CameraPicker
        init(_ p: CameraPicker) { self.parent = p }
        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            picker.dismiss(animated: true)
            if let img = info[.originalImage] as? UIImage {
                parent.onCapture(img)
            }
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}

// MARK: - Sample card image (for demo)

enum SampleCardImage {
    @MainActor
    static func render() -> UIImage {
        let renderer = ImageRenderer(content: SampleCardView())
        renderer.scale = 3
        return renderer.uiImage ?? UIImage()
    }
}

private struct SampleCardView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("LEADGRID AS")
                        .font(.appScaled(size: 11, weight: .black))
                        .foregroundStyle(.purple)
                        .tracking(0.6)
                    Text("Maria Lindholm")
                        .font(.appScaled(size: 18, weight: .heavy))
                        .foregroundStyle(.black)
                    Text("Senior Salgssjef")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(.gray)
                }
                Spacer()
                Circle().fill(.purple.opacity(0.3)).frame(width: 30, height: 30)
            }
            Divider()
            Group {
                Text("maria@leadgrid.no").font(.appScaled(size: 10, weight: .semibold))
                Text("+47 41 23 45 67").font(.appScaled(size: 10, weight: .semibold))
                Text("www.leadgrid.no").font(.appScaled(size: 10, weight: .semibold))
                Text("Bryggegata 14, 0250 Oslo").font(.appScaled(size: 10))
            }
            .foregroundStyle(.black.opacity(0.7))
            Spacer()
        }
        .padding(16)
        .frame(width: 380, height: 220)
        .background(.white)
    }
}
