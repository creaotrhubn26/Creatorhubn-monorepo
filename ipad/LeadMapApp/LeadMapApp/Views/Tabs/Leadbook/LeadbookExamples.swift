// LeadbookExamples.swift — "Eksempler"-fane: ekte salgssamtaler som case-bibliotek (2026-06-30)
//
// Filter-rad (outcome + kanal + pondus-dimensjon) + featured hero + grid med case-kort.
// Tap → fullskjerm modal m/ audio-player + transkript med tids-anker + Pencil-annotering +
// pondus-breakdown + nøkkelmoment-markører + «Lagre som mal»-CTA.

import SwiftUI

// MARK: - Models

struct LeadbookExample: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let customer: String
    let industry: String
    let outcome: Outcome
    let channel: LeadbookTemplate.Channel
    let duration: Int          // sekunder
    let salesperson: String
    let salespersonInitials: String
    let salespersonColor: Color
    let date: String
    let pondusScore: Int
    let featuredDimension: Dimension
    let dimensionScores: [Dimension: Int]
    let keyLearnings: [String]
    let alternativePhrasings: [String]
    let transcript: [TranscriptLine]
    let keyMoments: [KeyMoment]
    let dealValue: Int          // NOK
    let summary: String

    enum Outcome: String, CaseIterable, Identifiable, Hashable {
        case won = "Vant"
        case lost = "Tapt"
        case ongoing = "Pågående"
        var id: String { rawValue }
        var color: Color {
            switch self {
            case .won: return LBrand.green
            case .lost: return LBrand.red
            case .ongoing: return LBrand.orange
            }
        }
        var icon: String {
            switch self {
            case .won: return "checkmark.seal.fill"
            case .lost: return "xmark.circle.fill"
            case .ongoing: return "clock.fill"
            }
        }
    }

    enum Dimension: String, CaseIterable, Identifiable, Hashable {
        case autoritet = "Autoritet"
        case klarhet = "Klarhet"
        case troverdighet = "Troverdighet"
        case trygghet = "Trygghet"
        case fremdrift = "Fremdrift"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .autoritet: return "person.fill"
            case .klarhet: return "scope"
            case .troverdighet: return "checkmark.seal.fill"
            case .trygghet: return "shield.fill"
            case .fremdrift: return "arrow.right.circle.fill"
            }
        }
    }
}

struct TranscriptLine: Identifiable, Hashable {
    let id = UUID()
    let timestamp: Int          // sekunder
    let speaker: Speaker
    let text: String
    let isHighlighted: Bool      // featured-moment

    enum Speaker: String, Hashable {
        case selger = "Selger"
        case kunde = "Kunde"
    }
}

struct KeyMoment: Identifiable, Hashable {
    let id = UUID()
    let timestamp: Int
    let label: String
    let icon: String
    let tint: Color
}

// MARK: - Mock data

enum LeadbookExampleData {
    static let examples: [LeadbookExample] = [
        LeadbookExample(
            title: "Den vanskelige prisinnvendingen",
            customer: "Norkonsult AS",
            industry: "Rådgivning",
            outcome: .won,
            channel: .phone,
            duration: 2452,
            salesperson: "Maria Lindholm",
            salespersonInitials: "ML",
            salespersonColor: LBrand.purpleLight,
            date: "12. mai 2026",
            pondusScore: 92,
            featuredDimension: .trygghet,
            dimensionScores: [.autoritet: 88, .klarhet: 90, .troverdighet: 94, .trygghet: 96, .fremdrift: 91],
            keyLearnings: [
                "Pauset 4 sekunder etter «det er for dyrt» — kunden snakket først",
                "Spurte «hva sammenligner du oss med?» istedenfor å forsvare prisen",
                "Brukte referansecase med konkrete tall i stedet for generelle påstander"
            ],
            alternativePhrasings: [
                "Skjønner — kan du si litt mer om hvor det vil veie tyngst for dere?",
                "Når du sier dyrt, hva er sammenligningsgrunnlaget?",
                "Hvis prisen var halvparten — hva ville det betydd for beslutningen?"
            ],
            transcript: [
                TranscriptLine(timestamp: 12, speaker: .selger, text: "Hei Marit, takk for at du tok deg tid i dag. Jeg har 15 minutter satt av — funker det fortsatt?", isHighlighted: false),
                TranscriptLine(timestamp: 24, speaker: .kunde, text: "Ja det går fint. Jeg har sett gjennom det dere sendte.", isHighlighted: false),
                TranscriptLine(timestamp: 1208, speaker: .kunde, text: "Men det er litt dyrt — vi har sammenlignet med to andre.", isHighlighted: true),
                TranscriptLine(timestamp: 1216, speaker: .selger, text: "Skjønner.", isHighlighted: true),
                TranscriptLine(timestamp: 1224, speaker: .selger, text: "Når du sier dyrt — hva sammenligner du oss med?", isHighlighted: true),
                TranscriptLine(timestamp: 1232, speaker: .kunde, text: "Vi har fått tilbud fra TwoCompete og InhouseTeam-løsning.", isHighlighted: false),
                TranscriptLine(timestamp: 1247, speaker: .selger, text: "Da må jeg si litt om hva som faktisk skiller seg her. Skanska valgte oss i fjor over begge to.", isHighlighted: false),
                TranscriptLine(timestamp: 2210, speaker: .kunde, text: "OK. La meg snakke med Erik. Kan vi ta en oppfølging på torsdag kl 10?", isHighlighted: true)
            ],
            keyMoments: [
                KeyMoment(timestamp: 1208, label: "Pris-innvending", icon: "exclamationmark.triangle.fill", tint: LBrand.orange),
                KeyMoment(timestamp: 1216, label: "4s pause", icon: "pause.fill", tint: LBrand.purpleLight),
                KeyMoment(timestamp: 1224, label: "Motspørsmål", icon: "questionmark.circle.fill", tint: LBrand.green),
                KeyMoment(timestamp: 2210, label: "CTA + dato", icon: "checkmark.circle.fill", tint: LBrand.green)
            ],
            dealValue: 380_000,
            summary: "Klassisk pris-innvending vendt til oppfølgings-avtale gjennom 4-sekunders pause og åpent motspørsmål."
        ),

        LeadbookExample(
            title: "Pondus-fail i discovery",
            customer: "Acme Solutions",
            industry: "SaaS",
            outcome: .lost,
            channel: .video,
            duration: 1680,
            salesperson: "Anders Solberg",
            salespersonInitials: "AS",
            salespersonColor: LBrand.blue,
            date: "08. mai 2026",
            pondusScore: 54,
            featuredDimension: .klarhet,
            dimensionScores: [.autoritet: 62, .klarhet: 48, .troverdighet: 55, .trygghet: 58, .fremdrift: 47],
            keyLearnings: [
                "12 spørsmål på 4 minutter — kunden følte seg avhørt",
                "Pitchet løsning før behov var avdekket → forhandle om feature istedenfor verdi",
                "Avslutning «vi tar kontakt» istedenfor konkret neste steg"
            ],
            alternativePhrasings: [
                "Hva er det viktigste du må få ut av denne samtalen?",
                "Før jeg viser noe — kan du si litt om hvordan dere løser dette i dag?",
                "Hva passer best — torsdag kl 13 eller fredag kl 10 for å vise dette mer i dybden?"
            ],
            transcript: [
                TranscriptLine(timestamp: 8, speaker: .selger, text: "Hei! La meg vise dere produktet med en gang så ser dere hvor smooth det er.", isHighlighted: true),
                TranscriptLine(timestamp: 18, speaker: .kunde, text: "Ehm — ja, men jeg trodde vi skulle snakke om utfordringene våre først?", isHighlighted: false),
                TranscriptLine(timestamp: 240, speaker: .selger, text: "Bruker dere CRM? Slack? HubSpot? Pipedrive? Salesforce? Excel?", isHighlighted: true),
                TranscriptLine(timestamp: 252, speaker: .kunde, text: "...vi har Pipedrive.", isHighlighted: false),
                TranscriptLine(timestamp: 1640, speaker: .selger, text: "Vi tar kontakt om noen dager med mer info.", isHighlighted: true),
                TranscriptLine(timestamp: 1648, speaker: .kunde, text: "OK. Takk.", isHighlighted: false)
            ],
            keyMoments: [
                KeyMoment(timestamp: 8, label: "Pitch FØR behov", icon: "exclamationmark.triangle.fill", tint: LBrand.red),
                KeyMoment(timestamp: 240, label: "Avhørs-modus", icon: "questionmark.diamond.fill", tint: LBrand.red),
                KeyMoment(timestamp: 1640, label: "Diffus avslutning", icon: "xmark.circle.fill", tint: LBrand.red)
            ],
            dealValue: 240_000,
            summary: "Klassisk fall-grube: produkt-pitch før behov, avhørs-stil discovery, og «vi tar kontakt»-avslutning uten dato."
        ),

        LeadbookExample(
            title: "Re-engasjement etter 6 mnd stillhet",
            customer: "Kvalitetsbygg AS",
            industry: "Bygg",
            outcome: .won,
            channel: .email,
            duration: 1080,
            salesperson: "Espen Bråten",
            salespersonInitials: "EB",
            salespersonColor: LBrand.orange,
            date: "03. mai 2026",
            pondusScore: 86,
            featuredDimension: .fremdrift,
            dimensionScores: [.autoritet: 84, .klarhet: 88, .troverdighet: 85, .trygghet: 82, .fremdrift: 91],
            keyLearnings: [
                "1-linjes emnefelt: «3 spørsmål som tar 2 min»",
                "Ingen forsøk på å «catche opp» — gikk rett til mikro-CTA",
                "JA/NEI/«spør om 2 mnd» som svaralternativer = lavterskel"
            ],
            alternativePhrasings: [
                "Hei {navn} — kort: er {tema} fortsatt på roadmap'en deres?",
                "Tre korte spørsmål, du kan svare med JA, NEI eller «spør om X mnd»."
            ],
            transcript: [
                TranscriptLine(timestamp: 5, speaker: .selger, text: "Emne: Kvalitetsbygg — 3 spørsmål som tar 2 min", isHighlighted: true),
                TranscriptLine(timestamp: 25, speaker: .selger, text: "Hei Frode, jeg vet du har lite tid. Tre korte spørsmål: (1) Er bedre prosjektstyring fortsatt relevant? (2) Hvem eier dette internt? (3) Når er rett tid å se på det? Et JA, NEI eller «spør om 2 mnd» er nok.", isHighlighted: true),
                TranscriptLine(timestamp: 1020, speaker: .kunde, text: "Svar: (1) JA (2) Meg (3) Nå — kan vi ta 20 min i morgen?", isHighlighted: true)
            ],
            keyMoments: [
                KeyMoment(timestamp: 5, label: "Konkret emne", icon: "envelope.fill", tint: LBrand.blue),
                KeyMoment(timestamp: 25, label: "Mikro-CTA", icon: "list.number", tint: LBrand.purpleLight),
                KeyMoment(timestamp: 1020, label: "Bekreftelse + dato", icon: "checkmark.circle.fill", tint: LBrand.green)
            ],
            dealValue: 520_000,
            summary: "6 mnd stillhet → JA + møte dagen etter. Korthet og struktur slo høflighet."
        ),

        LeadbookExample(
            title: "Når kunden snur i siste sekund",
            customer: "Norse Manufacturing",
            industry: "Industri",
            outcome: .won,
            channel: .video,
            duration: 3180,
            salesperson: "Lars Kristensen",
            salespersonInitials: "LK",
            salespersonColor: LBrand.purple,
            date: "28. apr 2026",
            pondusScore: 89,
            featuredDimension: .autoritet,
            dimensionScores: [.autoritet: 94, .klarhet: 88, .troverdighet: 90, .trygghet: 91, .fremdrift: 82],
            keyLearnings: [
                "Når kunden sa «vi velger konkurrent» — Lars svarte med ett ord: «Greit.»",
                "5 sekunders stillhet → kunden begynte å forklare hvorfor → åpning",
                "Avsluttet ikke salget før kunden hadde sagt nei tre ganger"
            ],
            alternativePhrasings: [
                "Greit.",
                "Forstår — hva ville måtte vært annerledes hos oss?",
                "Hvis dere ombestemmer dere, er det ikke for sent å ta en prat?"
            ],
            transcript: [
                TranscriptLine(timestamp: 2940, speaker: .kunde, text: "Vi har bestemt oss — vi går med konkurrenten.", isHighlighted: true),
                TranscriptLine(timestamp: 2946, speaker: .selger, text: "Greit.", isHighlighted: true),
                TranscriptLine(timestamp: 2952, speaker: .kunde, text: "...altså, vi vet ikke om det er rett, men prisen ble bedre.", isHighlighted: false),
                TranscriptLine(timestamp: 2962, speaker: .selger, text: "Hva ville måtte vært annerledes hos oss?", isHighlighted: true)
            ],
            keyMoments: [
                KeyMoment(timestamp: 2940, label: "Tap-bekreftelse", icon: "xmark.octagon.fill", tint: LBrand.red),
                KeyMoment(timestamp: 2946, label: "«Greit.»", icon: "checkmark.circle.fill", tint: LBrand.purpleLight),
                KeyMoment(timestamp: 2962, label: "Reopener-spørsmål", icon: "arrow.uturn.right.circle.fill", tint: LBrand.green)
            ],
            dealValue: 1_240_000,
            summary: "Aksepterte tapet med ett ord. Stillhet gjorde at kunden snudde i sanntid."
        ),

        LeadbookExample(
            title: "Discovery-samtale i mesterklasse",
            customer: "FutureBank",
            industry: "Finans",
            outcome: .won,
            channel: .video,
            duration: 2820,
            salesperson: "Marit Hansen",
            salespersonInitials: "MH",
            salespersonColor: LBrand.green,
            date: "22. apr 2026",
            pondusScore: 95,
            featuredDimension: .klarhet,
            dimensionScores: [.autoritet: 92, .klarhet: 98, .troverdighet: 93, .trygghet: 96, .fremdrift: 94],
            keyLearnings: [
                "Brukte 18 minutter på lytting, 3 minutter på løsningen",
                "Speilet kundens egne ord («når du sier ‹kaotisk›, mener du…?»)",
                "Lot kunden formulere problemet selv — solgte ikke verdien, kunden gjorde det"
            ],
            alternativePhrasings: [
                "Hvis du skulle beskrive den ideelle løsningen — hvordan ville den se ut?",
                "Hvilken konsekvens har det at dere ikke har løst dette ennå?"
            ],
            transcript: [
                TranscriptLine(timestamp: 22, speaker: .selger, text: "Før vi går i gang: hva er det viktigste å få ut av denne samtalen for deg?", isHighlighted: true),
                TranscriptLine(timestamp: 420, speaker: .kunde, text: "Det er litt kaotisk hos oss.", isHighlighted: true),
                TranscriptLine(timestamp: 427, speaker: .selger, text: "Når du sier kaotisk — mener du flest mennesker, eller flest prosesser?", isHighlighted: true)
            ],
            keyMoments: [
                KeyMoment(timestamp: 22, label: "Ramme-spørsmål", icon: "scope", tint: LBrand.purpleLight),
                KeyMoment(timestamp: 420, label: "Kundens språk", icon: "ear.fill", tint: LBrand.green),
                KeyMoment(timestamp: 427, label: "Speiling", icon: "arrow.left.arrow.right", tint: LBrand.green)
            ],
            dealValue: 2_800_000,
            summary: "Lytting + speiling i 18 min, så 3 min løsning. Kunden solgte verdien til seg selv."
        ),

        LeadbookExample(
            title: "For tidlig demo-feil",
            customer: "SkyTech AS",
            industry: "IT",
            outcome: .lost,
            channel: .video,
            duration: 1320,
            salesperson: "Maria Lindholm",
            salespersonInitials: "ML",
            salespersonColor: LBrand.purpleLight,
            date: "18. apr 2026",
            pondusScore: 67,
            featuredDimension: .fremdrift,
            dimensionScores: [.autoritet: 72, .klarhet: 70, .troverdighet: 68, .trygghet: 62, .fremdrift: 65],
            keyLearnings: [
                "Demo-skjerm tidlig → kunden gikk i evaluerings-modus",
                "Manglet behovsforankring → snakk om features, ikke verdi",
                "Ingen «skal vi ta en titt på dette»-bekreftelse før demo"
            ],
            alternativePhrasings: [
                "Før jeg viser noe — er det nok at jeg forklarer, eller vil du se det i verktøyet?",
                "Skal vi titte på dette sammen i 3 min så du får følelsen, eller vil du heller jeg sender lenke etterpå?"
            ],
            transcript: [
                TranscriptLine(timestamp: 180, speaker: .selger, text: "La meg dele skjermen — så ser dere hvordan det fungerer!", isHighlighted: true),
                TranscriptLine(timestamp: 1280, speaker: .kunde, text: "OK, vi må evaluere internt og kommer tilbake.", isHighlighted: true)
            ],
            keyMoments: [
                KeyMoment(timestamp: 180, label: "Skjerm-deling for tidlig", icon: "rectangle.dashed.fill", tint: LBrand.red),
                KeyMoment(timestamp: 1280, label: "Evalueringsmodus = død", icon: "hand.thumbsdown.fill", tint: LBrand.red)
            ],
            dealValue: 180_000,
            summary: "Demo uten behovsforankring → kunden gikk i kjøper-evaluering. Sjelden returnerer derfra."
        ),

        LeadbookExample(
            title: "Cold-email som vant",
            customer: "MarineCo",
            industry: "Maritim",
            outcome: .won,
            channel: .email,
            duration: 240,
            salesperson: "Espen Bråten",
            salespersonInitials: "EB",
            salespersonColor: LBrand.orange,
            date: "15. apr 2026",
            pondusScore: 88,
            featuredDimension: .troverdighet,
            dimensionScores: [.autoritet: 86, .klarhet: 92, .troverdighet: 94, .trygghet: 85, .fremdrift: 83],
            keyLearnings: [
                "Refererte til konkret post på kundens LinkedIn i åpningen",
                "Brukte tall fra deres egen årsmelding",
                "Tilbød 12-min Loom-video istedenfor møte = lavere terskel"
            ],
            alternativePhrasings: [
                "{Navn} — så at dere skrev om {konkret tema} sist uke. Vi har hjulpet {lignende kunde} med det samme.",
                "Hvis du har 12 minutter, har jeg laget en Loom-video som viser hvordan."
            ],
            transcript: [
                TranscriptLine(timestamp: 5, speaker: .selger, text: "Emne: Så LinkedIn-posten din om fartøysplanlegging", isHighlighted: true),
                TranscriptLine(timestamp: 30, speaker: .selger, text: "Hei Per — så at dere skrev om effektivisering av fartøysplanlegging forrige uke. Vi hjalp NorthSea Logistics med samme problem — 18 % kortere rute-planlegging. Jeg har laget en Loom på 12 min hvis du vil ta en titt.", isHighlighted: true),
                TranscriptLine(timestamp: 220, speaker: .kunde, text: "Send link.", isHighlighted: true)
            ],
            keyMoments: [
                KeyMoment(timestamp: 5, label: "Spesifikt emne", icon: "envelope.badge.fill", tint: LBrand.blue),
                KeyMoment(timestamp: 30, label: "LinkedIn-referanse", icon: "doc.text.magnifyingglass", tint: LBrand.green),
                KeyMoment(timestamp: 220, label: "Lavterskel-CTA traff", icon: "checkmark.circle.fill", tint: LBrand.green)
            ],
            dealValue: 680_000,
            summary: "Research + lavterskel-CTA (Loom istedenfor møte) brøt gjennom cold-email-støy."
        ),

        LeadbookExample(
            title: "Pondus-comeback fra dårlig åpning",
            customer: "Nordhus AS",
            industry: "Eiendom",
            outcome: .ongoing,
            channel: .phone,
            duration: 2280,
            salesperson: "Lars Kristensen",
            salespersonInitials: "LK",
            salespersonColor: LBrand.purple,
            date: "10. apr 2026",
            pondusScore: 78,
            featuredDimension: .trygghet,
            dimensionScores: [.autoritet: 74, .klarhet: 78, .troverdighet: 76, .trygghet: 85, .fremdrift: 79],
            keyLearnings: [
                "Anerkjente dårlig åpning åpent: «Det der var en svak start, beklager»",
                "Reframet: «Skal jeg starte på nytt med ett spørsmål istedenfor?»",
                "Kunden lo + samtalen fikk ny energi"
            ],
            alternativePhrasings: [
                "Det der var litt klønete åpning. Skal jeg ta det igjen — eller skal jeg bare hoppe rett til det viktige?",
                "Du, jeg merker jeg snubler litt. Kan jeg restarte og spørre deg ett tydelig spørsmål?"
            ],
            transcript: [
                TranscriptLine(timestamp: 6, speaker: .selger, text: "Hei, øh, jeg ringer fra Leadgrid, vi er en, øh, plattform for, vi hjelper team med, øh…", isHighlighted: true),
                TranscriptLine(timestamp: 38, speaker: .selger, text: "Vent. Det der var litt klønete. Skal jeg starte på nytt med ett tydelig spørsmål istedenfor?", isHighlighted: true),
                TranscriptLine(timestamp: 46, speaker: .kunde, text: "Haha, ja, takk for det.", isHighlighted: false)
            ],
            keyMoments: [
                KeyMoment(timestamp: 6, label: "Klønete åpning", icon: "exclamationmark.bubble.fill", tint: LBrand.red),
                KeyMoment(timestamp: 38, label: "Pondus-reset", icon: "arrow.counterclockwise", tint: LBrand.green)
            ],
            dealValue: 540_000,
            summary: "Innrømte at åpningen var dårlig. Trygghet-i-feilen reddet samtalen — gikk fra død til pågående."
        )
    ]
}

// MARK: - LeadbookExamplesView

struct LeadbookExamplesView: View {
    @State private var outcomeFilter: LeadbookExample.Outcome?
    @State private var channelFilter: LeadbookTemplate.Channel?
    @State private var dimensionFilter: LeadbookExample.Dimension?
    @State private var search: String = ""
    @State private var detail: LeadbookExample?
    @State private var sort: SortField = .recent
    @State private var showAdd = false
    @State private var addToast: String?

    enum SortField: String, CaseIterable, Identifiable {
        case recent = "Nylig"
        case score = "Høyest pondus"
        case value = "Verdi"
        case duration = "Lengde"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .recent: return "clock.fill"
            case .score: return "chart.line.uptrend.xyaxis"
            case .value: return "banknote.fill"
            case .duration: return "timer"
            }
        }
    }

    private var rows: [LeadbookExample] {
        var list = LeadbookExampleData.examples
        if let f = outcomeFilter { list = list.filter { $0.outcome == f } }
        if let f = channelFilter { list = list.filter { $0.channel == f } }
        if let f = dimensionFilter { list = list.filter { $0.featuredDimension == f } }
        if !search.isEmpty {
            let q = search.lowercased()
            list = list.filter {
                $0.title.lowercased().contains(q)
                    || $0.customer.lowercased().contains(q)
                    || $0.industry.lowercased().contains(q)
                    || $0.summary.lowercased().contains(q)
            }
        }
        switch sort {
        case .recent: break    // mock — keep as-is
        case .score: list.sort { $0.pondusScore > $1.pondusScore }
        case .value: list.sort { $0.dealValue > $1.dealValue }
        case .duration: list.sort { $0.duration > $1.duration }
        }
        return list
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            heroBanner
            searchAndSort
            filterChips
            grid
        }
        .sheet(item: $detail) { ex in LeadbookExampleDetailSheet(example: ex) }
        .sheet(isPresented: $showAdd) {
            AddExampleSheet { name in
                addToast = "«\(name)» lagt til i eksempler"
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { addToast = nil }
            }
        }
        .overlay(alignment: .top) {
            if let t = addToast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(LBrand.green, in: Capsule())
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: addToast)
    }

    // MARK: Hero

    private var heroBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "books.vertical.fill")
                    .foregroundStyle(LBrand.purpleLight)
                Text("EKSEMPLER")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.purpleLight)
                    .tracking(0.8)
                Spacer()
                Text("\(LeadbookExampleData.examples.count) reelle samtaler")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LBrand.textTertiary)
            }
            // Leadbook-QA 2026-07-05 (iPhone): tittel + stats + CTA i én
            // rad brakk tittelen bokstav-for-bokstav på 390pt — telefon
            // stabler vertikalt.
            let heroLayout = DeviceIdiom.isPhone
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
                : AnyLayout(HStackLayout(alignment: .center, spacing: 18))
            heroLayout {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Lær fra ekte salgssamtaler")
                        .font(.appScaled(size: 22, weight: .heavy))
                        .foregroundStyle(.white)
                    Text("Hver case er transkribert, scoret og annotert med Apple Pencil. Tap en samtale for å spille av lyden, lese transkriptet og se hva som faktisk fungerte.")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(LBrand.textSecondary)
                        .lineLimit(DeviceIdiom.isPhone ? 3 : 2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 10) {
                    heroStat(label: "VANT", value: "\(LeadbookExampleData.examples.filter { $0.outcome == .won }.count)", color: LBrand.green)
                    heroStat(label: "TAPT", value: "\(LeadbookExampleData.examples.filter { $0.outcome == .lost }.count)", color: LBrand.red)
                    heroStat(label: "PÅGÅR", value: "\(LeadbookExampleData.examples.filter { $0.outcome == .ongoing }.count)", color: LBrand.orange)
                }
                Button { showAdd = true } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "plus.circle.fill").font(.appScaled(size: 13, weight: .bold))
                        Text("Nytt eksempel").font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                    .shadow(color: LBrand.purple.opacity(0.45), radius: 6, y: 2)
                }.buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.purple.opacity(0.22), lineWidth: 1))
    }

    private func heroStat(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.appScaled(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(color)
            Text(label)
                .font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
        }
        .frame(width: 60)
        .padding(.vertical, 8)
        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
    }

    // MARK: Search + sort

    private var searchAndSort: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(LBrand.textTertiary)
                TextField("Søk kunde, bransje eller nøkkelord…", text: $search)
                    .foregroundStyle(.white).textFieldStyle(.plain)
                if !search.isEmpty {
                    Button { search = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(LBrand.textTertiary)
                    }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            Menu {
                ForEach(SortField.allCases) { s in
                    Button { sort = s } label: { Label(s.rawValue, systemImage: s.icon) }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: sort.icon).font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(LBrand.purpleLight)
                    Text(sort.rawValue).font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white).lineLimit(1).fixedSize()
                    Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            }
        }
    }

    // MARK: Filter chips

    private var filterChips: some View {
        VStack(alignment: .leading, spacing: 10) {
            chipRow(label: "UTFALL") {
                chip(text: "Alle", tint: LBrand.purpleLight, active: outcomeFilter == nil) { outcomeFilter = nil }
                ForEach(LeadbookExample.Outcome.allCases) { o in
                    chip(text: o.rawValue, icon: o.icon, tint: o.color, active: outcomeFilter == o) {
                        outcomeFilter = (outcomeFilter == o) ? nil : o
                    }
                }
            }
            chipRow(label: "KANAL") {
                chip(text: "Alle", tint: LBrand.purpleLight, active: channelFilter == nil) { channelFilter = nil }
                ForEach(LeadbookTemplate.Channel.allCases, id: \.self) { c in
                    chip(text: c.rawValue, icon: c.icon, tint: c.color, active: channelFilter == c) {
                        channelFilter = (channelFilter == c) ? nil : c
                    }
                }
            }
            chipRow(label: "PONDUS-DIMENSJON") {
                chip(text: "Alle", tint: LBrand.purpleLight, active: dimensionFilter == nil) { dimensionFilter = nil }
                ForEach(LeadbookExample.Dimension.allCases) { d in
                    chip(text: d.rawValue, icon: d.icon, tint: LBrand.purpleLight, active: dimensionFilter == d) {
                        dimensionFilter = (dimensionFilter == d) ? nil : d
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func chipRow<C: View>(label: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) { content() }
            }
        }
    }

    private func chip(text: String, icon: String? = nil, tint: Color, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let icon { Image(systemName: icon).font(.appScaled(size: 10, weight: .bold)) }
                Text(text).font(.appScaled(size: 11, weight: .semibold))
            }
            .foregroundStyle(active ? .white : LBrand.textSecondary)
            .padding(.horizontal, 11).padding(.vertical, 6)
            .background(active ? tint.opacity(0.30) : LBrand.cardHi, in: Capsule())
            .overlay(Capsule().stroke(active ? tint.opacity(0.55) : LBrand.stroke, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    // MARK: Grid

    private var grid: some View {
        Group {
            if rows.isEmpty { emptyState }
            else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    ForEach(rows) { ex in
                        exampleCard(ex)
                    }
                    addNewCard
                }
            }
        }
    }

    private var addNewCard: some View {
        Button { showAdd = true } label: {
            VStack(spacing: 14) {
                ZStack {
                    Circle().fill(LBrand.purple.opacity(0.18))
                    Image(systemName: "plus")
                        .font(.appScaled(size: 28, weight: .heavy))
                        .foregroundStyle(LBrand.purpleLight)
                }
                .frame(width: 64, height: 64)
                VStack(spacing: 4) {
                    Text("Legg til nytt eksempel")
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Last opp opptak, spill inn, eller skriv inn — AI scorer og foreslår key moments.")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                }
                HStack(spacing: 6) {
                    Image(systemName: "sparkles").font(.appScaled(size: 10, weight: .bold))
                    Text("AI-analyse").font(.appScaled(size: 11, weight: .bold))
                }
                .foregroundStyle(LBrand.purpleLight)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(LBrand.purple.opacity(0.15), in: Capsule())
                .overlay(Capsule().stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
            }
            .frame(maxWidth: .infinity, minHeight: 260)
            .padding(20)
            .background(LBrand.card.opacity(0.5), in: RoundedRectangle(cornerRadius: 13))
            .overlay(
                RoundedRectangle(cornerRadius: 13)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                    .foregroundStyle(LBrand.purple.opacity(0.45))
            )
        }
        .buttonStyle(.plain)
    }

    private func exampleCard(_ ex: LeadbookExample) -> some View {
        Button { detail = ex } label: {
            VStack(alignment: .leading, spacing: 0) {
                // Poster
                ZStack(alignment: .topLeading) {
                    LinearGradient(
                        colors: [ex.outcome.color.opacity(0.32), .black.opacity(0.6), ex.outcome.color.opacity(0.10)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                    // Waveform-stripes
                    HStack(spacing: 3) {
                        ForEach(0..<48, id: \.self) { i in
                            let h: CGFloat = CGFloat(((i * 73) % 100)) / 100.0
                            Capsule()
                                .fill(.white.opacity(0.18))
                                .frame(width: 2, height: 14 + h * 24)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, 12)
                    HStack {
                        HStack(spacing: 5) {
                            Image(systemName: ex.outcome.icon).font(.appScaled(size: 10, weight: .bold))
                            Text(ex.outcome.rawValue.uppercased())
                                .font(.appScaled(size: 9, weight: .black)).tracking(0.6)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(ex.outcome.color, in: Capsule())
                        Spacer()
                        HStack(spacing: 5) {
                            Image(systemName: ex.channel.icon).font(.appScaled(size: 10, weight: .bold))
                            Text(ex.channel.rawValue.uppercased())
                                .font(.appScaled(size: 9, weight: .black)).tracking(0.6)
                        }
                        .foregroundStyle(ex.channel.color)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(ex.channel.color.opacity(0.20), in: Capsule())
                        .overlay(Capsule().stroke(ex.channel.color.opacity(0.45), lineWidth: 1))
                    }
                    .padding(12)
                    VStack {
                        Spacer()
                        HStack {
                            // Pondus-score
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(ex.pondusScore)")
                                    .font(.appScaled(size: 30, weight: .heavy, design: .rounded))
                                    .foregroundStyle(.white)
                                    .shadow(color: .black.opacity(0.4), radius: 3)
                                Text("PONDUS")
                                    .font(.appScaled(size: 8, weight: .black))
                                    .foregroundStyle(.white.opacity(0.8))
                                    .tracking(0.8)
                            }
                            Spacer()
                            // Duration
                            HStack(spacing: 4) {
                                Image(systemName: "clock.fill").font(.appScaled(size: 10))
                                Text(formatMinSec(ex.duration))
                                    .font(.appScaled(size: 11, weight: .semibold, design: .monospaced))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(.black.opacity(0.4), in: Capsule())
                        }
                        .padding(12)
                    }
                }
                .frame(height: 120)

                // Meta
                VStack(alignment: .leading, spacing: 8) {
                    Text(ex.title)
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 6) {
                        Text(ex.customer)
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                        Text("·").foregroundStyle(LBrand.textTertiary)
                        Text(ex.industry)
                            .font(.appScaled(size: 11))
                            .foregroundStyle(LBrand.textSecondary)
                        Spacer()
                        Text(formatNOK(ex.dealValue))
                            .font(.appScaled(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(LBrand.green)
                    }
                    Text(ex.summary)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 8) {
                        ZStack {
                            Circle().fill(ex.salespersonColor.opacity(0.25))
                            Text(ex.salespersonInitials)
                                .font(.appScaled(size: 9, weight: .black))
                                .foregroundStyle(ex.salespersonColor)
                        }
                        .frame(width: 22, height: 22)
                        Text(ex.salesperson)
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                        Spacer()
                        HStack(spacing: 5) {
                            Image(systemName: ex.featuredDimension.icon)
                                .font(.appScaled(size: 9, weight: .bold))
                            Text(ex.featuredDimension.rawValue)
                                .font(.appScaled(size: 10, weight: .bold))
                        }
                        .foregroundStyle(LBrand.purpleLight)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(LBrand.purple.opacity(0.16), in: Capsule())
                    }
                }
                .padding(12)
            }
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 13))
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "books.vertical")
                .font(.appScaled(size: 32)).foregroundStyle(LBrand.textTertiary)
            Text("Ingen eksempler matcher filteret")
                .font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
            Button {
                outcomeFilter = nil; channelFilter = nil; dimensionFilter = nil; search = ""
            } label: {
                Text("Nullstill filtre")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(LBrand.purpleLight)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(LBrand.purple.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
            }.buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 50)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
    }

    // MARK: Formatters

    private func formatMinSec(_ secs: Int) -> String {
        let m = secs / 60, s = secs % 60
        return String(format: "%d:%02d", m, s)
    }
    private func formatNOK(_ v: Int) -> String {
        if v >= 1_000_000 { return String(format: "%.1f mill kr", Double(v) / 1_000_000) }
        if v >= 1000 { return "\(v / 1000) k kr" }
        return "\(v) kr"
    }
}

// MARK: - Detail sheet

import PencilKit

struct LeadbookExampleDetailSheet: View {
    let example: LeadbookExample
    @Environment(\.dismiss) private var dismiss
    @State private var playbackSeconds: Int = 0
    @State private var isPlaying = false
    @State private var showAnnotations = true
    @State private var saveToast: String?

    // Pencil-annotering
    @State private var pencilMode = false
    @State private var pencilDrawing = PKDrawing()
    @State private var pencilTool: PKTool = PKInkingTool(.pen, color: UIColor(red: 0.75, green: 0.45, blue: 1.0, alpha: 1.0), width: 4)
    @State private var allowFinger: Bool = true

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    ZStack {
                        if DeviceIdiom.isPhone {
                            // iPhone: høyrekolonnen (360pt) får ikke plass ved
                            // siden av spilleren — stack alt i én felles scroll.
                            ScrollView {
                                VStack(spacing: 0) {
                                    leftColumnContent
                                    Divider().overlay(LBrand.stroke)
                                    rightColumnContent
                                }
                            }
                        } else {
                            HStack(spacing: 0) {
                                leftColumn
                                Divider().overlay(LBrand.stroke)
                                rightColumn.frame(width: 360)
                            }
                        }
                        // Pencil-overlay over hele scenen
                        if pencilMode {
                            PencilAnnotationCanvas(
                                drawing: $pencilDrawing,
                                tool: $pencilTool,
                                allowFinger: allowFinger,
                                transparentBackground: true
                            )
                            .allowsHitTesting(true)
                        }
                    }
                    if pencilMode {
                        PencilToolbar(
                            tool: $pencilTool,
                            drawing: $pencilDrawing,
                            allowFinger: $allowFinger,
                            onClose: { withAnimation { pencilMode = false } },
                            onExport: {
                                saveToast = "PDF eksportert med annoteringer"
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { saveToast = nil }
                            },
                            onSave: {
                                saveToast = "Annoteringer lagret"
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { saveToast = nil }
                            }
                        )
                        .transition(.move(edge: .bottom))
                    }
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text(example.title).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        HStack(spacing: 6) {
                            Image(systemName: example.outcome.icon).font(.appScaled(size: 9))
                            Text(example.customer).font(.appScaled(size: 10))
                        }
                        .foregroundStyle(example.outcome.color)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    HStack(spacing: 8) {
                        // Pencil-toggle som primær CTA
                        Button { withAnimation { pencilMode.toggle() } } label: {
                            HStack(spacing: 5) {
                                Image(systemName: pencilMode ? "pencil.tip.crop.circle.fill" : "pencil.tip.crop.circle")
                                    .font(.appScaled(size: 12, weight: .bold))
                                Text(pencilMode ? "Annoterer" : "Pencil")
                                    .font(.appScaled(size: 12, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 11).padding(.vertical, 6)
                            .background(
                                pencilMode
                                    ? AnyShapeStyle(LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                                                   startPoint: .leading, endPoint: .trailing))
                                    : AnyShapeStyle(LBrand.cardHi),
                                in: Capsule()
                            )
                            .overlay(Capsule().stroke(pencilMode ? LBrand.purple.opacity(0.6) : LBrand.stroke, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        Menu {
                            Button {
                                saveToast = "Mal opprettet fra denne samtalen"
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { saveToast = nil }
                            } label: { Label("Lagre som mal", systemImage: "doc.badge.plus") }
                            Button { showAnnotations.toggle() } label: {
                                Label(showAnnotations ? "Skjul key moments" : "Vis key moments", systemImage: "sparkles")
                            }
                            Button { pencilDrawing = PKDrawing() } label: {
                                Label("Slett alle tegninger", systemImage: "trash")
                            }
                            Divider()
                            Button {} label: { Label("Last ned transkript", systemImage: "square.and.arrow.down") }
                            Button {} label: { Label("Del", systemImage: "square.and.arrow.up") }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .font(.appScaled(size: 16, weight: .semibold))
                                .foregroundStyle(LBrand.purpleLight)
                        }
                    }
                }
            }
            .overlay(alignment: .top) {
                if let t = saveToast {
                    Label(t, systemImage: "checkmark.circle.fill")
                        .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(LBrand.green, in: Capsule())
                        .padding(.top, 6)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: saveToast)
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: pencilMode)
        }
    }

    // MARK: Left — player + transcript

    private var leftColumn: some View {
        ScrollView { leftColumnContent }
    }

    /// Innholdet uten egen ScrollView — gjenbrukes i stacked iPhone-layout
    /// der begge kolonnene deler én felles scroll.
    private var leftColumnContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            playerCanvas
            playerControls
            meta
            transcriptCard
            Color.clear.frame(height: 20)
        }
        .padding(20)
    }

    private var playerCanvas: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(
                colors: [example.outcome.color.opacity(0.35), .black, example.outcome.color.opacity(0.18)],
                startPoint: .topLeading, endPoint: .bottomTrailing)
            // Waveform
            GeometryReader { geo in
                HStack(spacing: 2.5) {
                    ForEach(0..<120, id: \.self) { i in
                        let h: CGFloat = CGFloat(((i * 31) % 100)) / 100.0
                        let played = Double(i) / 120.0 < (Double(playbackSeconds) / Double(example.duration))
                        Capsule()
                            .fill(played ? LBrand.purpleLight : .white.opacity(0.25))
                            .frame(width: 2.5, height: 14 + h * 70)
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height, alignment: .center)
            }
            HStack {
                HStack(spacing: 5) {
                    Image(systemName: example.outcome.icon).font(.appScaled(size: 11, weight: .bold))
                    Text(example.outcome.rawValue.uppercased()).font(.appScaled(size: 10, weight: .black)).tracking(0.6)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(example.outcome.color, in: Capsule())
                Spacer()
                Text(formatNOK(example.dealValue))
                    .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(LBrand.green)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(.black.opacity(0.4), in: Capsule())
            }
            .padding(14)
            VStack {
                Spacer()
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(example.title)
                            .font(.appScaled(size: 17, weight: .heavy))
                            .foregroundStyle(.white)
                        Text("\(example.customer) · \(example.industry) · \(example.date)")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    Spacer()
                }
                .padding(14)
            }
        }
        .aspectRatio(16/7, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var playerControls: some View {
        VStack(spacing: 10) {
            // Scrubber + key-moment markers
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(LBrand.cardHi).frame(height: 6)
                    Capsule()
                        .fill(LinearGradient(colors: [LBrand.purple, LBrand.purpleLight], startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(6, geo.size.width * progress), height: 6)
                    // Key moment markers
                    ForEach(example.keyMoments) { km in
                        let x = geo.size.width * Double(km.timestamp) / Double(example.duration)
                        Button { playbackSeconds = km.timestamp } label: {
                            Circle()
                                .fill(km.tint)
                                .frame(width: 9, height: 9)
                                .overlay(Circle().stroke(.white, lineWidth: 1.5))
                                .offset(x: x - 4.5)
                        }
                        .buttonStyle(.plain)
                    }
                    Circle().fill(.white)
                        .frame(width: 13, height: 13)
                        .offset(x: max(0, geo.size.width * progress - 6.5))
                        .shadow(color: LBrand.purple.opacity(0.6), radius: 4)
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { v in
                            let pct = max(0, min(1, v.location.x / geo.size.width))
                            playbackSeconds = Int(Double(example.duration) * pct)
                        }
                )
            }
            .frame(height: 14)
            HStack(spacing: 16) {
                Text(formatMinSec(playbackSeconds))
                    .font(.appScaled(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(LBrand.textSecondary)
                Spacer()
                Button { skip(-10) } label: {
                    Image(systemName: "gobackward.10")
                        .font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 36, height: 36).background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
                Button { togglePlay() } label: {
                    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                        .font(.appScaled(size: 18, weight: .heavy)).foregroundStyle(.white)
                        .frame(width: 52, height: 52)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight], startPoint: .leading, endPoint: .trailing),
                            in: Circle()
                        )
                        .shadow(color: LBrand.purple.opacity(0.5), radius: 8)
                }.buttonStyle(.plain)
                Button { skip(10) } label: {
                    Image(systemName: "goforward.10")
                        .font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 36, height: 36).background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
                Spacer()
                Text(formatMinSec(example.duration))
                    .font(.appScaled(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(LBrand.textSecondary)
            }
            // Key-moments-rad
            if !example.keyMoments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(example.keyMoments) { km in
                            Button { playbackSeconds = km.timestamp } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: km.icon)
                                        .font(.appScaled(size: 10, weight: .bold))
                                        .foregroundStyle(km.tint)
                                    Text(formatMinSec(km.timestamp))
                                        .font(.appScaled(size: 10, weight: .bold, design: .monospaced))
                                        .foregroundStyle(.white)
                                    Text(km.label)
                                        .font(.appScaled(size: 11, weight: .semibold))
                                        .foregroundStyle(.white)
                                }
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(LBrand.cardHi, in: Capsule())
                                .overlay(Capsule().stroke(km.tint.opacity(0.35), lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private var meta: some View {
        HStack(spacing: 8) {
            HStack(spacing: 6) {
                ZStack {
                    Circle().fill(example.salespersonColor.opacity(0.25))
                    Text(example.salespersonInitials)
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(example.salespersonColor)
                }
                .frame(width: 26, height: 26)
                Text(example.salesperson)
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(LBrand.card, in: Capsule())
            HStack(spacing: 6) {
                Image(systemName: example.channel.icon).font(.appScaled(size: 10, weight: .bold)).foregroundStyle(example.channel.color)
                Text(example.channel.rawValue).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(LBrand.card, in: Capsule())
            HStack(spacing: 6) {
                Image(systemName: example.featuredDimension.icon).font(.appScaled(size: 10, weight: .bold)).foregroundStyle(LBrand.purpleLight)
                Text(example.featuredDimension.rawValue).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(LBrand.card, in: Capsule())
            Spacer()
        }
    }

    private var transcriptCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "text.bubble.fill").foregroundStyle(LBrand.purpleLight)
                Text("TRANSKRIPT").font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Spacer()
                Button { showAnnotations.toggle() } label: {
                    HStack(spacing: 5) {
                        Image(systemName: showAnnotations ? "pencil.tip.crop.circle.badge.minus" : "pencil.tip.crop.circle")
                            .font(.appScaled(size: 11, weight: .bold))
                        Text(showAnnotations ? "Skjul Pencil-annoteringer" : "Vis Pencil-annoteringer")
                            .font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(LBrand.purpleLight)
                }.buttonStyle(.plain)
            }
            VStack(alignment: .leading, spacing: 8) {
                ForEach(example.transcript) { line in
                    transcriptRow(line)
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func transcriptRow(_ line: TranscriptLine) -> some View {
        let isHL = line.isHighlighted && showAnnotations
        return Button { playbackSeconds = line.timestamp } label: {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(formatMinSec(line.timestamp))
                        .font(.appScaled(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(LBrand.textTertiary)
                    Text(line.speaker.rawValue.uppercased())
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(line.speaker == .selger ? LBrand.purpleLight : LBrand.blue)
                        .tracking(0.6)
                }
                .frame(width: 60, alignment: .leading)
                Text(line.text)
                    .font(.appScaled(size: 13, design: .serif))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(
                        isHL
                            ? LBrand.purple.opacity(0.14)
                            : line.speaker == .selger ? LBrand.cardHi : LBrand.bg.opacity(0.6),
                        in: RoundedRectangle(cornerRadius: 9)
                    )
                    .overlay(
                        isHL ? RoundedRectangle(cornerRadius: 9).stroke(LBrand.purple.opacity(0.45), lineWidth: 1) : nil
                    )
                    .overlay(alignment: .topTrailing) {
                        if isHL {
                            // Pencil-annotering: scribble + handwritten label
                            HStack(spacing: 4) {
                                Image(systemName: "pencil.tip")
                                    .font(.appScaled(size: 9, weight: .bold))
                                Text("KEY MOMENT")
                                    .font(.appScaled(size: 8, weight: .black))
                                    .tracking(0.6)
                            }
                            .foregroundStyle(LBrand.purpleLight)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(LBrand.purple.opacity(0.18), in: Capsule())
                            .overlay(Capsule().stroke(LBrand.purpleLight.opacity(0.5), lineWidth: 1))
                            .padding(6)
                        }
                    }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: Right — Pondus + learnings + alts

    private var rightColumn: some View {
        ScrollView { rightColumnContent }
    }

    /// Innholdet uten egen ScrollView — gjenbrukes i stacked iPhone-layout.
    private var rightColumnContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            pondusBreakdown
            learningsCard
            alternativesCard
            Button {
                saveToast = "«\(example.title)» lagret som mal"
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { saveToast = nil }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "doc.badge.plus")
                    Text("Lagre som mal")
                }
                .font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(
                    LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
                .shadow(color: LBrand.purple.opacity(0.45), radius: 8, y: 3)
            }
            .buttonStyle(.plain)
            Color.clear.frame(height: 16)
        }
        .padding(16)
    }

    private var pondusBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("PONDUS-BREAKDOWN")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Spacer()
                Text("\(example.pondusScore)")
                    .font(.appScaled(size: 28, weight: .heavy, design: .rounded))
                    .foregroundStyle(LBrand.purpleLight)
                    .monospacedDigit()
            }
            ForEach(LeadbookExample.Dimension.allCases) { d in
                let value = example.dimensionScores[d] ?? 0
                HStack(spacing: 8) {
                    Image(systemName: d.icon)
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(LBrand.purpleLight)
                        .frame(width: 14)
                    Text(d.rawValue)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 92, alignment: .leading)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(LBrand.cardHi).frame(height: 5)
                            Capsule()
                                .fill(LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                                     startPoint: .leading, endPoint: .trailing))
                                .frame(width: max(6, geo.size.width * Double(value) / 100), height: 5)
                        }
                    }
                    .frame(height: 5)
                    Text("\(value)")
                        .font(.appScaled(size: 11, weight: .bold, design: .rounded))
                        .foregroundStyle(.white).monospacedDigit()
                        .frame(width: 24, alignment: .trailing)
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private var learningsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "lightbulb.fill").foregroundStyle(LBrand.yellow)
                Text("NØKKEL-LÆRINGER").font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            }
            ForEach(example.keyLearnings, id: \.self) { l in
                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(example.outcome == .lost ? LBrand.orange : LBrand.green)
                    Text(l).font(.appScaled(size: 12)).foregroundStyle(.white)
                    Spacer()
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private var alternativesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "arrow.left.arrow.right").foregroundStyle(LBrand.blue)
                Text("ALTERNATIVE FORMULERINGER").font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            }
            ForEach(example.alternativePhrasings, id: \.self) { alt in
                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: "quote.opening")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(LBrand.textTertiary)
                        .padding(.top, 2)
                    Text(alt)
                        .font(.appScaled(size: 12, design: .serif))
                        .foregroundStyle(.white)
                    Spacer()
                }
                .padding(10)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: Actions

    private var progress: Double { Double(playbackSeconds) / max(1, Double(example.duration)) }

    private func togglePlay() {
        if isPlaying { isPlaying = false; return }
        isPlaying = true
        tick()
    }
    private func tick() {
        guard isPlaying else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            if !isPlaying { return }
            playbackSeconds = min(example.duration, playbackSeconds + 1)
            if playbackSeconds >= example.duration { isPlaying = false }
            else { tick() }
        }
    }
    private func skip(_ d: Int) {
        playbackSeconds = max(0, min(example.duration, playbackSeconds + d))
    }

    private func formatMinSec(_ s: Int) -> String {
        String(format: "%d:%02d", s / 60, s % 60)
    }
    private func formatNOK(_ v: Int) -> String {
        if v >= 1_000_000 { return String(format: "%.1f mill kr", Double(v) / 1_000_000) }
        if v >= 1000 { return "\(v / 1000) k kr" }
        return "\(v) kr"
    }
}

// MARK: - AddExampleSheet — 3-stegs wizard for å legge til nytt eksempel

struct AddExampleSheet: View {
    var onCreated: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var step: Int = 1
    @State private var source: Source = .upload
    @State private var fileName: String?
    @State private var isRecording = false
    @State private var recordingSeconds: Int = 0
    @State private var importedCall: ImportedCall?
    @State private var pastedTranscript: String = ""
    @State private var aiProgress: Int = 0
    @State private var aiState: AIState = .idle

    // Steg 3 — finalize
    @State private var title: String = ""
    @State private var customer: String = ""
    @State private var industry: String = ""
    @State private var outcome: LeadbookExample.Outcome = .ongoing
    @State private var channel: LeadbookTemplate.Channel = .phone
    @State private var featuredDim: LeadbookExample.Dimension = .autoritet
    @State private var dealValue: String = ""
    @State private var anonymize: Bool = false
    @State private var requireConsent: Bool = true
    @State private var visibility: Visibility = .team
    @State private var keyLearnings: [String] = []
    @State private var customLearning: String = ""

    enum Source: String, CaseIterable, Identifiable {
        case upload = "Last opp fil"
        case record = "Spill inn nå"
        case phoneIntegration = "Telefon-integrasjon"
        case meetingRec = "Møte-opptak"
        case manual = "Skriv inn manuelt"
        case watchMemo = "Apple Watch-memo"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .upload: return "square.and.arrow.up.fill"
            case .record: return "mic.fill"
            case .phoneIntegration: return "phone.connection.fill"
            case .meetingRec: return "video.fill"
            case .manual: return "text.alignleft"
            case .watchMemo: return "applewatch"
            }
        }
        var tint: Color {
            switch self {
            case .upload: return LBrand.blue
            case .record: return LBrand.red
            case .phoneIntegration: return LBrand.green
            case .meetingRec: return LBrand.orange
            case .manual: return LBrand.purpleLight
            case .watchMemo: return LBrand.pink
            }
        }
        var subtitle: String {
            switch self {
            case .upload: return "MP3/MP4/WAV/M4A · maks 500 MB"
            case .record: return "Bruk iPad-mikrofonen direkte"
            case .phoneIntegration: return "Aircall · Dialpad · CloudTalk · Twilio"
            case .meetingRec: return "Google Meet · Teams · Zoom · FaceTime"
            case .manual: return "Lim inn transkript fra annet system"
            case .watchMemo: return "Synk fra Voice Memos på din iPhone/Watch"
            }
        }
    }

    enum AIState { case idle, transcribing, analyzing, scoring, done }
    enum Visibility: String, CaseIterable, Identifiable {
        case me = "Bare meg"
        case team = "Mitt team"
        case all = "Hele organisasjonen"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .me: return "lock.fill"
            case .team: return "person.3.fill"
            case .all: return "globe"
            }
        }
    }

    struct ImportedCall: Identifiable, Hashable {
        let id = UUID()
        let customer: String
        let duration: Int
        let date: String
        let source: String
    }
    let mockedCalls: [ImportedCall] = [
        ImportedCall(customer: "Skanska AS", duration: 1840, date: "I dag · 11:22", source: "Aircall"),
        ImportedCall(customer: "Norkonsult", duration: 2452, date: "I dag · 09:14", source: "Aircall"),
        ImportedCall(customer: "Acme Solutions", duration: 1680, date: "I går · 15:32", source: "Dialpad"),
        ImportedCall(customer: "FutureBank", duration: 2820, date: "27. juni · 13:00", source: "Google Meet"),
        ImportedCall(customer: "Kvalitetsbygg", duration: 1080, date: "26. juni · 10:15", source: "Outlook")
    ]

    private var canProceedFromStep1: Bool { true }
    private var canProceedFromStep2: Bool {
        switch source {
        case .upload: return fileName != nil
        case .record: return recordingSeconds > 5
        case .phoneIntegration, .meetingRec, .watchMemo: return importedCall != nil
        case .manual: return pastedTranscript.count > 50
        }
    }
    private var canSubmit: Bool {
        !title.isEmpty && !customer.isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    stepper
                    Divider().overlay(LBrand.stroke)
                    ScrollView {
                        Group {
                            switch step {
                            case 1: step1_source
                            case 2: step2_content
                            default: step3_finalize
                            }
                        }
                        .padding(20)
                    }
                    bottomBar
                }
            }
            .navigationTitle("Nytt eksempel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
            }
        }
    }

    // MARK: Stepper

    private var stepper: some View {
        HStack(spacing: 0) {
            stepDot(1, label: "Kilde")
            stepDivider(step >= 2)
            stepDot(2, label: contentLabel)
            stepDivider(step >= 3)
            stepDot(3, label: "Detaljer")
        }
        .padding(.horizontal, 20).padding(.vertical, 16)
    }

    private var contentLabel: String {
        switch source {
        case .upload: return "Fil"
        case .record: return "Opptak"
        case .phoneIntegration, .meetingRec, .watchMemo: return "Velg"
        case .manual: return "Transkript"
        }
    }

    private func stepDot(_ n: Int, label: String) -> some View {
        let isDone = step > n
        let isCurrent = step == n
        return HStack(spacing: 8) {
            ZStack {
                Circle().fill(
                    isDone ? LBrand.green : (isCurrent ? LBrand.purple : LBrand.cardHi)
                )
                .frame(width: 26, height: 26)
                if isDone {
                    Image(systemName: "checkmark").font(.appScaled(size: 11, weight: .black)).foregroundStyle(.white)
                } else {
                    Text("\(n)").font(.appScaled(size: 12, weight: .black)).foregroundStyle(isCurrent ? .white : LBrand.textTertiary)
                }
            }
            Text(label)
                .font(.appScaled(size: 12, weight: isCurrent ? .bold : .semibold))
                .foregroundStyle(isCurrent ? .white : LBrand.textSecondary)
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(isCurrent ? LBrand.purple.opacity(0.15) : .clear, in: Capsule())
    }

    private func stepDivider(_ active: Bool) -> some View {
        Rectangle()
            .fill(active ? LBrand.green : LBrand.stroke)
            .frame(maxWidth: .infinity).frame(height: 1)
            .padding(.horizontal, 4)
    }

    // MARK: Steg 1 — kilde

    private var step1_source: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Hvor kommer samtalen fra?")
                .font(.appScaled(size: 18, weight: .heavy)).foregroundStyle(.white)
            Text("AI transkriberer, scorer pondus og foreslår key moments automatisk.")
                .font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                ForEach(Source.allCases) { s in
                    Button { source = s } label: {
                        HStack(alignment: .top, spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10).fill(s.tint.opacity(0.22))
                                Image(systemName: s.icon).font(.appScaled(size: 16, weight: .bold)).foregroundStyle(s.tint)
                            }
                            .frame(width: 40, height: 40)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(s.rawValue).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                                Text(s.subtitle).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary).lineLimit(2)
                            }
                            Spacer(minLength: 4)
                            Image(systemName: source == s ? "largecircle.fill.circle" : "circle")
                                .font(.appScaled(size: 16))
                                .foregroundStyle(source == s ? s.tint : LBrand.textTertiary)
                        }
                        .padding(12)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(source == s ? s.tint.opacity(0.45) : LBrand.stroke, lineWidth: 1))
                    }.buttonStyle(.plain)
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "lock.shield.fill").foregroundStyle(LBrand.orange)
                    Text("PERSONVERN").font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                }
                Text("Alle samtaler skal ha gyldig opptakssamtykke. Du kan anonymisere kundenavn i steg 3.")
                    .font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
            }
            .padding(14)
            .background(LBrand.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.orange.opacity(0.25), lineWidth: 1))
        }
    }

    // MARK: Steg 2 — innhold (varierer per kilde)

    @ViewBuilder
    private var step2_content: some View {
        switch source {
        case .upload: uploadView
        case .record: recordView
        case .phoneIntegration: importListView(.phoneIntegration)
        case .meetingRec: importListView(.meetingRec)
        case .watchMemo: importListView(.watchMemo)
        case .manual: manualView
        }
    }

    private var uploadView: some View {
        VStack(spacing: 14) {
            Button { fileName = "Skanska_call_2026-06-30.m4a" } label: {
                VStack(spacing: 12) {
                    Image(systemName: fileName == nil ? "tray.and.arrow.down.fill" : "doc.fill")
                        .font(.appScaled(size: 44, weight: .semibold))
                        .foregroundStyle(LBrand.blue)
                    Text(fileName ?? "Trykk for å velge fil")
                        .font(.appScaled(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Eller dra-og-slipp en MP3/MP4/WAV/M4A her")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 50)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                        .foregroundStyle(LBrand.blue.opacity(0.45))
                )
            }.buttonStyle(.plain)

            if fileName != nil {
                aiProcessCard
            }
        }
    }

    private var recordView: some View {
        VStack(spacing: 16) {
            // Mic-knapp
            Button {
                if isRecording { isRecording = false }
                else {
                    isRecording = true
                    recordingSeconds = 0
                    tickRecord()
                }
            } label: {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: isRecording ? [LBrand.red, LBrand.orange] : [LBrand.purple, LBrand.purpleLight],
                                startPoint: .top, endPoint: .bottom)
                        )
                        .frame(width: 100, height: 100)
                        .shadow(color: (isRecording ? LBrand.red : LBrand.purple).opacity(0.45), radius: 15)
                    Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                        .font(.appScaled(size: 40, weight: .heavy))
                        .foregroundStyle(.white)
                }
            }.buttonStyle(.plain)

            VStack(spacing: 4) {
                Text(isRecording ? "Tar opp…" : (recordingSeconds > 0 ? "Opptak ferdig" : "Trykk for å starte opptak"))
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text(formatMinSec(recordingSeconds))
                    .font(.appScaled(size: 28, weight: .heavy, design: .monospaced))
                    .foregroundStyle(isRecording ? LBrand.red : .white)
                    .monospacedDigit()
            }

            // Mic level mock visualization
            if isRecording {
                HStack(spacing: 3) {
                    ForEach(0..<32, id: \.self) { i in
                        let phase = sin(Double(recordingSeconds) * 0.5 + Double(i) * 0.3)
                        let h = 8 + abs(phase) * 28
                        Capsule().fill(LBrand.red).frame(width: 3, height: h)
                            .animation(.easeInOut(duration: 0.3), value: recordingSeconds)
                    }
                }
                .frame(height: 40)
            }

            if recordingSeconds > 5 && !isRecording {
                aiProcessCard
            }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 16)
    }

    private func tickRecord() {
        guard isRecording else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            if !isRecording { return }
            recordingSeconds += 1
            tickRecord()
        }
    }

    private func importListView(_ s: Source) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: s.icon).foregroundStyle(s.tint)
                Text(s.rawValue.uppercased()).font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(s.tint).tracking(0.8)
                Spacer()
                Text("\(mockedCalls.count) samtaler funnet")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textTertiary)
            }
            VStack(spacing: 8) {
                ForEach(mockedCalls) { call in
                    Button { importedCall = call } label: {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle().fill(s.tint.opacity(0.2))
                                Image(systemName: s.icon).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(s.tint)
                            }
                            .frame(width: 36, height: 36)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(call.customer).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                                HStack(spacing: 6) {
                                    Text(call.date).font(.appScaled(size: 10)).foregroundStyle(LBrand.textSecondary)
                                    Text("·").foregroundStyle(LBrand.textTertiary)
                                    Text(formatMinSec(call.duration)).font(.appScaled(size: 10, design: .monospaced)).foregroundStyle(LBrand.textSecondary)
                                    Text("·").foregroundStyle(LBrand.textTertiary)
                                    Text(call.source).font(.appScaled(size: 10, weight: .semibold)).foregroundStyle(s.tint)
                                }
                            }
                            Spacer()
                            Image(systemName: importedCall == call ? "checkmark.circle.fill" : "circle")
                                .font(.appScaled(size: 18))
                                .foregroundStyle(importedCall == call ? LBrand.green : LBrand.textTertiary)
                        }
                        .padding(12)
                        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(importedCall == call ? LBrand.green.opacity(0.45) : LBrand.stroke, lineWidth: 1))
                    }.buttonStyle(.plain)
                }
            }
            if importedCall != nil { aiProcessCard }
        }
    }

    private var manualView: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("LIM INN TRANSKRIPT")
                .font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            TextEditor(text: $pastedTranscript)
                .font(.appScaled(size: 13, design: .serif))
                .foregroundStyle(.white)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 280)
                .padding(10)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            HStack(spacing: 8) {
                Text("\(pastedTranscript.count) tegn")
                    .font(.appScaled(size: 11, design: .monospaced)).foregroundStyle(LBrand.textSecondary)
                Spacer()
                Button {
                    pastedTranscript = """
[Selger]: Hei Marit, takk for at du tok deg tid.
[Kunde]: Det går fint.
[Selger]: Før jeg går videre — hva er det viktigste å få til denne samtalen for deg?
[Kunde]: Jeg vil forstå hvordan dere skiller dere fra konkurrentene.
[Selger]: Skjønner. La meg fortelle om Skanska — de jobbet mot samme problem...
"""
                } label: {
                    Text("Lim inn eksempel-transkript")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.purpleLight)
                }.buttonStyle(.plain)
            }
            if pastedTranscript.count > 50 { aiProcessCard }
        }
    }

    private var aiProcessCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles").foregroundStyle(LBrand.purpleLight)
                Text("AI-PROSESSERING").font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.purpleLight).tracking(0.8)
                Spacer()
                if aiState != .done {
                    Button { runAIPipeline() } label: {
                        Text(aiState == .idle ? "Start" : "…")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(LBrand.purple, in: Capsule())
                    }.buttonStyle(.plain)
                    .disabled(aiState != .idle)
                }
            }
            aiStepRow(label: "Transkriberer lyd", active: aiState == .transcribing, done: aiProgress >= 33)
            aiStepRow(label: "Analyserer pondus-dimensjoner", active: aiState == .analyzing, done: aiProgress >= 66)
            aiStepRow(label: "Identifiserer key moments + score", active: aiState == .scoring, done: aiProgress >= 100)
            if aiState == .done {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(LBrand.green)
                    Text("Klar — Pondus-score 82, 4 key moments funnet")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .padding(.top, 4)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.purple.opacity(0.25), lineWidth: 1))
    }

    private func aiStepRow(label: String, active: Bool, done: Bool) -> some View {
        HStack(spacing: 10) {
            if done {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(LBrand.green)
            } else if active {
                ProgressView().tint(LBrand.purpleLight).scaleEffect(0.8)
            } else {
                Image(systemName: "circle").foregroundStyle(LBrand.textTertiary)
            }
            Text(label).font(.appScaled(size: 12)).foregroundStyle(done ? .white : LBrand.textSecondary)
        }
    }

    private func runAIPipeline() {
        aiState = .transcribing
        aiProgress = 0
        ticker(target: 33, then: .analyzing) {
            ticker(target: 66, then: .scoring) {
                ticker(target: 100, then: .done) {
                    // Auto-fyll forslag når AI ferdig
                    if title.isEmpty { title = autoSuggestTitle() }
                    if customer.isEmpty { customer = importedCall?.customer ?? "Skanska AS" }
                    if industry.isEmpty { industry = "Industri" }
                    keyLearnings = [
                        "Pauset 4 sekunder etter pris-innvending",
                        "Stilte motspørsmål istedenfor å forsvare prisen",
                        "Refererte til Skanska-case med konkrete tall"
                    ]
                }
            }
        }
    }

    private func ticker(target: Int, then nextState: AIState, completion: @escaping () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            if aiProgress < target {
                aiProgress += 2
                ticker(target: target, then: nextState, completion: completion)
            } else {
                aiState = nextState
                completion()
            }
        }
    }

    private func autoSuggestTitle() -> String {
        let suggestions = [
            "Pondus-test mot prisinnvending",
            "Tøff discovery med {kunde}",
            "Møtebooking-flow som vant",
            "Når kunden ble stille",
            "Reframe etter dårlig åpning"
        ]
        return suggestions.randomElement() ?? "Nytt eksempel"
    }

    // MARK: Steg 3 — finalize

    private var step3_finalize: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionLabel("DETALJER", icon: "info.circle.fill", tint: LBrand.blue)
            VStack(spacing: 8) {
                titledField("Tittel", text: $title, hint: "F.eks. «Den vanskelige prisinnvendingen»")
                HStack(spacing: 8) {
                    titledField("Kunde", text: $customer, hint: "Skanska AS").frame(maxWidth: .infinity)
                    titledField("Bransje", text: $industry, hint: "Industri").frame(maxWidth: .infinity)
                }
                titledField("Deal-verdi (NOK)", text: $dealValue, hint: "380000", keyboardType: .numberPad)
            }

            sectionLabel("KATEGORISER", icon: "tag.fill", tint: LBrand.purpleLight)
            VStack(spacing: 10) {
                pickerRow("Utfall", icon: "flag.fill") {
                    HStack(spacing: 6) {
                        ForEach(LeadbookExample.Outcome.allCases) { o in
                            Button { outcome = o } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: o.icon).font(.appScaled(size: 9, weight: .bold))
                                    Text(o.rawValue).font(.appScaled(size: 11, weight: .semibold))
                                }
                                .foregroundStyle(outcome == o ? .white : LBrand.textSecondary)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(outcome == o ? o.color.opacity(0.32) : LBrand.cardHi, in: Capsule())
                                .overlay(Capsule().stroke(outcome == o ? o.color.opacity(0.55) : LBrand.stroke, lineWidth: 1))
                            }.buttonStyle(.plain)
                        }
                    }
                }
                pickerRow("Kanal", icon: "antenna.radiowaves.left.and.right") {
                    HStack(spacing: 6) {
                        ForEach(LeadbookTemplate.Channel.allCases, id: \.self) { c in
                            Button { channel = c } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: c.icon).font(.appScaled(size: 9, weight: .bold))
                                    Text(c.rawValue).font(.appScaled(size: 11, weight: .semibold))
                                }
                                .foregroundStyle(channel == c ? .white : LBrand.textSecondary)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(channel == c ? c.color.opacity(0.32) : LBrand.cardHi, in: Capsule())
                                .overlay(Capsule().stroke(channel == c ? c.color.opacity(0.55) : LBrand.stroke, lineWidth: 1))
                            }.buttonStyle(.plain)
                        }
                    }
                }
                pickerRow("Featured pondus-dim", icon: "star.fill") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(LeadbookExample.Dimension.allCases) { d in
                                Button { featuredDim = d } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: d.icon).font(.appScaled(size: 9, weight: .bold))
                                        Text(d.rawValue).font(.appScaled(size: 11, weight: .semibold))
                                    }
                                    .foregroundStyle(featuredDim == d ? .white : LBrand.textSecondary)
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(featuredDim == d ? LBrand.purple.opacity(0.32) : LBrand.cardHi, in: Capsule())
                                    .overlay(Capsule().stroke(featuredDim == d ? LBrand.purple.opacity(0.55) : LBrand.stroke, lineWidth: 1))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                }
            }

            sectionLabel("NØKKEL-LÆRINGER", icon: "lightbulb.fill", tint: LBrand.yellow)
            VStack(spacing: 8) {
                ForEach(keyLearnings, id: \.self) { l in
                    HStack(spacing: 9) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(LBrand.green)
                        Text(l).font(.appScaled(size: 12)).foregroundStyle(.white)
                        Spacer()
                        Button { keyLearnings.removeAll { $0 == l } } label: {
                            Image(systemName: "minus.circle.fill")
                                .foregroundStyle(LBrand.textTertiary)
                        }.buttonStyle(.plain)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 9))
                }
                HStack(spacing: 8) {
                    TextField("Legg til læring…", text: $customLearning)
                        .foregroundStyle(.white).textFieldStyle(.plain)
                        .padding(.horizontal, 10).padding(.vertical, 8)
                        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                    Button {
                        if !customLearning.isEmpty {
                            keyLearnings.append(customLearning)
                            customLearning = ""
                        }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.appScaled(size: 20))
                            .foregroundStyle(LBrand.purpleLight)
                    }.buttonStyle(.plain)
                }
            }

            sectionLabel("PERSONVERN OG DELING", icon: "lock.shield.fill", tint: LBrand.orange)
            VStack(spacing: 10) {
                Toggle(isOn: $anonymize) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Anonymiser kundenavn").font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        Text("Bytter «\(customer.isEmpty ? "Skanska AS" : customer)» med «Kunde A» osv.").font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                    }
                }
                Toggle(isOn: $requireConsent) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Bekreft opptakssamtykke").font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        Text("Vi krever at du har innhentet samtykke fra kunden").font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Synlighet").font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(LBrand.textSecondary)
                    HStack(spacing: 6) {
                        ForEach(Visibility.allCases) { v in
                            Button { visibility = v } label: {
                                HStack(spacing: 5) {
                                    Image(systemName: v.icon).font(.appScaled(size: 10, weight: .bold))
                                    Text(v.rawValue).font(.appScaled(size: 11, weight: .semibold))
                                }
                                .foregroundStyle(visibility == v ? .white : LBrand.textSecondary)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(visibility == v ? LBrand.purple.opacity(0.32) : LBrand.cardHi, in: Capsule())
                                .overlay(Capsule().stroke(visibility == v ? LBrand.purple.opacity(0.55) : LBrand.stroke, lineWidth: 1))
                            }.buttonStyle(.plain)
                        }
                    }
                }
            }
            .tint(LBrand.purpleLight).foregroundStyle(.white)
            .padding(14)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        }
    }

    private func sectionLabel(_ text: String, icon: String, tint: Color) -> some View {
        HStack(spacing: 7) {
            Image(systemName: icon).foregroundStyle(tint)
            Text(text).font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(tint).tracking(0.8)
            Spacer()
        }
    }

    private func titledField(_ label: String, text: Binding<String>, hint: String, keyboardType: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label.uppercased()).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            TextField(hint, text: text)
                .keyboardType(keyboardType)
                .foregroundStyle(.white).textFieldStyle(.plain)
                .padding(10)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.stroke, lineWidth: 1))
        }
    }

    private func pickerRow<C: View>(_ label: String, icon: String, @ViewBuilder content: () -> C) -> some View {
        HStack(alignment: .center, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(LBrand.purpleLight)
                Text(label).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(LBrand.textSecondary)
                    .lineLimit(1).fixedSize()
            }
            .frame(width: 130, alignment: .leading)
            content()
            Spacer()
        }
        .padding(10)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: Bottom bar

    private var bottomBar: some View {
        HStack(spacing: 10) {
            if step > 1 {
                Button { withAnimation(.easeInOut(duration: 0.18)) { step -= 1 } } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "chevron.left").font(.appScaled(size: 11, weight: .bold))
                        Text("Tilbake").font(.appScaled(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(LBrand.cardHi, in: Capsule())
                    .overlay(Capsule().stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)
            }
            Spacer()
            if step < 3 {
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { step += 1 }
                } label: {
                    HStack(spacing: 6) {
                        Text("Neste").font(.appScaled(size: 13, weight: .bold))
                        Image(systemName: "chevron.right").font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                    .shadow(color: LBrand.purple.opacity(0.45), radius: 6, y: 2)
                    .opacity(canProceed ? 1 : 0.45)
                }
                .buttonStyle(.plain)
                .disabled(!canProceed)
            } else {
                Button {
                    onCreated(title.isEmpty ? "Nytt eksempel" : title)
                    dismiss()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark").font(.appScaled(size: 12, weight: .black))
                        Text("Publiser eksempel").font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 11)
                    .background(
                        LinearGradient(colors: [LBrand.green, LBrand.green.opacity(0.7)],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                    .shadow(color: LBrand.green.opacity(0.45), radius: 6, y: 2)
                    .opacity(canSubmit ? 1 : 0.45)
                }
                .buttonStyle(.plain)
                .disabled(!canSubmit)
            }
        }
        .padding(16)
        .background(LBrand.bg.opacity(0.95).overlay(
            Rectangle().fill(LBrand.stroke).frame(height: 1), alignment: .top
        ))
    }

    private var canProceed: Bool {
        switch step {
        case 1: return canProceedFromStep1
        case 2: return canProceedFromStep2
        default: return true
        }
    }

    private func formatMinSec(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }
}
