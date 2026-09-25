// NarratorVoiceSettingsSection.swift
//
// «Stemme» (Daniel 25.09.2026): norsk har to Soniox-stemmer med norsk
// aksent, Hazel og Walter, som vises med norske navn (Hedda og Vidar).
// Listen og navnene kommer fra backend (`voices` i områdesvaret,
// SENSEAID_VOICE_CATALOG i backend/server/reiseguide-config.ts), så
// seksjonen vises bare når språket har mer enn én stemme. Et nytt valg
// henter området på nytt med `?voice=`, så lyd og teksting følger stemmen.
//
// Tilgjengelighet: hver rad leses som «Hedda, kvinnestemme», så valget gir
// mening uten å høre stemmen først.

import SwiftUI

struct NarratorVoiceSettingsSection: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.contrastColors) private var contrast

    var body: some View {
        let voices = env.store.response?.voices ?? []
        if voices.count > 1 {
            Section {
                Picker("settings.voice.label", selection: selection(in: voices)) {
                    ForEach(voices) { voice in
                        Text(label(for: voice)).tag(voice.id)
                    }
                }
                .pickerStyle(.navigationLink)
            } header: {
                Text("settings.voice")
            } footer: {
                Text("settings.voice.footer")
                    .foregroundStyle(contrast.textSecondary)
            }
        }
    }

    /// Valgt stemme hvis språket har den, ellers standardstemmen (den første).
    private func selection(in voices: [GuideVoice]) -> Binding<String> {
        Binding(
            get: {
                if let chosen = env.settings.narratorVoiceId, voices.contains(where: { $0.id == chosen }) {
                    return chosen
                }
                return voices.first?.id ?? ""
            },
            set: { choose($0) }
        )
    }

    private func choose(_ voiceId: String) {
        guard voiceId != env.store.narratorVoice else { return }
        env.settings.narratorVoiceId = voiceId
        env.store.narratorVoice = voiceId
        Task { await env.store.load(lang: env.settings.guideLanguage) }
    }

    private func label(for voice: GuideVoice) -> String {
        let genderKey: String
        switch voice.gender {
        case "female": genderKey = "voice.gender.female"
        case "male": genderKey = "voice.gender.male"
        default: return voice.name
        }
        return "\(voice.name), \(L10n.string(genderKey, lang: env.settings.uiLanguage))"
    }
}
