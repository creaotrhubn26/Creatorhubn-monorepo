// LeadbookLydopptakCompliance.swift — Org-onboarding-sjekkliste (2026-08-16)
//
// §7/§8 i docs/leadgrid-gdpr-lydopptak.md: org-admin/leder må bekrefte at
// arbeidsmiljøloven kap. 9-prosessen er gjennomført FØR lydopptak-nøkkelen
// (leadbookLydopptak) kan åpnes. Bekreftelsen ER det som åpner nøkkelen —
// ingen egen «skru på»-bryter andre steder (backend håndhever dette,
// se leadbook-recording-consent-routes.ts POST .../compliance).

import SwiftUI

struct LeadbookLydopptakComplianceSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var drofting = false
    @State private var rutine = false
    @State private var infoskriv = false
    @State private var innsyn = false
    @State private var isSaving = false
    @State private var error: String?
    @State private var alreadyAcknowledged: LeadbookComplianceAckDTO?
    @State private var isLoadingStatus = true

    private var allChecked: Bool { drofting && rutine && infoskriv && innsyn }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let ack = alreadyAcknowledged {
                        alreadyAckCard(ack)
                    }
                    Text("Før lydopptak kan brukes av selgerne i organisasjonen din, må dette være på plass (Datatilsynets retningslinjer for kontrolltiltak, arbeidsmiljøloven kap. 9):")
                        .font(.appScaled(size: 13)).foregroundStyle(LBrand.textSecondary)

                    checklistRow(
                        $drofting, "Drøftingsmøte gjennomført",
                        "Med ansatte/tillitsvalgte, referert skriftlig."
                    )
                    checklistRow(
                        $rutine, "Skriftlig rutine finnes",
                        "Formål, hvem har tilgang, lagringstid, konsekvenser."
                    )
                    checklistRow(
                        $infoskriv, "Informasjonsskriv sendt til selgerne",
                        "Alle som kan bli tatt opp av kunder vet om ordningen."
                    )
                    checklistRow(
                        $innsyn, "Selgere kan se egne opptak og be om sletting",
                        "Opptak brukes ALDRI alene som sanksjonsgrunnlag — kun coaching."
                    )

                    if let error {
                        Text(error).font(.appScaled(size: 12)).foregroundStyle(LBrand.red)
                    }

                    Text("Du (org-admin/leder) bekrefter dette på vegne av organisasjonen — behandlingsansvaret for kundeopptakene ligger hos dere, ikke Creatorhub.")
                        .font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
                }
                .padding(20)
            }
            .background(LBrand.bg.ignoresSafeArea())
            .navigationTitle("Lydopptak — GDPR-sjekkliste")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(LBrand.textSecondary)
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) { confirmBar }
            .task { await loadStatus() }
        }
    }

    private func alreadyAckCard(_ ack: LeadbookComplianceAckDTO) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.seal.fill").foregroundStyle(LBrand.green)
            VStack(alignment: .leading, spacing: 2) {
                Text("Allerede bekreftet").font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                if let name = ack.acknowledgedByName, let at = ack.acknowledgedAt {
                    Text("\(name) — \(at)").font(.appScaled(size: 10)).foregroundStyle(LBrand.textSecondary)
                }
            }
            Spacer()
        }
        .padding(12).background(LBrand.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.green.opacity(0.3), lineWidth: 1))
    }

    private func checklistRow(_ binding: Binding<Bool>, _ title: String, _ detail: String) -> some View {
        Toggle(isOn: binding) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
                Text(detail).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
        }
        .tint(LBrand.green)
        .padding(12).background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var confirmBar: some View {
        Button { Task { await confirm() } } label: {
            HStack(spacing: 7) {
                if isSaving { ProgressView().tint(.white) }
                else { Image(systemName: "checkmark.shield.fill").font(.appScaled(size: 13, weight: .bold)) }
                Text(isSaving ? "Bekrefter …" : "Bekreft og åpne lydopptak").font(.appScaled(size: 14, weight: .bold))
            }
            .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(
                LinearGradient(colors: allChecked ? [LBrand.green, LBrand.green.opacity(0.7)] : [LBrand.cardHi, LBrand.cardHi],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(allChecked ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!allChecked || isSaving)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(LBrand.bg.opacity(0.95).overlay(Rectangle().fill(LBrand.stroke).frame(height: 1), alignment: .top))
    }

    private func loadStatus() async {
        isLoadingStatus = true
        defer { isLoadingStatus = false }
        guard let status = try? await appState.api?.leadbookLydopptakComplianceStatus(), status.acknowledged else { return }
        alreadyAcknowledged = status.ack
    }

    private func confirm() async {
        guard let api = appState.api else {
            error = "Ikke innlogget mot backend."
            return
        }
        isSaving = true
        error = nil
        do {
            try await api.leadbookAcknowledgeLydopptakCompliance(checklist: [
                "drofting": drofting, "rutine": rutine, "infoskriv": infoskriv, "innsyn": innsyn,
            ])
            isSaving = false
            dismiss()
        } catch {
            isSaving = false
            self.error = "Kunne ikke bekrefte — prøv igjen. (\(error.localizedDescription))"
        }
    }
}
