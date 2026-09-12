import SwiftUI

struct SalesManagementCoachingSheet: View {
    @Environment(\.dismiss) private var dismiss
    let members: [SalesManagementWorkspace.TeamMember]
    let onCreate: (String, String, Date, String?, String) async -> Bool

    @State private var memberId = ""
    @State private var scheduledAt = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var focus = ""
    @State private var saving = false
    @State private var idempotencyKey = UUID().uuidString

    var body: some View {
        NavigationStack {
            Form {
                Picker("Teammedlem", selection: $memberId) {
                    ForEach(members) { Text($0.name).tag($0.userId) }
                }
                DatePicker("Tidspunkt", selection: $scheduledAt, in: Date()...)
                TextField("Fokus for samtalen", text: $focus, axis: .vertical)
                    .lineLimit(2...5)
            }
            .navigationTitle("Ny 1-til-1")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Planlegger …" : "Planlegg") {
                        guard let member = members.first(where: { $0.userId == memberId }) else { return }
                        saving = true
                        Task {
                            let created = await onCreate(
                                member.userId,
                                member.name,
                                scheduledAt,
                                focus.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : focus,
                                idempotencyKey
                            )
                            if created { dismiss() } else { saving = false }
                        }
                    }.disabled(saving || memberId.isEmpty)
                }
            }
            .onAppear { memberId = memberId.isEmpty ? members.first?.userId ?? "" : memberId }
        }
    }
}
