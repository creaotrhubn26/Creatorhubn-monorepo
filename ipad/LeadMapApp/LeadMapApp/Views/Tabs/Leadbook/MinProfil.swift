// MinProfil.swift — Min profil-modal (2026-06-30; wiret mot ekte data 2026-07-17)

import SwiftUI
import PhotosUI

struct MinProfilSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var toast: String?
    /// Focal point: 0 = center, ±0.6 = edge (generøst for portrett-i-landscape).
    /// Persisteres i UserDefaults per bruker (gikk tidligere tapt ved lukk).
    @State private var focalOffset: CGSize = .zero
    @State private var focalScale: CGFloat = 1.0
    @State private var showFocalEditor = false
    @State private var didAutoDetectFace = false

    // Ekte profil-data (GET/PATCH /me/profile) + handlinger som før var døde.
    @State private var myProfile: MyProfile?
    // 2026-07-17: «Mitt utstyr» — utstyr utlevert til meg fra org-ens
    // utstyrsregister (GET /equipment/mine). Kun i ekte modus — profilen
    // holdes ærlig, så seksjonen skjules helt i demo.
    @State private var myEquipment: [APIClient.EquipmentDTO] = []
    @State private var equipmentLoaded = false
    /// Dørsalg: mine egne dør-tall (meg-blokka fra /dorsalg/stats).
    @State private var dorsalgMeg: KartverketService.DorsalgStats.Meg?
    @State private var showEditProfile = false
    @State private var showLogoutConfirm = false
    @State private var showFeedback = false
    @State private var photoItem: PhotosPickerItem?
    @State private var localPortrait: UIImage?

    private var focalKey: String { "minprofil.focal.\(appState.userEmail ?? "ukjent")" }
    private var portraitFileURL: URL {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let safe = (appState.userEmail ?? "ukjent").replacingOccurrences(of: "/", with: "_")
        return dir.appendingPathComponent("profil-portrett-\(safe).jpg")
    }

    /// Rolle-tittel fra faktisk org-rolle — var hardkodet «Salgssjef».
    private var roleTitle: String {
        switch appState.roleInOrg {
        case "admin": return "Administrator"
        case "salgssjef": return "Salgssjef"
        case "teamleder": return "Teamleder"
        case "salgskonsulent": return "Salgskonsulent"
        case "kvalitet": return "Kvalitetskontrollør"
        case "promotor": return "Promotør"
        case .some(let r): return r.capitalized
        case nil: return "Selger"
        }
    }
    private var isLeaderRole: Bool {
        appState.roleInOrg == "admin" || appState.roleInOrg == "salgssjef"
    }

    /// «daniel@…» → «portrait-daniel». Faller tilbake til `portrait-lars`
    /// hvis brukerens asset ikke er lagt til enda (bevarer visuelt før
    /// per-bruker-portraits leveres av backend).
    private var portraitAsset: String {
        guard let email = appState.userEmail,
              let local = email.split(separator: "@").first else {
            return "portrait-lars"
        }
        let candidate = "portrait-\(local.lowercased())"
        return UIImage(named: candidate) != nil ? candidate : "portrait-lars"
    }

    /// E-post + telefon for hero-linjen — telefon fra ekte profil
    /// (/me/profile), utelates hvis ikke registrert (var hardkodet).
    private var heroContact: String {
        let email = appState.userEmail ?? "ukjent@leadgrid.no"
        if let phone = myProfile?.phone, !phone.isEmpty {
            return "\(email) · \(phone)"
        }
        return email
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        hero
                        kpiRow
                        infoCard
                        // achievementsCard fjernet 2026-07-17: badges var hardkodet
                        // mock («4 av 12») — kommer tilbake når det finnes en ekte
                        // achievements-kilde i backend.
                        // 2026-07-17: «Mitt utstyr» — kun i ekte modus (demo har
                        // ingen ekte utleveringer, og profilen skal være ærlig).
                        if !DemoModeManager.isActiveNonisolated {
                            myEquipmentCard
                        }
                        actionsRow
                        Color.clear.frame(height: 20)
                    }
                    .padding(20)
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
            .navigationTitle("Min profil")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                loadPersistedFocal()
                loadPersistedPortrait()
                autoDetectFaceIfNeeded()
            }
            .task { myProfile = try? await appState.api?.fetchMyProfile().profile }
            // Dørsalg-KPI-ene (kun for dørsalg-profil-orger).
            .task {
                guard erDorsalgProfil, let api = appState.api else { return }
                dorsalgMeg = await KartverketService.shared.fetchDorsalgStats(using: api)?.meg
            }
            // 2026-07-17: Mitt utstyr — hentes kun i ekte modus.
            .task {
                guard !DemoModeManager.isActiveNonisolated, let api = appState.api else {
                    equipmentLoaded = true
                    return
                }
                myEquipment = (try? await api.fetchMyEquipment()) ?? []
                equipmentLoaded = true
            }
            .onChange(of: focalOffset) { _, _ in persistFocal() }
            .onChange(of: focalScale) { _, _ in persistFocal() }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task { await importPortrait(item) }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        // Innlogging er Google/pairing — appen har ingen passord,
                        // derfor finnes ikke «Endre passord» lenger (var død knapp).
                        Button {
                            // Systemets varslingsinnstillinger for appen.
                            if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        } label: { Label("Notifikasjoner", systemImage: "bell.fill") }
                        Link(destination: URL(string: "https://leadgrid.no/personvern")!) {
                            Label("Personvern", systemImage: "lock.shield.fill")
                        }
                        Button {
                            showFeedback = true
                        } label: { Label("Hva synes du om Leadgrid?", systemImage: "star.bubble.fill") }
                        Divider()
                        Button(role: .destructive) {
                            showLogoutConfirm = true
                        } label: { Label("Logg ut", systemImage: "rectangle.portrait.and.arrow.right") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
            .confirmationDialog("Logge ut av Leadgrid?", isPresented: $showLogoutConfirm, titleVisibility: .visible) {
                Button("Logg ut", role: .destructive) {
                    dismiss()
                    appState.signOut()
                }
                Button("Avbryt", role: .cancel) {}
            }
            .sheet(isPresented: $showFeedback) {
                if let api = appState.api {
                    LeadgridFeedbackSheet(api: api)
                }
            }
            .sheet(isPresented: $showEditProfile) {
                EditMyProfileSheet(profile: myProfile) { updated in
                    myProfile = updated
                    toast = "Profil lagret"
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
                }
            }
        }
        .macCatalystSheetSize(minWidth: 900, minHeight: 720)
    }

    // MARK: persist — focal point + lokalt portrett

    private func persistFocal() {
        UserDefaults.standard.set(
            [focalOffset.width, focalOffset.height, focalScale].map(Double.init),
            forKey: focalKey)
    }

    private func loadPersistedFocal() {
        guard let v = UserDefaults.standard.array(forKey: focalKey) as? [Double], v.count == 3 else { return }
        focalOffset = CGSize(width: v[0], height: v[1])
        focalScale = CGFloat(v[2])
        didAutoDetectFace = true   // brukerens valg vinner over AI-forslaget
    }

    private func loadPersistedPortrait() {
        guard localPortrait == nil,
              let data = try? Data(contentsOf: portraitFileURL),
              let img = UIImage(data: data) else { return }
        localPortrait = img
    }

    private func importPortrait(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let img = UIImage(data: data) else {
            toast = "Kunne ikke lese bildet"
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
            return
        }
        localPortrait = img
        // Nytt bilde → nullstill focal (brukeren justerer selv).
        focalOffset = .zero; focalScale = 1.0
        try? img.jpegData(compressionQuality: 0.88)?.write(to: portraitFileURL)
        toast = "Profilbilde oppdatert"
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
    }

    /// Kjør Vision-ansiktsdetektor hvis brukeren ikke har overstyrt focal point.
    /// Setter focalOffset slik at ansiktet havner i øvre tredjedel av heroen.
    private func autoDetectFaceIfNeeded() {
        guard !didAutoDetectFace, focalOffset == .zero, focalScale == 1.0 else { return }
        FaceDetector.detectFaceCenter(in: portraitAsset) { center in
            guard let center else { return }
            let suggested = FaceDetector.focalOffset(faceCenter: center)
            withAnimation(.easeInOut(duration: 0.6)) {
                focalOffset = suggested
                didAutoDetectFace = true
            }
            toast = "AI fant ansiktet — bildet er sentrert"
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { toast = nil }
        }
    }

    /// Hero-bildet: brukerens eget bilde (fra Bytt bilde) vinner over asset.
    @ViewBuilder
    private var portraitImage: some View {
        if let ui = localPortrait {
            Image(uiImage: ui).resizable()
        } else {
            Image(portraitAsset).resizable()
        }
    }

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            // Portrett m/ brukerstyrt focal point
            GeometryReader { geo in
                portraitImage
                    .scaledToFill()
                    .scaleEffect(focalScale)
                    .offset(
                        x: focalOffset.width * geo.size.width,
                        y: focalOffset.height * geo.size.height
                    )
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
            }
            .frame(maxWidth: .infinity)
            .frame(height: 360)
            .clipped()
            LinearGradient(
                colors: [.clear, .black.opacity(0.75)],
                startPoint: .top, endPoint: .bottom
            )
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 7) {
                    HStack(spacing: 4) {
                        Circle().fill(LBrand.green).frame(width: 8, height: 8)
                        Text("ONLINE").font(.appScaled(size: 9, weight: .black))
                            .foregroundStyle(LBrand.green).tracking(0.8)
                    }
                }
                Text(appState.displayName)
                    .font(.appScaled(size: 30, weight: .heavy))
                    .foregroundStyle(.white)
                HStack(spacing: 6) {
                    if isLeaderRole {
                        Image(systemName: "crown.fill").font(.appScaled(size: 11))
                            .foregroundStyle(LBrand.yellow)
                    }
                    Text(roleTitle)
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    if let prof = myProfile?.profession, !prof.isEmpty {
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text(prof)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
                Text(heroContact)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .padding(20)
            // Flytende «Juster bildet»-knapp øverst-høyre på heroen
            VStack {
                HStack {
                    Spacer()
                    Button { showFocalEditor = true } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                                .font(.appScaled(size: 11, weight: .bold))
                            Text("Juster bildet").font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(.black.opacity(0.55), in: Capsule())
                        .overlay(Capsule().stroke(.white.opacity(0.2), lineWidth: 1))
                    }.buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(14)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(LBrand.purple.opacity(0.3), lineWidth: 1))
        .sheet(isPresented: $showFocalEditor) {
            FocalPointEditorSheet(
                imageName: portraitAsset,
                uiImage: localPortrait,
                offset: $focalOffset,
                scale: $focalScale
            )
        }
    }

    // MARK: KPI — EKTE tall fra mine leads (var hardkodet mock til 2026-07-17)

    /// Leads tildelt meg (matcher på e-post — samme identitet som innloggingen).
    private var myLeads: [LeadModel] {
        guard let email = appState.userEmail?.lowercased() else { return [] }
        return appState.leads.filter { $0.assignedUserEmail?.lowercased() == email }
    }
    private var myActiveLeads: [LeadModel] {
        myLeads.filter { $0.status != .won && $0.status != .lost && $0.status != .doNotContact }
    }
    private var myWonLeads: [LeadModel] { myLeads.filter { $0.status == .won } }

    private func formatKr(_ v: Double) -> String {
        if v >= 1_000_000 { return String(format: "%.1f mill", v / 1_000_000).replacingOccurrences(of: ".", with: ",") }
        if v >= 1_000 { return "\(Int(v / 1_000))k" }
        return "\(Int(v))"
    }

    /// Dørsalg-org: lead-KPI-ene ville stått på null for alltid — vis
    /// personlige dørsalg-tall i stedet (Daniel 2026-07-18). `meg`-blokka
    /// fra /dorsalg/stats.
    private var erDorsalgProfil: Bool {
        EntitlementStore.shared.erRenDorsalgOrg
    }

    @ViewBuilder
    private var kpiRow: some View {
        if erDorsalgProfil {
            dorsalgKpiRow
        } else {
            leadKpiRow
        }
    }

    private var dorsalgKpiRow: some View {
        let m = dorsalgMeg
        let behandlet = (m?.vunnet ?? 0) + (m?.avslatt ?? 0)
        let hitRate = behandlet > 0
            ? "\(Int((Double(m?.vunnet ?? 0) / Double(behandlet) * 100).rounded())) %"
            : "–"
        return HStack(spacing: 10) {
            kpiTile("Dører i dag", "\(m?.iDag ?? 0)", LBrand.purpleLight, "door.left.hand.open")
            kpiTile("Denne uka", "\(m?.denneUka ?? 0)", LBrand.blue, "calendar")
            kpiTile("Vunnet", "\(m?.vunnet ?? 0)", LBrand.green, "trophy.fill")
            kpiTile("Hit-rate", hitRate, LBrand.orange, "percent")
        }
    }

    private var leadKpiRow: some View {
        let pipeline = myActiveLeads.compactMap(\.estimatedValue).reduce(0, +)
        let wonSum = myWonLeads.compactMap(\.estimatedValue).reduce(0, +)
        let meetings = myLeads.filter { $0.status == .meetingBooked }.count
        return HStack(spacing: 10) {
            kpiTile("Mine leads", "\(myActiveLeads.count)", LBrand.purpleLight, "person.text.rectangle.fill")
            kpiTile("Pipeline", "\(formatKr(pipeline)) kr", LBrand.green, "chart.line.uptrend.xyaxis")
            kpiTile("Møter booket", "\(meetings)", LBrand.blue, "calendar.badge.checkmark")
            kpiTile("Vunnet", wonSum > 0 ? "\(formatKr(wonSum)) kr" : "\(myWonLeads.count)", LBrand.orange, "trophy.fill")
        }
    }

    private func kpiTile(_ label: String, _ value: String, _ tint: Color, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(tint)
                Text(label.uppercased())
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Text(value)
                .font(.appScaled(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    // Kun EKTE felter — Område/Team/ansatt-siden/Pondus-score var hardkodet
    // mock og er fjernet til datakildene finnes.
    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("INFO").font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            VStack(spacing: 10) {
                infoRow(icon: "person.badge.shield.checkmark.fill", label: "Rolle",
                        value: isLeaderRole ? "\(roleTitle) · Admin-tilgang" : roleTitle,
                        tint: LBrand.yellow)
                infoRow(icon: "envelope.fill", label: "E-post",
                        value: appState.userEmail ?? "—", tint: LBrand.blue)
                infoRow(icon: "phone.fill", label: "Telefon",
                        value: (myProfile?.phone?.isEmpty == false) ? myProfile!.phone! : "Ikke registrert",
                        tint: LBrand.green)
                infoRow(icon: "person.text.rectangle.fill", label: "Tildelte leads",
                        value: "\(myLeads.count) totalt · \(myActiveLeads.count) aktive",
                        tint: LBrand.purpleLight)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func infoRow(icon: String, label: String, value: String, tint: Color) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(tint.opacity(0.22))
                Image(systemName: icon).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                Text(value).font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
            }
            Spacer()
        }
    }

    // MARK: Mitt utstyr (2026-07-17) — utlevert org-utstyr, lesevisning.
    // Ingen handlinger i v1: innlevering går via leder (Utstyrsregisteret).

    private var myEquipmentCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("MITT UTSTYR").font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            if !equipmentLoaded {
                HStack(spacing: 8) {
                    ProgressView().tint(LBrand.purpleLight)
                    Text("Laster utstyr …")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            } else if myEquipment.isEmpty {
                Text("Ingen utstyr utlevert")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(LBrand.textSecondary)
            } else {
                VStack(spacing: 10) {
                    ForEach(myEquipment) { item in myEquipmentRow(item) }
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func myEquipmentRow(_ item: APIClient.EquipmentDTO) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(LBrand.purpleLight.opacity(0.22))
                Image(systemName: UtstyrKind.icon(item.kind))
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(LBrand.purpleLight)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.label)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(myEquipmentSubtitle(item))
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(1)
            }
            Spacer()
        }
    }

    private func myEquipmentSubtitle(_ item: APIClient.EquipmentDTO) -> String {
        var parts: [String] = []
        if let s = item.serialNumber, !s.isEmpty { parts.append("SN \(s)") }
        if let at = item.assignedAt, at.count >= 10 {
            parts.append("utlevert \(at.prefix(10))")
        }
        return parts.isEmpty ? UtstyrKind.label(item.kind) : parts.joined(separator: " · ")
    }

    private var actionsRow: some View {
        HStack(spacing: 10) {
            Button {
                showEditProfile = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "pencil").font(.appScaled(size: 12, weight: .bold))
                    Text("Rediger profil").font(.appScaled(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(
                    LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }.buttonStyle(.plain)
            PhotosPicker(selection: $photoItem, matching: .images) {
                HStack(spacing: 6) {
                    Image(systemName: "camera.fill").font(.appScaled(size: 12, weight: .bold))
                    Text("Bytt bilde").font(.appScaled(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
            }.buttonStyle(.plain)
        }
    }
}

// MARK: - EditMyProfileSheet — ekte redigering mot PATCH /me/profile

struct EditMyProfileSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    let profile: MyProfile?
    var onSaved: (MyProfile) -> Void

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var phone = ""
    @State private var profession = ""
    @State private var saving = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        field("Fornavn", $firstName, "Fornavn")
                        field("Etternavn", $lastName, "Etternavn")
                        field("Telefon", $phone, "+47 …", keyboard: .phonePad)
                        field("Tittel/profesjon", $profession, "F.eks. Selger")
                        if let e = errorMsg {
                            Text(e).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(LBrand.red)
                        }
                        Button { Task { await save() } } label: {
                            HStack(spacing: 6) {
                                if saving { ProgressView().tint(.white) }
                                Text("Lagre").font(.appScaled(size: 13, weight: .bold))
                            }
                            .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 13)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .disabled(saving)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Rediger profil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            firstName = profile?.firstName ?? ""
            lastName = profile?.lastName ?? ""
            phone = profile?.phone ?? ""
            profession = profile?.profession ?? ""
        }
    }

    private func field(_ label: String, _ text: Binding<String>, _ placeholder: String,
                       keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(LBrand.textSecondary)
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .font(.appScaled(size: 14)).foregroundStyle(.white).padding(12)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
        }
    }

    private func save() async {
        guard let api = appState.api else { errorMsg = "Ikke innlogget."; return }
        saving = true; errorMsg = nil
        defer { saving = false }
        do {
            let updated = try await api.patchMyProfile([
                "first_name": firstName.trimmingCharacters(in: .whitespaces),
                "last_name": lastName.trimmingCharacters(in: .whitespaces),
                "phone": phone.trimmingCharacters(in: .whitespaces),
                "profession": profession.trimmingCharacters(in: .whitespaces),
            ])
            onSaved(updated.profile)
            dismiss()
        } catch {
            errorMsg = "Kunne ikke lagre — prøv igjen."
        }
    }
}

// MARK: - FocalPointEditorSheet
// Lar brukeren posisjonere bildet i klippramen ved å dra og pinch-zoome.

struct FocalPointEditorSheet: View {
    let imageName: String
    /// Brukerens eget bilde (fra Bytt bilde) — vinner over asset-navnet.
    var uiImage: UIImage? = nil
    @Binding var offset: CGSize
    @Binding var scale: CGFloat

    @ViewBuilder
    private var editorImage: some View {
        if let ui = uiImage {
            Image(uiImage: ui).resizable()
        } else {
            Image(imageName).resizable()
        }
    }

    @Environment(\.dismiss) private var dismiss

    // Live drag/zoom state — kommitres til offset/scale ved Lagre
    @State private var draftOffset: CGSize = .zero
    @State private var draftScale: CGFloat = 1.0
    @GestureState private var dragDelta: CGSize = .zero
    @GestureState private var pinchDelta: CGFloat = 1.0

    // Aspect-rasjo for klippramen (samme som hero)
    private let cropAspect: CGFloat = 16.0 / 9.0  // 360pt høyt på iPad-bredde

    private var currentOffset: CGSize {
        CGSize(
            width: draftOffset.width + dragDelta.width,
            height: draftOffset.height + dragDelta.height
        )
    }
    private var currentScale: CGFloat { max(0.5, min(3.0, draftScale * pinchDelta)) }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                VStack(spacing: 18) {
                    headerText
                    cropPreview
                    avatarPreview
                    controls
                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Juster bildet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        offset = currentOffset
                        scale = currentScale
                        dismiss()
                    } label: {
                        Text("Lagre").font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                    }
                }
            }
            .onAppear {
                draftOffset = offset
                draftScale = scale
            }
        }
    }

    private var headerText: some View {
        VStack(spacing: 6) {
            Text("Dra for å flytte · klyp for å zoome")
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(.white)
            Text("Sørg for at ansiktet er innenfor klippramen i begge forhåndsvisninger.")
                .font(.appScaled(size: 11))
                .foregroundStyle(LBrand.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    /// Stor klippramme der brukeren drar
    private var cropPreview: some View {
        GeometryReader { geo in
            let cropW = geo.size.width
            let cropH = cropW / cropAspect
            ZStack {
                // Bildet
                editorImage
                    .scaledToFill()
                    .scaleEffect(currentScale)
                    .offset(
                        x: currentOffset.width * cropW,
                        y: currentOffset.height * cropH
                    )
                    .frame(width: cropW, height: cropH)
                    .clipped()
                // Grid-linjer for tredjedels-regelen
                gridOverlay
                // Subtilt fadet hjørner
                RoundedRectangle(cornerRadius: 14)
                    .stroke(LBrand.purpleLight.opacity(0.7), lineWidth: 2)
            }
            .frame(width: cropW, height: cropH)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .position(x: cropW / 2, y: cropH / 2)
            .frame(width: cropW, height: cropH)
            .gesture(
                DragGesture()
                    .updating($dragDelta) { val, state, _ in
                        state = CGSize(
                            width: val.translation.width / cropW,
                            height: val.translation.height / cropH
                        )
                    }
                    .onEnded { val in
                        draftOffset.width  += val.translation.width / cropW
                        draftOffset.height += val.translation.height / cropH
                        clampOffset()
                    }
            )
            .simultaneousGesture(
                MagnificationGesture()
                    .updating($pinchDelta) { val, state, _ in state = val }
                    .onEnded { val in
                        draftScale = max(0.5, min(3.0, draftScale * val))
                        clampOffset()
                    }
            )
        }
        .aspectRatio(cropAspect, contentMode: .fit)
        .frame(maxWidth: .infinity)
    }

    /// Liten avatar-forhåndsvisning slik den vil se ut som rund profil-thumbnail
    private var avatarPreview: some View {
        HStack(spacing: 14) {
            VStack(spacing: 5) {
                ZStack {
                    editorImage
                        .scaledToFill()
                        .scaleEffect(currentScale)
                        .offset(
                            x: currentOffset.width * 64,
                            y: currentOffset.height * 64
                        )
                        .frame(width: 64, height: 64)
                        .clipShape(Circle())
                }
                .overlay(Circle().stroke(LBrand.purpleLight.opacity(0.5), lineWidth: 1.5))
                Text("Liten avatar").font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
            }
            VStack(spacing: 5) {
                ZStack {
                    editorImage
                        .scaledToFill()
                        .scaleEffect(currentScale)
                        .offset(
                            x: currentOffset.width * 110,
                            y: currentOffset.height * 110
                        )
                        .frame(width: 110, height: 110)
                        .clipShape(Circle())
                }
                .overlay(Circle().stroke(LBrand.purpleLight.opacity(0.5), lineWidth: 1.5))
                Text("Stor avatar").font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
            }
            VStack(spacing: 5) {
                ZStack {
                    GeometryReader { geo in
                        editorImage
                            .scaledToFill()
                            .scaleEffect(currentScale)
                            .offset(
                                x: currentOffset.width * geo.size.width,
                                y: currentOffset.height * geo.size.height
                            )
                            .frame(width: geo.size.width, height: geo.size.height)
                            .clipped()
                    }
                }
                .frame(width: 160, height: 90)
                .clipShape(RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.purpleLight.opacity(0.5), lineWidth: 1.5))
                Text("Hero").font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
            }
            Spacer()
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private var controls: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                Button {
                    withAnimation {
                        draftScale = max(0.5, draftScale - 0.2)
                        clampOffset()
                    }
                } label: {
                    Image(systemName: "minus.magnifyingglass")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
                Slider(value: $draftScale, in: 0.5...3.0) {
                    Text("Zoom")
                } minimumValueLabel: {
                    Image(systemName: "minus").foregroundStyle(LBrand.textTertiary)
                } maximumValueLabel: {
                    Image(systemName: "plus").foregroundStyle(LBrand.textTertiary)
                }
                .tint(LBrand.purpleLight)
                Button {
                    withAnimation {
                        draftScale = min(3.0, draftScale + 0.2)
                        clampOffset()
                    }
                } label: {
                    Image(systemName: "plus.magnifyingglass")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
            }
            Button {
                withAnimation {
                    draftOffset = .zero
                    draftScale = 1.0
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "arrow.counterclockwise").font(.appScaled(size: 11, weight: .bold))
                    Text("Tilbakestill").font(.appScaled(size: 12, weight: .semibold))
                }
                .foregroundStyle(LBrand.purpleLight)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(LBrand.purple.opacity(0.18), in: Capsule())
                .overlay(Capsule().stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
            }.buttonStyle(.plain)
        }
    }

    private var gridOverlay: some View {
        GeometryReader { geo in
            Path { p in
                // Tredjedels-vertikal
                p.move(to: CGPoint(x: geo.size.width / 3, y: 0))
                p.addLine(to: CGPoint(x: geo.size.width / 3, y: geo.size.height))
                p.move(to: CGPoint(x: geo.size.width * 2 / 3, y: 0))
                p.addLine(to: CGPoint(x: geo.size.width * 2 / 3, y: geo.size.height))
                // Tredjedels-horisontal
                p.move(to: CGPoint(x: 0, y: geo.size.height / 3))
                p.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height / 3))
                p.move(to: CGPoint(x: 0, y: geo.size.height * 2 / 3))
                p.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height * 2 / 3))
            }
            .stroke(.white.opacity(0.25), lineWidth: 0.8)
        }
        .allowsHitTesting(false)
    }

    /// Holder offset innenfor rimelig grense. For portrett-i-landscape har vi mye
    /// vertikalt slingrings-rom, så vi tillater ±0.7 i Y, ±0.4 i X.
    private func clampOffset() {
        let yLimit: CGFloat = 0.7
        let xLimit: CGFloat = 0.4
        draftOffset.width  = max(-xLimit, min(xLimit, draftOffset.width))
        draftOffset.height = max(-yLimit, min(yLimit, draftOffset.height))
    }
}
