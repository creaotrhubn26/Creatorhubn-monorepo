// LeadsAddLeadSheet.swift
//
// Leadliste-wrapper rundt det kanoniske skjemaet. All state, validering,
// BRREG-oppslag og innsending eies av LeadAddFormSheet.

import SwiftUI

struct LeadsAddLeadSheet: View {
    let onSave: (LeadDraft, OfflineResilientActions.LeadCreateDisposition) -> Void

    var body: some View {
        LeadAddFormSheet(onSave: onSave)
    }
}
