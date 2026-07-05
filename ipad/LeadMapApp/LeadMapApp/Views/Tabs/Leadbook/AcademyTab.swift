// AcademyTab.swift — «Akademi»-sub-fane i Leadbook (2026-07-04)
//
// Kursliste over alle synlige Academy-kurs: offisielle Leadgrid-kurs +
// organisasjonens egne. Kort-grid m/ progresjon, tap åpner den generaliserte
// PondusAkademiSheet-spilleren for kursets kapitler. Admin (admin/super_admin)
// kan opprette kurs, legge til kapitler, laste opp video (R2 presign) og
// slette org-egne kurs/kapitler.

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

// AcademyCourseDTO har `id: String` — Identifiable for sheet(item:)/ForEach.
extension AcademyCourseDTO: Identifiable {}

/// Payload for fullScreenCover — kurs (ekte eller mock-fallback) + kapitler.
private struct AcademyOpenPayload: Identifiable {
    let id: String
    let chapters: [PondusChapter]
}

// MARK: - Hovedview

struct AcademyTabView: View {
    @Environment(AppState.self) private var appState

    @State private var watched: Set<UUID> = []
    @State private var openPayload: AcademyOpenPayload?
    @State private var showNewCourse = false
    @State private var newChapterCourse: AcademyCourseDTO?
    @State private var adminCourse: AcademyCourseDTO?
    @State private var deleteCourseCandidate: AcademyCourseDTO?
    @State private var errorToast: String?

    private var store: AcademyLiveStore { AcademyLiveStore.shared }
    private var isAdmin: Bool {
        appState.userRole == "admin" || appState.userRole == "super_admin"
    }

    private var officialCourses: [AcademyCourseDTO] {
        store.courses.filter { $0.scope == "leadgrid_official" }
    }
    private var orgCourses: [AcademyCourseDTO] {
        store.courses.filter { $0.scope != "leadgrid_official" }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            header
            officialSection
            orgSection
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) {
            if let t = errorToast {
                Label(t, systemImage: "exclamationmark.triangle.fill")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(LBrand.red, in: Capsule())
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: errorToast)
        .task {
            AcademyLiveStore.shared.attach(api: appState.api)
            await AcademyLiveStore.shared.load()
            watched.formUnion(AcademyLiveStore.shared.serverWatched)
        }
        // Spilleren markerer sett (video-slutt / simulert fullført) —
        // persister nye ids mot backend.
        .onChange(of: watched) { old, new in
            for id in new.subtracting(old) {
                AcademyLiveStore.shared.logWatched(id)
            }
        }
        .fullScreenCover(item: $openPayload) { payload in
            if let first = payload.chapters.first {
                PondusAkademiSheet(
                    watched: $watched,
                    current: payload.chapters.first { !watched.contains($0.id) } ?? first,
                    chapters: payload.chapters
                )
            }
        }
        .sheet(isPresented: $showNewCourse) {
            AcademyNewCourseSheet { title, description in
                await createCourse(title: title, description: description)
            }
        }
        .sheet(item: $newChapterCourse) { course in
            AcademyNewChapterSheet(courseTitle: course.title) { title, summary, minutes in
                await createChapter(course: course, title: title, summary: summary, minutes: minutes)
            }
        }
        .sheet(item: $adminCourse) { course in
            AcademyCourseAdminSheet(course: course)
                .environment(appState)
        }
        .confirmationDialog(
            "Slett kurset?",
            isPresented: Binding(
                get: { deleteCourseCandidate != nil },
                set: { if !$0 { deleteCourseCandidate = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Slett «\(deleteCourseCandidate?.title ?? "")»", role: .destructive) {
                if let course = deleteCourseCandidate {
                    Task { await deleteCourse(course) }
                }
            }
            Button("Avbryt", role: .cancel) { deleteCourseCandidate = nil }
        } message: {
            Text("Kurset, alle kapitler og teamets progresjon slettes permanent.")
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Leadbook — Akademi")
                    .font(.appScaled(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                Text("Videokurs for teamet — offisielle Leadgrid-kurs og organisasjonens egne opplæringsløp.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 12)
            if isAdmin {
                Button { showNewCourse = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus").font(.appScaled(size: 11, weight: .bold))
                        Text("Nytt kurs").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                    .shadow(color: LBrand.purple.opacity(0.45), radius: 6, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Seksjoner

    private var officialSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("LEADGRID-KURS", icon: "checkmark.seal.fill", tint: LBrand.purpleLight)
            LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 1, iPad: 2, mac: 3), spacing: 12) {
                if officialCourses.isEmpty {
                    // Offline/demo-fallback: Pondus-Akademiet fra innebygd mock
                    // slik at fanen aldri står tom.
                    AcademyCourseCard(
                        title: "Lær Leadgrid Pondus",
                        description: "Bygg autoritet, klarhet, troverdighet, trygghet og fremdrift i all utadrettet kommunikasjon.",
                        icon: "graduationcap.fill",
                        tint: LBrand.purpleLight,
                        isOfficial: true,
                        chapters: PondusAcademyData.chapters,
                        watched: watched
                    ) {
                        openPayload = AcademyOpenPayload(id: "pondus-mock", chapters: PondusAcademyData.chapters)
                    }
                } else {
                    ForEach(officialCourses) { course in
                        courseCard(course)
                    }
                }
            }
        }
    }

    private var orgSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("DINE KURS", icon: "building.2.fill", tint: LBrand.orange)
            if orgCourses.isEmpty {
                orgEmptyState
            } else {
                LazyVGrid(columns: MacCatalystGrid.adaptive(phone: 1, iPad: 2, mac: 3), spacing: 12) {
                    ForEach(orgCourses) { course in
                        courseCard(course)
                            .contextMenu { orgCourseMenu(course) }
                    }
                }
            }
        }
    }

    private func sectionLabel(_ text: String, icon: String, tint: Color) -> some View {
        HStack(spacing: 7) {
            Image(systemName: icon)
                .font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(tint)
            Text(text)
                .font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(tint)
                .tracking(0.8)
            Spacer()
        }
    }

    private var orgEmptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "graduationcap")
                .font(.appScaled(size: 30, weight: .semibold))
                .foregroundStyle(LBrand.textTertiary)
            Text("Sett en standard i organisasjonen")
                .font(.appScaled(size: 15, weight: .bold))
                .foregroundStyle(.white)
            Text("Lær opp ansatte og utvikle dem til bedre og mer effektive leads-jaktere.")
                .font(.appScaled(size: 12))
                .foregroundStyle(LBrand.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)
            if isAdmin {
                Button { showNewCourse = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus").font(.appScaled(size: 11, weight: .bold))
                        Text("Nytt kurs").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
                .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 34)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(LBrand.stroke, style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
        )
    }

    // MARK: Kort + meny

    private func courseCard(_ course: AcademyCourseDTO) -> some View {
        let chapters = store.chaptersByCourse[course.id] ?? []
        return AcademyCourseCard(
            title: course.title,
            description: course.description ?? "",
            icon: course.posterIcon ?? "graduationcap.fill",
            tint: academyTint(course.posterTint),
            isOfficial: course.scope == "leadgrid_official",
            chapters: chapters,
            watched: watched
        ) {
            if chapters.isEmpty {
                // Tomt kurs: admin sendes rett til kapittel-administrasjon.
                if isAdmin && course.scope != "leadgrid_official" {
                    adminCourse = course
                }
            } else {
                openPayload = AcademyOpenPayload(id: course.id, chapters: chapters)
            }
        }
    }

    @ViewBuilder
    private func orgCourseMenu(_ course: AcademyCourseDTO) -> some View {
        if isAdmin {
            Button { newChapterCourse = course } label: {
                Label("Nytt kapittel", systemImage: "plus.rectangle.on.rectangle")
            }
            Button { adminCourse = course } label: {
                Label("Administrer kapitler", systemImage: "slider.horizontal.3")
            }
            Divider()
            Button(role: .destructive) { deleteCourseCandidate = course } label: {
                Label("Slett kurs", systemImage: "trash")
            }
        }
    }

    // MARK: Admin-handlinger

    private func createCourse(title: String, description: String) async {
        guard let api = appState.api else { return }
        do {
            _ = try await api.academyCreateCourse(
                title: title,
                description: description.isEmpty ? nil : description
            )
            await store.load()
        } catch {
            showError("Kunne ikke opprette kurset")
        }
    }

    private func createChapter(course: AcademyCourseDTO, title: String, summary: String, minutes: Int) async {
        guard let api = appState.api else { return }
        do {
            _ = try await api.academyCreateChapter(
                courseId: course.id,
                title: title,
                summary: summary.isEmpty ? nil : summary,
                durationSeconds: minutes * 60
            )
            await store.load()
        } catch {
            showError("Kunne ikke opprette kapittelet")
        }
    }

    private func deleteCourse(_ course: AcademyCourseDTO) async {
        guard let api = appState.api else { return }
        do {
            try await api.academyDeleteCourse(courseId: course.id)
            deleteCourseCandidate = nil
            await store.load()
        } catch {
            showError("Kunne ikke slette kurset")
        }
    }

    private func showError(_ message: String) {
        errorToast = message
        Task {
            try? await Task.sleep(for: .seconds(3))
            if errorToast == message { errorToast = nil }
        }
    }
}

// MARK: - Kurs-kort

private struct AcademyCourseCard: View {
    let title: String
    let description: String
    let icon: String
    let tint: Color
    let isOfficial: Bool
    let chapters: [PondusChapter]
    let watched: Set<UUID>
    var onTap: () -> Void

    private var watchedCount: Int {
        chapters.filter { watched.contains($0.id) }.count
    }
    private var progress: Double {
        chapters.isEmpty ? 0 : Double(watchedCount) / Double(chapters.count)
    }
    private var totalDuration: Int {
        chapters.map(\.duration).reduce(0, +)
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    // Poster-ikon
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(LinearGradient(
                                colors: [tint.opacity(0.35), tint.opacity(0.10)],
                                startPoint: .topLeading, endPoint: .bottomTrailing))
                        Image(systemName: icon)
                            .font(.appScaled(size: 18, weight: .bold))
                            .foregroundStyle(tint)
                    }
                    .frame(width: 44, height: 44)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        badge
                    }
                    Spacer(minLength: 0)
                }

                Text(description.isEmpty ? "Ingen beskrivelse ennå." : description)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, minHeight: 30, alignment: .topLeading)

                // Progresjon
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(LBrand.cardHi).frame(height: 5)
                        Capsule()
                            .fill(LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                                 startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(progress > 0 ? 6 : 0, geo.size.width * progress), height: 5)
                    }
                }
                .frame(height: 5)

                HStack(spacing: 6) {
                    Text("\(watchedCount) / \(chapters.count) sett")
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(LBrand.textTertiary)
                    Spacer()
                    Image(systemName: "play.rectangle")
                        .font(.appScaled(size: 9))
                        .foregroundStyle(LBrand.textTertiary)
                    Text("\(chapters.count) kapitler")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(LBrand.textTertiary)
                    Text("·").foregroundStyle(LBrand.textTertiary)
                    Image(systemName: "clock")
                        .font(.appScaled(size: 9))
                        .foregroundStyle(LBrand.textTertiary)
                    Text(formatCourseDuration(totalDuration))
                        .font(.appScaled(size: 10, design: .monospaced))
                        .foregroundStyle(LBrand.textTertiary)
                }
            }
            .padding(14)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14).stroke(LBrand.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var badge: some View {
        HStack(spacing: 4) {
            Image(systemName: isOfficial ? "checkmark.seal.fill" : "building.2.fill")
                .font(.appScaled(size: 8, weight: .bold))
            Text(isOfficial ? "Leadgrid" : "Ditt kurs")
                .font(.appScaled(size: 9, weight: .black))
                .tracking(0.4)
        }
        .foregroundStyle(isOfficial ? LBrand.purpleLight : LBrand.orange)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(
            (isOfficial ? LBrand.purpleLight : LBrand.orange).opacity(0.14),
            in: Capsule()
        )
    }
}

private func formatCourseDuration(_ secs: Int) -> String {
    let m = secs / 60
    if m < 60 { return "\(m) min" }
    return "\(m / 60) t \(m % 60) min"
}

// MARK: - Nytt kurs

private struct AcademyNewCourseSheet: View {
    var onCreate: (String, String) async -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var courseDescription = ""
    @State private var busy = false

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 16) {
                    fieldLabel("TITTEL")
                    TextField("F.eks. «Onboarding for nye selgere»", text: $title)
                        .textFieldStyle(.plain)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 11)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))

                    fieldLabel("BESKRIVELSE")
                    TextEditor(text: $courseDescription)
                        .scrollContentBackground(.hidden)
                        .foregroundStyle(.white)
                        .frame(height: 110)
                        .padding(8)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))

                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Nytt kurs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        busy = true
                        Task {
                            await onCreate(title.trimmingCharacters(in: .whitespacesAndNewlines), courseDescription)
                            busy = false
                            dismiss()
                        }
                    } label: {
                        if busy { ProgressView().tint(LBrand.purpleLight) }
                        else { Text("Opprett").fontWeight(.bold) }
                    }
                    .tint(LBrand.purpleLight)
                    .disabled(busy || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDetents([.medium, .large])
    }
}

// MARK: - Nytt kapittel

private struct AcademyNewChapterSheet: View {
    let courseTitle: String
    var onCreate: (String, String, Int) async -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var summary = ""
    @State private var minutes = 5
    @State private var busy = false

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 16) {
                    Text(courseTitle)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(LBrand.purpleLight)

                    fieldLabel("KAPITTEL-TITTEL")
                    TextField("F.eks. «Slik booker du første møte»", text: $title)
                        .textFieldStyle(.plain)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 11)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))

                    fieldLabel("SAMMENDRAG")
                    TextEditor(text: $summary)
                        .scrollContentBackground(.hidden)
                        .foregroundStyle(.white)
                        .frame(height: 90)
                        .padding(8)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))

                    fieldLabel("VARIGHET (ESTIMAT)")
                    Stepper(value: $minutes, in: 1...120) {
                        Text("\(minutes) min")
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))

                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Nytt kapittel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        busy = true
                        Task {
                            await onCreate(title.trimmingCharacters(in: .whitespacesAndNewlines), summary, minutes)
                            busy = false
                            dismiss()
                        }
                    } label: {
                        if busy { ProgressView().tint(LBrand.purpleLight) }
                        else { Text("Opprett").fontWeight(.bold) }
                    }
                    .tint(LBrand.purpleLight)
                    .disabled(busy || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDetents([.medium, .large])
    }
}

// MARK: - Kapittel-administrasjon (video-opplasting + sletting)

private struct AcademyCourseAdminSheet: View {
    let course: AcademyCourseDTO
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var uploadingChapterId: UUID?
    @State private var deleteChapterCandidate: PondusChapter?
    @State private var showNewChapter = false
    @State private var errorToast: String?

    private var store: AcademyLiveStore { AcademyLiveStore.shared }
    private var chapters: [PondusChapter] {
        store.chaptersByCourse[course.id] ?? []
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 10) {
                        if chapters.isEmpty {
                            VStack(spacing: 10) {
                                Image(systemName: "rectangle.stack.badge.plus")
                                    .font(.appScaled(size: 28))
                                    .foregroundStyle(LBrand.textTertiary)
                                Text("Ingen kapitler ennå")
                                    .font(.appScaled(size: 14, weight: .bold))
                                    .foregroundStyle(.white)
                                Text("Legg til første kapittel og last opp video.")
                                    .font(.appScaled(size: 12))
                                    .foregroundStyle(LBrand.textSecondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                        } else {
                            ForEach(chapters) { chapter in
                                chapterRow(chapter)
                            }
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle(course.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { showNewChapter = true } label: {
                        Label("Nytt kapittel", systemImage: "plus")
                            .font(.appScaled(size: 12, weight: .bold))
                    }
                    .tint(LBrand.purpleLight)
                }
            }
            .overlay(alignment: .top) {
                if let t = errorToast {
                    Label(t, systemImage: "exclamationmark.triangle.fill")
                        .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(LBrand.red, in: Capsule())
                        .padding(.top, 6)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: errorToast)
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showNewChapter) {
            AcademyNewChapterSheet(courseTitle: course.title) { title, summary, minutes in
                await createChapter(title: title, summary: summary, minutes: minutes)
            }
        }
        .confirmationDialog(
            "Slett kapittelet?",
            isPresented: Binding(
                get: { deleteChapterCandidate != nil },
                set: { if !$0 { deleteChapterCandidate = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Slett «\(deleteChapterCandidate?.title ?? "")»", role: .destructive) {
                if let chapter = deleteChapterCandidate {
                    Task { await deleteChapter(chapter) }
                }
            }
            Button("Avbryt", role: .cancel) { deleteChapterCandidate = nil }
        } message: {
            Text("Kapittelet og eventuell video slettes permanent.")
        }
    }

    // MARK: Kapittel-rad

    private func chapterRow(_ chapter: PondusChapter) -> some View {
        HStack(alignment: .center, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(LinearGradient(
                        colors: [chapter.posterTint.opacity(0.35), chapter.posterTint.opacity(0.10)],
                        startPoint: .topLeading, endPoint: .bottomTrailing))
                Image(systemName: chapter.posterIcon)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 44, height: 36)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("\(chapter.number)")
                        .font(.appScaled(size: 10, weight: .black, design: .rounded))
                        .foregroundStyle(LBrand.textTertiary)
                    Text(chapter.title)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                HStack(spacing: 6) {
                    if chapter.hasVideo {
                        Label("Video", systemImage: "video.fill")
                            .font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(LBrand.green)
                    } else {
                        Label("Mangler video", systemImage: "video.slash")
                            .font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                    Text("·").foregroundStyle(LBrand.textTertiary)
                    Text(formatCourseDuration(chapter.duration))
                        .font(.appScaled(size: 10, design: .monospaced))
                        .foregroundStyle(LBrand.textTertiary)
                }
            }
            Spacer(minLength: 8)

            if uploadingChapterId == chapter.id {
                HStack(spacing: 6) {
                    ProgressView().tint(LBrand.purpleLight)
                    Text("Laster opp…")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.textSecondary)
                }
            } else {
                PhotosPicker(
                    selection: Binding(
                        get: { nil },
                        set: { (item: PhotosPickerItem?) in
                            if let item {
                                Task { await upload(item: item, chapter: chapter) }
                            }
                        }
                    ),
                    matching: .videos
                ) {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.appScaled(size: 11, weight: .bold))
                        Text(chapter.hasVideo ? "Bytt video" : "Last opp video")
                            .font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(LBrand.purple.opacity(0.35), in: Capsule())
                    .overlay(Capsule().stroke(LBrand.purple.opacity(0.55), lineWidth: 1))
                }
                .disabled(uploadingChapterId != nil)

                Button(role: .destructive) {
                    deleteChapterCandidate = chapter
                } label: {
                    Image(systemName: "trash")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(LBrand.red)
                        .frame(width: 30, height: 30)
                        .background(LBrand.red.opacity(0.12), in: Circle())
                }
                .buttonStyle(.plain)
                .disabled(uploadingChapterId != nil)
            }
        }
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Handlinger

    private func upload(item: PhotosPickerItem, chapter: PondusChapter) async {
        guard let api = appState.api,
              let backendId = store.backendIds[chapter.id] else {
            showError("Kapittelet er ikke synkronisert ennå")
            return
        }
        uploadingChapterId = chapter.id
        defer { uploadingChapterId = nil }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                showError("Fikk ikke lest videoen fra biblioteket")
                return
            }
            let isMov = item.supportedContentTypes.contains { $0.conforms(to: .quickTimeMovie) }
            let contentType = isMov ? "video/quicktime" : "video/mp4"
            let (url, key) = try await api.academyVideoUploadURL(
                chapterId: backendId, contentType: contentType
            )
            try await api.academyUploadVideoData(data, to: url, contentType: contentType)
            try await api.academyAttachVideo(
                chapterId: backendId,
                key: key,
                durationSeconds: chapter.duration > 0 ? chapter.duration : nil
            )
            await store.load()
        } catch {
            showError("Opplastingen feilet — prøv igjen")
        }
    }

    private func createChapter(title: String, summary: String, minutes: Int) async {
        guard let api = appState.api else { return }
        do {
            _ = try await api.academyCreateChapter(
                courseId: course.id,
                title: title,
                summary: summary.isEmpty ? nil : summary,
                durationSeconds: minutes * 60
            )
            await store.load()
        } catch {
            showError("Kunne ikke opprette kapittelet")
        }
    }

    private func deleteChapter(_ chapter: PondusChapter) async {
        guard let api = appState.api,
              let backendId = store.backendIds[chapter.id] else { return }
        do {
            try await api.academyDeleteChapter(chapterId: backendId)
            deleteChapterCandidate = nil
            await store.load()
        } catch {
            showError("Kunne ikke slette kapittelet")
        }
    }

    private func showError(_ message: String) {
        errorToast = message
        Task {
            try? await Task.sleep(for: .seconds(3))
            if errorToast == message { errorToast = nil }
        }
    }
}

// MARK: - Delte små helpers

private func fieldLabel(_ text: String) -> some View {
    Text(text)
        .font(.appScaled(size: 10, weight: .black))
        .foregroundStyle(LBrand.textTertiary)
        .tracking(0.8)
}

/// Poster-tint-token fra backend → LBrand-farge (samme mapping som
/// AcademyLiveStore.mapTint, som er privat der).
private func academyTint(_ token: String?) -> Color {
    switch token {
    case "yellow": return LBrand.yellow
    case "orange": return LBrand.orange
    case "red": return LBrand.red
    case "green": return LBrand.green
    case "blue": return LBrand.blue
    default: return LBrand.purpleLight
    }
}
