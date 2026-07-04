// MacCatalystAdapters.swift
//
// Modifikatorer + shims for Mac Catalyst-varianten. iOS/iPadOS-koden er
// uendret; alle Catalyst-spesifikke tilpasninger lever her og gates av
// `#if targetEnvironment(macCatalyst)`.
//
// Målsettinger:
//   1. Native Mac-følelse: `.sidebar`-splitview i .automatic-modus,
//      titlebar-toolbar med `.customizableItems`.
//   2. Ikke bruk `.preferredColorScheme(.dark)` som tvinger dark på Mac
//      der brukeren kan ha lys-modus preferanse i System-innstillinger.
//   3. NSMenu-native avatar-menu via SwiftUI `Menu` (Catalyst mapper
//      automatisk til NSMenu i toolbar-kontekst).
//
// Bruk (i view):
//   MyView().macCatalystToolbar()
//   NavigationSplitView { ... } detail: { ... }.macCatalystSidebar()
//   BigSheet().macCatalystSheetSize()
//   AnyButton().macCatalystHover()
//   AvatarView().macCatalystHideInSheet()
//
// Alle modifiers er no-op på iOS/iPadOS/visionOS/watchOS.

import SwiftUI

extension View {
    /// Legg til en toolbar-linje ved Mac-Catalyst. No-op på iOS/iPadOS.
    /// Gjenbruker eksisterende avatar-menu via en callback så vi ikke
    /// dupliserer state-håndtering.
    @ViewBuilder
    func macCatalystToolbar<ToolbarContent: View>(
        @ViewBuilder items: @escaping () -> ToolbarContent
    ) -> some View {
        #if targetEnvironment(macCatalyst)
        self.toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                items()
            }
        }
        #else
        self
        #endif
    }

    /// Sidebar-oppførsel på Mac Catalyst — bruk automatic split-view
    /// visibility slik at brukeren kan collapse sidebar-en som i alle
    /// andre native Mac-apper (⌃⌘S).
    @ViewBuilder
    func macCatalystSidebar() -> some View {
        #if targetEnvironment(macCatalyst)
        self.navigationSplitViewStyle(.balanced)
        #else
        self
        #endif
    }

    /// Fjern safe-area-padding som gir rare hull på Mac Catalyst.
    /// Behold dem på iPhone/iPad (hjørne-notch/dynamic island).
    @ViewBuilder
    func macCatalystRemoveEdgePadding() -> some View {
        #if targetEnvironment(macCatalyst)
        self.ignoresSafeArea(.container, edges: .top)
        #else
        self
        #endif
    }

    /// Sett minimum vindusstørrelse på Mac Catalyst. Leadgrid-layouten
    /// er trang under 1024×720 (Leadbook-header + KPI-rad).
    @ViewBuilder
    func macCatalystMinFrame() -> some View {
        #if targetEnvironment(macCatalyst)
        self.frame(minWidth: 1024, minHeight: 720)
        #else
        self
        #endif
    }

    /// Størrelse på store sheet-innhold på Mac Catalyst.
    /// UIKit på Catalyst presenterer `.sheet` som en liten flytende modal
    /// (~540×620) uansett content. Sett en romsligere minstestørrelse
    /// direkte på sheet-innholdet så vinduet vokser til noe brukbart på Mac.
    /// iOS/iPadOS: no-op (system-detents styrer størrelsen).
    ///
    /// - Parameters:
    ///   - minWidth: minste bredde (default 780 — rom for KPI-rader + kolonner).
    ///   - minHeight: minste høyde (default 620 — nok til headers + primær CTA).
    ///   - idealWidth: ideel bredde ved åpning.
    ///   - idealHeight: ideel høyde ved åpning.
    @ViewBuilder
    func macCatalystSheetSize(
        minWidth: CGFloat = 780,
        minHeight: CGFloat = 620,
        idealWidth: CGFloat = 920,
        idealHeight: CGFloat = 720
    ) -> some View {
        #if targetEnvironment(macCatalyst)
        self.frame(
            minWidth: minWidth,
            idealWidth: idealWidth,
            minHeight: minHeight,
            idealHeight: idealHeight
        )
        #else
        self
        #endif
    }

    /// Native-feel hover-effekt for knapper på Mac Catalyst.
    /// Bruker `.hoverEffect(.highlight)` + subtle brightening ved hover.
    /// iOS/iPadOS: no-op — der er `.hoverEffect` styrt av pointer-interaction
    /// system-wide og trenger ikke ekstra tint.
    @ViewBuilder
    func macCatalystHover() -> some View {
        #if targetEnvironment(macCatalyst)
        self.modifier(_MacHoverModifier())
        #else
        self
        #endif
    }

    /// Skjul et view utelukkende på Mac Catalyst. Brukes typisk til
    /// LK-avatar-badgen som ligger i sheet-header — iPad-idiomet, men
    /// ser rart ut som liten svevende dott i et Mac-vindu.
    @ViewBuilder
    func macCatalystHideInSheet() -> some View {
        #if targetEnvironment(macCatalyst)
        EmptyView()
        #else
        self
        #endif
    }
}

/// Adaptive grid-kolonner som utvider seg med vindusstørrelse på Mac.
/// Bruk i steden for hardkoded 2-kolonne LazyVGrid.
///
///     LazyVGrid(columns: MacCatalystGrid.adaptive(iPad: 2, mac: 3), spacing: 12) {...}
enum MacCatalystGrid {
    /// - Parameters:
    ///   - iPad: antall kolonner på iPad/iPhone.
    ///   - mac: antall kolonner på Mac Catalyst.
    ///   - spacing: horisontal spacing mellom kolonner.
    static func adaptive(
        iPad: Int,
        mac: Int,
        spacing: CGFloat = 12
    ) -> [GridItem] {
        #if targetEnvironment(macCatalyst)
        return Array(repeating: GridItem(.flexible(), spacing: spacing), count: mac)
        #else
        return Array(repeating: GridItem(.flexible(), spacing: spacing), count: iPad)
        #endif
    }
}

/// Intern hover-modifier — bygger på `.hoverEffect()` + `.onHover` med
/// et Observable-flagg som gir subtle brightening + scale ved hover.
/// Gates internt av `#if targetEnvironment(macCatalyst)` slik at det er
/// no-op på alle andre plattformer.
private struct _MacHoverModifier: ViewModifier {
    @State private var isHovering = false

    func body(content: Content) -> some View {
        content
            .brightness(isHovering ? 0.06 : 0)
            .scaleEffect(isHovering ? 1.02 : 1.0)
            .animation(.easeOut(duration: 0.12), value: isHovering)
            .hoverEffect(.highlight)
            .onHover { hovering in
                isHovering = hovering
            }
    }
}

/// True hvis appen kjører som Mac Catalyst. Bruk denne til å velge
/// layout-variant der `#if` ikke er tilstrekkelig (f.eks. inne i en
/// `@ViewBuilder` computed property).
enum MacCatalystEnv {
    static var isCatalyst: Bool {
        #if targetEnvironment(macCatalyst)
        return true
        #else
        return false
        #endif
    }

    /// True hvis appen kjører på visionOS (Vision Pro).
    static var isVision: Bool {
        #if os(visionOS)
        return true
        #else
        return false
        #endif
    }
}
