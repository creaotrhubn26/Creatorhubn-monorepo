// PondusStore.swift
//
// Backend-backed observable store for Leadgrid Pondus-maler.
//
// Bruk:
//   @State private var pondusStore = PondusStore()
//   .task { await pondusStore.load(api: appState.api) }
//
// Store-en holder både publiserte og utkast (utkast kun tilgjengelig
// hvis SuperAdmin — backend håndhever). Views filtrer på isPublished
// for empty-state vs. innhold.

import SwiftUI

@MainActor
@Observable
final class PondusStore {
    // Rå templates fra backend (siste hentede).
    private(set) var templates: [PondusTemplateDTO] = []
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?
    private(set) var lastLoadedAt: Date?

    init() {}

    // MARK: - Filter helpers

    /// Publiserte maler.
    var published: [PondusTemplateDTO] {
        templates.filter { $0.isPublished }
    }

    /// Utkast (SuperAdmin ser disse).
    var drafts: [PondusTemplateDTO] {
        templates.filter { !$0.isPublished }
    }

    // MARK: - Load

    /// Last inn alle Pondus-maler synlig for gjeldende session. Kaller
    /// backend med `published=all` slik at SuperAdmin også ser utkast;
    /// backend håndhever filter for vanlige brukere uansett.
    func load(api: APIClient?, includeDrafts: Bool = true) async {
        guard let api else {
            lastError = "no_api_client"
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let list = try await api.pondusListTemplates(
                category: nil,
                kind: nil,
                publishedOnly: !includeDrafts
            )
            self.templates = list
            self.lastLoadedAt = Date()
            self.lastError = nil
            // Push til Apple Watch (Pondus overalt — trinn 1).
            // Trimmer til topp 8 publiserte maler.
            PondusWatchSync.shared.pushTemplatesToWatch(list.filter { $0.isPublished })
        } catch {
            self.lastError = String(describing: error)
        }
    }

    // MARK: - Mutations (SuperAdmin only — backend returnerer 403 hvis ikke)

    @discardableResult
    func create(_ payload: CreatePondusTemplatePayload, api: APIClient?) async -> PondusTemplateDTO? {
        guard let api else { return nil }
        do {
            let created = try await api.pondusCreateTemplate(payload)
            templates.insert(created, at: 0)
            return created
        } catch {
            lastError = String(describing: error)
            return nil
        }
    }

    @discardableResult
    func update(id: UUID, _ payload: UpdatePondusTemplatePayload, api: APIClient?) async -> PondusTemplateDTO? {
        guard let api else { return nil }
        do {
            let updated = try await api.pondusUpdateTemplate(
                id: id.uuidString.lowercased(),
                payload
            )
            replace(updated)
            return updated
        } catch {
            lastError = String(describing: error)
            return nil
        }
    }

    @discardableResult
    func publish(id: UUID, published: Bool, api: APIClient?) async -> PondusTemplateDTO? {
        guard let api else { return nil }
        do {
            let updated = try await api.pondusPublishTemplate(
                id: id.uuidString.lowercased(),
                published: published
            )
            replace(updated)
            return updated
        } catch {
            lastError = String(describing: error)
            return nil
        }
    }

    func delete(id: UUID, api: APIClient?) async {
        guard let api else { return }
        do {
            try await api.pondusDeleteTemplate(id: id.uuidString.lowercased())
            // Soft-delete → backend setter is_published = false, ikke sletter.
            // Hard-delete → rad forsvinner. Reload for korrekt tilstand.
            await load(api: api)
        } catch {
            lastError = String(describing: error)
        }
    }

    // MARK: - Private

    private func replace(_ updated: PondusTemplateDTO) {
        if let idx = templates.firstIndex(where: { $0.id == updated.id }) {
            templates[idx] = updated
        } else {
            templates.insert(updated, at: 0)
        }
    }
}

// MARK: - Views (backend-list + empty-state)

/// Render publiserte backend-maler i mørkt Leadbook-tema. SuperAdmin
/// får inline «Rediger»-knapper + «Ny mal»-CTA på toppen.
struct PondusBackendListView: View {
    let templates: [PondusTemplateDTO]
    let isSuperAdmin: Bool
    let onEdit: (PondusTemplateDTO) -> Void
    let onNew: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            if isSuperAdmin {
                HStack {
                    Text("SuperAdmin — du kan opprette og publisere Leadgrid-maler.")
                        .font(.system(size: 12))
                        .foregroundStyle(LBrand.textSecondary)
                    Spacer()
                    Button(action: onNew) {
                        HStack(spacing: 6) {
                            Image(systemName: "plus")
                                .font(.system(size: 11, weight: .bold))
                            Text("Ny mal")
                                .font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight], startPoint: .leading, endPoint: .trailing),
                            in: Capsule()
                        )
                    }.buttonStyle(.plain)
                }
                .padding(12)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
            }

            ForEach(templates) { t in
                PondusBackendCard(
                    template: t,
                    isSuperAdmin: isSuperAdmin,
                    onEdit: { onEdit(t) }
                )
            }
        }
    }
}

private struct PondusBackendCard: View {
    let template: PondusTemplateDTO
    let isSuperAdmin: Bool
    let onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9)
                        .fill(kindTint.opacity(0.22))
                    Image(systemName: kindIcon)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(kindTint)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 3) {
                    Text(template.name)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    HStack(spacing: 6) {
                        Text(kindLabel).font(.system(size: 11, weight: .semibold)).foregroundStyle(kindTint)
                        Text("•").foregroundStyle(LBrand.textTertiary).font(.system(size: 10))
                        Text(categoryLabel).font(.system(size: 11)).foregroundStyle(LBrand.textSecondary)
                        Text("•").foregroundStyle(LBrand.textTertiary).font(.system(size: 10))
                        Text("Score \(template.score)")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(scoreColor)
                            .monospacedDigit()
                    }
                }
                Spacer(minLength: 8)
                if isSuperAdmin {
                    Button(action: onEdit) {
                        HStack(spacing: 4) {
                            Image(systemName: "pencil").font(.system(size: 10, weight: .bold))
                            Text("Rediger").font(.system(size: 11, weight: .bold))
                        }
                        .foregroundStyle(LBrand.purpleLight)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(LBrand.purple.opacity(0.20), in: Capsule())
                    }.buttonStyle(.plain)
                }
            }
            if let desc = template.description, !desc.isEmpty {
                Text(desc)
                    .font(.system(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
            }
            HStack(spacing: 6) {
                ForEach(template.orderedSteps.prefix(6)) { step in
                    Text(step.title)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.75))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(LBrand.cardHi, in: Capsule())
                }
                if template.steps.count > 6 {
                    Text("+\(template.steps.count - 6)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                Spacer(minLength: 0)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var kindTint: Color {
        switch template.kindEnum {
        case .telephone: return LBrand.green
        case .video: return LBrand.orange
        case .email: return LBrand.blue
        case .meeting: return LBrand.purpleLight
        case .field: return LBrand.pink
        }
    }
    private var kindIcon: String {
        switch template.kindEnum {
        case .telephone: return "phone.fill"
        case .video: return "video.fill"
        case .email: return "envelope.fill"
        case .meeting: return "calendar"
        case .field: return "person.crop.circle.fill"
        }
    }
    private var kindLabel: String {
        switch template.kindEnum {
        case .telephone: return "Telefon"
        case .video: return "Video"
        case .email: return "E-post"
        case .meeting: return "Møte"
        case .field: return "Felt"
        }
    }
    private var categoryLabel: String {
        switch template.category {
        case PondusCategory.firstContact: return "Første kontakt"
        case PondusCategory.meetingOpen: return "Møteåpning"
        case PondusCategory.priceObjection: return "Prisinnvending"
        case PondusCategory.decisionMaker: return "Beslutningstaker"
        case PondusCategory.followUp: return "Oppfølging"
        default: return template.category
        }
    }
    private var scoreColor: Color {
        if template.score >= 85 { return LBrand.green }
        if template.score >= 70 { return LBrand.orange }
        return LBrand.yellow
    }
}

/// Empty-state når backend har 0 publiserte maler.
struct PondusEmptyStateView: View {
    let isSuperAdmin: Bool
    let isLoading: Bool
    let onNew: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            if isLoading {
                ProgressView().tint(LBrand.purpleLight)
            } else {
                Image(systemName: "book.pages.fill")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(LBrand.purpleLight.opacity(0.7))
            }
            Text("Ingen publiserte pondus-maler enda")
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(.white)
            if isSuperAdmin {
                Text("Legg til første mal og publiser den slik at alle brukere får tilgang.")
                    .font(.system(size: 13))
                    .foregroundStyle(LBrand.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                Button(action: onNew) {
                    HStack(spacing: 6) {
                        Image(systemName: "plus.circle.fill").font(.system(size: 12, weight: .bold))
                        Text("Legg til første mal")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight], startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }.buttonStyle(.plain)
            } else {
                Text("Din SuperAdmin publiserer maler her.")
                    .font(.system(size: 13))
                    .foregroundStyle(LBrand.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 70)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1))
    }
}

