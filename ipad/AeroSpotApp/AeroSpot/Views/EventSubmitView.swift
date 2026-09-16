// EventSubmitView.swift — arrangør melder inn et arrangement. Sendes til
// godkjenning (status=pending, verified=false). Krever innlogging.

import SwiftUI
import MapKit
import CoreLocation

struct EventSubmitView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model
    @State private var showLogin = false

    @State private var name = ""
    @State private var type = "airshow"
    @State private var venue = ""
    @State private var country = "NO"
    @State private var airportIcao = ""
    @State private var startDate = Date()
    @State private var multiDay = false
    @State private var endDate = Date()
    @State private var description = ""
    @State private var ticketUrl = ""
    @State private var websiteUrl = ""
    @State private var contactEmail = ""
    @State private var contactPhone = ""
    @State private var program: [EventProgramItem] = []
    @State private var aircraft: [String] = []
    @State private var newAircraft = ""
    @State private var venuePins: [VenuePin] = []

    @State private var submitting = false
    @State private var result: AeroSpotAPI.SubmitResult?

    private let types: [(String, String)] = [
        ("airshow", "Flyshow"), ("flydag", "Flydag"),
        ("spotting", "Spotting"), ("museum", "Museum"), ("fly-in", "Fly-in"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                if !model.auth.isLoggedIn { loginGate }

                Section("Om arrangementet") {
                    TextField("Navn", text: $name)
                    Picker("Type", selection: $type) {
                        ForEach(types, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    TextField("Sted / venue", text: $venue)
                    TextField("Land (ISO-2, f.eks. NO)", text: $country)
                        .textInputAutocapitalization(.characters)
                    TextField("Flyplass ICAO (valgfritt)", text: $airportIcao)
                        .textInputAutocapitalization(.characters)
                }

                Section("Dato") {
                    DatePicker("Startdato", selection: $startDate, displayedComponents: .date)
                    Toggle("Flere dager", isOn: $multiDay)
                    if multiDay {
                        DatePicker("Sluttdato", selection: $endDate, displayedComponents: .date)
                    }
                }

                Section("Beskrivelse") {
                    TextField("Kort beskrivelse", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("Lenker (valgfritt)") {
                    TextField("Billett-URL", text: $ticketUrl)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    TextField("Nettside", text: $websiteUrl)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                }

                Section {
                    TextField("E-post", text: $contactEmail)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    TextField("Telefon", text: $contactPhone)
                        .keyboardType(.phonePad)
                } header: {
                    Text("Kontakt (valgfritt)")
                } footer: {
                    Text("Vises på arrangementssiden så publikum kan nå deg direkte.")
                }

                programSection
                aircraftSection
                venueMapSection

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            Spacer()
                            Text(submitting ? "Sender…" : "Send til godkjenning").bold()
                            Spacer()
                        }
                    }
                    .disabled(!canSubmit || submitting)
                }

                if let result {
                    Section { resultBanner(result) }
                }
            }
            .navigationTitle("Meld inn arrangement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
            }
            .sheet(isPresented: $showLogin) { AuthView() }
        }
    }

    /// Login-vegg: innsending krever innlogget CreatorHub-konto (server
    /// setter status=pending). Uten innlogging gir backend 401.
    private var loginGate: some View {
        Section {
            Button {
                showLogin = true
            } label: {
                HStack {
                    Spacer()
                    Label("Logg inn for å melde inn", systemImage: "person.crop.circle.badge.plus")
                        .bold()
                    Spacer()
                }
            }
        } footer: {
            Text("Innsending krever innlogging. Da får arrangementet en eier og kan verifiseres.")
        }
    }

    private var canSubmit: Bool {
        model.auth.isLoggedIn &&
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        !venue.trimmingCharacters(in: .whitespaces).isEmpty &&
        !description.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // ── Program-bygger ───────────────────────────────────────────────

    @State private var newActTime = "12:00"
    @State private var newActTitle = ""

    private var programSection: some View {
        Section("Program (valgfritt)") {
            ForEach(program, id: \.self) { item in
                HStack {
                    Text(item.time).font(.system(.body, design: .monospaced))
                        .foregroundStyle(Theme.primaryBright)
                    Text(item.title)
                }
            }
            .onDelete { program.remove(atOffsets: $0) }
            HStack {
                TextField("12:30", text: $newActTime)
                    .frame(width: 64)
                    .font(.system(.body, design: .monospaced))
                TextField("Programpunkt", text: $newActTitle)
                Button {
                    let t = newActTime.trimmingCharacters(in: .whitespaces)
                    let title = newActTitle.trimmingCharacters(in: .whitespaces)
                    guard t.contains(":"), !title.isEmpty else { return }
                    program.append(EventProgramItem(time: t, title: title))
                    newActTitle = ""
                } label: { Image(systemName: "plus.circle.fill") }
                    .disabled(newActTitle.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private var aircraftSection: some View {
        Section("Deltakende fly (valgfritt)") {
            ForEach(aircraft, id: \.self) { Text($0) }
                .onDelete { aircraft.remove(atOffsets: $0) }
            HStack {
                TextField("F.eks. F-35A Lightning II", text: $newAircraft)
                Button {
                    let a = newAircraft.trimmingCharacters(in: .whitespaces)
                    guard !a.isEmpty else { return }
                    aircraft.append(a); newAircraft = ""
                } label: { Image(systemName: "plus.circle.fill") }
                    .disabled(newAircraft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private var venueMapSection: some View {
        Section {
            NavigationLink {
                VenueMapEditor(pins: $venuePins)
            } label: {
                HStack {
                    Label("Områdekart", systemImage: "map")
                    Spacer()
                    Text(venuePins.isEmpty ? "Legg til punkter" : "\(venuePins.count) punkter")
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("Områdekart (valgfritt)")
        } footer: {
            Text("Marker fotopunkter, innganger, parkering og fasiliteter så publikum ser oppsettet.")
        }
    }

    @ViewBuilder
    private func resultBanner(_ r: AeroSpotAPI.SubmitResult) -> some View {
        switch r {
        case .success:
            Label("Sendt! Arrangementet vises etter godkjenning.", systemImage: "checkmark.circle.fill")
                .foregroundStyle(Theme.success)
        case .unauthorized:
            Label("Du må være innlogget for å melde inn arrangement.", systemImage: "person.crop.circle.badge.exclamationmark")
                .foregroundStyle(Theme.warning)
        case .failed:
            Label("Noe gikk galt. Prøv igjen.", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.danger)
        }
    }

    private func submit() async {
        submitting = true
        result = nil
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        var payload: [String: Any] = [
            "name": name, "type": type, "venue": venue,
            "country": country.uppercased(),
            "startDate": fmt.string(from: startDate),
            "endDate": fmt.string(from: multiDay ? endDate : startDate),
            "description": description,
        ]
        if !airportIcao.isEmpty { payload["airportIcao"] = airportIcao.uppercased() }
        if !ticketUrl.isEmpty { payload["ticketUrl"] = ticketUrl }
        if !websiteUrl.isEmpty { payload["url"] = websiteUrl }
        if !contactEmail.isEmpty { payload["contactEmail"] = contactEmail.trimmingCharacters(in: .whitespaces) }
        if !contactPhone.isEmpty { payload["contactPhone"] = contactPhone.trimmingCharacters(in: .whitespaces) }
        if !program.isEmpty {
            payload["program"] = program.map { ["time": $0.time, "title": $0.title] }
        }
        if !aircraft.isEmpty { payload["aircraft"] = aircraft }
        if !venuePins.isEmpty {
            payload["venueMap"] = venuePins.map {
                ["type": $0.type, "name": $0.name, "latitude": $0.latitude, "longitude": $0.longitude]
            }
        }

        let body = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data()
        result = await AeroSpotAPI.submitEvent(body: body)
        submitting = false
    }
}

/// Kart-editor: trykk for å slippe et punkt, velg type og navn.
struct VenueMapEditor: View {
    @Binding var pins: [VenuePin]
    @Environment(\.dismiss) private var dismiss

    @State private var camera: MapCameraPosition = .automatic
    @State private var pendingCoord: CLLocationCoordinate2D?
    @State private var pinType: VenuePinKind = .photo
    @State private var pinName = ""

    var body: some View {
        VStack(spacing: 0) {
            MapReader { proxy in
                Map(position: $camera) {
                    ForEach(pins) { pin in
                        Annotation(pin.name, coordinate:
                            CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude)) {
                            Image(systemName: VenuePinKind.from(pin.type).systemImage)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(6).background(Theme.primary).clipShape(Circle())
                                .overlay(Circle().stroke(.white, lineWidth: 1.5))
                        }
                    }
                    if let pc = pendingCoord {
                        Annotation("Nytt punkt", coordinate: pc) {
                            Image(systemName: "mappin").font(.title3).foregroundStyle(Theme.gold)
                        }
                    }
                }
                .onTapGesture { location in
                    if let coord = proxy.convert(location, from: .local) { pendingCoord = coord }
                }
            }
            .frame(maxHeight: .infinity)
            editorPanel
        }
        .navigationTitle("Områdekart")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("Ferdig") { dismiss() } }
        }
    }

    private var editorPanel: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            if pendingCoord != nil {
                Text("Nytt punkt").font(.caption.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                Picker("Type", selection: $pinType) {
                    ForEach(VenuePinKind.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                .pickerStyle(.menu)
                HStack {
                    TextField("Navn (f.eks. Fotopunkt sør)", text: $pinName)
                        .textFieldStyle(.roundedBorder)
                    Button("Legg til") {
                        guard let c = pendingCoord else { return }
                        let name = pinName.trimmingCharacters(in: .whitespaces)
                        pins.append(VenuePin(type: pinType.rawValue,
                            name: name.isEmpty ? pinType.label : name,
                            latitude: c.latitude, longitude: c.longitude, note: nil))
                        pendingCoord = nil
                        pinName = ""
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                Text("Trykk på kartet for å plassere et punkt.")
                    .font(.subheadline).foregroundStyle(Theme.textSecondary)
            }
            if !pins.isEmpty {
                Divider()
                ForEach(pins) { pin in
                    HStack {
                        Image(systemName: VenuePinKind.from(pin.type).systemImage)
                            .foregroundStyle(Theme.primaryBright)
                        Text(pin.name)
                        Spacer()
                        Button {
                            pins.removeAll { $0.id == pin.id }
                        } label: { Image(systemName: "trash").foregroundStyle(Theme.danger) }
                    }
                    .font(.subheadline)
                }
            }
        }
        .padding(Theme.spacingLG)
        .background(Theme.surface)
    }
}
