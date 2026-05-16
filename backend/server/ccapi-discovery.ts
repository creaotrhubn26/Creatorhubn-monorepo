/**
 * ccapi-discovery.ts
 *
 * Active subnet-scanner for Canon CCAPI-kameraer. Sender parallelle HTTPS-
 * probes mot /ccapi-endpoint på hver IP i et lokalt subnet. Treffer
 * kameraer som svarer på CCAPI, uavhengig av om de annonserer via mDNS.
 *
 * Begrensninger:
 *   - Bare kameraer på samme subnet som server kan oppdages
 *   - For prod-deploy på Render: backend er ikke på lokalt-nett, så
 *     discovery er kun nyttig i dev eller på-set-mac/iPad-instans
 *   - Workaround for prod: iPad CaptureApp scanner LAN og POSTer funne
 *     kameraer til /api/ccapi/connect mot backend
 *
 * mDNS-alternativet vurdert men droppet:
 *   - bonjour-service / mdns npm-pakker krever native build som har
 *     feilet tidligere
 *   - Raw dgram-implementasjon er ~150 LOC og fragil mot Canon's faktiske
 *     advertisement-format som varierer per modell
 *   - Active scanning er forutsigbart og enkelt å feilsøke
 */

import os from "os";
import { Agent } from "undici";

export interface DiscoveredCamera {
  ipAddress: string;
  port: number;
  /** Fra /ccapi-respons hvis tilgjengelig */
  supportedVersions: string[];
  /** Fra /deviceinformation hvis vi rakk å hente den */
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  /** Tidspunkt for vellykket probe */
  discoveredAt: string;
}

interface ScanOptions {
  /** Eksplisitt subnet å skanne (f.eks. '192.168.1') — utleder fra interfaces hvis null */
  subnet?: string;
  /** Port å probe — Canon AP-mode bruker 443 */
  port?: number;
  /** Max ms per probe */
  probeTimeoutMs?: number;
  /** Max parallelle probes */
  concurrency?: number;
}

/**
 * Finn lokale IPv4-interfaces (ikke-loopback) og returnér /24-subnets.
 * Eksempel: 192.168.1.5 → '192.168.1'
 */
function getLocalSubnets(): string[] {
  const subnets = new Set<string>();
  for (const ifaces of Object.values(os.networkInterfaces())) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      const parts = iface.address.split(".");
      if (parts.length !== 4) continue;
      subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
    }
  }
  // Canon AP-mode default subnet — alltid forsøk denne også
  subnets.add("192.168.1");
  return Array.from(subnets);
}

/**
 * Én HTTPS-probe mot https://ipAddress:port/ccapi.
 * Returnér null hvis ikke et CCAPI-kamera, eller DiscoveredCamera hvis det er.
 */
async function probeOne(
  ipAddress: string,
  port: number,
  timeoutMs: number,
): Promise<DiscoveredCamera | null> {
  const agent = new Agent({
    connect: { rejectUnauthorized: false, timeout: timeoutMs },
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://${ipAddress}:${port}/ccapi`, {
      method: "GET",
      signal: controller.signal,
      dispatcher: agent,
    } as RequestInit & { dispatcher: Agent });

    if (!response.ok) return null;
    const body = (await response.json()) as { apis?: Record<string, unknown> };
    if (!body.apis || typeof body.apis !== "object") return null;

    const supportedVersions = Object.keys(body.apis).filter((k) => k.startsWith("ver"));
    const camera: DiscoveredCamera = {
      ipAddress,
      port,
      supportedVersions,
      discoveredAt: new Date().toISOString(),
    };

    // Best-effort: hent device-info for model/serial-info
    try {
      const devResponse = await fetch(
        `https://${ipAddress}:${port}/ccapi/ver100/deviceinformation`,
        {
          method: "GET",
          signal: AbortSignal.timeout(timeoutMs),
          dispatcher: agent,
        } as RequestInit & { dispatcher: Agent },
      );
      if (devResponse.ok) {
        const info = (await devResponse.json()) as {
          manufacturer?: string;
          productname?: string;
          serialnumber?: string;
          firmwareversion?: string;
        };
        camera.manufacturer = info.manufacturer;
        camera.model = info.productname;
        camera.serialNumber = info.serialnumber;
        camera.firmwareVersion = info.firmwareversion;
      }
    } catch {
      // device-info er valgfri — kameraet er fortsatt oppdaget
    }

    return camera;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Skannér én eller flere /24-subnets. Returnerer alle funne kameraer.
 * Krever ~5 sek for én /24-skannning med concurrency=32.
 */
export async function discoverCcapiCameras(
  options: ScanOptions = {},
): Promise<DiscoveredCamera[]> {
  const port = options.port ?? 443;
  const timeoutMs = options.probeTimeoutMs ?? 2000;
  const concurrency = options.concurrency ?? 32;
  const subnets = options.subnet ? [options.subnet] : getLocalSubnets();

  if (subnets.length === 0) return [];

  const found: DiscoveredCamera[] = [];

  // Generer alle target-IP-er
  const targets: string[] = [];
  for (const subnet of subnets) {
    for (let host = 1; host <= 254; host++) {
      targets.push(`${subnet}.${host}`);
    }
  }

  // Run probes med concurrency-grense (simple chunking)
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((ip) => probeOne(ip, port, timeoutMs)),
    );
    for (const result of results) {
      if (result) found.push(result);
    }
  }

  return found;
}
