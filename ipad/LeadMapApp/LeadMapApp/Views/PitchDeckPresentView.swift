// PitchDeckPresentView.swift
//
// Full-screen sveip-presentasjon m/ Apple Pencil-annotering. Hver
// slide har én title-claim + brødtekst, rendret i samme warm-dark
// palett som PDF-eksporten. Brukeren sveiper, og kan på hvilken som
// helst slide hente fram PKCanvas via en lite "Pencil"-knapp i
// hjørnet for å markere/krysse av/notere.
//
// Habit-anker: når brukeren avslutter, dukker det opp et raskt
// outcome-ark m/ 5 valg + valgfri kommentar. Sender PATCH til
// /presentations/:id med outcome + slides_shown[] + annotasjoner
// kodet som base64-PNG'er per slide. Lead Map-status oppdateres
// automatisk i backend.

import SwiftUI
import PencilKit

struct PitchDeckPresentView: View {
    let bundle: PitchDeckBundle
    let presentation: PitchPresentation
    /// Per-lead Value-override fra POST /value-slide/for-lead. Renderes
    /// kun på Verdien-sliden hvis satt.
    var valueOverride: PitchValueOverride? = nil
    /// Pre-møte-brief: hvis satt, presenter KUN anbefalte slides.
    var preMeetingBrief: PitchBrief? = nil
    /// Org-navn for cover-slide.
    var orgName: String = ""

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var currentIndex: Int = 0
    @State private var shownSlideIds: Set<String> = []
    @State private var annotations: [String: PKDrawing] = [:]
    @State private var showOutcome = false
    @State private var pencilActive = false
    @State private var savingOutcome = false

    /// Aktive slides — filtrerer is_included og respekterer brief-anbefalingen
    /// hvis den er satt. Slettede slides er allerede filtrert av backend.
    private var activeSlides: [PitchSlide] {
        let included = bundle.slides.filter { $0.isIncluded }
        guard let brief = preMeetingBrief, !brief.recommendedSlideIds.isEmpty else {
            return included
        }
        let allowed = Set(brief.recommendedSlideIds)
        let recommended = included.filter { allowed.contains($0.id) }
        return recommended.isEmpty ? included : recommended
    }

    var body: some View {
        ZStack {
            // Warm-dark bakgrunn — matcher PDF-eksporten
            Color(red: 0.043, green: 0.043, blue: 0.043).ignoresSafeArea()

            // Sveipbar slide-stack
            TabView(selection: $currentIndex) {
                ForEach(Array(activeSlides.enumerated()), id: \.element.id) { idx, slide in
                    slideCanvas(slide: slide, idx: idx)
                        .tag(idx)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()

            // Topp-overlay m/ fremdrift + avslutt-knapp
            VStack {
                topBar
                Spacer()
                bottomBar
            }
        }
        .onChange(of: currentIndex, initial: true) { _, new in
            let slides = activeSlides
            if new < slides.count {
                shownSlideIds.insert(slides[new].id)
            }
        }
        .statusBarHidden()
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showOutcome) {
            PitchPresentationOutcomeSheet(
                deck: bundle.deck,
                slideCount: activeSlides.count,
                slidesShown: shownSlideIds.count,
                annotationsCount: annotations.count,
                onSubmit: { outcome, note in
                    Task {
                        await submit(outcome: outcome, note: note)
                    }
                }
            )
            .interactiveDismissDisabled(savingOutcome)
        }
    }

    // MARK: - Slide

    private func slideCanvas(slide: PitchSlide, idx: Int) -> some View {
        ZStack {
            PitchSlideRenderer(
                slide: slide,
                position: idx + 1,
                total: activeSlides.count,
                coverLogoUrl: bundle.deck.coverLogoUrl,
                coverTagline: bundle.deck.coverTagline,
                orgName: orgName,
                // Bare Verdien-sliden får override
                valueOverride: slide.slideType == "value" ? valueOverride : nil
            )
            .frame(maxWidth: 1100)
            if pencilActive {
                PencilCanvas(drawing: bindingForDrawing(slideId: slide.id))
                    .allowsHitTesting(true)
            }
        }
    }

    // MARK: - Bars

    private var topBar: some View {
        HStack {
            Button {
                showOutcome = true
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.white.opacity(0.7))
            }
            Spacer()
            // Fremdrifts-streker
            HStack(spacing: 4) {
                ForEach(0..<activeSlides.count, id: \.self) { i in
                    Capsule()
                        .fill(i == currentIndex
                              ? Color.white
                              : i < currentIndex
                                ? Color.white.opacity(0.5)
                                : Color.white.opacity(0.15))
                        .frame(width: 24, height: 3)
                }
            }
            Spacer()
            Button {
                withAnimation { pencilActive.toggle() }
            } label: {
                Image(systemName: pencilActive ? "pencil.tip.crop.circle.fill" : "pencil.tip.crop.circle")
                    .font(.title2)
                    .foregroundStyle(pencilActive ? Color.yellow : .white.opacity(0.7))
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
    }

    private var bottomBar: some View {
        HStack {
            if currentIndex > 0 {
                Button {
                    withAnimation { currentIndex -= 1 }
                } label: {
                    Image(systemName: "chevron.left.circle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
            Spacer()
            if currentIndex < activeSlides.count - 1 {
                Button {
                    withAnimation { currentIndex += 1 }
                } label: {
                    Image(systemName: "chevron.right.circle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(.white.opacity(0.8))
                }
            } else {
                Button {
                    showOutcome = true
                } label: {
                    Label("Avslutt", systemImage: "checkmark")
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .tint(.white)
                .foregroundStyle(.black)
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 12)
    }

    // MARK: - Helpers

    private func bindingForDrawing(slideId: String) -> Binding<PKDrawing> {
        Binding(
            get: { annotations[slideId] ?? PKDrawing() },
            set: { annotations[slideId] = $0 }
        )
    }

    private func submit(outcome: PitchOutcome?, note: String?) async {
        guard let api = appState.api else {
            dismiss()
            return
        }
        savingOutcome = true
        defer {
            savingOutcome = false
            showOutcome = false
            dismiss()
        }
        // Bygg annotations-JSON: { slide_id: { png_b64: "..." } }
        var annDict: [String: Any] = [:]
        for (slideId, drawing) in annotations {
            // PKDrawing.image() krever bounds + scale
            let bounds = drawing.bounds.isEmpty
                ? CGRect(x: 0, y: 0, width: 1024, height: 768)
                : drawing.bounds
            let img = drawing.image(from: bounds, scale: 2.0)
            if let png = img.pngData() {
                annDict[slideId] = ["png_b64": png.base64EncodedString()]
            }
        }
        do {
            try await api.updatePitchPresentation(
                id: presentation.id,
                slidesShown: Array(shownSlideIds),
                annotations: annDict.isEmpty ? nil : annDict,
                outcome: outcome,
                outcomeNote: note,
                end: true
            )
            // Post-møte-loop: outcome → automatisk lead_status / next_
            // follow_up_at / calendar-hint. Best-effort — vi blokker
            // ikke dismiss på den.
            if outcome != nil {
                _ = try? await api.finalizePitchPresentation(id: presentation.id)
            }
        } catch {
            // Sviss feilen — vi er på vei ut. PresentationDB-raden er
            // allerede opprettet, så vi mister bare outcome/annotations.
        }
    }
}

// MARK: - PencilCanvas

private struct PencilCanvas: UIViewRepresentable {
    @Binding var drawing: PKDrawing

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawing = drawing
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.drawingPolicy = .anyInput
        canvas.tool = PKInkingTool(.pen, color: .yellow, width: 6)
        canvas.delegate = context.coordinator
        return canvas
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        if uiView.drawing != drawing {
            uiView.drawing = drawing
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        let parent: PencilCanvas
        init(_ p: PencilCanvas) { self.parent = p }
        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            parent.drawing = canvasView.drawing
        }
    }
}

// MARK: - Outcome-sheet

private struct PitchPresentationOutcomeSheet: View {
    let deck: PitchDeck
    let slideCount: Int
    let slidesShown: Int
    let annotationsCount: Int
    let onSubmit: (PitchOutcome?, String?) -> Void

    @State private var outcome: PitchOutcome?
    @State private var note: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Hvordan gikk det?") {
                    ForEach(PitchOutcome.allCases, id: \.self) { o in
                        Button {
                            outcome = o
                        } label: {
                            HStack {
                                Image(systemName: o.iconName)
                                    .frame(width: 24)
                                    .foregroundStyle(outcome == o
                                        ? AnyShapeStyle(.tint)
                                        : AnyShapeStyle(.secondary))
                                Text(o.displayLabel)
                                Spacer()
                                if outcome == o {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.tint)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                Section("Notater (valgfritt)") {
                    TextField("Hva sa kunden? Hva må følges opp?", text: $note, axis: .vertical)
                        .lineLimit(3...8)
                }
                Section {
                    HStack {
                        Label("\(slidesShown) av \(slideCount) slides vist", systemImage: "rectangle.stack")
                        Spacer()
                        if annotationsCount > 0 {
                            Label("\(annotationsCount) annotasjon\(annotationsCount == 1 ? "" : "er")", systemImage: "pencil.tip")
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Avslutt presentasjon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Hopp over") {
                        onSubmit(nil, nil)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        onSubmit(outcome, note.isEmpty ? nil : note)
                    }
                    .disabled(outcome == nil)
                }
            }
        }
    }
}
