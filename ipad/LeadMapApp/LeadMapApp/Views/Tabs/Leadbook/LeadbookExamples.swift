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

    // 2026-07-17: Backend-kobling — org-egne eksempler (ekte modus) bærer
    // DTO-id, draft-status og leder-tilbakemeldinger. Mock-casene lar
    // defaultene stå (nil/false/[]) så demo-oppførselen er 100 % uendret.
    var backendId: String? = nil
    var isDraft: Bool = false
    var feedback: [APIClient.LeadbookExampleFeedbackDTO] = []
    // 2026-07-17: visningstall — backend setter dem KUN for ledere, så
    // nil-sjekk er gaten i UI-et («Ukens samtale»-distribusjonen).
    var viewsTotal: Int? = nil
    var viewersCount: Int? = nil

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
        // 2026-07-17: backend-transkript kan ha fritekst-notater (linjer uten
        // «Selger:»/«Kunde:»-prefiks i opprettelses-sheeten).
        case notat = "Notat"
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

// MARK: - Backend-adapter (2026-07-17)

extension LeadbookExample {
    /// Deterministisk avatar-farge fra navnet — samme navn gir samme farge.
    private static let avatarPalette: [Color] = [
        LBrand.purpleLight, LBrand.blue, LBrand.orange, LBrand.green, LBrand.purple, LBrand.pink
    ]

    /// 2026-07-17: Mapper backend-DTO (org-egne eksempler) inn i den
    /// eksisterende view-modellen. Ukjente strenger faller trygt tilbake
    /// til defaults; backend-eksempler har ingen lydfil → keyMoments = [].
    static func fromDTO(_ dto: APIClient.LeadbookExampleDTO) -> LeadbookExample {
        let outcome: Outcome
        switch dto.outcome.lowercased() {
        case "won": outcome = .won
        case "lost": outcome = .lost
        default: outcome = .ongoing
        }

        let channel: LeadbookTemplate.Channel
        switch dto.channel.lowercased() {
        case "phone", "telefon": channel = .phone
        case "email", "e-post", "epost": channel = .email
        case "video": channel = .video
        case "field", "felt": channel = .field
        default: channel = .phone
        }

        func dimension(from raw: String?) -> Dimension? {
            guard let raw else { return nil }
            return Dimension.allCases.first { $0.rawValue.lowercased() == raw.lowercased() }
        }
        var scores: [Dimension: Int] = [:]
        for (key, value) in dto.dimensionScores {
            if let d = dimension(from: key) { scores[d] = value }
        }
        let featured = dimension(from: dto.featuredDimension)
            ?? scores.max(by: { $0.value < $1.value })?.key
            ?? .klarhet

        let transcript: [TranscriptLine] = dto.transcript.map { line in
            let speaker: TranscriptLine.Speaker
            let raw = line.speaker.lowercased()
            if raw.hasPrefix("selger") { speaker = .selger }
            else if raw.hasPrefix("notat") { speaker = .notat }
            else { speaker = .kunde }
            return TranscriptLine(
                timestamp: line.atSec ?? 0,
                speaker: speaker,
                text: line.text,
                isHighlighted: false
            )
        }

        let name = dto.sellerName.isEmpty ? dto.createdByName : dto.sellerName
        let parts = name.split(separator: " ")
        let initials = parts.count >= 2
            ? String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
            : String(name.prefix(2)).uppercased()
        let colorIdx = name.unicodeScalars.reduce(0) { ($0 + Int($1.value)) % avatarPalette.count }

        return LeadbookExample(
            title: dto.title,
            customer: dto.customerLabel,
            industry: dto.industry,
            outcome: outcome,
            channel: channel,
            duration: dto.durationSec ?? 0,
            salesperson: name,
            salespersonInitials: initials.isEmpty ? "?" : initials,
            salespersonColor: avatarPalette[colorIdx],
            date: "",
            pondusScore: dto.pondusScore ?? 0,
            featuredDimension: featured,
            dimensionScores: scores,
            keyLearnings: dto.keyLearnings,
            alternativePhrasings: dto.alternativePhrasings,
            transcript: transcript,
            keyMoments: [],
            dealValue: dto.dealValueNok ?? 0,
            summary: dto.summary,
            backendId: dto.id,
            isDraft: dto.status == "draft",
            feedback: dto.feedback,
            viewsTotal: dto.viewsTotal,
            viewersCount: dto.viewersCount
        )
    }
}

// 2026-07-17: DTO-en fikk custom Decodable-init (fjerner memberwise-init) —
// lokal init for optimistiske appends i UI-et.
extension APIClient.LeadbookExampleFeedbackDTO {
    init(id: String, authorName: String, authorRole: String, dimension: String?,
         body: String, createdAt: String?, transcriptIndex: Int?, atSec: Int?) {
        self.id = id
        self.authorName = authorName
        self.authorRole = authorRole
        self.dimension = dimension
        self.body = body
        self.createdAt = createdAt
        self.transcriptIndex = transcriptIndex
        self.atSec = atSec
        self.readAt = nil
        self.replies = []
        self.exampleTitle = nil
        self.exampleId = nil
    }
}

// MARK: - Delte feedback-format-hjelpere (2026-07-17)
// Brukes av både detail-sheeten og «Mine tilbakemeldinger»-innboksen.

enum LeadbookFeedbackFormat {
    static func roleLabel(_ role: String) -> String {
        switch role.lowercased() {
        case "selger": return "Selger"
        case "admin": return "Admin"
        case "salgssjef": return "Salgssjef"
        case "teamleder": return "Teamleder"
        case "kvalitet": return "Kvalitet"
        default: return role.isEmpty ? "Leder" : role.prefix(1).uppercased() + role.dropFirst()
        }
    }

    static func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return name.isEmpty ? "?" : String(name.prefix(2)).uppercased()
    }

    /// Relativ dato («for 2 t siden») fra ISO-streng — ellers nil (skjules).
    static func relativeDate(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = f.date(from: iso)
        if date == nil {
            f.formatOptions = [.withInternetDateTime]
            date = f.date(from: iso)
        }
        guard let date else { return nil }
        let rel = RelativeDateTimeFormatter()
        rel.locale = Locale(identifier: "nb_NO")
        rel.unitsStyle = .short
        return rel.localizedString(for: date, relativeTo: Date())
    }

    static func minSec(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }

    static func dimension(_ raw: String?) -> LeadbookExample.Dimension? {
        guard let raw else { return nil }
        return LeadbookExample.Dimension.allCases.first { $0.rawValue.lowercased() == raw.lowercased() }
    }

    /// «12 · 5 lesere» — visningstall-etikett (kun ledere får tallene).
    static func viewsLabel(_ views: Int, _ viewers: Int?) -> String {
        viewers.map { "\(views) · \($0) lesere" } ?? "\(views)"
    }
}

// MARK: - LeadbookExamplesView

struct LeadbookExamplesView: View {
    @Environment(AppState.self) private var appState
    @State private var outcomeFilter: LeadbookExample.Outcome?
    @State private var channelFilter: LeadbookTemplate.Channel?
    @State private var dimensionFilter: LeadbookExample.Dimension?
    @State private var search: String = ""
    @State private var detail: LeadbookExample?
    @State private var sort: SortField = .recent
    @State private var showAdd = false
    @State private var addToast: String?

    // 2026-07-17: Ekte datakilde — org-egne eksempler fra backend (demo AV).
    // Demo-modus beholder mock-casene uendret.
    @State private var backendExamples: [LeadbookExample] = []
    @State private var canEdit = false
    @State private var canGiveFeedback = false
    @State private var isLoading = false
    @State private var loadError: String?
    @State private var showCreate = false

    // 2026-07-17: «Mine tilbakemeldinger»-samleflate (dialog-utvidelsen)
    @State private var myFeedback: [APIClient.LeadbookExampleFeedbackDTO] = []
    @State private var unreadFeedback = 0
    @State private var showInbox = false

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }
    private var sourceExamples: [LeadbookExample] {
        isDemo ? LeadbookExampleData.examples : backendExamples
    }

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
        var list = sourceExamples
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
        .task { await loadExamples() }
        .sheet(item: $detail) { ex in
            // 2026-07-17: backend-rettigheter + refresh-callback inn i sheeten.
            LeadbookExampleDetailSheet(
                example: ex,
                canEdit: canEdit,
                canGiveFeedback: canGiveFeedback,
                onChanged: { Task { await loadExamples() } }
            )
            .presentationDragIndicator(DeviceIdiom.isPhone ? .visible : .automatic)
        }
        .sheet(isPresented: $showAdd) {
            AddExampleSheet { name in
                addToast = "«\(name)» lagt til i eksempler"
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { addToast = nil }
            }
        }
        .sheet(isPresented: $showInbox) {
            // 2026-07-17: samleflate — tap på rad åpner eksempelets detail-sheet
            // hvis eksempelet er lastet; ellers ekspanderes raden inline.
            LeadbookFeedbackInboxSheet(
                items: myFeedback,
                resolveExample: { exId in backendExamples.first { $0.backendId == exId } },
                onOpenExample: { ex in
                    showInbox = false
                    // liten pause så innboks-sheeten rekker å lukke før neste åpnes
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { detail = ex }
                }
            )
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showCreate) {
            // 2026-07-17: ekte opprettelse — lagres som utkast på backend.
            LeadbookCreateExampleSheet { name in
                addToast = "«\(name)» lagret som utkast"
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { addToast = nil }
                Task { await loadExamples() }
            }
            .presentationDragIndicator(DeviceIdiom.isPhone ? .visible : .automatic)
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
                // 2026-07-17: teller fra aktiv kilde (mock i demo, backend ellers)
                Text("\(sourceExamples.count) \(isDemo ? "reelle samtaler" : "eksempler")")
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(LBrand.textTertiary)
                // 2026-07-17: «Mine tilbakemeldinger» m/ ulest-badge (kun ekte modus)
                if !isDemo {
                    Button { showInbox = true } label: {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "tray.full.fill")
                                .font(.appScaled(size: 13, weight: .semibold))
                                .foregroundStyle(LBrand.purpleLight)
                                .padding(7)
                                .background(LBrand.cardHi, in: Circle())
                            if unreadFeedback > 0 {
                                Text("\(min(unreadFeedback, 99))")
                                    .font(.appScaled(size: 8, weight: .black))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 4).padding(.vertical, 1.5)
                                    .background(LBrand.red, in: Capsule())
                                    .offset(x: 5, y: -3)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Mine tilbakemeldinger\(unreadFeedback > 0 ? " — \(unreadFeedback) uleste" : "")")
                }
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
                    // 2026-07-17: ærlig copy i ekte modus — ingen lydfil/AI-lovnader.
                    Text(isDemo
                         ? "Hver case er transkribert, scoret og annotert med Apple Pencil. Tap en samtale for å spille av lyden, lese transkriptet og se hva som faktisk fungerte."
                         : "Organisasjonens egne salgssamtaler — med transkript, lærdommer og tilbakemeldinger fra ledelsen. Tap et eksempel for å lese hva som faktisk fungerte.")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(LBrand.textSecondary)
                        .lineLimit(DeviceIdiom.isPhone ? 3 : 2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 10) {
                    heroStat(label: "VANT", value: "\(sourceExamples.filter { $0.outcome == .won }.count)", color: LBrand.green)
                    heroStat(label: "TAPT", value: "\(sourceExamples.filter { $0.outcome == .lost }.count)", color: LBrand.red)
                    heroStat(label: "PÅGÅR", value: "\(sourceExamples.filter { $0.outcome == .ongoing }.count)", color: LBrand.orange)
                }
                // 2026-07-17: i ekte modus kun for ledere (canEdit) → ekte sheet.
                if isDemo || canEdit {
                    Button { if isDemo { showAdd = true } else { showCreate = true } } label: {
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
                // 2026-07-17: naturlig bredde — chips skal aldri klemmes på iPhone
                HStack(spacing: 7) { content() }
                    .fixedSize(horizontal: true, vertical: false)
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

    // 2026-07-17: iPhone får 1 kolonne — 2 faste kolonner ga ~180pt-kort på 390pt.
    private var gridColumns: [GridItem] {
        DeviceIdiom.isPhone
            ? [GridItem(.flexible())]
            : [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
    }

    private var grid: some View {
        Group {
            if !isDemo && isLoading && backendExamples.isEmpty {
                loadingState
            } else if !isDemo && backendExamples.isEmpty && loadError != nil {
                errorState
            } else if !isDemo && backendExamples.isEmpty {
                realEmptyState
            } else if rows.isEmpty {
                emptyState
            } else {
                LazyVGrid(columns: gridColumns, spacing: 12) {
                    ForEach(rows) { ex in
                        exampleCard(ex)
                    }
                    if isDemo || canEdit { addNewCard }
                }
            }
        }
    }

    // 2026-07-17: laste-/feil-/tom-tilstander for ekte modus (ALDRI mock her).
    private var loadingState: some View {
        VStack(spacing: 10) {
            ProgressView().tint(LBrand.purpleLight)
            Text("Henter eksempler…")
                .font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 60)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
    }

    private var errorState: some View {
        VStack(spacing: 10) {
            Image(systemName: "wifi.exclamationmark")
                .font(.appScaled(size: 30)).foregroundStyle(LBrand.orange)
            Text(loadError ?? "Kunne ikke hente eksempler")
                .font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
            Button {
                Task { await loadExamples() }
            } label: {
                Text("Prøv igjen")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(LBrand.purpleLight)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(LBrand.purple.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
            }.buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 50)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
    }

    private var realEmptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "books.vertical")
                .font(.appScaled(size: 32)).foregroundStyle(LBrand.textTertiary)
            Text("Ingen eksempler enda")
                .font(.appScaled(size: 15, weight: .bold)).foregroundStyle(.white)
            Text("Flagg gode samtaler fra Kvalitet, eller opprett manuelt.")
                .font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
                .multilineTextAlignment(.center)
            if canEdit {
                Button { showCreate = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus.circle.fill").font(.appScaled(size: 12, weight: .bold))
                        Text("Opprett eksempel").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }.buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 60).padding(.horizontal, 20)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
    }

    private var addNewCard: some View {
        // 2026-07-17: demo → mock-wizard; ekte modus → backend-opprettelse (utkast).
        Button { if isDemo { showAdd = true } else { showCreate = true } } label: {
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
                    Text(isDemo
                         ? "Last opp opptak, spill inn, eller skriv inn — AI scorer og foreslår key moments."
                         : "Skriv inn en god (eller lærerik) samtale — lagres som utkast til du publiserer.")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                }
                if isDemo {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles").font(.appScaled(size: 10, weight: .bold))
                        Text("AI-analyse").font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(LBrand.purpleLight)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(LBrand.purple.opacity(0.15), in: Capsule())
                    .overlay(Capsule().stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
                }
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
                        // 2026-07-17: ledere ser upubliserte utkast tydelig merket
                        if ex.isDraft {
                            Text("UTKAST")
                                .font(.appScaled(size: 9, weight: .black)).tracking(0.6)
                                .foregroundStyle(.black)
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(LBrand.yellow, in: Capsule())
                        }
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
                            .lineLimit(1)
                        Spacer()
                        // 2026-07-17: diskrete visningstall (backend setter kun for ledere)
                        if let views = ex.viewsTotal {
                            HStack(spacing: 3) {
                                Image(systemName: "eye.fill").font(.appScaled(size: 9))
                                Text(LeadbookFeedbackFormat.viewsLabel(views, ex.viewersCount))
                                    .font(.appScaled(size: 10, weight: .semibold))
                            }
                            .foregroundStyle(LBrand.textTertiary)
                        }
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

    // MARK: Data (2026-07-17)

    /// Henter org-egne eksempler i ekte modus. Demo-modus rører aldri nettet.
    @MainActor
    private func loadExamples() async {
        guard !isDemo, let api = appState.api else { return }
        if backendExamples.isEmpty { isLoading = true }
        loadError = nil
        do {
            let resp = try await api.fetchLeadbookExamples()
            backendExamples = resp.examples.map(LeadbookExample.fromDTO)
            canEdit = resp.canEdit
            canGiveFeedback = resp.canGiveFeedback
        } catch {
            loadError = "Kunne ikke hente eksempler"
        }
        isLoading = false
        // 2026-07-17: «Mine tilbakemeldinger» + ulest-badge — sekundært,
        // feiler stille uten å påvirke eksempel-listen.
        do {
            let mine = try await api.fetchMyLeadbookFeedback()
            myFeedback = mine.feedback
            unreadFeedback = mine.unread
        } catch {
            // stille — innboksen viser bare det vi har
        }
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
    // 2026-07-17: backend-rettigheter fra fetchLeadbookExamples + refresh-
    // callback til fanen. Defaultene holder gamle call-sites (Innsikt) grønne.
    var canEdit: Bool = false
    var canGiveFeedback: Bool = false
    var onChanged: (() -> Void)? = nil

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var playbackSeconds: Int = 0
    @State private var isPlaying = false
    @State private var showAnnotations = true
    @State private var saveToast: String?

    // 2026-07-17: backend-eksempel-tilstand (publisering + tilbakemeldinger)
    @State private var didPublish = false
    @State private var isPublishing = false
    @State private var extraFeedback: [APIClient.LeadbookExampleFeedbackDTO] = []
    @State private var feedbackText = ""
    @State private var feedbackDim: LeadbookExample.Dimension?
    @State private var isSendingFeedback = false

    // 2026-07-17: replikk-anker — tilbakemelding på konkret replikk i
    // transkriptet, + scroll-mål (composer ↔ replikk) og tastatur-fokus.
    @State private var anchorIndex: Int?
    @State private var scrollTarget: String?
    @FocusState private var feedbackFocused: Bool

    // 2026-07-17: svar-tråd («coaching, ikke megafon») — per-feedback composer
    // + optimistiske svar. Backend håndhever hvem som får svare (403 → toast).
    @State private var replyingTo: String?
    @State private var replyText = ""
    @State private var isSendingReply = false
    @State private var extraReplies: [String: [APIClient.LeadbookFeedbackReplyDTO]] = [:]
    @FocusState private var replyFocused: Bool

    private static let composerID = "leadbook-feedback-composer"

    /// Org-eget eksempel fra backend (ingen lydfil enda → skjul fake player).
    private var isBackend: Bool { example.backendId != nil }

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
                    // 2026-07-17: reader for anker-scroll (replikk ↔ composer) —
                    // proxyen dekker de nestede ScrollView-ene i begge layouts.
                    ScrollViewReader { proxy in
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
                    .onChange(of: scrollTarget) { _, target in
                        guard let target else { return }
                        withAnimation(.easeInOut(duration: 0.25)) {
                            proxy.scrollTo(target, anchor: .center)
                        }
                        scrollTarget = nil
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
                            // «Lagre som mal» fjernet 2026-07-17: var død
                            // knapp — kun toast, ingen mal ble opprettet.
                            Button { showAnnotations.toggle() } label: {
                                Label(showAnnotations ? "Skjul key moments" : "Vis key moments", systemImage: "sparkles")
                            }
                            Button { pencilDrawing = PKDrawing() } label: {
                                Label("Slett alle tegninger", systemImage: "trash")
                            }
                            // «Last ned transkript» + «Del» fjernet 2026-07-17:
                            // var døde knapper (tomme closures).
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
            .task { onOpenBackendExample() }
        }
    }

    /// 2026-07-17: kjøres når sheeten åpnes for et backend-eksempel:
    /// (a) visnings-registrering («Ukens samtale»-distribusjonen) og
    /// (b) selger-lest-kvittering for uleste tilbakemeldinger.
    /// Begge fire-and-forget — demo-eksempler (backendId == nil) er no-op.
    private func onOpenBackendExample() {
        guard isBackend, let api = appState.api, let exId = example.backendId else { return }
        Task { try? await api.recordLeadbookExampleView(exampleId: exId) }
        // Ledere kvitterer ikke — lest-status er selgerens signal (backend
        // håndhever uansett at kun eksempelets selger kan kvittere).
        if !canGiveFeedback {
            for fb in example.feedback where fb.readAt == nil {
                Task { try? await api.markLeadbookFeedbackRead(feedbackId: fb.id) }
            }
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
            if isBackend {
                // 2026-07-17: fake audio-player + tidsanker er kun demo-mock —
                // backend-eksempler har ingen lydfil enda. Transkript rett frem.
                if example.isDraft && !didPublish { draftBanner }
                backendHeader
            } else {
                playerCanvas
                playerControls
            }
            meta
            transcriptCard
            Color.clear.frame(height: 20)
        }
        .padding(DeviceIdiom.isPhone ? 14 : 20)
    }

    // MARK: Backend-header + utkast (2026-07-17)

    private var backendHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                HStack(spacing: 5) {
                    Image(systemName: example.outcome.icon).font(.appScaled(size: 11, weight: .bold))
                    Text(example.outcome.rawValue.uppercased()).font(.appScaled(size: 10, weight: .black)).tracking(0.6)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(example.outcome.color, in: Capsule())
                Spacer()
                if example.dealValue > 0 {
                    Text(formatNOK(example.dealValue))
                        .font(.appScaled(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(LBrand.green)
                }
            }
            Text(example.title)
                .font(.appScaled(size: 18, weight: .heavy))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text([example.customer, example.industry].filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.appScaled(size: 11))
                .foregroundStyle(LBrand.textSecondary)
            // 2026-07-17: visningstall for ledere (backend setter kun da)
            if let views = example.viewsTotal {
                HStack(spacing: 4) {
                    Image(systemName: "eye.fill").font(.appScaled(size: 10))
                    Text(LeadbookFeedbackFormat.viewsLabel(views, example.viewersCount))
                        .font(.appScaled(size: 11, weight: .semibold))
                }
                .foregroundStyle(LBrand.textTertiary)
            }
            if !example.summary.isEmpty {
                Text(example.summary)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(example.outcome.color.opacity(0.25), lineWidth: 1))
    }

    private var draftBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "doc.badge.clock")
                .font(.appScaled(size: 16, weight: .bold))
                .foregroundStyle(LBrand.yellow)
            VStack(alignment: .leading, spacing: 2) {
                Text("UTKAST")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.yellow).tracking(0.8)
                Text("Kun ledere ser dette til det publiseres.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
            if canEdit {
                Button { Task { await publish() } } label: {
                    HStack(spacing: 5) {
                        if isPublishing {
                            ProgressView().tint(.white).scaleEffect(0.7)
                        } else {
                            Image(systemName: "paperplane.fill").font(.appScaled(size: 11, weight: .bold))
                        }
                        Text("Publiser").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 13).padding(.vertical, 8)
                    .background(
                        LinearGradient(colors: [LBrand.green, LBrand.green.opacity(0.7)],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
                .disabled(isPublishing)
            }
        }
        .padding(12)
        .background(LBrand.yellow.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.yellow.opacity(0.3), lineWidth: 1))
    }

    /// 2026-07-17: leder publiserer utkast → synlig for hele teamet.
    @MainActor
    private func publish() async {
        guard let api = appState.api, let id = example.backendId, !isPublishing else { return }
        isPublishing = true
        do {
            try await api.updateLeadbookExample(id: id, ["status": "published"])
            didPublish = true
            saveToast = "Eksempelet er publisert"
            onChanged?()
        } catch {
            saveToast = "Kunne ikke publisere — prøv igjen"
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { saveToast = nil }
        isPublishing = false
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

    // 2026-07-17: på iPhone (390pt) brakk capsule-radene — horisontal scroll
    // med naturlig bredde i stedet for faste rammer.
    @ViewBuilder
    private var meta: some View {
        if DeviceIdiom.isPhone {
            ScrollView(.horizontal, showsIndicators: false) {
                metaRow.fixedSize(horizontal: true, vertical: false)
            }
        } else {
            metaRow
        }
    }

    private var metaRow: some View {
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
                // 2026-07-17: indeksert — replikk-nr brukes som feedback-anker
                ForEach(Array(example.transcript.enumerated()), id: \.element.id) { idx, line in
                    transcriptRow(line, index: idx)
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    // 2026-07-17: backend-eksempler har ingen lyd → ingen tidsanker-hopp;
    // iPhone stabler taler-etikett over boblen så teksten får full bredde.
    // Ledere (canGiveFeedback) får et diskret kommentar-ikon per replikk som
    // setter anker i composeren og scroller/fokuserer dit.
    @ViewBuilder
    private func transcriptRow(_ line: TranscriptLine, index: Int) -> some View {
        if isBackend {
            HStack(alignment: .top, spacing: 6) {
                transcriptBody(line, showTimestamp: line.timestamp > 0)
                if canGiveFeedback {
                    Button { setFeedbackAnchor(index) } label: {
                        Image(systemName: anchorIndex == index ? "text.bubble.fill" : "text.bubble")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(anchorIndex == index ? LBrand.purpleLight : LBrand.textTertiary)
                            .padding(.top, 10)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Gi tilbakemelding på replikk \(index + 1)")
                }
            }
            .id(Self.transcriptRowID(index))
        } else {
            Button { playbackSeconds = line.timestamp } label: {
                transcriptBody(line, showTimestamp: true)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: Replikk-anker (2026-07-17)

    private static func transcriptRowID(_ idx: Int) -> String { "leadbook-transcript-\(idx)" }

    /// Sett anker → scroll til composeren og gi tastatur-fokus.
    private func setFeedbackAnchor(_ idx: Int) {
        anchorIndex = idx
        scrollTarget = Self.composerID
        feedbackFocused = true
    }

    private func speakerColor(_ s: TranscriptLine.Speaker) -> Color {
        switch s {
        case .selger: return LBrand.purpleLight
        case .kunde: return LBrand.blue
        case .notat: return LBrand.textTertiary
        }
    }

    @ViewBuilder
    private func transcriptBody(_ line: TranscriptLine, showTimestamp: Bool) -> some View {
        if DeviceIdiom.isPhone {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(line.speaker.rawValue.uppercased())
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(speakerColor(line.speaker))
                        .tracking(0.6)
                    if showTimestamp {
                        Text(formatMinSec(line.timestamp))
                            .font(.appScaled(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                }
                transcriptBubble(line)
            }
        } else {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    if showTimestamp {
                        Text(formatMinSec(line.timestamp))
                            .font(.appScaled(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                    Text(line.speaker.rawValue.uppercased())
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(speakerColor(line.speaker))
                        .tracking(0.6)
                }
                .frame(width: 60, alignment: .leading)
                transcriptBubble(line)
            }
        }
    }

    private func transcriptBubble(_ line: TranscriptLine) -> some View {
        let isHL = line.isHighlighted && showAnnotations
        return Text(line.text)
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

    // MARK: Right — Pondus + learnings + alts

    private var rightColumn: some View {
        ScrollView { rightColumnContent }
    }

    /// Innholdet uten egen ScrollView — gjenbrukes i stacked iPhone-layout.
    private var rightColumnContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            // 2026-07-17: backend-eksempler kan mangle score/lister — skjul
            // tomme kort ærlig. Demo-casene har alltid innhold → uendret.
            if !isBackend || example.pondusScore > 0 || !example.dimensionScores.isEmpty {
                pondusBreakdown
            }
            if !example.keyLearnings.isEmpty { learningsCard }
            if !example.alternativePhrasings.isEmpty { alternativesCard }
            if isBackend { feedbackSection }
            // «Lagre som mal» fjernet 2026-07-17: var død knapp — kun toast,
            // ingen mal ble faktisk lagret.
            Color.clear.frame(height: 16)
        }
        .padding(16)
    }

    // MARK: Tilbakemeldinger fra ledelsen (2026-07-17)

    private var allFeedback: [APIClient.LeadbookExampleFeedbackDTO] {
        example.feedback + extraFeedback
    }

    private var feedbackSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "bubble.left.and.text.bubble.right.fill")
                    .foregroundStyle(LBrand.purpleLight)
                Text("TILBAKEMELDINGER FRA LEDELSEN")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Spacer()
                if !allFeedback.isEmpty {
                    Text("\(allFeedback.count)")
                        .font(.appScaled(size: 10, weight: .black, design: .rounded))
                        .foregroundStyle(LBrand.purpleLight)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(LBrand.purple.opacity(0.18), in: Capsule())
                }
            }
            if allFeedback.isEmpty {
                Text(canGiveFeedback
                     ? "Ingen tilbakemeldinger enda — gi den første under."
                     : "Ingen tilbakemeldinger enda.")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
            }
            ForEach(allFeedback) { fb in
                feedbackRow(fb)
            }
            if canGiveFeedback { feedbackComposer.id(Self.composerID) }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    // 2026-07-17: anker-chips (composer + feedback-rader)

    /// Chip i composeren: «Replikk 4 · Selger · 02:13» + X for å fjerne ankeret.
    private func composerAnchorChip(_ idx: Int) -> some View {
        let line = example.transcript.indices.contains(idx) ? example.transcript[idx] : nil
        var label = "Replikk \(idx + 1)"
        if let line {
            label += " · \(line.speaker.rawValue)"
            if line.timestamp > 0 { label += " · \(formatMinSec(line.timestamp))" }
        }
        return HStack(spacing: 6) {
            Image(systemName: "text.bubble.fill").font(.appScaled(size: 10, weight: .bold))
            Text(label).font(.appScaled(size: 11, weight: .semibold)).lineLimit(1)
            Button { anchorIndex = nil } label: {
                Image(systemName: "xmark.circle.fill").font(.appScaled(size: 12))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Fjern replikk-anker")
        }
        .foregroundStyle(LBrand.purpleLight)
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(LBrand.purple.opacity(0.14), in: Capsule())
        .overlay(Capsule().stroke(LBrand.purple.opacity(0.35), lineWidth: 1))
    }

    /// Chip på en feedback-rad med anker — tap scroller til replikken.
    @ViewBuilder
    private func feedbackAnchorChip(_ fb: APIClient.LeadbookExampleFeedbackDTO) -> some View {
        if let idx = fb.transcriptIndex {
            let valid = example.transcript.indices.contains(idx)
            let secs = fb.atSec ?? (valid ? example.transcript[idx].timestamp : 0)
            Button { if valid { scrollTarget = Self.transcriptRowID(idx) } } label: {
                HStack(spacing: 4) {
                    Image(systemName: "quote.opening").font(.appScaled(size: 9, weight: .bold))
                    Text(secs > 0 ? "Replikk \(idx + 1) · \(formatMinSec(secs))" : "Replikk \(idx + 1)")
                        .font(.appScaled(size: 10, weight: .bold))
                }
                .foregroundStyle(LBrand.blue)
                .padding(.horizontal, 7).padding(.vertical, 3)
                .background(LBrand.blue.opacity(0.12), in: Capsule())
                .overlay(Capsule().stroke(LBrand.blue.opacity(0.3), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(!valid)
        }
    }

    private func feedbackRow(_ fb: APIClient.LeadbookExampleFeedbackDTO) -> some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                Circle().fill(LBrand.purple.opacity(0.25))
                Text(feedbackInitials(fb.authorName))
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.purpleLight)
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Text(fb.authorName)
                        .font(.appScaled(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(roleLabel(fb.authorRole))
                        .font(.appScaled(size: 9, weight: .black)).tracking(0.4)
                        .foregroundStyle(LBrand.purpleLight)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(LBrand.purple.opacity(0.16), in: Capsule())
                    Spacer()
                    if let rel = relativeDate(fb.createdAt) {
                        Text(rel)
                            .font(.appScaled(size: 10))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                }
                // 2026-07-17: dimensjon-chip + evt. replikk-anker-chip på én rad
                if fb.dimension != nil || fb.transcriptIndex != nil {
                    HStack(spacing: 6) {
                        if let dim = feedbackDimension(fb.dimension) {
                            HStack(spacing: 4) {
                                Image(systemName: dim.icon).font(.appScaled(size: 9, weight: .bold))
                                Text(dim.rawValue).font(.appScaled(size: 10, weight: .bold))
                            }
                            .foregroundStyle(LBrand.purpleLight)
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(LBrand.purple.opacity(0.12), in: Capsule())
                            .overlay(Capsule().stroke(LBrand.purple.opacity(0.3), lineWidth: 1))
                        }
                        feedbackAnchorChip(fb)
                    }
                }
                Text(fb.body)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                // 2026-07-17: svar-tråd — coaching-dialog, innrykket under
                let replies = allReplies(fb)
                if !replies.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(replies) { r in replyRow(r) }
                    }
                    .padding(.top, 2)
                }
                HStack(spacing: 12) {
                    // «Svar» for alle — backend håndhever hvem som faktisk får
                    // svare (selger + ledere); 403 gir feil-toast, aldri stille.
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                            replyingTo = (replyingTo == fb.id) ? nil : fb.id
                        }
                        replyText = ""
                        if replyingTo == fb.id { replyFocused = true }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrowshape.turn.up.left.fill")
                                .font(.appScaled(size: 9, weight: .bold))
                            Text(replyingTo == fb.id ? "Avbryt" : "Svar")
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(LBrand.purpleLight)
                    }
                    .buttonStyle(.plain)
                    // 2026-07-17: lest-kvittering — kun ledere ser status
                    if canGiveFeedback {
                        HStack(spacing: 3) {
                            Image(systemName: fb.readAt != nil ? "checkmark.circle.fill" : "circle.dashed")
                                .font(.appScaled(size: 9, weight: .bold))
                            Text(fb.readAt != nil ? "Sett" : "Ulest")
                                .font(.appScaled(size: 9, weight: .black)).tracking(0.4)
                        }
                        .foregroundStyle(fb.readAt != nil ? LBrand.green : LBrand.textTertiary)
                    }
                    Spacer()
                }
                if replyingTo == fb.id {
                    replyComposer(fb)
                }
            }
        }
        .padding(10)
        .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: Svar-tråd (2026-07-17)

    private func allReplies(_ fb: APIClient.LeadbookExampleFeedbackDTO) -> [APIClient.LeadbookFeedbackReplyDTO] {
        fb.replies + (extraReplies[fb.id] ?? [])
    }

    private func replyRow(_ r: APIClient.LeadbookFeedbackReplyDTO) -> some View {
        let isSeller = r.authorRole.lowercased() == "selger"
        return HStack(alignment: .top, spacing: 8) {
            ZStack {
                Circle().fill((isSeller ? LBrand.blue : LBrand.purple).opacity(0.22))
                Text(LeadbookFeedbackFormat.initials(r.authorName))
                    .font(.appScaled(size: 8, weight: .black))
                    .foregroundStyle(isSeller ? LBrand.blue : LBrand.purpleLight)
            }
            .frame(width: 22, height: 22)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(r.authorName)
                        .font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(LeadbookFeedbackFormat.roleLabel(r.authorRole))
                        .font(.appScaled(size: 8, weight: .black)).tracking(0.4)
                        .foregroundStyle(isSeller ? LBrand.blue : LBrand.purpleLight)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background((isSeller ? LBrand.blue : LBrand.purple).opacity(0.15), in: Capsule())
                    Spacer()
                    if let rel = LeadbookFeedbackFormat.relativeDate(r.createdAt) {
                        Text(rel).font(.appScaled(size: 9)).foregroundStyle(LBrand.textTertiary)
                    }
                }
                Text(r.body)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(8)
        .background(LBrand.bg.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
        .padding(.leading, 12)   // innrykk under moder-tilbakemeldingen
    }

    private func replyComposer(_ fb: APIClient.LeadbookExampleFeedbackDTO) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Svar \(fb.authorName)…", text: $replyText, axis: .vertical)
                .lineLimit(1...4)
                .font(.appScaled(size: 12))
                .foregroundStyle(.white)
                .textFieldStyle(.plain)
                .focused($replyFocused)
                .padding(8)
                .background(LBrand.bg.opacity(0.6), in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(LBrand.stroke, lineWidth: 1))
            Button { Task { await sendReply(fb) } } label: {
                Group {
                    if isSendingReply {
                        ProgressView().tint(.white).scaleEffect(0.7)
                    } else {
                        Image(systemName: "paperplane.fill").font(.appScaled(size: 12, weight: .bold))
                    }
                }
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(
                    LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Circle()
                )
                .opacity(replyDisabled ? 0.45 : 1)
            }
            .buttonStyle(.plain)
            .disabled(replyDisabled)
            .accessibilityLabel("Send svar")
        }
        .padding(.leading, 12)
    }

    private var replyDisabled: Bool {
        replyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSendingReply
    }

    @MainActor
    private func sendReply(_ fb: APIClient.LeadbookExampleFeedbackDTO) async {
        guard let api = appState.api else { return }
        let text = replyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSendingReply else { return }
        isSendingReply = true
        do {
            try await api.replyToLeadbookFeedback(feedbackId: fb.id, body: text)
            // Optimistisk append — rolle-heuristikk kun for lokal visning
            extraReplies[fb.id, default: []].append(APIClient.LeadbookFeedbackReplyDTO(
                id: UUID().uuidString,
                authorName: appState.displayName,
                authorRole: canGiveFeedback ? (appState.roleInOrg ?? "leder") : "selger",
                body: text,
                createdAt: ISO8601DateFormatter().string(from: Date())
            ))
            replyText = ""
            replyingTo = nil
            saveToast = "Svar sendt — \(fb.authorName) varsles"
            onChanged?()
        } catch {
            saveToast = "Kunne ikke svare — prøv igjen"
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { saveToast = nil }
        isSendingReply = false
    }

    private var feedbackComposer: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider().overlay(LBrand.stroke)
            Text("GI TILBAKEMELDING")
                .font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            // 2026-07-17: aktivt replikk-anker vises som chip m/ X for å fjerne
            if let idx = anchorIndex {
                composerAnchorChip(idx)
            }
            TextField("Skriv en tilbakemelding til teamet…", text: $feedbackText, axis: .vertical)
                .lineLimit(2...5)
                .font(.appScaled(size: 12))
                .foregroundStyle(.white)
                .textFieldStyle(.plain)
                .focused($feedbackFocused)
                .padding(10)
                .background(LBrand.bg.opacity(0.6), in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(LBrand.stroke, lineWidth: 1))
            HStack(spacing: 8) {
                // Valgfri Pondus-dimensjon (eller «Generelt»)
                Menu {
                    Button { feedbackDim = nil } label: { Label("Generelt", systemImage: "text.bubble") }
                    ForEach(LeadbookExample.Dimension.allCases) { d in
                        Button { feedbackDim = d } label: { Label(d.rawValue, systemImage: d.icon) }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: feedbackDim?.icon ?? "text.bubble")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text(feedbackDim?.rawValue ?? "Generelt")
                            .font(.appScaled(size: 11, weight: .semibold))
                        Image(systemName: "chevron.down").font(.appScaled(size: 8, weight: .semibold))
                    }
                    .foregroundStyle(LBrand.purpleLight)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(LBrand.purple.opacity(0.14), in: Capsule())
                    .overlay(Capsule().stroke(LBrand.purple.opacity(0.35), lineWidth: 1))
                }
                Spacer()
                Button { Task { await sendFeedback() } } label: {
                    HStack(spacing: 5) {
                        if isSendingFeedback {
                            ProgressView().tint(.white).scaleEffect(0.7)
                        } else {
                            Image(systemName: "paperplane.fill").font(.appScaled(size: 11, weight: .bold))
                        }
                        Text("Send").font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 7)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                    .opacity(sendDisabled ? 0.45 : 1)
                }
                .buttonStyle(.plain)
                .disabled(sendDisabled)
            }
        }
    }

    private var sendDisabled: Bool {
        feedbackText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSendingFeedback
    }

    @MainActor
    private func sendFeedback() async {
        guard let api = appState.api, let id = example.backendId else { return }
        let text = feedbackText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSendingFeedback else { return }
        isSendingFeedback = true
        let dimKey = feedbackDim.map { $0.rawValue.lowercased() }
        // 2026-07-17: valgfritt replikk-anker → transcript_index + at_sec
        let anchorIdx = anchorIndex.flatMap { example.transcript.indices.contains($0) ? $0 : nil }
        let anchorSec: Int? = anchorIdx.flatMap {
            let t = example.transcript[$0].timestamp
            return t > 0 ? t : nil
        }
        do {
            try await api.addLeadbookExampleFeedback(
                exampleId: id, body: text, dimension: dimKey,
                transcriptIndex: anchorIdx, atSec: anchorSec)
            // Optimistisk append — refresh skjer i bakgrunnen via onChanged.
            extraFeedback.append(APIClient.LeadbookExampleFeedbackDTO(
                id: UUID().uuidString,
                authorName: appState.displayName,
                authorRole: appState.roleInOrg ?? "leder",
                dimension: dimKey,
                body: text,
                createdAt: ISO8601DateFormatter().string(from: Date()),
                transcriptIndex: anchorIdx,
                atSec: anchorSec
            ))
            feedbackText = ""
            feedbackDim = nil
            anchorIndex = nil
            // 2026-07-17: backend varsler selgeren (in-app + push) automatisk.
            saveToast = example.salesperson.isEmpty
                ? "Tilbakemelding sendt"
                : "Sendt — \(example.salesperson) varsles"
            onChanged?()
        } catch {
            saveToast = "Kunne ikke sende — prøv igjen"
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { saveToast = nil }
        isSendingFeedback = false
    }

    // MARK: Feedback-helpers (2026-07-17)

    private func roleLabel(_ role: String) -> String {
        switch role.lowercased() {
        case "admin": return "Admin"
        case "salgssjef": return "Salgssjef"
        case "teamleder": return "Teamleder"
        case "kvalitet": return "Kvalitet"
        default: return role.isEmpty ? "Leder" : role.prefix(1).uppercased() + role.dropFirst()
        }
    }

    private func feedbackInitials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return name.isEmpty ? "?" : String(name.prefix(2)).uppercased()
    }

    private func feedbackDimension(_ raw: String?) -> LeadbookExample.Dimension? {
        guard let raw else { return nil }
        return LeadbookExample.Dimension.allCases.first { $0.rawValue.lowercased() == raw.lowercased() }
    }

    /// Relativ dato («for 2 t siden») fra ISO-streng — ellers nil (skjules).
    private func relativeDate(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = f.date(from: iso)
        if date == nil {
            f.formatOptions = [.withInternetDateTime]
            date = f.date(from: iso)
        }
        guard let date else { return nil }
        let rel = RelativeDateTimeFormatter()
        rel.locale = Locale(identifier: "nb_NO")
        rel.unitsStyle = .short
        return rel.localizedString(for: date, relativeTo: Date())
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
            // 2026-07-17: 1 kolonne på iPhone — 2 faste kolonner klemte kortene.
            LazyVGrid(columns: DeviceIdiom.isPhone
                        ? [GridItem(.flexible())]
                        : [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                      spacing: 10) {
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

// MARK: - LeadbookCreateExampleSheet — ekte opprettelse mot backend (2026-07-17)

/// Kompakt leder-flyt for å legge inn et org-eget eksempel manuelt.
/// Lagres som UTKAST via `createLeadbookExample` — publiseres fra detail-sheeten.
/// (Demo-modusens AI-wizard `AddExampleSheet` er urørt og vises kun i demo.)
struct LeadbookCreateExampleSheet: View {
    var onCreated: (String) -> Void
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var customerLabel = ""
    @State private var industry = ""
    @State private var outcome: LeadbookExample.Outcome = .ongoing
    @State private var channel: LeadbookTemplate.Channel = .phone
    @State private var dealValue = ""
    @State private var sellerName = ""
    @State private var summary = ""
    @State private var transcriptText = ""
    @State private var learningsText = ""
    @State private var isSaving = false
    @State private var errorText: String?

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        sectionLabel("DETALJER", icon: "info.circle.fill", tint: LBrand.blue)
                        VStack(spacing: 8) {
                            field("Tittel", text: $title, hint: "F.eks. «Den vanskelige prisinnvendingen»")
                            field("Kunde", text: $customerLabel, hint: "Kan anonymiseres — f.eks. «Kunde A (bygg)»")
                            // iPhone: stable feltene — side-om-side brakk på 390pt.
                            if DeviceIdiom.isPhone {
                                field("Bransje", text: $industry, hint: "Industri")
                                field("Deal-verdi (NOK, valgfri)", text: $dealValue, hint: "380000", keyboardType: .numberPad)
                            } else {
                                HStack(spacing: 8) {
                                    field("Bransje", text: $industry, hint: "Industri")
                                    field("Deal-verdi (NOK, valgfri)", text: $dealValue, hint: "380000", keyboardType: .numberPad)
                                }
                            }
                            field("Selger", text: $sellerName, hint: "Hvem hadde samtalen?")
                        }

                        sectionLabel("KATEGORISER", icon: "tag.fill", tint: LBrand.purpleLight)
                        chipPicker("Utfall") {
                            ForEach(LeadbookExample.Outcome.allCases) { o in
                                selectChip(text: o.rawValue, icon: o.icon, tint: o.color, active: outcome == o) { outcome = o }
                            }
                        }
                        chipPicker("Kanal") {
                            ForEach(LeadbookTemplate.Channel.allCases, id: \.self) { c in
                                selectChip(text: c.rawValue, icon: c.icon, tint: c.color, active: channel == c) { channel = c }
                            }
                        }

                        sectionLabel("INNHOLD", icon: "text.alignleft", tint: LBrand.green)
                        editor("Sammendrag", text: $summary, minHeight: 70,
                               hint: "Én-to setninger om hva som skjedde og hvorfor det er lærerikt.")
                        editor("Transkript", text: $transcriptText, minHeight: 160,
                               hint: "Én replikk per linje: «Selger: …» / «Kunde: …». Linjer uten kolon blir notater.")
                        editor("Nøkkel-lærdommer", text: $learningsText, minHeight: 90,
                               hint: "Én lærdom per linje.")

                        if let errorText {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(LBrand.red)
                                Text(errorText).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(LBrand.red)
                            }
                        }
                        Color.clear.frame(height: 12)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Nytt eksempel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { Task { await save() } } label: {
                        HStack(spacing: 5) {
                            if isSaving {
                                ProgressView().tint(.white).scaleEffect(0.7)
                            } else {
                                Image(systemName: "tray.and.arrow.down.fill").font(.appScaled(size: 11, weight: .bold))
                            }
                            Text("Lagre utkast").font(.appScaled(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: Capsule()
                        )
                        .opacity(canSave ? 1 : 0.45)
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSave)
                }
            }
        }
    }

    // MARK: Lagring

    @MainActor
    private func save() async {
        guard let api = appState.api else {
            errorText = "Ikke innlogget — prøv igjen"
            return
        }
        let t = title.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty, !isSaving else { return }
        isSaving = true
        errorText = nil

        let outcomeKey: String
        switch outcome {
        case .won: outcomeKey = "won"
        case .lost: outcomeKey = "lost"
        case .ongoing: outcomeKey = "ongoing"
        }
        let channelKey: String
        switch channel {
        case .field: channelKey = "field"
        case .phone: channelKey = "phone"
        case .email: channelKey = "email"
        case .video: channelKey = "video"
        }

        var body: [String: Any] = [
            "status": "draft",
            "title": t,
            "customer_label": customerLabel.trimmingCharacters(in: .whitespaces),
            "industry": industry.trimmingCharacters(in: .whitespaces),
            "outcome": outcomeKey,
            "channel": channelKey,
            "seller_name": sellerName.trimmingCharacters(in: .whitespaces),
            "summary": summary.trimmingCharacters(in: .whitespacesAndNewlines),
            "transcript": parsedTranscript(),
            "key_learnings": learningsText
                .split(separator: "\n")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
        ]
        if let v = Int(dealValue.filter(\.isNumber)), v > 0 {
            body["deal_value_nok"] = v
        }

        do {
            _ = try await api.createLeadbookExample(body)
            onCreated(t)
            dismiss()
        } catch {
            errorText = "Kunne ikke lagre — prøv igjen"
        }
        isSaving = false
    }

    /// «Selger: …» / «Kunde: …» → {speaker, text}; speaker = tekst før første
    /// kolon, resten = text. Linjer uten kolon → speaker «Notat».
    private func parsedTranscript() -> [[String: Any]] {
        transcriptText
            .split(separator: "\n", omittingEmptySubsequences: true)
            .compactMap { raw in
                let line = raw.trimmingCharacters(in: .whitespaces)
                guard !line.isEmpty else { return nil }
                if let idx = line.firstIndex(of: ":") {
                    let speaker = String(line[..<idx]).trimmingCharacters(in: .whitespaces)
                    let text = String(line[line.index(after: idx)...]).trimmingCharacters(in: .whitespaces)
                    if !speaker.isEmpty && !text.isEmpty {
                        return ["speaker": speaker, "text": text, "at_sec": 0]
                    }
                }
                return ["speaker": "Notat", "text": line, "at_sec": 0]
            }
    }

    // MARK: Byggeklosser

    private func sectionLabel(_ text: String, icon: String, tint: Color) -> some View {
        HStack(spacing: 7) {
            Image(systemName: icon).foregroundStyle(tint)
            Text(text).font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(tint).tracking(0.8)
            Spacer()
        }
    }

    private func field(_ label: String, text: Binding<String>, hint: String, keyboardType: UIKeyboardType = .default) -> some View {
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
        .frame(maxWidth: .infinity)
    }

    private func editor(_ label: String, text: Binding<String>, minHeight: CGFloat, hint: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label.uppercased()).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            TextEditor(text: text)
                .font(.appScaled(size: 13, design: .serif))
                .foregroundStyle(.white)
                .scrollContentBackground(.hidden)
                .frame(minHeight: minHeight)
                .padding(8)
                .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
            Text(hint).font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
        }
    }

    /// Horisontal scroll med naturlig bredde — bryter aldri på iPhone.
    private func chipPicker<C: View>(_ label: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label.uppercased()).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) { content() }
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
    }

    private func selectChip(text: String, icon: String, tint: Color, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.appScaled(size: 10, weight: .bold))
                Text(text).font(.appScaled(size: 11, weight: .semibold))
            }
            .foregroundStyle(active ? .white : LBrand.textSecondary)
            .padding(.horizontal, 11).padding(.vertical, 6)
            .background(active ? tint.opacity(0.30) : LBrand.cardHi, in: Capsule())
            .overlay(Capsule().stroke(active ? tint.opacity(0.55) : LBrand.stroke, lineWidth: 1))
        }.buttonStyle(.plain)
    }
}

// MARK: - LeadbookFeedbackInboxSheet — «Mine tilbakemeldinger» (2026-07-17)

/// Samleflate for all tilbakemelding på innlogget selgers eksempler.
/// Tap på rad → åpner eksempelets detail-sheet hvis eksempelet er lastet;
/// ellers ekspanderes raden inline med svar-tråd + svar-composer.
struct LeadbookFeedbackInboxSheet: View {
    let items: [APIClient.LeadbookExampleFeedbackDTO]
    var resolveExample: (String) -> LeadbookExample?
    var onOpenExample: (LeadbookExample) -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var expandedId: String?
    @State private var replyText = ""
    @State private var isSendingReply = false
    @State private var extraReplies: [String: [APIClient.LeadbookFeedbackReplyDTO]] = [:]
    @State private var locallyRead: Set<String> = []
    @State private var toast: String?
    @FocusState private var replyFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                if items.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "tray")
                            .font(.appScaled(size: 32)).foregroundStyle(LBrand.textTertiary)
                        Text("Ingen tilbakemeldinger enda")
                            .font(.appScaled(size: 15, weight: .bold)).foregroundStyle(.white)
                        Text("Når ledelsen kommenterer eksemplene dine, dukker de opp her.")
                            .font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, 30)
                } else {
                    ScrollView {
                        VStack(spacing: 10) {
                            ForEach(items) { fb in row(fb) }
                            Color.clear.frame(height: 12)
                        }
                        .padding(DeviceIdiom.isPhone ? 12 : 16)
                    }
                }
            }
            .navigationTitle("Mine tilbakemeldinger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
            }
            .overlay(alignment: .top) {
                if let t = toast {
                    Label(t, systemImage: "checkmark.circle.fill")
                        .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(LBrand.green, in: Capsule())
                        .padding(.top, 6)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        }
    }

    // MARK: Rad

    private func row(_ fb: APIClient.LeadbookExampleFeedbackDTO) -> some View {
        let isExpanded = expandedId == fb.id
        let unread = fb.readAt == nil && !locallyRead.contains(fb.id)
        let replies = fb.replies + (extraReplies[fb.id] ?? [])
        return VStack(alignment: .leading, spacing: 8) {
            Button { rowTapped(fb) } label: {
                HStack(alignment: .top, spacing: 10) {
                    // Ulest-dot
                    Circle()
                        .fill(unread ? LBrand.red : Color.clear)
                        .frame(width: 8, height: 8)
                        .padding(.top, 5)
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 6) {
                            Text(fb.exampleTitle ?? "Eksempel")
                                .font(.appScaled(size: 13, weight: .bold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Spacer()
                            if let rel = LeadbookFeedbackFormat.relativeDate(fb.createdAt) {
                                Text(rel).font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
                            }
                            Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(LBrand.textTertiary)
                        }
                        HStack(spacing: 6) {
                            Text(fb.authorName)
                                .font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(LBrand.textSecondary)
                                .lineLimit(1)
                            Text(LeadbookFeedbackFormat.roleLabel(fb.authorRole))
                                .font(.appScaled(size: 8, weight: .black)).tracking(0.4)
                                .foregroundStyle(LBrand.purpleLight)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(LBrand.purple.opacity(0.15), in: Capsule())
                            Spacer()
                        }
                        // Dimensjon- + anker-chips
                        if fb.dimension != nil || fb.transcriptIndex != nil {
                            HStack(spacing: 6) {
                                if let dim = LeadbookFeedbackFormat.dimension(fb.dimension) {
                                    HStack(spacing: 4) {
                                        Image(systemName: dim.icon).font(.appScaled(size: 9, weight: .bold))
                                        Text(dim.rawValue).font(.appScaled(size: 10, weight: .bold))
                                    }
                                    .foregroundStyle(LBrand.purpleLight)
                                    .padding(.horizontal, 7).padding(.vertical, 3)
                                    .background(LBrand.purple.opacity(0.12), in: Capsule())
                                }
                                if let idx = fb.transcriptIndex {
                                    HStack(spacing: 4) {
                                        Image(systemName: "quote.opening").font(.appScaled(size: 9, weight: .bold))
                                        Text((fb.atSec ?? 0) > 0
                                             ? "Replikk \(idx + 1) · \(LeadbookFeedbackFormat.minSec(fb.atSec ?? 0))"
                                             : "Replikk \(idx + 1)")
                                            .font(.appScaled(size: 10, weight: .bold))
                                    }
                                    .foregroundStyle(LBrand.blue)
                                    .padding(.horizontal, 7).padding(.vertical, 3)
                                    .background(LBrand.blue.opacity(0.12), in: Capsule())
                                }
                            }
                        }
                        // Utdrag (full tekst når ekspandert)
                        Text(fb.body)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(.white)
                            .lineLimit(isExpanded ? nil : 2)
                            .fixedSize(horizontal: false, vertical: true)
                        if !replies.isEmpty && !isExpanded {
                            HStack(spacing: 4) {
                                Image(systemName: "arrowshape.turn.up.left.fill")
                                    .font(.appScaled(size: 9, weight: .bold))
                                Text("\(replies.count) svar").font(.appScaled(size: 10, weight: .bold))
                            }
                            .foregroundStyle(LBrand.purpleLight)
                        }
                    }
                }
            }
            .buttonStyle(.plain)
            if isExpanded {
                // Svar-tråd + composer inline (eksempelet er ikke lastet lokalt)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(replies) { r in inboxReplyRow(r) }
                    inboxReplyComposer(fb)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(unread ? LBrand.purple.opacity(0.4) : LBrand.stroke, lineWidth: 1))
    }

    private func rowTapped(_ fb: APIClient.LeadbookExampleFeedbackDTO) {
        // Hopp til eksempelet hvis det er lastet i fanen
        if let exId = fb.exampleId, let ex = resolveExample(exId) {
            onOpenExample(ex)
            return
        }
        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
            expandedId = (expandedId == fb.id) ? nil : fb.id
        }
        replyText = ""
        // Innboksen er selger-scopet (backend) → ekspandering = lest
        markRead(fb)
    }

    private func markRead(_ fb: APIClient.LeadbookExampleFeedbackDTO) {
        guard fb.readAt == nil, !locallyRead.contains(fb.id), let api = appState.api else { return }
        locallyRead.insert(fb.id)
        Task { try? await api.markLeadbookFeedbackRead(feedbackId: fb.id) }
    }

    // MARK: Svar (inline)

    private func inboxReplyRow(_ r: APIClient.LeadbookFeedbackReplyDTO) -> some View {
        let isSeller = r.authorRole.lowercased() == "selger"
        return HStack(alignment: .top, spacing: 8) {
            ZStack {
                Circle().fill((isSeller ? LBrand.blue : LBrand.purple).opacity(0.22))
                Text(LeadbookFeedbackFormat.initials(r.authorName))
                    .font(.appScaled(size: 8, weight: .black))
                    .foregroundStyle(isSeller ? LBrand.blue : LBrand.purpleLight)
            }
            .frame(width: 22, height: 22)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(r.authorName)
                        .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                    Text(LeadbookFeedbackFormat.roleLabel(r.authorRole))
                        .font(.appScaled(size: 8, weight: .black)).tracking(0.4)
                        .foregroundStyle(isSeller ? LBrand.blue : LBrand.purpleLight)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background((isSeller ? LBrand.blue : LBrand.purple).opacity(0.15), in: Capsule())
                    Spacer()
                    if let rel = LeadbookFeedbackFormat.relativeDate(r.createdAt) {
                        Text(rel).font(.appScaled(size: 9)).foregroundStyle(LBrand.textTertiary)
                    }
                }
                Text(r.body)
                    .font(.appScaled(size: 11)).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(8)
        .background(LBrand.bg.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
        .padding(.leading, 18)
    }

    private func inboxReplyComposer(_ fb: APIClient.LeadbookExampleFeedbackDTO) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Svar \(fb.authorName)…", text: $replyText, axis: .vertical)
                .lineLimit(1...4)
                .font(.appScaled(size: 12)).foregroundStyle(.white).textFieldStyle(.plain)
                .focused($replyFocused)
                .padding(8)
                .background(LBrand.bg.opacity(0.6), in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(LBrand.stroke, lineWidth: 1))
            Button { Task { await sendReply(fb) } } label: {
                Group {
                    if isSendingReply {
                        ProgressView().tint(.white).scaleEffect(0.7)
                    } else {
                        Image(systemName: "paperplane.fill").font(.appScaled(size: 12, weight: .bold))
                    }
                }
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(
                    LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Circle()
                )
                .opacity(replyDisabled ? 0.45 : 1)
            }
            .buttonStyle(.plain)
            .disabled(replyDisabled)
            .accessibilityLabel("Send svar")
        }
        .padding(.leading, 18)
    }

    private var replyDisabled: Bool {
        replyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSendingReply
    }

    @MainActor
    private func sendReply(_ fb: APIClient.LeadbookExampleFeedbackDTO) async {
        guard let api = appState.api else { return }
        let text = replyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSendingReply else { return }
        isSendingReply = true
        do {
            try await api.replyToLeadbookFeedback(feedbackId: fb.id, body: text)
            // Innboksen er selger-scopet → optimistisk svar som «selger»
            extraReplies[fb.id, default: []].append(APIClient.LeadbookFeedbackReplyDTO(
                id: UUID().uuidString,
                authorName: appState.displayName,
                authorRole: "selger",
                body: text,
                createdAt: ISO8601DateFormatter().string(from: Date())
            ))
            replyText = ""
            toast = "Svar sendt — \(fb.authorName) varsles"
        } catch {
            toast = "Kunne ikke svare — prøv igjen"
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
        isSendingReply = false
    }
}
