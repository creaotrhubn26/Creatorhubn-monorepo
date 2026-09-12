// CrashReporterService.swift — MetricKit-basert krasjrapportering (2026-07-18).
//
// Launch-blocker fra readiness-listen: TestFlight-testere kunne ikke
// rapportere krasj skikkelig (jf. KartView-stack-overflowen som måtte
// devicectl-graves manuelt). iOS leverer MXDiagnosticPayload ved NESTE
// oppstart etter krasj/heng — vi bufrer til disk og poster til backend
// (`/api/leadgrid/crash-reports`) når en innlogget API-klient finnes.
//
// Design-valg:
//   • Fil-buffer (Application Support/CrashReports/) — ikke UserDefaults;
//     call-stack-treet kan være hundrevis av KB.
//   • Fire-and-forget flush ved app-aktivering; filene slettes KUN etter
//     bekreftet lagring server-side.
//   • Ingen ekstern avhengighet — Sentry-iOS kan legges oppå senere.
//   • MetricKit leverer ikke i simulator; ekte enhet/TestFlight kreves.

import Foundation
import MetricKit
import UIKit

final class CrashReporterService: NSObject, MXMetricManagerSubscriber, @unchecked Sendable {
    // @unchecked Sendable: all muterbar tilstand er filsystemet (atomiske
    // skriv til egne UUID-filer) — ingen delte properties å beskytte.
    static let shared = CrashReporterService()

    private var dir: URL {
        let base = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let d = base.appendingPathComponent("CrashReports", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    /// Kalles én gang ved oppstart (LeadMapApp.init-løypa).
    func start() {
        MXMetricManager.shared.add(self)
    }

    // MARK: MXMetricManagerSubscriber

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            for d in payload.crashDiagnostics ?? [] {
                buffer(kind: "crash",
                       termination: d.terminationReason ?? "",
                       signal: d.signal.map { "\($0)" } ?? "",
                       meta: d.metaData,
                       callStack: d.callStackTree.jsonRepresentation())
            }
            for d in payload.hangDiagnostics ?? [] {
                buffer(kind: "hang",
                       termination: "hang \(d.hangDuration)",
                       signal: "",
                       meta: d.metaData,
                       callStack: d.callStackTree.jsonRepresentation())
            }
            for d in payload.cpuExceptionDiagnostics ?? [] {
                buffer(kind: "cpu",
                       termination: "cpu \(d.totalCPUTime)",
                       signal: "",
                       meta: d.metaData,
                       callStack: d.callStackTree.jsonRepresentation())
            }
        }
    }

    // Metrics-payloads (ytelse) ignoreres i v1 — kun diagnostikk.
    func didReceive(_ payloads: [MXMetricPayload]) {}

    // MARK: Buffer + flush

    private func buffer(
        kind: String, termination: String, signal: String,
        meta: MXMetaData, callStack: Data
    ) {
        let stackObj = (try? JSONSerialization.jsonObject(with: callStack)) ?? [:]
        let report: [String: Any] = [
            "kind": kind,
            "termination_reason": termination,
            "signal": signal,
            "app_version": (Bundle.main.object(
                forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "",
            "build_number": meta.applicationBuildVersion,
            "os_version": meta.osVersion,
            "device_model": meta.deviceType,
            "payload": ["call_stack_tree": stackObj],
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: report) else { return }
        let file = dir.appendingPathComponent("\(UUID().uuidString).json")
        try? data.write(to: file, options: .atomic)
    }

    /// Post bufrede rapporter — kalles ved app-aktivering når API-klient
    /// finnes. Sletter filer kun etter bekreftet lagring.
    func flush(api: APIClient) {
        let files = (try? FileManager.default.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: nil)) ?? []
        guard !files.isEmpty else { return }
        let reports: [(URL, [String: Any])] = files.prefix(20).compactMap { url in
            guard let data = try? Data(contentsOf: url),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                // Uleselig fil — fjern så den ikke blokkerer køen for alltid.
                try? FileManager.default.removeItem(at: url)
                return nil
            }
            return (url, obj)
        }
        guard !reports.isEmpty else { return }
        // [String: Any] er ikke Sendable — kryss task-grensen med Data
        // (Sendable) og dekod på innsiden.
        let urls = reports.map { $0.0 }
        let encoded: [Data] = reports.compactMap {
            try? JSONSerialization.data(withJSONObject: $0.1)
        }
        guard !encoded.isEmpty else { return }
        Task.detached(priority: .utility) {
            do {
                _ = try await api.submitCrashReports(encoded: encoded)
                for url in urls {
                    try? FileManager.default.removeItem(at: url)
                }
                print("[CrashReporter] sendte \(encoded.count) rapport(er)")
            } catch {
                // Beholder filene — nytt forsøk ved neste aktivering.
            }
        }
    }
}
