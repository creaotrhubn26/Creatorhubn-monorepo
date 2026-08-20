import SwiftUI

struct DeductionSource: Decodable, Sendable {
    let accountNumber: String
    let accountName: String
    let taxDeductible: String?   // yes | no | depends | null
    let plainExplanation: String
    let whenToUse: String
    let whenNotToUse: String?
    let commonMistakes: [String]
}

struct DeductionAlt: Decodable, Identifiable, Sendable {
    let accountNumber: String
    let accountName: String
    let taxDeductible: String?
    var id: String { accountNumber }
}

struct DeductionAnswer: Decodable, Sendable {
    let verdict: String   // yes | no | depends | unknown
    let summary: String
    let source: DeductionSource?
    let alternatives: [DeductionAlt]
    let aiUsed: Bool
    let disclaimer: String
}

@MainActor
@Observable
final class DeductionViewModel {
    var question: String = ""
    var asking = false
    var answer: DeductionAnswer?
    var errorText: String?

    func ask(orgId: String) async {
        let q = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else { return }
        asking = true; errorText = nil
        struct Body: Encodable { let question: String }
        do {
            answer = try await APIClient.shared.post("/api/organizations/\(orgId)/deduction/ask", body: Body(question: q))
        } catch {
            errorText = error.localizedDescription
        }
        asking = false
    }
}

struct DeductionView: View {
    let orgId: String
    @State private var model = DeductionViewModel()

    var body: some View {
        Form {
            Section {
                TextField("F.eks. «kan jeg trekke fra ny laptop?»", text: $model.question, axis: .vertical)
                    .lineLimit(1...3)
                Button {
                    Task { await model.ask(orgId: orgId) }
                } label: {
                    if model.asking { ProgressView() } else { Label("Spør", systemImage: "questionmark.circle") }
                }
                .disabled(model.asking || model.question.trimmingCharacters(in: .whitespaces).count < 2)
            } footer: {
                Text("Deterministisk svar fra kontoplanen. Verdiktet kommer fra kontoens fradragsflagg — aldri fra AI.")
            }

            if let msg = model.errorText {
                Section { Text(msg).font(.footnote).foregroundStyle(.red) }
            }
            if let a = model.answer {
                DeductionResult(answer: a)
            }
        }
        .navigationTitle("Spør: fradrag")
    }
}

private struct DeductionResult: View {
    let answer: DeductionAnswer

    private var verdictText: String {
        switch answer.verdict {
        case "yes": return "Ja, fradragsberettiget"
        case "no": return "Nei, ikke fradrag"
        case "depends": return "Kommer an på"
        default: return "Usikker"
        }
    }
    private var verdictTint: Color {
        switch answer.verdict {
        case "yes": return .green
        case "no": return .red
        case "depends": return .orange
        default: return .secondary
        }
    }

    var body: some View {
        Section {
            Text(verdictText).font(.headline).foregroundStyle(verdictTint)
            Text(answer.summary).font(.callout)
            if let s = answer.source {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Konto \(s.accountNumber) — \(s.accountName)").font(.footnote.weight(.medium))
                    Text(s.whenToUse).font(.caption).foregroundStyle(.secondary)
                }
            }
        } footer: {
            Text(answer.disclaimer)
        }

        if !answer.alternatives.isEmpty {
            Section("Andre mulige kontoer") {
                ForEach(answer.alternatives) { alt in
                    HStack {
                        Text("\(alt.accountNumber) \(alt.accountName)").font(.footnote)
                        Spacer()
                        if let t = alt.taxDeductible {
                            Text(t == "yes" ? "fradrag" : t == "no" ? "ikke" : "avhenger")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}
