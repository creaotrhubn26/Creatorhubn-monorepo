// LeadgridWorkflowBuilderView.swift
//
// Native iPad workflow-builder. Lar bruker velge trigger + actions.
// For raskere onboarding kan brukeren også starte fra en template
// (sendes inn ved init via `templates`).

import SwiftUI

struct LeadgridWorkflowBuilderView: View {
    let api: APIClient
    let templates: [LeadgridWorkflowTemplate]
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var description: String = ""
    @State private var triggerType: String = "lead.created"
    @State private var triggerTo: String = ""
    // mig 0350 — trigger-config-felt for 6 nye triggers
    @State private var triggerEmailId: String = ""
    @State private var triggerLinkPattern: String = ""
    @State private var triggerMeetingType: String = ""
    @State private var triggerProposalId: String = ""
    @State private var triggerContractProvider: String = ""
    @State private var actions: [BuilderActionDraft] = [
        BuilderActionDraft(type: "send_email", templateId: "")
    ]
    @State private var saving = false
    @State private var errorText: String?

    private let triggerOptions: [(String, String)] = [
        ("lead.created", "Ny lead opprettet"),
        ("lead.status_changed", "Lead-status endret"),
        ("lead.temperature_changed", "Lead-temperatur endret"),
        ("pipeline.stage_changed", "Pipeline-stage endret"),
        ("deal.probability_changed", "Deal-probability endret"),
        ("deal.amount_changed", "Deal-amount endret"),
        ("recommendation.published", "NBA publisert"),
        ("manual", "Manuelt utløst"),
        // mig 0350 — 6 nye triggers
        ("email.opened", "E-post åpnet"),
        ("email.link_clicked", "E-post-lenke klikket"),
        ("meeting.booked", "Møte booket"),
        ("meeting.no_show", "Møte no-show"),
        ("proposal.opened", "Proposal åpnet"),
        ("contract.signed", "Kontrakt signert"),
    ]
    private let actionOptions: [(String, String)] = [
        ("send_email", "Send e-post"),
        ("send_sms", "Send SMS"),
        ("send_whatsapp", "Send WhatsApp"),
        ("create_task", "Opprett oppgave"),
        ("change_pipeline_stage", "Endre pipeline-stage"),
        ("set_lead_status", "Sett lead-status"),
        ("assign_to_user", "Tildel til bruker"),
        ("add_tag", "Legg til tag"),
        ("notify_channel", "Varsle kanal"),
        ("wait", "Vent (minutter)"),
        ("ai_pitch_generate", "AI: Generer pitch"),
        // mig 0350 — 9 nye actions
        ("schedule_call", "Planlegg telefonsamtale"),
        ("book_meeting", "Book møte"),
        ("update_lead_fields", "Oppdater lead-felter"),
        ("post_to_webhook", "Post til webhook"),
        ("trigger_zapier", "Trigger Zapier"),
        ("send_internal_notification", "Intern varsling"),
        ("remove_tag", "Fjern tag"),
        ("archive_lead", "Arkiver lead"),
        ("revive_lead", "Reviviser lead"),
    ]

    private let stageOptions = [
        "new", "first_contact", "qualified", "meeting",
        "proposal", "negotiation", "won", "lost",
    ]

    var body: some View {
        NavigationStack {
            Form {
                if !templates.isEmpty {
                    Section("Start fra template (valgfritt)") {
                        ForEach(templates) { tpl in
                            Button {
                                applyTemplate(tpl)
                            } label: {
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(tpl.name).font(.subheadline)
                                        Text(tpl.description)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(2)
                                    }
                                    Spacer()
                                    Image(systemName: "arrow.up.right")
                                        .foregroundStyle(.tint)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section("Grunnleggende") {
                    TextField("Navn", text: $name)
                    TextField("Beskrivelse (valgfri)", text: $description, axis: .vertical)
                        .lineLimit(2...5)
                }

                Section("Trigger") {
                    Picker("Trigger-type", selection: $triggerType) {
                        ForEach(triggerOptions, id: \.0) {
                            Text($0.1).tag($0.0)
                        }
                    }
                    if requiresTo {
                        TextField("\"To\"-verdi (f.eks. won/hot)", text: $triggerTo)
                    }
                    // mig 0350 — trigger-config-felt
                    if triggerType == "email.opened" {
                        TextField("Email-ID (valgfri)", text: $triggerEmailId)
                    }
                    if triggerType == "email.link_clicked" {
                        TextField("URL-pattern (valgfri)", text: $triggerLinkPattern)
                    }
                    if triggerType == "meeting.booked" {
                        Picker("Møte-type (valgfri)", selection: $triggerMeetingType) {
                            Text("Alle").tag("")
                            Text("Discovery").tag("discovery")
                            Text("Demo").tag("demo")
                            Text("Closing").tag("closing")
                            Text("Followup").tag("followup")
                            Text("Annet").tag("other")
                        }
                    }
                    if triggerType == "proposal.opened" {
                        TextField("Proposal-ID (valgfri)", text: $triggerProposalId)
                    }
                    if triggerType == "contract.signed" {
                        TextField("Provider (valgfri)", text: $triggerContractProvider)
                    }
                }

                Section("Actions (kjøres i rekkefølge)") {
                    ForEach($actions) { $action in
                        ActionEditor(
                            action: $action,
                            actionOptions: actionOptions,
                            stageOptions: stageOptions,
                            onDelete: { removeAction(action.id) }
                        )
                    }
                    Button {
                        actions.append(
                            BuilderActionDraft(type: "send_email", templateId: "")
                        )
                    } label: {
                        Label("Legg til action", systemImage: "plus")
                    }
                }

                if let errorText {
                    Section {
                        Text(errorText).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Ny workflow")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if saving {
                            ProgressView()
                        } else {
                            Text("Lagre")
                        }
                    }
                    .disabled(name.isEmpty || actions.isEmpty || saving)
                }
            }
        }
    }

    private var requiresTo: Bool {
        ["lead.status_changed", "pipeline.stage_changed", "lead.temperature_changed"]
            .contains(triggerType)
    }

    private func removeAction(_ id: UUID) {
        actions.removeAll { $0.id == id }
    }

    private func applyTemplate(_ tpl: LeadgridWorkflowTemplate) {
        name = tpl.name
        description = tpl.description
        triggerType = tpl.trigger.type
        triggerTo = tpl.trigger.to ?? ""
        // mig 0350 — overfør nye trigger-config-felt
        triggerEmailId = tpl.trigger.emailId ?? ""
        triggerLinkPattern = tpl.trigger.linkUrlPattern ?? ""
        triggerMeetingType = tpl.trigger.meetingType ?? ""
        triggerProposalId = tpl.trigger.proposalId ?? ""
        triggerContractProvider = tpl.trigger.provider ?? ""
        actions = tpl.actions.map { a in
            BuilderActionDraft(
                type: a.type,
                templateId: a.templateId ?? "",
                title: a.title ?? "",
                stage: a.stage ?? "",
                userId: a.userId ?? "",
                tag: a.tag ?? "",
                channel: a.channel ?? "slack",
                messageTemplate: a.messageTemplate ?? "",
                durationMinutes: a.durationMinutes ?? 60,
                saveToNotes: a.saveToNotes ?? true,
                status: a.status ?? "",
                when: a.when ?? "",
                notes: a.notes ?? "",
                meetingType: a.meetingType ?? "discovery",
                fieldsJson: "",
                destinationId: a.destinationId ?? "",
                payloadTemplate: a.payloadTemplate ?? "",
                recipient: a.recipient ?? "owner",
                body: a.body ?? "",
                reason: a.reason ?? "",
            )
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        var triggerConfig: [String: Any] = ["type": triggerType]
        if requiresTo && !triggerTo.isEmpty {
            triggerConfig["to"] = triggerTo
        }
        // mig 0350 — nye trigger-config-felt
        if triggerType == "email.opened" && !triggerEmailId.isEmpty {
            triggerConfig["email_id"] = triggerEmailId
        }
        if triggerType == "email.link_clicked" && !triggerLinkPattern.isEmpty {
            triggerConfig["link_url_pattern"] = triggerLinkPattern
        }
        if triggerType == "meeting.booked" && !triggerMeetingType.isEmpty {
            triggerConfig["meeting_type"] = triggerMeetingType
        }
        if triggerType == "proposal.opened" && !triggerProposalId.isEmpty {
            triggerConfig["proposal_id"] = triggerProposalId
        }
        if triggerType == "contract.signed" && !triggerContractProvider.isEmpty {
            triggerConfig["provider"] = triggerContractProvider
        }
        let actionsPayload = actions.map { $0.toDict() }
        var body: [String: Any] = [
            "name": name,
            "trigger_type": triggerType,
            "trigger_config": triggerConfig,
            "conditions": [],
            "actions": actionsPayload,
        ]
        if !description.isEmpty {
            body["description"] = description
        }
        do {
            let data = try JSONSerialization.data(withJSONObject: body)
            _ = try await api.createWorkflow(jsonBody: data)
            onSaved()
        } catch {
            errorText = "Klarte ikke å lagre: \(error.localizedDescription)"
        }
    }
}

// MARK: - Action draft

struct BuilderActionDraft: Identifiable {
    let id = UUID()
    var type: String
    var templateId: String = ""
    var title: String = ""
    var stage: String = ""
    var userId: String = ""
    var tag: String = ""
    var channel: String = "slack"
    var messageTemplate: String = ""
    var durationMinutes: Int = 60
    var saveToNotes: Bool = true
    var status: String = ""
    // mig 0350 — felt for nye actions
    var when: String = ""
    var notes: String = ""
    var meetingType: String = "discovery"
    var fieldsJson: String = ""
    var destinationId: String = ""
    var payloadTemplate: String = ""
    var recipient: String = "owner"
    var body: String = ""
    var reason: String = ""

    func toDict() -> [String: Any] {
        var d: [String: Any] = ["type": type]
        switch type {
        case "send_email", "send_sms", "send_whatsapp":
            d["template_id"] = templateId
        case "create_task":
            d["title"] = title
        case "change_pipeline_stage":
            d["stage"] = stage
        case "set_lead_status":
            d["status"] = status
        case "assign_to_user":
            d["user_id"] = userId
        case "add_tag":
            d["tag"] = tag
        case "notify_channel":
            d["channel"] = channel
            d["message_template"] = messageTemplate
        case "wait":
            d["duration_minutes"] = durationMinutes
        case "ai_pitch_generate":
            d["save_to_notes"] = saveToNotes
        case "schedule_call":
            d["when"] = when
            if !notes.isEmpty { d["notes"] = notes }
        case "book_meeting":
            d["when"] = when
            d["meeting_type"] = meetingType
            d["duration_minutes"] = durationMinutes
        case "update_lead_fields":
            if let data = fieldsJson.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                d["fields"] = parsed
            } else {
                d["fields"] = [String: Any]()
            }
        case "post_to_webhook":
            d["destination_id"] = destinationId
            if !payloadTemplate.isEmpty { d["payload_template"] = payloadTemplate }
        case "trigger_zapier":
            d["destination_id"] = destinationId
        case "send_internal_notification":
            d["recipient"] = recipient
            d["title"] = title
            if !body.isEmpty { d["body"] = body }
        case "remove_tag":
            d["tag"] = tag
        case "archive_lead":
            if !reason.isEmpty { d["reason"] = reason }
        case "revive_lead":
            break
        default:
            break
        }
        return d
    }
}

// MARK: - ActionEditor

private struct ActionEditor: View {
    @Binding var action: BuilderActionDraft
    let actionOptions: [(String, String)]
    let stageOptions: [String]
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Picker("Action", selection: $action.type) {
                    ForEach(actionOptions, id: \.0) {
                        Text($0.1).tag($0.0)
                    }
                }
                Spacer()
                Button(role: .destructive) { onDelete() } label: {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
            }
            configFields
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var configFields: some View {
        switch action.type {
        case "send_email", "send_sms", "send_whatsapp":
            TextField("Template-ID", text: $action.templateId)
        case "create_task":
            TextField("Tittel", text: $action.title)
        case "change_pipeline_stage":
            Picker("Stage", selection: $action.stage) {
                Text("Velg…").tag("")
                ForEach(stageOptions, id: \.self) { Text($0).tag($0) }
            }
        case "set_lead_status":
            TextField("Status-key", text: $action.status)
        case "assign_to_user":
            TextField("Bruker-ID", text: $action.userId)
        case "add_tag":
            TextField("Tag", text: $action.tag)
        case "notify_channel":
            Picker("Kanal", selection: $action.channel) {
                Text("Slack").tag("slack")
                Text("Teams").tag("teams")
                Text("Admin-epost").tag("email_admin")
            }
            TextField("Melding", text: $action.messageTemplate, axis: .vertical)
                .lineLimit(2...4)
        case "wait":
            Stepper(
                "Vent \(action.durationMinutes) min",
                value: $action.durationMinutes,
                in: 1...(60 * 24 * 30),
            )
        case "ai_pitch_generate":
            Toggle("Lagre som lead-notat", isOn: $action.saveToNotes)

        // ── Mig 0350 ─────────────────────────────────────────────
        case "schedule_call":
            TextField("Når (ISO eller 'in_X_days')", text: $action.when)
            TextField("Notater", text: $action.notes, axis: .vertical)
                .lineLimit(1...3)
        case "book_meeting":
            Picker("Møte-type", selection: $action.meetingType) {
                Text("Discovery").tag("discovery")
                Text("Demo").tag("demo")
                Text("Closing").tag("closing")
                Text("Followup").tag("followup")
                Text("Annet").tag("other")
            }
            TextField("Når (ISO eller 'in_X_days')", text: $action.when)
            Stepper(
                "Varighet \(action.durationMinutes) min",
                value: $action.durationMinutes,
                in: 15...(60 * 8),
                step: 15,
            )
        case "update_lead_fields":
            TextField(
                "Fields JSON {\"phone\": \"+47 999\"}",
                text: $action.fieldsJson,
                axis: .vertical,
            )
            .lineLimit(2...6)
            .font(.system(.body, design: .monospaced))
        case "post_to_webhook":
            TextField("Destination ID", text: $action.destinationId)
            TextField(
                "Payload-template (valgfri)",
                text: $action.payloadTemplate,
                axis: .vertical,
            )
            .lineLimit(2...6)
        case "trigger_zapier":
            TextField("Destination ID", text: $action.destinationId)
        case "send_internal_notification":
            Picker("Mottaker", selection: $action.recipient) {
                Text("Lead owner").tag("owner")
                Text("Assignee").tag("assignee")
                Text("Manager").tag("manager")
                Text("Admin").tag("admin")
            }
            TextField("Tittel", text: $action.title)
            TextField("Body", text: $action.body, axis: .vertical)
                .lineLimit(1...4)
        case "remove_tag":
            TextField("Tag som skal fjernes", text: $action.tag)
        case "archive_lead":
            TextField("Årsak (valgfri)", text: $action.reason)
        case "revive_lead":
            Text("(ingen ekstra config)")
                .font(.caption)
                .foregroundStyle(.secondary)
        default:
            EmptyView()
        }
    }
}
