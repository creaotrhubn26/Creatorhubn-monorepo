// SuperAdminHubView.swift
//
// Fase 18: Super-admin hub for Daniel's B2B-pipeline + alle superadmin-tabs.
// Vises kun hvis appState.isSuperAdmin.
//
// Daniels reasoning: "markedssjefer i andre organisasjoner er en lead for
// Leadgrid. derfor er det viktig at det finnes i appen også."

import SwiftUI

struct SuperAdminHubView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if !appState.isSuperAdmin {
                        Label("Du har ikke super-admin-tilgang.",
                              systemImage: "lock.fill")
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    HStack {
                        Image(systemName: "shield.checkered")
                            .foregroundStyle(.purple)
                        Text("Super Admin")
                    }
                }

                if let api = appState.api, appState.isSuperAdmin {
                    Section("B2B-pipeline") {
                        NavigationLink {
                            SuperAdminAgencyLeadsView(api: api)
                        } label: {
                            Label("Markedssjef-leads", systemImage: "tray.full.fill")
                        }
                        NavigationLink {
                            SuperAdminOnboardingFunnelView(api: api)
                        } label: {
                            Label("Onboarding-funnel", systemImage: "arrow.down.right.and.arrow.up.left")
                        }
                        NavigationLink {
                            SuperAdminPaymentsView(api: api)
                        } label: {
                            Label("Inntekter (MRR/ARR)", systemImage: "creditcard.fill")
                        }
                        NavigationLink {
                            SuperAdminOverageStatsView(api: api)
                        } label: {
                            Label("Overage / plan-overskridelser", systemImage: "exclamationmark.gauge")
                        }
                        NavigationLink {
                            SuperAdminB2BCockpitView(api: api)
                        } label: {
                            Label("B2B-funnel (cockpit)", systemImage: "chart.line.downtrend.xyaxis")
                        }
                        NavigationLink {
                            SuperAdminCustomerSuccessView(api: api)
                        } label: {
                            Label("Customer Success", systemImage: "heart.text.square.fill")
                        }
                        NavigationLink {
                            SuperAdminCaseStudiesView(api: api)
                        } label: {
                            Label("Case Studies", systemImage: "doc.text.image.fill")
                        }
                    }

                    // Fase 19: RBAC + nav-config + LinkedIn cockpit
                    if let orgId = appState.activeOrganizationId {
                        Section("RBAC & Organisasjon") {
                            NavigationLink {
                                SuperAdminPermissionsMatrixView(api: api, orgId: orgId)
                            } label: {
                                Label("Permissions-matrise", systemImage: "tablecells.fill")
                            }
                            NavigationLink {
                                SuperAdminPromoteMemberView(api: api, orgId: orgId)
                            } label: {
                                Label("Forfremme medlem", systemImage: "arrow.up.right.square.fill")
                            }
                            NavigationLink {
                                SuperAdminRoleNavConfigView(api: api)
                            } label: {
                                Label("Rolle-meny-config", systemImage: "rectangle.3.group.fill")
                            }
                        }
                    }

                    Section("Marketing-cockpit") {
                        NavigationLink {
                            SuperAdminLinkedInCockpitView(api: api)
                        } label: {
                            Label("LinkedIn (CAPI + Lead Sync)",
                                   systemImage: "circle.grid.cross.fill")
                        }
                    }

                    Section("WhatsApp") {
                        NavigationLink {
                            SuperAdminWaTemplatesView(api: api)
                        } label: {
                            Label("Templates", systemImage: "doc.text.fill")
                        }
                        NavigationLink {
                            SuperAdminWaOrgConfigsView(api: api)
                        } label: {
                            Label("Org-config", systemImage: "phone.fill")
                        }
                    }

                    Section("Partnere") {
                        NavigationLink {
                            SuperAdminPartnerApplicationsView(api: api)
                        } label: {
                            Label("Søknader (godkjenn)",
                                   systemImage: "person.crop.circle.badge.questionmark")
                        }
                        NavigationLink {
                            SuperAdminPartnersListView(api: api)
                        } label: {
                            Label("Godkjente partnere", systemImage: "person.2.crop.square.stack.fill")
                        }
                    }

                    Section("Infrastruktur") {
                        NavigationLink {
                            SuperAdminEmailBrandingView(api: api)
                        } label: {
                            Label("E-post-branding", systemImage: "envelope.badge.fill")
                        }
                        NavigationLink {
                            SuperAdminApiKeysView(api: api)
                        } label: {
                            Label("API-nøkler", systemImage: "key.fill")
                        }
                        NavigationLink {
                            SuperAdminWebhooksView(api: api)
                        } label: {
                            Label("Webhooks", systemImage: "link")
                        }
                        NavigationLink {
                            SuperAdminNotificationLogView(api: api)
                        } label: {
                            Label("Varsel-log", systemImage: "bell.badge.fill")
                        }
                        NavigationLink {
                            SuperAdminTestflightTestersView(api: api)
                        } label: {
                            Label("TestFlight-testere", systemImage: "airplane.circle.fill")
                        }
                    }

                    // Fase 20: Plattform-helse + Integrations
                    Section("Plattform & helse") {
                        NavigationLink {
                            SuperAdminPlatformStatusView(api: api)
                        } label: {
                            Label("Plattform-status", systemImage: "server.rack")
                        }
                        NavigationLink {
                            SuperAdminIntegrationsView(api: api)
                        } label: {
                            Label("Integrations-oversikt", systemImage: "circle.grid.cross.fill")
                        }
                        NavigationLink {
                            SuperAdminApiHealthView(api: api)
                        } label: {
                            Label("API-helse (24t)", systemImage: "waveform.path.ecg")
                        }
                        NavigationLink {
                            SuperAdminResendStatusView(api: api)
                        } label: {
                            Label("Resend (email)", systemImage: "envelope.fill")
                        }
                        NavigationLink {
                            SuperAdminMigrationsStatusView(api: api)
                        } label: {
                            Label("Migrasjoner", systemImage: "arrow.triangle.swap")
                        }
                        NavigationLink {
                            SuperAdminB2ArchiveView(api: api)
                        } label: {
                            Label("B2 Archive", systemImage: "externaldrive.connected.to.line.below")
                        }
                    }

                    // Fase 21: Vekst + Sosial + Innhold
                    Section("Vekst & innhold") {
                        NavigationLink {
                            SuperAdminLeadsGrowthView(api: api)
                        } label: {
                            Label("Leads-vekst (B2B)", systemImage: "chart.bar.fill")
                        }
                        NavigationLink {
                            SuperAdminSocialConnectionsView(api: api)
                        } label: {
                            Label("Sosiale koblinger", systemImage: "link.circle.fill")
                        }
                        NavigationLink {
                            SuperAdminPostDraftsView(api: api)
                        } label: {
                            Label("Post-drafts", systemImage: "doc.text.fill")
                        }
                        NavigationLink {
                            SuperAdminContentCalendarView(api: api)
                        } label: {
                            Label("Content-kalender", systemImage: "calendar")
                        }
                        NavigationLink {
                            SuperAdminWhatsNewView(api: api)
                        } label: {
                            Label("What's New", systemImage: "sparkles.rectangle.stack.fill")
                        }
                    }

                    // Fase 22: Observability + Market Intel + Campaigns + Org Switcher + Brand Kit
                    Section("Market Intel & Observability") {
                        NavigationLink {
                            SuperAdminObservabilityView(api: api)
                        } label: {
                            Label("Observability (errors)", systemImage: "ladybug.fill")
                        }
                        NavigationLink {
                            SuperAdminMarketScansView(api: api)
                        } label: {
                            Label("Market Scans", systemImage: "binoculars.fill")
                        }
                        NavigationLink {
                            SuperAdminCampaignsView(api: api)
                        } label: {
                            Label("Ads-kampanjer", systemImage: "megaphone.fill")
                        }
                    }

                    Section("Tilgang & merkevare") {
                        NavigationLink {
                            SuperAdminOrgSwitcherView(api: api)
                        } label: {
                            Label("Org-switcher (impersonate)", systemImage: "eye.circle.fill")
                        }
                        if let projectId = appState.activeProjectId {
                            NavigationLink {
                                SuperAdminBrandKitView(api: api, projectId: projectId)
                            } label: {
                                Label("Brand Kit (aktivt prosjekt)", systemImage: "paintpalette.fill")
                            }
                        }
                    }

                    // Fase 23: Drips/cron + Marketplace + Partner-application + Developer-application
                    Section("Cron & marketplace") {
                        NavigationLink {
                            SuperAdminDripsManagementView(api: api)
                        } label: {
                            Label("Cron / drips", systemImage: "envelope.arrow.triangle.branch.fill")
                        }
                        NavigationLink {
                            LeadgridMarketplaceView(api: api)
                        } label: {
                            Label("Marketplace", systemImage: "storefront.fill")
                        }
                        NavigationLink {
                            LeadgridPartnerApplicationView(api: api)
                        } label: {
                            Label("Min partner-søknad", systemImage: "doc.badge.gearshape")
                        }
                        NavigationLink {
                            LeadgridDeveloperApplicationView(api: api)
                        } label: {
                            Label("Utvikler-program", systemImage: "chevron.left.forwardslash.chevron.right")
                        }
                    }

                    // Fase 24: Newsletter + RR-økonomi + Outreach
                    Section("Marketing & økonomi") {
                        NavigationLink {
                            SuperAdminNewsletterView(api: api)
                        } label: {
                            Label("Newsletter (RR)", systemImage: "newspaper.fill")
                        }
                        NavigationLink {
                            SuperAdminRREconomyView(api: api)
                        } label: {
                            Label("RR-økonomi", systemImage: "chart.line.uptrend.xyaxis.circle.fill")
                        }
                        NavigationLink {
                            SuperAdminOutreachTemplatesView(api: api)
                        } label: {
                            Label("Outreach-templates", systemImage: "text.bubble.fill")
                        }
                    }

                    // Fase 25: Ad-tech-stack
                    Section("Ad-tech-stack") {
                        NavigationLink {
                            SuperAdminAdsConfigsView(api: api)
                        } label: {
                            Label("Ads-configs (klient-pixels)", systemImage: "megaphone.fill")
                        }
                        NavigationLink {
                            SuperAdminAdsApprovalsView(api: api)
                        } label: {
                            Label("Ads-godkjenninger", systemImage: "checkmark.seal.fill")
                        }
                    }
                }
            }
            .navigationTitle("Super Admin")
        }
    }
}
