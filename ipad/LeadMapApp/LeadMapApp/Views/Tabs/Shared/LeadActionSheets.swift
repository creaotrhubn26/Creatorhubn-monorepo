// LeadActionSheets.swift — delte lead-action-modaler (Pakke 10.1, 2026-07-01).
//
// Bygd som svar på Daniel-feedback: både Kart og Leads-fanen har 4 handlinger
// som ba om ekte modaler i stedet for toast-stubs. Vi bygger dem her som lead-
// scope (ikke meeting-scope som Møter-fanen har) siden en «lead» ikke har
// start/slutt-tid slik et møte har.
//
// Innhold:
//   • LeadStatusChangeSheet   — bytt lead-status (unvisited/interested/won/lost/…)
//   • LeadAssignSellerSheet    — tildel/omfordel til annen selger
//   • LeadNoteSheet            — skriv notat på lead (category + pin + AI-forslag)
//   • confirmationDialog       — brukes inline for "arkiver lead"-flow

import SwiftUI

// MARK: - Brand

fileprivate enum LaBrand {
    static let bg           = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card         = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi       = Color(red: 0.14, green: 0.12, blue: 0.22)
    static let stroke       = Color.white.opacity(0.08)
    static let purple       = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight  = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let orange       = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let green        = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let red          = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let blue         = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let yellow       = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let textPrimary  = Color.white
    static let textSecondary = Color.white.opacity(0.65)
    static let textTertiary = Color.white.opacity(0.4)
}

// MARK: - 1. LeadStatusChangeSheet

struct LeadStatusChangeSheet: View {
    let companyName: String
    let companyColor: Color
    let currentStatus: LeadPipelineStatus
    var onSave: ((LeadPipelineStatus, String) -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var selected: LeadPipelineStatus
    @State private var note: String = ""

    init(
        companyName: String,
        companyColor: Color,
        currentStatus: LeadPipelineStatus = .interested,
        onSave: ((LeadPipelineStatus, String) -> Void)? = nil
    ) {
        self.companyName = companyName
        self.companyColor = companyColor
        self.currentStatus = currentStatus
        self.onSave = onSave
        self._selected = State(initialValue: currentStatus)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LaBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        leadHeader
                        Text("VELG NY STATUS")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(LaBrand.textTertiary).tracking(0.8)
                        VStack(spacing: 8) {
                            ForEach(LeadPipelineStatus.allCases) { s in
                                statusRow(s)
                            }
                        }
                        Text("NOTAT (VALGFRITT)")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(LaBrand.textTertiary).tracking(0.8)
                            .padding(.top, 8)
                        TextEditor(text: $note)
                            .font(.system(size: 13))
                            .foregroundStyle(.white)
                            .scrollContentBackground(.hidden)
                            .padding(10)
                            .frame(minHeight: 100)
                            .background(LaBrand.card, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LaBrand.stroke, lineWidth: 1))
                            .overlay(alignment: .topLeading) {
                                if note.isEmpty {
                                    Text("Forklar hvorfor status endres…")
                                        .font(.system(size: 13))
                                        .foregroundStyle(LaBrand.textTertiary)
                                        .padding(14)
                                        .allowsHitTesting(false)
                                }
                            }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Endre status")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(LaBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        onSave?(selected, note)
                        dismiss()
                    } label: {
                        Text("Lagre")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 7)
                            .background(
                                LinearGradient(colors: [LaBrand.purple, LaBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(selected == currentStatus)
                    .opacity(selected == currentStatus ? 0.5 : 1)
                }
            }
            .toolbarBackground(LaBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .macCatalystSheetSize(minWidth: 720, minHeight: 640)
    }

    private var leadHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(companyColor.opacity(0.22))
                Image(systemName: "building.2.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(companyColor)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text("Endre status for")
                    .font(.system(size: 11)).foregroundStyle(LaBrand.textSecondary)
                Text(companyName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
        .padding(12)
        .background(LaBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LaBrand.stroke, lineWidth: 1))
    }

    private func statusRow(_ s: LeadPipelineStatus) -> some View {
        Button { selected = s } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(s.color.opacity(0.24))
                    Image(systemName: s.icon)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(s.color)
                }.frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.label).font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(s.subtitle).font(.system(size: 10))
                        .foregroundStyle(LaBrand.textSecondary)
                }
                Spacer(minLength: 6)
                if s == selected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(LaBrand.green)
                }
            }
            .padding(11)
            .background(
                selected == s ? s.color.opacity(0.12) : LaBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(selected == s ? s.color.opacity(0.5) : LaBrand.stroke, lineWidth: 1)
            )
        }.buttonStyle(.plain)
    }
}

// MARK: LeadPipelineStatus

enum LeadPipelineStatus: String, CaseIterable, Identifiable, Hashable {
    case unvisited, contacted, interested, meetingBooked, proposalSent, negotiation, won, lost, doNotContact

    var id: String { rawValue }

    var label: String {
        switch self {
        case .unvisited:     return "Ikke besøkt"
        case .contacted:     return "Kontaktet"
        case .interested:    return "Interessert"
        case .meetingBooked: return "Møte booket"
        case .proposalSent:  return "Tilbud sendt"
        case .negotiation:   return "Forhandling"
        case .won:           return "Vunnet"
        case .lost:          return "Tapt"
        case .doNotContact:  return "Ikke kontakt"
        }
    }

    var subtitle: String {
        switch self {
        case .unvisited:     return "Ingen kontakt enda"
        case .contacted:     return "Første kontakt tatt"
        case .interested:    return "Positive signaler"
        case .meetingBooked: return "Møte i kalender"
        case .proposalSent:  return "Venter tilbakemelding"
        case .negotiation:   return "Aktive forhandlinger"
        case .won:           return "Kontrakt signert"
        case .lost:          return "Ingen deal"
        case .doNotContact:  return "Ikke ta kontakt igjen"
        }
    }

    var icon: String {
        switch self {
        case .unvisited:     return "circle.dashed"
        case .contacted:     return "phone.fill"
        case .interested:    return "hand.thumbsup.fill"
        case .meetingBooked: return "calendar.badge.checkmark"
        case .proposalSent:  return "doc.text.fill"
        case .negotiation:   return "arrow.left.and.right.circle.fill"
        case .won:           return "trophy.fill"
        case .lost:          return "xmark.octagon.fill"
        case .doNotContact:  return "hand.raised.fill"
        }
    }

    var color: Color {
        switch self {
        case .unvisited:     return LaBrand.textTertiary
        case .contacted:     return LaBrand.blue
        case .interested:    return LaBrand.purple
        case .meetingBooked: return LaBrand.purpleLight
        case .proposalSent:  return LaBrand.orange
        case .negotiation:   return LaBrand.yellow
        case .won:           return LaBrand.green
        case .lost:          return LaBrand.red
        case .doNotContact:  return LaBrand.textTertiary
        }
    }
}

// MARK: - 2. LeadAssignSellerSheet

struct LeadAssignSellerSheet: View {
    let companyName: String
    let companyColor: Color
    let currentSellerName: String?
    var onAssign: ((LeadSeller) -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var search: String = ""
    @State private var selectedID: UUID?

    private var sellers: [LeadSeller] {
        [
            LeadSeller(name: "Anniken Sørli",   title: "Salgsdirektør",   avatarColor: .purple,      leadsCount: 42, winRateText: "34 %"),
            LeadSeller(name: "Mikkel Berg",     title: "Senior selger",   avatarColor: .green,       leadsCount: 38, winRateText: "31 %"),
            LeadSeller(name: "Lars Kristensen", title: "Salgssjef",       avatarColor: .blue,        leadsCount: 28, winRateText: "26 %"),
            LeadSeller(name: "Sara Lindberg",   title: "Salgskonsulent",  avatarColor: .orange,      leadsCount: 24, winRateText: "24 %"),
            LeadSeller(name: "Tobias Strand",   title: "Salgskonsulent",  avatarColor: .yellow,      leadsCount: 22, winRateText: "22 %"),
            LeadSeller(name: "Karoline Nesse",  title: "Salgskonsulent",  avatarColor: .red,         leadsCount: 20, winRateText: "20 %"),
            LeadSeller(name: "Henrik Aase",     title: "Salgskonsulent",  avatarColor: Color(red: 0.75, green: 0.45, blue: 1.0), leadsCount: 18, winRateText: "18 %"),
            LeadSeller(name: "Marte Johansen",  title: "Salgskonsulent",  avatarColor: .green,       leadsCount: 15, winRateText: "16 %")
        ]
    }

    private var filtered: [LeadSeller] {
        let s = search.trimmingCharacters(in: .whitespaces).lowercased()
        return s.isEmpty ? sellers : sellers.filter {
            $0.name.lowercased().contains(s) || $0.title.lowercased().contains(s)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LaBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        leadHeader
                        searchField
                        VStack(spacing: 8) {
                            ForEach(filtered) { seller in
                                sellerRow(seller)
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Tildel selger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(LaBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        if let id = selectedID, let s = sellers.first(where: { $0.id == id }) {
                            onAssign?(s)
                        }
                        dismiss()
                    } label: {
                        Text("Tildel")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 7)
                            .background(
                                LinearGradient(colors: [LaBrand.purple, LaBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(selectedID == nil)
                    .opacity(selectedID == nil ? 0.5 : 1)
                }
            }
            .toolbarBackground(LaBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .macCatalystSheetSize(minWidth: 720, minHeight: 620)
    }

    private var leadHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(companyColor.opacity(0.22))
                Image(systemName: "building.2.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(companyColor)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text("Tildel til selger")
                    .font(.system(size: 11)).foregroundStyle(LaBrand.textSecondary)
                Text(companyName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                if let cur = currentSellerName {
                    Text("Nåværende eier: \(cur)")
                        .font(.system(size: 10))
                        .foregroundStyle(LaBrand.orange)
                }
            }
            Spacer()
        }
        .padding(12)
        .background(LaBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LaBrand.stroke, lineWidth: 1))
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(LaBrand.textTertiary)
            TextField("Søk etter selger…", text: $search)
                .font(.system(size: 13))
                .foregroundStyle(.white)
        }
        .padding(11)
        .background(LaBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LaBrand.stroke, lineWidth: 1))
    }

    private func sellerRow(_ s: LeadSeller) -> some View {
        Button { selectedID = s.id } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(s.avatarColor.opacity(0.28))
                    Text(s.initials)
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }.frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.name).font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text(s.title).font(.system(size: 10))
                        .foregroundStyle(LaBrand.textSecondary)
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(s.leadsCount) leads")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(LaBrand.textSecondary).monospacedDigit()
                    Text(s.winRateText)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(LaBrand.green)
                }
                if s.id == selectedID {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(LaBrand.green)
                }
            }
            .padding(11)
            .background(
                selectedID == s.id ? LaBrand.purple.opacity(0.12) : LaBrand.card,
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(selectedID == s.id ? LaBrand.purple.opacity(0.5) : LaBrand.stroke, lineWidth: 1)
            )
        }.buttonStyle(.plain)
    }
}

struct LeadSeller: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let title: String
    let avatarColor: Color
    let leadsCount: Int
    let winRateText: String

    var initials: String {
        name.split(separator: " ").prefix(2)
            .map { String($0.prefix(1)) }.joined().uppercased()
    }
}

// MARK: - 3. LeadNoteSheet

struct LeadNoteSheet: View {
    let companyName: String
    let companyColor: Color
    var onSave: ((String, LeadNoteCategory, Bool) -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var note: String = ""
    @State private var category: LeadNoteCategory = .general
    @State private var pinned: Bool = false

    enum LeadNoteCategory: String, CaseIterable, Identifiable {
        case general = "Generelt"
        case call = "Telefonsamtale"
        case meeting = "Møte-notat"
        case objection = "Innvending"
        case followup = "Neste steg"
        case decision = "Beslutning"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .general: return "note.text"
            case .call: return "phone.fill"
            case .meeting: return "person.2.wave.2.fill"
            case .objection: return "exclamationmark.bubble.fill"
            case .followup: return "arrow.right.circle.fill"
            case .decision: return "flag.fill"
            }
        }
        var color: Color {
            switch self {
            case .general: return LaBrand.blue
            case .call: return LaBrand.green
            case .meeting: return LaBrand.purpleLight
            case .objection: return LaBrand.orange
            case .followup: return LaBrand.purple
            case .decision: return LaBrand.yellow
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LaBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        leadHeader
                        Text("KATEGORI")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(LaBrand.textTertiary).tracking(0.8)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(LeadNoteCategory.allCases) { cat in
                                    Button { category = cat } label: {
                                        HStack(spacing: 5) {
                                            Image(systemName: cat.icon)
                                                .font(.system(size: 10, weight: .bold))
                                            Text(cat.rawValue)
                                                .font(.system(size: 11, weight: .semibold))
                                        }
                                        .foregroundStyle(category == cat ? .white : cat.color)
                                        .padding(.horizontal, 11).padding(.vertical, 6)
                                        .background(
                                            category == cat ? cat.color : cat.color.opacity(0.14),
                                            in: Capsule()
                                        )
                                        .overlay(
                                            Capsule().stroke(cat.color.opacity(0.4), lineWidth: 1)
                                        )
                                    }.buttonStyle(.plain)
                                }
                            }
                        }
                        Text("NOTAT")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(LaBrand.textTertiary).tracking(0.8)
                            .padding(.top, 4)
                        TextEditor(text: $note)
                            .font(.system(size: 14))
                            .foregroundStyle(.white)
                            .scrollContentBackground(.hidden)
                            .padding(12)
                            .frame(minHeight: 240)
                            .background(LaBrand.card, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LaBrand.stroke, lineWidth: 1))
                            .overlay(alignment: .topLeading) {
                                if note.isEmpty {
                                    Text("Skriv notat om samtalen, møtet eller neste steg…")
                                        .font(.system(size: 14))
                                        .foregroundStyle(LaBrand.textTertiary)
                                        .padding(16)
                                        .allowsHitTesting(false)
                                }
                            }
                        Toggle(isOn: $pinned) {
                            HStack(spacing: 7) {
                                Image(systemName: "pin.fill")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(pinned ? LaBrand.yellow : LaBrand.textTertiary)
                                Text("Fest øverst i lead-historikken")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .tint(LaBrand.yellow)
                        .padding(12)
                        .background(LaBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(LaBrand.stroke, lineWidth: 1))
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Nytt notat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(LaBrand.purpleLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        onSave?(note, category, pinned)
                        dismiss()
                    } label: {
                        Text("Lagre")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 7)
                            .background(
                                LinearGradient(colors: [LaBrand.purple, LaBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: Capsule()
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(note.trimmingCharacters(in: .whitespaces).isEmpty)
                    .opacity(note.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
                }
            }
            .toolbarBackground(LaBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .macCatalystSheetSize(minWidth: 720, minHeight: 620)
    }

    private var leadHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(companyColor.opacity(0.22))
                Image(systemName: "building.2.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(companyColor)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text("Nytt notat for")
                    .font(.system(size: 11)).foregroundStyle(LaBrand.textSecondary)
                Text(companyName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
        .padding(12)
        .background(LaBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LaBrand.stroke, lineWidth: 1))
    }
}
