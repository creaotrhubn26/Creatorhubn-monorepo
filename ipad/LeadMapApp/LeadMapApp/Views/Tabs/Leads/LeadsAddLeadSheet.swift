// LeadsAddLeadSheet.swift
//
// Leads-fanen bruker den samme Add Lead-flaten som Kart, Oversikt og
// kalenderen. Adapteren beholder den eksisterende callback-typen, mens all
// layout, validering og tilgjengelighet eies av AddLeadSheet. Det hindrer at
// mobil- og iPad-variantene driver fra hverandre igjen.

import SwiftUI
import MapKit

struct LeadsAddLeadSheet: View {
    let onSave: @MainActor (NewLeadData) async throws -> Void

    struct NewLeadData {
        let companyName: String
        let address: String
        let status: MapLeadMock.PinStatus
        let coord: CLLocationCoordinate2D
        let phone: String
        let email: String
    }

    var body: some View {
        AddLeadSheet { lead in
            try await onSave(NewLeadData(
                companyName: lead.companyName,
                address: lead.address,
                status: lead.status,
                coord: lead.coord,
                phone: lead.phone,
                email: lead.email
            ))
        }
    }
}
