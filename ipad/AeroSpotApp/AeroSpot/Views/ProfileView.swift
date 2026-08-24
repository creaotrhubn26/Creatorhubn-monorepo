// ProfileView.swift — posisjon, spottepunkt-detalj-sheet deles herfra,
// backend-URL (dev) og personvern.

import SwiftUI

struct ProfileView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("aerospot.baseURL") private var baseURL = ""
    @State private var showLogin = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.spacingLG) {
                    Text("Profil")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)

                    accountCard
                    locationCard
                    gearLink
                    moderationLink
                    backendCard
                    privacyCard
                }
                .padding(Theme.spacingLG)
            }
            .background(Theme.background)
            .sheet(isPresented: $showLogin) { AuthView() }
        }
    }

    private var accountCard: some View {
        HStack(spacing: Theme.spacingMD) {
            Image(systemName: model.auth.isLoggedIn ? "person.crop.circle.fill.badge.checkmark" : "person.crop.circle")
                .font(.title3)
                .foregroundStyle(Theme.primaryBright)
            VStack(alignment: .leading, spacing: 2) {
                Text(model.auth.isLoggedIn ? "Innlogget" : "Ikke innlogget")
                    .font(.headline)
                    .foregroundStyle(Theme.textPrimary)
                Text(model.auth.userName ?? (model.auth.isLoggedIn ? "CreatorHub-konto" : "Logg inn for å melde inn arrangement"))
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            if model.auth.isLoggedIn {
                Button("Logg ut") { model.auth.logout() }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.red)
            } else {
                Button("Logg inn") { showLogin = true }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.primaryBright)
            }
        }
        .card()
    }

    private var gearLink: some View {
        NavigationLink {
            GearProfileView()
        } label: {
            HStack(spacing: Theme.spacingMD) {
                Image(systemName: "camera.aperture")
                    .font(.title3)
                    .foregroundStyle(Theme.primaryBright)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Mitt utstyr")
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)
                    Text(model.gear.hasGear
                         ? "\(model.gear.lenses.count) objektiv · \(model.gear.body.label)"
                         : "Sett kamera + objektiver for treffsikre forslag")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
            }
            .card()
        }
        .buttonStyle(.plain)
    }

    private var moderationLink: some View {
        NavigationLink {
            ModerationView()
        } label: {
            HStack(spacing: Theme.spacingMD) {
                Image(systemName: "checkmark.shield.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.primaryBright)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Moderering")
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)
                    Text("Godkjenn innsendte arrangementer (admin)")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
            }
            .card()
        }
        .buttonStyle(.plain)
    }

    private var locationCard: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            Text("Posisjon")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            Text(
                model.userCoordinate != nil
                    ? "Posisjon aktiv — brukes til avstand, retning og spottepunkt-ranking."
                    : "Skru på posisjon for avstander, objektiv-forslag og smartere anbefalinger."
            )
            .font(.subheadline)
            .foregroundStyle(Theme.textSecondary)
            if model.userCoordinate == nil {
                Button("Del posisjon") { model.requestLocation() }
                    .font(.headline)
                    .foregroundStyle(Theme.primaryBright)
            }
        }
        .card()
    }

    private var backendCard: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            Text("Backend")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            Text("Flydata og vær hentes via CreatorHub-backenden. Tomt felt = standard.")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            TextField("https://creatorhubn.com", text: $baseURL)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .keyboardType(.URL)
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.primaryBright)
        }
        .card()
    }

    private var privacyCard: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            Text("Personvern")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            Text(
                "Bilder og posisjon er dine data. Loggbok-oppføringer slettes enkeltvis "
                + "(hold inne en rad), og posisjonstilgang styres i Innstillinger. "
                + "Loggboken lagres lokalt på enheten."
            )
            .font(.subheadline)
            .foregroundStyle(Theme.textSecondary)
        }
        .card()
    }
}

/// Spottepunkt-detalj — brukes fra Hjem og Live-kartet.
struct SpottingLocationSheet: View {
    @Environment(AppModel.self) private var model
    let location: SpottingLocation

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.spacingLG) {
                VStack(alignment: .leading, spacing: Theme.spacingXS) {
                    HStack(spacing: Theme.spacingSM) {
                        Text(location.name)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(Theme.textPrimary)
                        Text("★ \(location.rating, specifier: "%.1f")")
                            .font(.subheadline)
                            .foregroundStyle(Theme.warning)
                    }
                    Text(location.bestFor.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }

                Text(location.description)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)

                if let rec = model.ranked.first(where: { $0.location.id == location.id }) {
                    VStack(alignment: .leading, spacing: Theme.spacingSM) {
                        Text("SPOTTING SCORE · \(rec.score.total)/100")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(0.8)
                            .foregroundStyle(Theme.primaryBright)
                        ScoreBar(label: "Lys", value: rec.score.light)
                        ScoreBar(label: "Vind", value: rec.score.wind)
                        ScoreBar(label: "Sikt", value: rec.score.visibility)
                        ScoreBar(label: "Trafikk", value: rec.score.traffic)
                        ScoreBar(label: "Posisjon", value: rec.score.position)
                    }
                }

                if let sun = model.sun {
                    let light = SunService.lightQuality(
                        sunAzimuthDeg: sun.azimuthDeg,
                        sunElevationDeg: sun.elevationDeg,
                        shootingDirectionDeg: location.shootingDirectionDeg
                    )
                    HStack(spacing: Theme.spacingSM) {
                        ValueTile(label: "Lys nå", value: light.label)
                        ValueTile(label: "Solvinkel", value: "\(Int(sun.azimuthDeg))°")
                        ValueTile(
                            label: "Objektiv",
                            value: "\(location.focalRange.lowerBound)–\(location.focalRange.upperBound) mm"
                        )
                    }
                }

                VStack(alignment: .leading, spacing: Theme.spacingXS) {
                    Label(location.sunNotes, systemImage: "sun.max")
                    Label(
                        "\(location.parking) · \(location.walkMinutes) min å gå",
                        systemImage: "parkingsign"
                    )
                    if let restrictions = location.restrictions {
                        Label(restrictions, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(Theme.warning)
                    }
                }
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
            }
            .padding(Theme.spacingLG)
        }
        .background(Theme.surface)
    }
}
