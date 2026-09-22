import Foundation

/// Forklarbar, on-device fotograferingsassistent. Den bruker bare tekniske
/// målinger (ansiktsskarphet + EXIF), aldri identitet, bildeinnhold eller stil.
struct CaptureTechnicalAdvisor: Sendable {
    struct LearningPrior: Sendable, Equatable {
        var sampleCount: Int = 0
        var improvementRate: Double = 0.5
        /// Antall tredjedelssteg blenderen tidligere måtte lukkes for at et nytt
        /// gruppebilde faktisk fikk flere skarpe ansikter.
        var preferredApertureStepCount: Int?

        static let empty = LearningPrior()
    }

    func advice(
        assetId: UUID,
        analysis: AssetAnalysis,
        exposure: CaptureExposureSnapshot,
        learning: LearningPrior = .empty
    ) -> CaptureTechnicalAdvice? {
        let measured = analysis.faceFocusAssessments.filter { $0.state != .unmeasured }
        let soft = measured.filter { $0.state == .soft }
        let sharpPersonNumbers = Set(measured.filter { $0.state == .sharp }.map(\.personNumber))
        // Only elevate an eye-specific miss when the larger face region is
        // otherwise sharp. If the entire face is soft, the broader focus-plane
        // diagnosis remains the more honest recommendation.
        let softEyes = analysis.criticalSoftEyeFocusAssessments.filter {
            $0.state == .soft && sharpPersonNumbers.contains($0.personNumber)
        }

        guard !soft.isEmpty || !softEyes.isEmpty else { return nil }

        let issue: CaptureTechnicalAdvice.Issue
        if !softEyes.isEmpty {
            issue = .eyeFocus
        } else if measured.count >= 2, soft.count < measured.count {
            issue = .mixedGroupFocus
        } else {
            issue = .generalBlur
        }

        let affectedPersonNumbers = issue == .eyeFocus
            ? Array(Set(softEyes.map(\.personNumber))).sorted()
            : soft.map(\.personNumber)

        let baseConfidence: Double
        switch issue {
        case .eyeFocus: baseConfidence = 0.78
        case .mixedGroupFocus: baseConfidence = 0.84
        case .generalBlur: baseConfidence = 0.67
        }
        let learnedAdjustment: Double
        if learning.sampleCount >= 3 {
            learnedAdjustment = (learning.improvementRate - 0.5) * 0.18
        } else {
            learnedAdjustment = 0
        }

        let recommendedAperture: Double?
        let apertureStepCount: Int?
        if issue == .mixedGroupFocus, let current = exposure.aperture {
            let steps = min(7, max(3, learning.preferredApertureStepCount ?? 5))
            recommendedAperture = Self.stoppedDownAperture(from: current, steps: steps)
            apertureStepCount = steps
        } else {
            recommendedAperture = nil
            apertureStepCount = nil
        }

        let minimumShutter = Self.minimumPeopleShutter(focalLengthMM: exposure.focalLengthMM)
        let shutterNeedsChange = exposure.shutterSeconds.map { $0 > minimumShutter } ?? false
        let recommendedISO = Self.estimatedISO(
            currentISO: exposure.iso,
            currentAperture: exposure.aperture,
            targetAperture: recommendedAperture,
            currentShutter: exposure.shutterSeconds,
            targetShutter: shutterNeedsChange ? minimumShutter : nil
        )

        return CaptureTechnicalAdvice(
            assetId: assetId,
            issue: issue,
            softPersonNumbers: affectedPersonNumbers,
            measuredFaceCount: measured.count,
            confidence: min(0.95, max(0.5, baseConfidence + learnedAdjustment)),
            exposure: exposure,
            recommendedAperture: recommendedAperture,
            apertureStepCount: apertureStepCount,
            minimumShutterSeconds: minimumShutter,
            shutterNeedsChange: shutterNeedsChange,
            estimatedISO: recommendedISO,
            learningSampleCount: learning.sampleCount
        )
    }

    private static let thirdStopApertures: [Double] = [
        1.0, 1.1, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5, 2.8,
        3.2, 3.5, 4.0, 4.5, 5.0, 5.6, 6.3, 7.1, 8.0, 9.0,
        10.0, 11.0, 13.0, 14.0, 16.0, 18.0, 20.0, 22.0
    ]

    static func stoppedDownAperture(from aperture: Double, steps: Int) -> Double {
        guard aperture.isFinite, aperture > 0 else { return aperture }
        let start = thirdStopApertures.enumerated().min {
            abs($0.element - aperture) < abs($1.element - aperture)
        }?.offset ?? 0
        return thirdStopApertures[min(thirdStopApertures.count - 1, start + max(1, steps))]
    }

    static func minimumPeopleShutter(focalLengthMM: Double?) -> Double {
        // Familie/portrett: 1/250 er gulvet for små bevegelser. Lengre optikk
        // krever i tillegg omtrent 2× brennvidden ved håndholdt fotografering.
        let focalDenominator = max(250, Int(((focalLengthMM ?? 85) * 2).rounded()))
        return 1 / Double(focalDenominator)
    }

    static func estimatedISO(
        currentISO: Int?,
        currentAperture: Double?,
        targetAperture: Double?,
        currentShutter: Double?,
        targetShutter: Double?
    ) -> Int? {
        guard let currentISO, currentISO > 0 else { return nil }
        var multiplier = 1.0
        if let currentAperture, let targetAperture, currentAperture > 0 {
            multiplier *= pow(targetAperture / currentAperture, 2)
        }
        if let currentShutter, let targetShutter,
           currentShutter > 0, targetShutter > 0, targetShutter < currentShutter {
            multiplier *= currentShutter / targetShutter
        }
        guard multiplier > 1.05 else { return nil }
        let raw = min(51_200, Double(currentISO) * multiplier)
        let common = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800,
                      1_000, 1_250, 1_600, 2_000, 2_500, 3_200, 4_000,
                      5_000, 6_400, 8_000, 10_000, 12_800, 16_000, 20_000,
                      25_600, 32_000, 40_000, 51_200]
        // ISO-trinnene er grove. Velg nærmeste annonserbare standardverdi i
        // stedet for alltid å runde opp et helt tredjedelssteg (1260 → 1250,
        // ikke 1600); dette bevarer eksponeringen uten unødvendig støy.
        return common.min { abs(Double($0) - raw) < abs(Double($1) - raw) }
    }
}

struct CaptureExposureSnapshot: Sendable, Equatable, Codable {
    var camera: String?
    var lens: String?
    var focalLengthMM: Double?
    var aperture: Double?
    var shutterSeconds: Double?
    var iso: Int?

    init(exif: ExifInfo?, telemetry: CameraTelemetry = .empty) {
        camera = exif?.camera
        lens = exif?.lens ?? telemetry.lensName
        focalLengthMM = exif?.focalLength
        aperture = exif?.fNumber ?? Self.number(from: telemetry.apertureValue)
        shutterSeconds = exif?.exposureTime ?? Self.shutter(from: telemetry.shutterSpeed)
        iso = exif?.iso ?? telemetry.isoValue.flatMap(Self.integer(from:))
    }

    init(
        camera: String? = nil,
        lens: String? = nil,
        focalLengthMM: Double? = nil,
        aperture: Double? = nil,
        shutterSeconds: Double? = nil,
        iso: Int? = nil
    ) {
        self.camera = camera
        self.lens = lens
        self.focalLengthMM = focalLengthMM
        self.aperture = aperture
        self.shutterSeconds = shutterSeconds
        self.iso = iso
    }

    private static func number(from raw: String?) -> Double? {
        guard let raw else { return nil }
        let normalized = raw.lowercased()
            .replacingOccurrences(of: "f/", with: "")
            .replacingOccurrences(of: "f", with: "")
            .replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return Double(normalized)
    }

    private static func integer(from raw: String) -> Int? {
        let digits = raw.filter(\.isNumber)
        return Int(digits)
    }

    private static func shutter(from raw: String?) -> Double? {
        guard let raw else { return nil }
        let value = raw.lowercased()
            .replacingOccurrences(of: "sec", with: "")
            .replacingOccurrences(of: "s", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if value.contains("/") {
            let parts = value.split(separator: "/").compactMap { Double($0) }
            guard parts.count == 2, parts[1] > 0 else { return nil }
            return parts[0] / parts[1]
        }
        return Double(value)
    }
}

struct CaptureTechnicalAdvice: Identifiable, Sendable, Equatable {
    enum Issue: String, Sendable, Codable { case eyeFocus, mixedGroupFocus, generalBlur }

    var id: UUID { assetId }
    let assetId: UUID
    let issue: Issue
    let softPersonNumbers: [Int]
    let measuredFaceCount: Int
    let confidence: Double
    let exposure: CaptureExposureSnapshot
    let recommendedAperture: Double?
    let apertureStepCount: Int?
    let minimumShutterSeconds: Double
    let shutterNeedsChange: Bool
    let estimatedISO: Int?
    let learningSampleCount: Int

    var title: String {
        if issue == .eyeFocus, let first = softPersonNumbers.first {
            return softPersonNumbers.count == 1
                ? "Øynene til person \(first) mangler kritisk skarphet"
                : "Øynene til \(softPersonNumbers.count) personer mangler kritisk skarphet"
        }
        if issue == .mixedGroupFocus, let first = softPersonNumbers.first {
            return softPersonNumbers.count == 1
                ? "Person \(first) er utenfor fokusplanet"
                : "\(softPersonNumbers.count) personer er utenfor fokusplanet"
        }
        return "Gruppen er ikke helt skarp"
    }

    var primaryTip: String {
        switch issue {
        case .eyeFocus:
            "Flytt AF-punktet til nærmeste øye og ta bildet på nytt. Ansiktet er skarpt, men øyedetaljene er ikke det."
        case .mixedGroupFocus:
            "Plasser \(personReference) på samme linje som de andre. Det er den raskeste løsningen."
        case .generalBlur:
            "Kontroller fokuspunktet og hold minst \(shutterText(minimumShutterSeconds)) for mennesker."
        }
    }

    var settingsTip: String? {
        var parts: [String] = []
        if let recommendedAperture {
            parts.append("prøv ƒ/\(Self.formatAperture(recommendedAperture))")
        }
        if shutterNeedsChange {
            parts.append("\(shutterText(minimumShutterSeconds)) eller raskere")
        }
        if let estimatedISO {
            parts.append("omtrent ISO \(estimatedISO)")
        } else if recommendedAperture != nil || shutterNeedsChange {
            parts.append("Auto ISO eller kompenser eksponeringen")
        }
        guard !parts.isEmpty else { return nil }
        return parts.joined(separator: " · ")
    }

    var canApplyAperture: Bool { recommendedAperture != nil }

    /// Returns only the measured faces this advice refers to. Keeping this
    /// mapping in the domain model makes the on-image annotation independent
    /// of the optional pro HUD: a photographer must still see *who* triggered
    /// the advice when histogram/zebra overlays are hidden.
    func focusTargets(in analysis: AssetAnalysis) -> [FaceFocusAssessment] {
        let targetNumbers = Set(softPersonNumbers)
        return analysis.faceFocusAssessments.filter { targetNumbers.contains($0.personNumber) }
    }

    func eyeTargets(in analysis: AssetAnalysis) -> [EyeFocusAssessment] {
        guard issue == .eyeFocus else { return [] }
        let targetNumbers = Set(softPersonNumbers)
        return analysis.criticalSoftEyeFocusAssessments.filter {
            targetNumbers.contains($0.personNumber) && $0.state == .soft
        }
    }

    private var personReference: String {
        let labels = softPersonNumbers.map(String.init)
        if labels.count == 1 { return "person \(labels[0])" }
        if labels.count == 2 { return "person \(labels[0]) og \(labels[1])" }
        return "de markerte personene"
    }

    private func shutterText(_ seconds: Double) -> String {
        guard seconds > 0 else { return "—" }
        if seconds >= 1 { return "\(Int(seconds.rounded())) s" }
        return "1/\(Int((1 / seconds).rounded())) s"
    }

    private static func formatAperture(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(format: "%.1f", value)
    }
}

enum CaptureTechnicalTrialAction: String, Sendable, Codable {
    case retryingAdvice
    case appliedAperture
}

enum CaptureTechnicalOutcomeResult: String, Sendable, Codable {
    case improved, unchanged, worse, incomparable
}

struct CaptureTechnicalOutcome: Sendable, Codable, Equatable, Identifiable {
    let id: UUID
    let createdAt: Date
    let sourceAssetId: UUID
    let resultAssetId: UUID
    let issue: CaptureTechnicalAdvice.Issue
    let action: CaptureTechnicalTrialAction
    let result: CaptureTechnicalOutcomeResult
    let camera: String?
    let lens: String?
    let apertureStepCount: Int?
    let baselineFocusScore: Double
    let resultFocusScore: Double?
}

/// Lokal, privat læring. Persistensen inneholder ingen bilder, ansiktsrektangler,
/// identitet, lokasjon eller stilvalg — bare teknisk oppsett og målt forbedring.
actor CaptureTechnicalLearningStore {
    private struct Pending: Codable {
        let sourceAssetId: UUID
        let sourceCaptureTime: Date
        let issue: CaptureTechnicalAdvice.Issue
        let action: CaptureTechnicalTrialAction
        let camera: String?
        let lens: String?
        let apertureStepCount: Int?
        let faceCount: Int
        let baselineFocusScore: Double
    }

    private struct State: Codable {
        var pending: Pending?
        var outcomes: [CaptureTechnicalOutcome]
    }

    private let fileURL: URL
    private var state: State

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? Self.defaultURL()
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let data = try? Data(contentsOf: self.fileURL),
           let decoded = try? decoder.decode(State.self, from: data) {
            state = decoded
        } else {
            state = State(pending: nil, outcomes: [])
        }
    }

    func learningPrior(camera: String?, lens: String?, issue: CaptureTechnicalAdvice.Issue) -> CaptureTechnicalAdvisor.LearningPrior {
        let matches = state.outcomes.filter {
            $0.issue == issue && Self.sameTechnicalProfile($0.camera, camera)
                && Self.sameTechnicalProfile($0.lens, lens)
                && $0.result != .incomparable
        }
        guard !matches.isEmpty else { return .empty }
        let improved = matches.filter { $0.result == .improved }
        let successfulSteps = improved.compactMap(\.apertureStepCount).sorted()
        let preferred = successfulSteps.isEmpty ? nil : successfulSteps[successfulSteps.count / 2]
        return .init(
            sampleCount: matches.count,
            improvementRate: Double(improved.count) / Double(matches.count),
            preferredApertureStepCount: preferred
        )
    }

    func beginTrial(
        advice: CaptureTechnicalAdvice,
        action: CaptureTechnicalTrialAction,
        sourceCaptureTime: Date,
        analysis: AssetAnalysis
    ) {
        state.pending = Pending(
            sourceAssetId: advice.assetId,
            sourceCaptureTime: sourceCaptureTime,
            issue: advice.issue,
            action: action,
            camera: advice.exposure.camera,
            lens: advice.exposure.lens,
            apertureStepCount: advice.apertureStepCount,
            faceCount: advice.measuredFaceCount,
            baselineFocusScore: Self.focusScore(analysis, issue: advice.issue)
        )
        persist()
    }

    /// Knytter bare et senere opptak i samme tekniske forsøk. Gamle analyser som
    /// fullføres ute av rekkefølge får aldri spise den ventende prøven.
    func completeTrialIfNeeded(
        resultAssetId: UUID,
        captureTime: Date,
        analysis: AssetAnalysis
    ) -> CaptureTechnicalOutcome? {
        guard let pending = state.pending,
              resultAssetId != pending.sourceAssetId,
              captureTime > pending.sourceCaptureTime
        else { return nil }

        let elapsed = captureTime.timeIntervalSince(pending.sourceCaptureTime)
        guard elapsed <= 10 * 60 else {
            state.pending = nil
            persist()
            return nil
        }

        let resultScore = Self.focusScore(analysis, issue: pending.issue)
        let comparable = pending.faceCount > 0
            && abs(analysis.faceFocusAssessments.count - pending.faceCount) <= 1
        let result: CaptureTechnicalOutcomeResult
        if !comparable {
            result = .incomparable
        } else if resultScore >= pending.baselineFocusScore + 0.15 {
            result = .improved
        } else if resultScore <= pending.baselineFocusScore - 0.15 {
            result = .worse
        } else {
            result = .unchanged
        }

        let outcome = CaptureTechnicalOutcome(
            id: UUID(), createdAt: Date(),
            sourceAssetId: pending.sourceAssetId, resultAssetId: resultAssetId,
            issue: pending.issue, action: pending.action, result: result,
            camera: pending.camera, lens: pending.lens,
            apertureStepCount: pending.apertureStepCount,
            baselineFocusScore: pending.baselineFocusScore,
            resultFocusScore: comparable ? resultScore : nil
        )
        state.pending = nil
        state.outcomes.append(outcome)
        if state.outcomes.count > 2_000 {
            state.outcomes.removeFirst(state.outcomes.count - 2_000)
        }
        persist()
        return outcome
    }

    func cancelPendingTrial(sourceAssetId: UUID) {
        guard state.pending?.sourceAssetId == sourceAssetId else { return }
        state.pending = nil
        persist()
    }

    private static func focusScore(
        _ analysis: AssetAnalysis,
        issue: CaptureTechnicalAdvice.Issue
    ) -> Double {
        if issue == .eyeFocus {
            let measuredEyes = analysis.eyeFocusAssessments.filter { $0.state != .unmeasured }
            guard !measuredEyes.isEmpty else { return 0 }
            return Double(measuredEyes.filter { $0.state == .sharp }.count)
                / Double(measuredEyes.count)
        }
        let measured = analysis.faceFocusAssessments.filter { $0.state != .unmeasured }
        guard !measured.isEmpty else { return 0 }
        return Double(measured.filter { $0.state == .sharp }.count) / Double(measured.count)
    }

    private static func sameTechnicalProfile(_ lhs: String?, _ rhs: String?) -> Bool {
        guard let lhs, let rhs else { return lhs == nil && rhs == nil }
        return lhs.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            == rhs.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private static func defaultURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent("CreatorHub", isDirectory: true)
            .appendingPathComponent("technical-capture-learning-v1.json")
    }

    private func persist() {
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true,
                attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
            )
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            try encoder.encode(state).write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch {
            // Teknisk læring er en berikelse. Capture må aldri blokkeres fordi
            // læringsfila ikke kan skrives (lite lagring, beskyttet enhet osv.).
        }
    }
}
