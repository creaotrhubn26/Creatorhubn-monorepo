/**
 * Equipment Intelligence Service
 *
 * Six production-grade intelligence engines:
 *   1. Predictive Failure Detection   – thermal / battery / shutter risk scoring
 *   2. Gear Compatibility Engine      – mount, voltage, battery, I/O validation
 *   3. Weight & Load Simulation       – rig weight vs payload limits
 *   4. Scene Continuity Tracker       – exact gear per scene for matching
 *   5. Equipment Memory Engine        – learns user gear preferences per scene
 *   6. Style Memory Engine            – discovers creative signature patterns
 *   + Explanation Layer               – human-readable reasoning for every suggestion
 */

import { Pool } from 'pg';

// ─────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────

export interface Explanation {
  summary: string;
  factors: string[];
  confidence: number; // 0–1
}

export interface PredictiveRisk {
  equipmentId: string;
  name: string;
  brand: string;
  model: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskPercent: number;
  risks: Array<{
    type: 'overheating' | 'battery_failure' | 'shutter_wear' | 'general_wear' | 'maintenance_overdue';
    probability: number;
    description: string;
    recommendation: string;
  }>;
  explanation: Explanation;
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: Array<{
    type: 'mount_mismatch' | 'power_mismatch' | 'overweight' | 'io_shortage' | 'media_incompatible';
    severity: 'error' | 'warning' | 'info';
    message: string;
  }>;
  details: Record<string, unknown>;
  explanation: Explanation;
}

export interface LoadSimulation {
  totalWeightG: number;
  maxPayloadG: number | null;
  utilizationPercent: number | null;
  safetyMargin: 'safe' | 'near_limit' | 'over_limit' | 'unknown';
  items: Array<{
    brand: string;
    model: string;
    weightG: number;
    isPayloadCarrier: boolean;
  }>;
  warnings: string[];
  explanation: Explanation;
}

export interface SceneContinuityEntry {
  id: string;
  projectId: string;
  sceneNumber: number | null;
  sceneLabel: string;
  sceneType: string;
  gearSetup: Record<string, { id?: string; brand: string; model: string }>;
  lightingSetup: Record<string, unknown> | null;
  audioSetup: Record<string, unknown> | null;
  shootDate: string;
  notes: string | null;
}

export interface EquipmentPreference {
  category: string;
  topChoices: Array<{
    brand: string;
    model: string;
    usageCount: number;
    percentage: number;
  }>;
  sceneTypes: string[];
}

export interface StylePattern {
  pattern: string;
  confidence: number;
  evidenceCount: number;
  explanation: string;
}

export interface StyleProfile {
  totalProjects: number;
  totalScenesLogged: number;
  scenePreferences: Record<string, Record<string, string>>;
  styleSignals: Record<string, string>;
  discoveredPatterns: StylePattern[];
  computedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Thermal model constants (camera-specific baselines)
// ─────────────────────────────────────────────────────────────

const THERMAL_PROFILES: Record<string, { maxOpTemp: number; baseRiskPerDeg: number; continuousLimitHrs: number }> = {
  'CANON|EOSR5':       { maxOpTemp: 40, baseRiskPerDeg: 0.04, continuousLimitHrs: 1.5 },
  'CANON|EOSR5C':      { maxOpTemp: 40, baseRiskPerDeg: 0.02, continuousLimitHrs: 6 },
  'CANON|EOSC70':      { maxOpTemp: 40, baseRiskPerDeg: 0.01, continuousLimitHrs: 12 },
  'SONY|FX6':          { maxOpTemp: 40, baseRiskPerDeg: 0.008, continuousLimitHrs: 12 },
  'SONY|FX3':          { maxOpTemp: 40, baseRiskPerDeg: 0.015, continuousLimitHrs: 8 },
  'SONY|A7SIII':       { maxOpTemp: 40, baseRiskPerDeg: 0.02, continuousLimitHrs: 4 },
  'SONY|A7IV':         { maxOpTemp: 40, baseRiskPerDeg: 0.025, continuousLimitHrs: 2 },
  'BLACKMAGIC|BMPCC6KG2': { maxOpTemp: 35, baseRiskPerDeg: 0.03, continuousLimitHrs: 3 },
  'PANASONIC|GH6':     { maxOpTemp: 40, baseRiskPerDeg: 0.015, continuousLimitHrs: 6 },
  'FUJIFILM|XH2S':     { maxOpTemp: 40, baseRiskPerDeg: 0.018, continuousLimitHrs: 5 },
  'RED|VRAPTOR':       { maxOpTemp: 45, baseRiskPerDeg: 0.005, continuousLimitHrs: 12 },
};

const SHUTTER_LIFETIME: Record<string, number> = {
  // Typical mechanical shutter life ratings
  default: 300000,
  'SONY|FX6': 500000, 'SONY|FX3': 500000,
  'CANON|EOSR5': 500000, 'CANON|EOSC70': 500000,
  'RED|VRAPTOR': 1000000, // electronic shutter
};

// ─────────────────────────────────────────────────────────────
// Lens Mount Compatibility Matrix
// ─────────────────────────────────────────────────────────────

/** Adapted mounts: key = body mount, value = lens mounts that can be adapted */
const MOUNT_ADAPTERS: Record<string, string[]> = {
  'RF':  ['EF', 'PL'],              // Canon RF can use EF & PL via adapters
  'E':   ['A', 'EF', 'PL'],         // Sony E can use A-mount, EF, PL
  'L':   ['EF', 'PL'],              // Panasonic/Sigma L-mount
  'MFT': ['EF', 'PL'],              // MFT can adapt EF & PL
  'Z':   ['F', 'EF'],               // Nikon Z can use F-mount & EF
  'X':   [],                        // Fuji X limited adaptation
  'PL':  [],                        // PL is the target, not source usually
  'EF':  [],                        // EF bodies can't adapt much
};

// ═══════════════════════════════════════════════════════════════
// Service Class
// ═══════════════════════════════════════════════════════════════

export class EquipmentIntelligenceService {
  constructor(private pool: Pool) {}

  // ─────────────────────────────────────────────────────────────
  // 1. PREDICTIVE FAILURE DETECTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Compute risk assessment for a single piece of equipment given
   * upcoming shoot conditions.
   */
  async predictFailure(
    equipmentId: string,
    userId: string,
    conditions?: { ambientTempC?: number; plannedDurationHrs?: number }
  ): Promise<PredictiveRisk> {
    // Fetch equipment info
    const eqRes = await this.pool.query(
      `SELECT id, brand, model, category, condition, firmware_current,
              serial_number, name,
              COALESCE(firmware_track_key, '') as track_key
       FROM (
         SELECT id::text, brand, model, category, condition,
                COALESCE(firmware_current, firmware_version) as firmware_current,
                serial_number, COALESCE(name, brand || ' ' || model) as name,
                firmware_track_key
         FROM user_equipment WHERE id::text = $1 AND user_id = $2
         UNION ALL
         SELECT id::text, COALESCE(brand,''), COALESCE(model,''), COALESCE(category,''),
                condition, NULL, serial_number, name, NULL
         FROM casting_equipment WHERE id::text = $1
       ) eq LIMIT 1`,
      [equipmentId, userId]
    );

    if (eqRes.rows.length === 0) {
      throw new Error(`Equipment ${equipmentId} not found`);
    }
    const eq = eqRes.rows[0];

    // Fetch health metrics
    const healthRes = await this.pool.query(
      'SELECT * FROM equipment_health_metrics WHERE equipment_id = $1',
      [equipmentId]
    );
    const health = healthRes.rows[0] || {};

    // Fetch usage history
    const usageRes = await this.pool.query(
      `SELECT COUNT(*) as shoot_count,
              SUM(duration_hours) as total_hours,
              MAX(ambient_temp_c) as max_temp,
              AVG(duration_hours) as avg_duration
       FROM equipment_usage_log WHERE equipment_id = $1`,
      [equipmentId]
    );
    const usage = usageRes.rows[0] || {};

    const risks: PredictiveRisk['risks'] = [];
    const factors: string[] = [];
    const ambient = conditions?.ambientTempC ?? 25;
    const planned = conditions?.plannedDurationHrs ?? 4;
    const trackKey = eq.track_key || `${(eq.brand || '').toUpperCase()}|${(eq.model || '').replace(/\s+/g, '').toUpperCase()}`;

    // ── Thermal Risk ──
    const thermal = THERMAL_PROFILES[trackKey];
    if (thermal) {
      const tempOverage = Math.max(0, ambient - thermal.maxOpTemp);
      const durationRatio = planned / thermal.continuousLimitHrs;
      const overheatingEvents = Number(health.overheating_events) || 0;
      const historyFactor = Math.min(overheatingEvents * 0.05, 0.3);

      let heatProb = thermal.baseRiskPerDeg * Math.max(0, ambient - 20) + (durationRatio > 1 ? (durationRatio - 1) * 0.25 : 0) + historyFactor;
      if (tempOverage > 0) heatProb += tempOverage * 0.08;
      heatProb = Math.min(heatProb, 0.99);

      if (heatProb > 0.1) {
        risks.push({
          type: 'overheating',
          probability: Math.round(heatProb * 100),
          description: `${Math.round(heatProb * 100)}% sannsynlighet for overheating ved ${ambient}°C i ${planned} timer kontinuerlig opptak.`,
          recommendation: heatProb > 0.5
            ? 'Bruk ekstern kjøling (vifteløsning), planlegg pauser hvert 30. minutt, eller bruk et kamera med bedre termisk ytelse.'
            : 'Planlegg korte pauser hvert 45. minutt for å la kameraet kjøle seg ned.',
        });
        factors.push(`Termisk profil: ${trackKey} (maks ${thermal.maxOpTemp}°C, kontinuerlig grense ${thermal.continuousLimitHrs}t)`);
        factors.push(`Omgivelsestemperatur: ${ambient}°C, planlagt varighet: ${planned}t`);
        if (overheatingEvents > 0) factors.push(`Tidligere overheating-hendelser: ${overheatingEvents}`);
      }
    }

    // ── Battery Risk ──
    const batteryCycles = Number(health.battery_cycles) || 0;
    const batteryHealth = Number(health.battery_health_pct) || 100;
    if (batteryCycles > 300 || batteryHealth < 70) {
      const battProb = Math.min(
        ((batteryCycles > 300 ? (batteryCycles - 300) / 200 : 0) + (batteryHealth < 70 ? (70 - batteryHealth) / 50 : 0)) * 0.5,
        0.95
      );
      if (battProb > 0.05) {
        risks.push({
          type: 'battery_failure',
          probability: Math.round(battProb * 100),
          description: `Batteriets helse er ${batteryHealth}% etter ${batteryCycles} sykluser. Risiko for uventet spenningsfall.`,
          recommendation: batteryHealth < 50
            ? 'Bytt batteri umiddelbart. Bruk samtidig ekstern strøm som backup.'
            : 'Ha ekstra fulladede batterier tilgjengelig. Vurder batteribytte snart.',
        });
        factors.push(`Batterisykluser: ${batteryCycles}, helse: ${batteryHealth}%`);
      }
    }

    // ── Shutter Wear ──
    const shutterCount = Number(health.shutter_count) || 0;
    const shutterLife = SHUTTER_LIFETIME[trackKey] || SHUTTER_LIFETIME.default;
    if (shutterCount > shutterLife * 0.6) {
      const shutterProb = Math.min((shutterCount / shutterLife) * 0.7, 0.95);
      risks.push({
        type: 'shutter_wear',
        probability: Math.round(shutterProb * 100),
        description: `Utløserteller: ${shutterCount.toLocaleString()} av ${shutterLife.toLocaleString()} estimert levetid (${Math.round(shutterCount / shutterLife * 100)}%).`,
        recommendation: shutterCount > shutterLife * 0.85
          ? 'Planlegg utløserbytte ASAP. Bruk elektronisk lukker der mulig for å spare mekanisk.'
          : 'Overvåk utløsertelleren. Vurder å bruke elektronisk lukker oftere.',
      });
      factors.push(`Utløserteller: ${shutterCount.toLocaleString()} / ${shutterLife.toLocaleString()}`);
    }

    // ── General Wear ──
    const totalHours = Number(health.total_runtime_hours) || Number(usage.total_hours) || 0;
    const repairCount = Number(health.repair_count) || 0;
    const condition = eq.condition || 'good';

    if (repairCount >= 2 || condition === 'poor' || condition === 'needs_repair') {
      const wearProb = Math.min(
        (repairCount * 0.1 + (condition === 'needs_repair' ? 0.4 : condition === 'poor' ? 0.25 : condition === 'fair' ? 0.1 : 0)),
        0.9
      );
      risks.push({
        type: 'general_wear',
        probability: Math.round(wearProb * 100),
        description: `${repairCount} reparasjoner registrert, tilstand: ${condition}. Totalt ${totalHours.toFixed(0)} driftstimer.`,
        recommendation: wearProb > 0.5
          ? 'Vurder å erstatte dette utstyret. Ha backup tilgjengelig for kritiske shoots.'
          : 'Utfør full service-sjekk før neste store produksjon.',
      });
      factors.push(`Reparasjoner: ${repairCount}, tilstand: ${condition}, driftstimer: ${totalHours.toFixed(0)}`);
    }

    // ── Maintenance Overdue ──
    // Check user_equipment maintenance fields
    const maintRes = await this.pool.query(
      `SELECT next_maintenance, last_maintenance, maintenance_interval
       FROM user_equipment WHERE id::text = $1 AND user_id = $2`,
      [equipmentId, userId]
    );
    if (maintRes.rows.length > 0) {
      const m = maintRes.rows[0];
      if (m.next_maintenance && new Date(m.next_maintenance) < new Date()) {
        const daysOverdue = Math.floor((Date.now() - new Date(m.next_maintenance).getTime()) / 86400000);
        const maintProb = Math.min(0.2 + daysOverdue * 0.005, 0.8);
        risks.push({
          type: 'maintenance_overdue',
          probability: Math.round(maintProb * 100),
          description: `Vedlikehold er ${daysOverdue} dager forsinket.`,
          recommendation: 'Utfør planlagt vedlikehold så snart som mulig for å unngå uventet svikt.',
        });
        factors.push(`Vedlikehold forfalt: ${daysOverdue} dager siden`);
      }
    }

    // Compute overall risk
    const maxProb = risks.length > 0 ? Math.max(...risks.map((r) => r.probability)) : 0;
    const riskLevel: PredictiveRisk['riskLevel'] =
      maxProb >= 70 ? 'critical' : maxProb >= 45 ? 'high' : maxProb >= 20 ? 'medium' : 'low';

    return {
      equipmentId,
      name: eq.name || `${eq.brand} ${eq.model}`,
      brand: eq.brand,
      model: eq.model,
      riskLevel,
      riskPercent: maxProb,
      risks,
      explanation: {
        summary: risks.length === 0
          ? `${eq.name || eq.brand + ' ' + eq.model} viser ingen vesentlige risikoer under gitte forhold.`
          : `${risks.length} risikoer identifisert for ${eq.name || eq.brand + ' ' + eq.model}. Høyeste risiko: ${maxProb}%.`,
        factors: factors.length > 0 ? factors : ['Ingen risikofaktorer registrert'],
        confidence: Math.min(0.4 + (Number(usage.shoot_count) || 0) * 0.05 + (health.battery_cycles ? 0.1 : 0) + (health.shutter_count ? 0.1 : 0), 0.95),
      },
    };
  }

  /**
   * Batch risk assessment for all user equipment.
   */
  async predictAllFailures(
    userId: string,
    conditions?: { ambientTempC?: number; plannedDurationHrs?: number }
  ): Promise<PredictiveRisk[]> {
    const eqRes = await this.pool.query(
      `SELECT id::text FROM user_equipment WHERE user_id = $1
       UNION ALL
       SELECT id::text FROM casting_equipment WHERE created_by = $1`,
      [userId]
    );
    const results: PredictiveRisk[] = [];
    for (const row of eqRes.rows) {
      try {
        results.push(await this.predictFailure(row.id, userId, conditions));
      } catch { /* skip items we can't evaluate */ }
    }
    return results.sort((a, b) => b.riskPercent - a.riskPercent);
  }

  // ─────────────────────────────────────────────────────────────
  // Health metrics CRUD
  // ─────────────────────────────────────────────────────────────

  async upsertHealthMetrics(equipmentId: string, userId: string, data: Partial<{
    battery_cycles: number;
    battery_health_pct: number;
    max_recorded_temp_c: number;
    overheating_events: number;
    shutter_count: number;
    total_runtime_hours: number;
    total_power_on_cycles: number;
    repair_count: number;
    last_repair_date: string;
    last_repair_notes: string;
  }>): Promise<void> {
    const fields = Object.entries(data).filter(([, v]) => v !== undefined && v !== null);
    if (fields.length === 0) return;

    const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ');
    const values = fields.map(([, v]) => v);

    await this.pool.query(
      `INSERT INTO equipment_health_metrics (equipment_id, user_id, ${fields.map(([k]) => k).join(', ')}, updated_at)
       VALUES ($1, $2, ${fields.map((_, i) => `$${i + 3}`).join(', ')}, now())
       ON CONFLICT (equipment_id)
       DO UPDATE SET ${setClauses}, updated_at = now()`,
      [equipmentId, userId, ...values]
    );
  }

  async getHealthMetrics(equipmentId: string): Promise<Record<string, unknown> | null> {
    const res = await this.pool.query(
      'SELECT * FROM equipment_health_metrics WHERE equipment_id = $1',
      [equipmentId]
    );
    return res.rows[0] || null;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. GEAR COMPATIBILITY ENGINE
  // ─────────────────────────────────────────────────────────────

  /**
   * Check compatibility between a camera body and a lens.
   */
  async checkLensCompatibility(
    cameraSpec: { brand: string; model: string },
    lensSpec: { brand: string; model: string }
  ): Promise<CompatibilityResult> {
    const [camRes, lensRes] = await Promise.all([
      this.pool.query('SELECT * FROM gear_compatibility_specs WHERE brand ILIKE $1 AND model ILIKE $2', [cameraSpec.brand, cameraSpec.model]),
      this.pool.query('SELECT * FROM gear_compatibility_specs WHERE brand ILIKE $1 AND model ILIKE $2', [lensSpec.brand, lensSpec.model]),
    ]);

    const cam = camRes.rows[0];
    const lens = lensRes.rows[0];
    const issues: CompatibilityResult['issues'] = [];
    const factors: string[] = [];

    if (!cam || !lens) {
      return {
        compatible: true,
        issues: [{ type: 'mount_mismatch', severity: 'info', message: 'Spesifikasjoner mangler i databasen — kan ikke verifisere kompatibilitet.' }],
        details: { camera: cam || null, lens: lens || null },
        explanation: {
          summary: 'Kunne ikke verifisere kompatibilitet — utstyret er ikke i spesifikasjonsdatabasen ennå.',
          factors: ['Legg til spesifikasjoner for nøyaktig sjekk'],
          confidence: 0.1,
        },
      };
    }

    // Mount compatibility check
    const bodyMount = cam.lens_mount;
    const lensMount = lens.lens_mount;

    if (bodyMount && lensMount) {
      const nativeCompat = bodyMount === lensMount;
      const adapterCompat = (MOUNT_ADAPTERS[bodyMount] || []).includes(lensMount);

      if (!nativeCompat && !adapterCompat) {
        issues.push({
          type: 'mount_mismatch',
          severity: 'error',
          message: `${lensSpec.brand} ${lensSpec.model} (${lensMount}-mount) passer IKKE på ${cameraSpec.brand} ${cameraSpec.model} (${bodyMount}-mount). Ingen kjent adapter finnes.`,
        });
        factors.push(`Kamera-mount: ${bodyMount}, Objektiv-mount: ${lensMount} — inkompatibel`);
      } else if (!nativeCompat && adapterCompat) {
        issues.push({
          type: 'mount_mismatch',
          severity: 'warning',
          message: `${lensMount}-mount objektiv krever adapter for ${bodyMount}-mount kamera. Autofokus og stabilisering kan bli begrenset.`,
        });
        factors.push(`${lensMount} → ${bodyMount} adapter tilgjengelig, men med mulige begrensninger`);
      } else {
        factors.push(`Native ${bodyMount}-mount kompatibilitet ✓`);
      }
    }

    const compatible = !issues.some((i) => i.severity === 'error');

    return {
      compatible,
      issues,
      details: {
        camera: { mount: bodyMount, brand: cam.brand, model: cam.model },
        lens: { mount: lensMount, brand: lens.brand, model: lens.model },
        adapterPossible: bodyMount && lensMount ? (MOUNT_ADAPTERS[bodyMount] || []).includes(lensMount) : false,
      },
      explanation: {
        summary: compatible
          ? issues.length > 0
            ? `Kompatibel med adapter: ${lensSpec.brand} ${lensSpec.model} kan brukes på ${cameraSpec.brand} ${cameraSpec.model} med adapter.`
            : `Full kompatibilitet: ${lensSpec.brand} ${lensSpec.model} passer nativt på ${cameraSpec.brand} ${cameraSpec.model}.`
          : `Ikke kompatibel: ${lensSpec.brand} ${lensSpec.model} passer ikke på ${cameraSpec.brand} ${cameraSpec.model}.`,
        factors,
        confidence: 0.95,
      },
    };
  }

  /**
   * Check if a complete rig has enough battery power for a planned shoot.
   */
  async checkBatteryEndurance(
    equipmentIds: string[],
    plannedHours: number
  ): Promise<{
    sufficient: boolean;
    totalWattHours: number;
    totalConsumption: number;
    estimatedRuntime: number;
    details: Array<{ brand: string; model: string; wattage: number | null; batteryType: string | null }>;
    explanation: Explanation;
  }> {
    if (equipmentIds.length === 0) {
      return { sufficient: true, totalWattHours: 0, totalConsumption: 0, estimatedRuntime: Infinity, details: [], explanation: { summary: 'Ingen utstyr valgt.', factors: [], confidence: 0 } };
    }
    const res = await this.pool.query(
      `SELECT brand, model, wattage, battery_type, voltage
       FROM gear_compatibility_specs
       WHERE (brand || ' ' || model) IN (${equipmentIds.map((_, i) => `$${i + 1}`).join(',')})
          OR id::text = ANY($${equipmentIds.length + 1}::text[])`,
      [...equipmentIds.map((id) => id), equipmentIds]
    );

    const items = res.rows;
    const totalWattage = items.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r.wattage) || 0), 0);

    // Estimate: typical production battery = 98Wh (V-Mount) or 16.4Wh (NP-F570)
    // This is a simplified model — real implementation would track actual battery inventory
    const estimatedBatteryWh = totalWattage > 50 ? 98 : 16.4; // rough heuristic
    const estimatedRuntime = totalWattage > 0 ? estimatedBatteryWh / totalWattage : Infinity;

    return {
      sufficient: estimatedRuntime >= plannedHours,
      totalWattHours: estimatedBatteryWh,
      totalConsumption: totalWattage,
      estimatedRuntime: Math.round(estimatedRuntime * 10) / 10,
      details: items.map((r: Record<string, unknown>) => ({
        brand: r.brand as string,
        model: r.model as string,
        wattage: r.wattage as number | null,
        batteryType: r.battery_type as string | null,
      })),
      explanation: {
        summary: totalWattage > 0
          ? `Total strømforbruk: ${totalWattage}W. Estimert driftstid: ${Math.round(estimatedRuntime * 10) / 10} timer.`
          : 'Ingen strøminformasjon tilgjengelig for valgt utstyr.',
        factors: items.map((r: Record<string, unknown>) => `${r.brand} ${r.model}: ${r.wattage || '?'}W (${r.battery_type || 'ukjent batteri'})`),
        confidence: items.length > 0 ? 0.7 : 0.1,
      },
    };
  }

  /**
   * Check I/O compatibility — do we have enough XLR inputs, HDMI outputs, etc.
   */
  async checkIOCompatibility(
    recorderSpec: { brand: string; model: string },
    sourceSpecs: Array<{ brand: string; model: string; connectionType: string }>
  ): Promise<CompatibilityResult> {
    const recRes = await this.pool.query(
      'SELECT * FROM gear_compatibility_specs WHERE brand ILIKE $1 AND model ILIKE $2',
      [recorderSpec.brand, recorderSpec.model]
    );

    const recorder = recRes.rows[0];
    const issues: CompatibilityResult['issues'] = [];
    const factors: string[] = [];

    if (!recorder) {
      return {
        compatible: true,
        issues: [{ type: 'io_shortage', severity: 'info', message: 'Opptakerens spesifikasjoner er ikke i databasen.' }],
        details: {},
        explanation: { summary: 'Kan ikke verifisere I/O-kompatibilitet uten spesifikasjoner.', factors: [], confidence: 0.1 },
      };
    }

    const inputs: string[] = Array.isArray(recorder.inputs) ? recorder.inputs : JSON.parse(recorder.inputs || '[]');
    const inputCounts: Record<string, number> = {};
    for (const inp of inputs) {
      const match = inp.match(/^(.+?)\s*x(\d+)$/);
      if (match) {
        inputCounts[match[1]] = (inputCounts[match[1]] || 0) + Number(match[2]);
      } else {
        inputCounts[inp] = (inputCounts[inp] || 0) + 1;
      }
    }

    // Count required inputs by type
    const requiredCounts: Record<string, number> = {};
    for (const src of sourceSpecs) {
      requiredCounts[src.connectionType] = (requiredCounts[src.connectionType] || 0) + 1;
    }

    for (const [connType, needed] of Object.entries(requiredCounts)) {
      const available = inputCounts[connType] || 0;
      if (available < needed) {
        issues.push({
          type: 'io_shortage',
          severity: 'error',
          message: `${recorderSpec.brand} ${recorderSpec.model} har ${available} ${connType}-inngang(er), men du trenger ${needed}. Mangler ${needed - available}.`,
        });
        factors.push(`${connType}: trengs ${needed}, tilgjengelig ${available}`);
      } else {
        factors.push(`${connType}: ${needed} av ${available} brukt ✓`);
      }
    }

    const compatible = !issues.some((i) => i.severity === 'error');

    return {
      compatible,
      issues,
      details: { availableInputs: inputCounts, requiredInputs: requiredCounts },
      explanation: {
        summary: compatible
          ? `${recorderSpec.brand} ${recorderSpec.model} har nok tilkoblinger for oppsettet ditt.`
          : `${recorderSpec.brand} ${recorderSpec.model} mangler tilkoblinger. Vurder en ekstern forforsterker eller splitter.`,
        factors,
        confidence: 0.9,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. WEIGHT & LOAD SIMULATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Calculate total rig weight and compare against carrier limits.
   */
  async simulateLoad(
    equipmentList: Array<{ brand: string; model: string }>,
    carrierId?: string // e.g. gimbal or drone brand+model
  ): Promise<LoadSimulation> {
    if (equipmentList.length === 0) {
      return {
        totalWeightG: 0, maxPayloadG: null, utilizationPercent: null,
        safetyMargin: 'unknown', items: [], warnings: [],
        explanation: { summary: 'Ingen utstyr valgt.', factors: [], confidence: 0 },
      };
    }

    // Fetch weights for all items
    const placeholders = equipmentList.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const params = equipmentList.flatMap((e) => [e.brand, e.model]);

    const res = await this.pool.query(
      `SELECT g.brand, g.model, g.weight_g, g.max_payload_g, g.category
       FROM gear_compatibility_specs g
       JOIN (VALUES ${placeholders}) AS v(b, m) ON g.brand ILIKE v.b AND g.model ILIKE v.m`,
      params
    );

    const itemMap = new Map<string, Record<string, unknown>>();
    for (const row of res.rows) {
      itemMap.set(`${row.brand}|${row.model}`, row);
    }

    const items: LoadSimulation['items'] = [];
    let totalWeight = 0;
    const warnings: string[] = [];

    for (const eq of equipmentList) {
      const spec = itemMap.get(`${eq.brand}|${eq.model}`);
      const w = spec ? Number(spec.weight_g) || 0 : 0;
      const isCarrier = spec ? ['stabilizer', 'drone'].includes(spec.category as string) : false;
      items.push({ brand: eq.brand, model: eq.model, weightG: w, isPayloadCarrier: isCarrier });
      if (!isCarrier) totalWeight += w;
      if (!spec) warnings.push(`Vekt ukjent for ${eq.brand} ${eq.model} — ikke i spesifikasjonsdatabasen.`);
    }

    // Find carrier
    let carrier: Record<string, unknown> | null = null;
    if (carrierId) {
      const [cBrand, cModel] = carrierId.split('|');
      const cRes = await this.pool.query(
        'SELECT * FROM gear_compatibility_specs WHERE brand ILIKE $1 AND model ILIKE $2',
        [cBrand || '', cModel || '']
      );
      carrier = cRes.rows[0] || null;
    } else {
      // Auto-detect carrier from the list
      carrier = res.rows.find((r: Record<string, unknown>) => ['stabilizer', 'drone'].includes(r.category as string)) || null;
    }

    const maxPayload = carrier ? Number(carrier.max_payload_g) || null : null;
    const util = maxPayload ? Math.round((totalWeight / maxPayload) * 100) : null;
    const safetyMargin: LoadSimulation['safetyMargin'] =
      maxPayload === null ? 'unknown'
        : totalWeight > maxPayload ? 'over_limit'
          : totalWeight > maxPayload * 0.9 ? 'near_limit'
            : 'safe';

    if (safetyMargin === 'over_limit') {
      warnings.push(`⚠️ OVERBELASTET: Totalvekt ${(totalWeight / 1000).toFixed(1)}kg overstiger maks payload ${(maxPayload! / 1000).toFixed(1)}kg med ${((totalWeight - maxPayload!) / 1000).toFixed(1)}kg.`);
    } else if (safetyMargin === 'near_limit') {
      warnings.push(`⚠️ Nær grensen: ${(totalWeight / 1000).toFixed(1)}kg av ${(maxPayload! / 1000).toFixed(1)}kg (${util}%). Motorsystemet kan oppleve økt slitasje.`);
    }

    const factors = items.map((i) =>
      `${i.brand} ${i.model}: ${i.weightG > 0 ? `${(i.weightG / 1000).toFixed(2)}kg` : 'ukjent vekt'}${i.isPayloadCarrier ? ' (bærer)' : ''}`
    );

    return {
      totalWeightG: totalWeight,
      maxPayloadG: maxPayload,
      utilizationPercent: util,
      safetyMargin,
      items,
      warnings,
      explanation: {
        summary: carrier
          ? `Totalvekt: ${(totalWeight / 1000).toFixed(1)}kg på ${carrier.brand} ${carrier.model} (maks ${maxPayload ? (maxPayload / 1000).toFixed(1) + 'kg' : 'ukjent'}).`
          : `Total utstyrsvekt: ${(totalWeight / 1000).toFixed(1)}kg. Ingen gimbal/drone valgt som bærer.`,
        factors,
        confidence: items.filter((i) => i.weightG > 0).length / Math.max(items.length, 1),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. SCENE CONTINUITY TRACKER
  // ─────────────────────────────────────────────────────────────

  async logSceneGear(data: {
    projectId: string;
    userId: string;
    sceneNumber?: number;
    sceneLabel: string;
    sceneType: string;
    gearSetup: Record<string, { id?: string; brand: string; model: string }>;
    lightingSetup?: Record<string, unknown>;
    audioSetup?: Record<string, unknown>;
    notes?: string;
    shootDate?: string;
  }): Promise<{ id: string }> {
    const res = await this.pool.query(
      `INSERT INTO scene_gear_assignments
         (project_id, user_id, scene_number, scene_label, scene_type, gear_setup, lighting_setup, audio_setup, notes, shoot_date, equipment_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        data.projectId, data.userId, data.sceneNumber || null, data.sceneLabel, data.sceneType,
        JSON.stringify(data.gearSetup), JSON.stringify(data.lightingSetup || null),
        JSON.stringify(data.audioSetup || null), data.notes || null,
        data.shootDate || new Date().toISOString().slice(0, 10),
        Object.values(data.gearSetup).filter((g) => g.id).map((g) => g.id),
      ]
    );
    return { id: res.rows[0].id };
  }

  async getSceneContinuity(projectId: string): Promise<SceneContinuityEntry[]> {
    const res = await this.pool.query(
      `SELECT * FROM scene_gear_assignments WHERE project_id = $1 ORDER BY scene_number, shoot_date`,
      [projectId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      sceneNumber: r.scene_number,
      sceneLabel: r.scene_label,
      sceneType: r.scene_type,
      gearSetup: r.gear_setup || {},
      lightingSetup: r.lighting_setup,
      audioSetup: r.audio_setup,
      shootDate: r.shoot_date,
      notes: r.notes,
    }));
  }

  /**
   * Find continuity breaks — scenes shot on different days with different gear.
   */
  async detectContinuityBreaks(projectId: string): Promise<Array<{
    sceneLabel: string;
    entries: Array<{ date: string; camera: string; lens: string }>;
    issue: string;
  }>> {
    const scenes = await this.getSceneContinuity(projectId);
    const byLabel = new Map<string, typeof scenes>();

    for (const s of scenes) {
      const list = byLabel.get(s.sceneLabel) || [];
      list.push(s);
      byLabel.set(s.sceneLabel, list);
    }

    const breaks: Array<{ sceneLabel: string; entries: Array<{ date: string; camera: string; lens: string }>; issue: string }> = [];

    for (const [label, entries] of byLabel) {
      if (entries.length < 2) continue;

      const setups = entries.map((e) => ({
        date: e.shootDate,
        camera: e.gearSetup?.camera ? `${e.gearSetup.camera.brand} ${e.gearSetup.camera.model}` : 'ukjent',
        lens: e.gearSetup?.lens ? `${e.gearSetup.lens.brand} ${e.gearSetup.lens.model}` : 'ingen',
      }));

      const cameras = new Set(setups.map((s) => s.camera));
      const lenses = new Set(setups.map((s) => s.lens));

      if (cameras.size > 1 || lenses.size > 1) {
        breaks.push({
          sceneLabel: label,
          entries: setups,
          issue: cameras.size > 1
            ? `Scenen "${label}" bruker ulike kameraer (${[...cameras].join(', ')}). Fargesammensetning kan bli inkonsistent.`
            : `Scenen "${label}" bruker ulike objektiver (${[...lenses].join(', ')}). Dybdeskarphet og perspektiv kan variere.`,
        });
      }
    }

    return breaks;
  }

  // ─────────────────────────────────────────────────────────────
  // 5. EQUIPMENT MEMORY ENGINE
  // ─────────────────────────────────────────────────────────────

  async logUsage(data: {
    userId: string;
    equipmentId: string;
    projectId?: string;
    sceneType?: string;
    sceneLabel?: string;
    category: string;
    brand: string;
    model: string;
    lensMm?: number;
    durationHours?: number;
    ambientTempC?: number;
    notes?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO equipment_usage_log
         (user_id, equipment_id, project_id, scene_type, scene_label, category, brand, model, lens_mm, duration_hours, ambient_temp_c, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        data.userId, data.equipmentId, data.projectId || null,
        data.sceneType || null, data.sceneLabel || null,
        data.category, data.brand, data.model,
        data.lensMm || null, data.durationHours || 0,
        data.ambientTempC || null, data.notes || null,
      ]
    );
  }

  /**
   * Analyze user's equipment usage to find preferences per scene type.
   */
  async getEquipmentPreferences(userId: string): Promise<EquipmentPreference[]> {
    const res = await this.pool.query(
      `SELECT category, brand, model, scene_type,
              COUNT(*) as usage_count
       FROM equipment_usage_log
       WHERE user_id = $1
       GROUP BY category, brand, model, scene_type
       ORDER BY category, usage_count DESC`,
      [userId]
    );

    if (res.rows.length === 0) return [];

    const byCategory = new Map<string, Array<{ brand: string; model: string; count: number; scenes: Set<string> }>>();

    for (const row of res.rows) {
      const cat = row.category;
      const list = byCategory.get(cat) || [];
      const existing = list.find((e) => e.brand === row.brand && e.model === row.model);
      if (existing) {
        existing.count += Number(row.usage_count);
        if (row.scene_type) existing.scenes.add(row.scene_type);
      } else {
        list.push({
          brand: row.brand,
          model: row.model,
          count: Number(row.usage_count),
          scenes: new Set(row.scene_type ? [row.scene_type] : []),
        });
      }
      byCategory.set(cat, list);
    }

    return [...byCategory.entries()].map(([category, items]) => {
      const totalUsage = items.reduce((s, i) => s + i.count, 0);
      items.sort((a, b) => b.count - a.count);
      return {
        category,
        topChoices: items.slice(0, 5).map((i) => ({
          brand: i.brand,
          model: i.model,
          usageCount: i.count,
          percentage: Math.round((i.count / totalUsage) * 100),
        })),
        sceneTypes: [...new Set(items.flatMap((i) => [...i.scenes]))],
      };
    });
  }

  /**
   * Get equipment recommendation for a specific scene type based on user history.
   */
  async getMemoryBasedRecommendation(
    userId: string,
    sceneType: string
  ): Promise<{
    recommendations: Array<{ category: string; brand: string; model: string; usageCount: number; reason: string }>;
    explanation: Explanation;
  }> {
    const res = await this.pool.query(
      `SELECT category, brand, model, COUNT(*) as times_used,
              ROUND(AVG(duration_hours)::numeric, 1) as avg_duration
       FROM equipment_usage_log
       WHERE user_id = $1 AND scene_type = $2
       GROUP BY category, brand, model
       ORDER BY times_used DESC`,
      [userId, sceneType]
    );

    if (res.rows.length === 0) {
      return {
        recommendations: [],
        explanation: {
          summary: `Ingen brukerhistorikk for ${sceneType}-scener ennå. Bruk utstyr i denne scene-typen for å få personlige anbefalinger.`,
          factors: [],
          confidence: 0,
        },
      };
    }

    const recommendations = res.rows.slice(0, 10).map((r) => ({
      category: r.category,
      brand: r.brand,
      model: r.model,
      usageCount: Number(r.times_used),
      reason: `Brukt ${r.times_used} ganger i ${sceneType}-scener (snitt ${r.avg_duration || 0} timer per økt).`,
    }));

    const factors = recommendations.map((r) => `${r.brand} ${r.model} (${r.category}): ${r.usageCount} ganger`);

    return {
      recommendations,
      explanation: {
        summary: `Basert på ${res.rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.times_used), 0)} registrerte ${sceneType}-økter: dine mest brukte verktøy identifisert.`,
        factors,
        confidence: Math.min(0.3 + res.rows.length * 0.05, 0.9),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 6. STYLE MEMORY ENGINE
  // ─────────────────────────────────────────────────────────────

  /**
   * Recompute the user's creative style profile from all usage data.
   */
  async computeStyleProfile(userId: string): Promise<StyleProfile> {
    // Count projects and scenes
    const countsRes = await this.pool.query(
      `SELECT
         COUNT(DISTINCT project_id) as total_projects,
         COUNT(*) as total_scenes,
         COUNT(DISTINCT scene_type) as unique_scene_types
       FROM equipment_usage_log WHERE user_id = $1`,
      [userId]
    );
    const counts = countsRes.rows[0] || { total_projects: 0, total_scenes: 0, unique_scene_types: 0 };

    // Scene preferences: top gear per scene type per category
    const prefRes = await this.pool.query(
      `SELECT scene_type, category, brand, model,
              COUNT(*) as times_used,
              ROW_NUMBER() OVER (PARTITION BY scene_type, category ORDER BY COUNT(*) DESC) as rank
       FROM equipment_usage_log
       WHERE user_id = $1 AND scene_type IS NOT NULL
       GROUP BY scene_type, category, brand, model`,
      [userId]
    );

    const scenePreferences: Record<string, Record<string, string>> = {};
    for (const row of prefRes.rows) {
      if (Number(row.rank) === 1 && Number(row.times_used) >= 2) {
        if (!scenePreferences[row.scene_type]) scenePreferences[row.scene_type] = {};
        scenePreferences[row.scene_type][row.category] = `${row.brand} ${row.model}`;
      }
    }

    // Discover style signals
    const styleSignals: Record<string, string> = {};
    const discoveredPatterns: StylePattern[] = [];

    // Lens preference analysis
    const lensRes = await this.pool.query(
      `SELECT lens_mm, COUNT(*) as times_used
       FROM equipment_usage_log
       WHERE user_id = $1 AND lens_mm IS NOT NULL AND category = 'lens'
       GROUP BY lens_mm ORDER BY times_used DESC`,
      [userId]
    );
    if (lensRes.rows.length > 0) {
      const topLens = lensRes.rows[0];
      const totalLens = lensRes.rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.times_used), 0);
      const pct = Math.round((Number(topLens.times_used) / totalLens) * 100);
      if (pct >= 40) {
        const mm = Number(topLens.lens_mm);
        const style = mm <= 24 ? 'ultra_wide' : mm <= 35 ? 'wide' : mm <= 50 ? 'standard' : mm <= 85 ? 'portrait' : 'telephoto';
        styleSignals.lens_preference = `${mm}mm (${style})`;
        discoveredPatterns.push({
          pattern: `Du velger ${mm}mm i ${pct}% av tilfellene.`,
          confidence: pct / 100,
          evidenceCount: Number(topLens.times_used),
          explanation: `Av ${totalLens} objektiv-logginger er ${mm}mm det klart mest brukte (${topLens.times_used} ganger).`,
        });
      }
    }

    // Lens per scene type analysis
    const lensSceneRes = await this.pool.query(
      `SELECT scene_type, lens_mm, COUNT(*) as times_used
       FROM equipment_usage_log
       WHERE user_id = $1 AND lens_mm IS NOT NULL AND scene_type IS NOT NULL
       GROUP BY scene_type, lens_mm
       ORDER BY scene_type, times_used DESC`,
      [userId]
    );
    const lensSceneMap = new Map<string, Array<{ mm: number; count: number }>>();
    for (const row of lensSceneRes.rows) {
      const list = lensSceneMap.get(row.scene_type) || [];
      list.push({ mm: Number(row.lens_mm), count: Number(row.times_used) });
      lensSceneMap.set(row.scene_type, list);
    }
    for (const [scene, entries] of lensSceneMap) {
      if (entries.length >= 2) {
        const top = entries[0];
        const second = entries[1];
        const total = entries.reduce((s, e) => s + e.count, 0);
        if (top.count >= 3 && (top.count / total) >= 0.6) {
          discoveredPatterns.push({
            pattern: `For ${scene}-scener velger du konsekvent ${top.mm}mm over ${second.mm}mm.`,
            confidence: top.count / total,
            evidenceCount: top.count,
            explanation: `${top.count} av ${total} ${scene}-scener bruker ${top.mm}mm (${Math.round(top.count / total * 100)}%).`,
          });
        }
      }
    }

    // Camera preference per shooting condition
    const camRes = await this.pool.query(
      `SELECT brand, model, COUNT(*) as times_used,
              ROUND(AVG(duration_hours)::numeric, 1) as avg_hrs
       FROM equipment_usage_log
       WHERE user_id = $1 AND category = 'camera'
       GROUP BY brand, model
       ORDER BY times_used DESC`,
      [userId]
    );
    if (camRes.rows.length >= 2) {
      const top = camRes.rows[0];
      const total = camRes.rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.times_used), 0);
      const pct = Math.round((Number(top.times_used) / total) * 100);
      if (pct >= 50) {
        styleSignals.camera_preference = `${top.brand} ${top.model}`;
        discoveredPatterns.push({
          pattern: `Ditt primærkamera er ${top.brand} ${top.model} (brukt i ${pct}% av shoots).`,
          confidence: pct / 100,
          evidenceCount: Number(top.times_used),
          explanation: `Av ${total} camera-logginger er ${top.brand} ${top.model} mest brukt (${top.times_used} ganger, snitt ${top.avg_hrs} timer).`,
        });
      }
    }

    // Lighting style analysis
    const lightRes = await this.pool.query(
      `SELECT brand, model, COUNT(*) as times_used
       FROM equipment_usage_log
       WHERE user_id = $1 AND category = 'lighting'
       GROUP BY brand, model ORDER BY times_used DESC`,
      [userId]
    );
    if (lightRes.rows.length > 0) {
      const totalLight = lightRes.rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.times_used), 0);
      // Heuristic: large lights (>= 300W) = studio/heavy; small panels/tubes = naturalistic
      const heavyBrands = ['Aputure 600d', 'Aputure 300d', 'Nanlite Forza'];
      const heavyUsage = lightRes.rows
        .filter((r: Record<string, unknown>) => heavyBrands.some((b) => `${r.brand} ${r.model}`.includes(b)))
        .reduce((s: number, r: Record<string, unknown>) => s + Number(r.times_used), 0);

      if (totalLight >= 3) {
        const heavyPct = Math.round((heavyUsage / totalLight) * 100);
        if (heavyPct < 30) {
          styleSignals.lighting_style = 'naturalistisk';
          discoveredPatterns.push({
            pattern: 'Ditt mønster tyder på en naturalistisk belysningsstil.',
            confidence: (100 - heavyPct) / 100,
            evidenceCount: totalLight,
            explanation: `Bare ${heavyPct}% av din lysbruk er tungt studioutstyr. Du foretrekker lettere, mer naturlig lys.`,
          });
        } else if (heavyPct >= 70) {
          styleSignals.lighting_style = 'studio';
          discoveredPatterns.push({
            pattern: 'Du foretrekker en kontrollert studio-belysningsstil.',
            confidence: heavyPct / 100,
            evidenceCount: totalLight,
            explanation: `${heavyPct}% av din lysbruk er tungt studioutstyr (600d, 300d, Forza-klassen).`,
          });
        } else {
          styleSignals.lighting_style = 'hybrid';
        }
      }
    }

    // Overall style summary
    const allProjects = Number(counts.total_projects) || 0;
    if (allProjects >= 5) {
      const styleDesc = [];
      if (styleSignals.lighting_style) styleDesc.push(`${styleSignals.lighting_style} belysning`);
      if (styleSignals.lens_preference) styleDesc.push(`preferanse for ${styleSignals.lens_preference}`);
      if (styleSignals.camera_preference) styleDesc.push(`primærkamera: ${styleSignals.camera_preference}`);
      if (styleDesc.length > 0) {
        discoveredPatterns.push({
          pattern: `Din kreative signatur: ${styleDesc.join(', ')}.`,
          confidence: Math.min(0.5 + allProjects * 0.03, 0.95),
          evidenceCount: allProjects,
          explanation: `Oppdaget etter ${allProjects} prosjekter og ${counts.total_scenes} scene-logginger.`,
        });
      }
    }

    // Save computed profile
    await this.pool.query(
      `INSERT INTO user_style_profile (user_id, total_projects, total_scenes_logged, scene_preferences, style_signals, discovered_patterns, computed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       ON CONFLICT (user_id)
       DO UPDATE SET total_projects = $2, total_scenes_logged = $3, scene_preferences = $4,
                     style_signals = $5, discovered_patterns = $6, computed_at = now(), updated_at = now()`,
      [
        userId,
        allProjects,
        Number(counts.total_scenes) || 0,
        JSON.stringify(scenePreferences),
        JSON.stringify(styleSignals),
        JSON.stringify(discoveredPatterns),
      ]
    );

    return {
      totalProjects: allProjects,
      totalScenesLogged: Number(counts.total_scenes) || 0,
      scenePreferences,
      styleSignals,
      discoveredPatterns,
      computedAt: new Date().toISOString(),
    };
  }

  async getStyleProfile(userId: string): Promise<StyleProfile | null> {
    const res = await this.pool.query(
      'SELECT * FROM user_style_profile WHERE user_id = $1',
      [userId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      totalProjects: r.total_projects,
      totalScenesLogged: r.total_scenes_logged,
      scenePreferences: r.scene_preferences || {},
      styleSignals: r.style_signals || {},
      discoveredPatterns: r.discovered_patterns || [],
      computedAt: r.computed_at?.toISOString?.() || r.computed_at,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // EXPLANATION LAYER — builds rich explanations for suggestions
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate a detailed explanation for why a specific piece of equipment
   * is recommended for a given scene.
   */
  async explainRecommendation(
    userId: string,
    sceneType: string,
    equipment: { brand: string; model: string; category: string },
    context?: { actorCount?: number; mood?: string; previousSceneLens?: string }
  ): Promise<Explanation> {
    const factors: string[] = [];

    // 1. Scene requirement match
    factors.push(`${equipment.category} er ${sceneType}-scener krever denne kategorien.`);

    // 2. User history
    const memoryRes = await this.pool.query(
      `SELECT COUNT(*) as times_used FROM equipment_usage_log
       WHERE user_id = $1 AND scene_type = $2
         AND brand = $3 AND model = $4`,
      [userId, sceneType, equipment.brand, equipment.model]
    );
    const timesUsed = Number(memoryRes.rows[0]?.times_used) || 0;
    if (timesUsed > 0) {
      factors.push(`Du har brukt ${equipment.brand} ${equipment.model} i ${timesUsed} tidligere ${sceneType}-scener.`);
    }

    // 3. Contextual factors
    if (context?.actorCount) {
      if (context.actorCount <= 2 && equipment.category === 'lens') {
        factors.push(`${context.actorCount} skuespillere — tettere brennvidde anbefales for intimitet.`);
      } else if (context.actorCount > 4) {
        factors.push(`${context.actorCount} skuespillere — vidvinkel kan være nødvendig.`);
      }
    }

    if (context?.mood) {
      factors.push(`Stemning: "${context.mood}" — påvirker valg av lys og objektiv.`);
    }

    if (context?.previousSceneLens) {
      factors.push(`Forrige scene brukte ${context.previousSceneLens} — vurder visuell kontinuitet.`);
    }

    // 4. Style profile match
    const style = await this.getStyleProfile(userId);
    if (style && style.scenePreferences[sceneType]?.[equipment.category]) {
      const pref = style.scenePreferences[sceneType][equipment.category];
      if (`${equipment.brand} ${equipment.model}` === pref) {
        factors.push(`Matcher din foretrukne ${equipment.category} for ${sceneType}-scener.`);
      }
    }

    const confidence = Math.min(0.3 + factors.length * 0.1 + (timesUsed > 0 ? 0.2 : 0), 0.95);

    return {
      summary: `Anbefalt ${equipment.brand} ${equipment.model} fordi: ${factors.slice(0, 3).join('. ')}.`,
      factors,
      confidence,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // COMPATIBILITY SPECS CRUD
  // ─────────────────────────────────────────────────────────────

  async getCompatibilitySpecs(filters?: { category?: string; brand?: string }): Promise<Array<Record<string, unknown>>> {
    let query = 'SELECT * FROM gear_compatibility_specs WHERE 1=1';
    const params: string[] = [];
    if (filters?.category) { params.push(filters.category); query += ` AND category = $${params.length}`; }
    if (filters?.brand) { params.push(filters.brand); query += ` AND brand ILIKE $${params.length}`; }
    query += ' ORDER BY category, brand, model';
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async upsertCompatibilitySpec(data: {
    brand: string; model: string; category: string;
    lens_mount?: string; battery_type?: string; voltage?: number; wattage?: number;
    weight_g?: number; max_payload_g?: number;
    inputs?: string[]; outputs?: string[]; media_slots?: string[];
    mounting_standard?: string; thread_size?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO gear_compatibility_specs
         (brand, model, category, lens_mount, battery_type, voltage, wattage, weight_g, max_payload_g, inputs, outputs, media_slots, mounting_standard, thread_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (brand, model)
       DO UPDATE SET category = $3, lens_mount = COALESCE($4, gear_compatibility_specs.lens_mount),
         battery_type = COALESCE($5, gear_compatibility_specs.battery_type),
         voltage = COALESCE($6, gear_compatibility_specs.voltage),
         wattage = COALESCE($7, gear_compatibility_specs.wattage),
         weight_g = COALESCE($8, gear_compatibility_specs.weight_g),
         max_payload_g = COALESCE($9, gear_compatibility_specs.max_payload_g),
         inputs = COALESCE($10, gear_compatibility_specs.inputs),
         outputs = COALESCE($11, gear_compatibility_specs.outputs),
         media_slots = COALESCE($12, gear_compatibility_specs.media_slots),
         mounting_standard = COALESCE($13, gear_compatibility_specs.mounting_standard),
         thread_size = COALESCE($14, gear_compatibility_specs.thread_size)`,
      [
        data.brand, data.model, data.category,
        data.lens_mount || null, data.battery_type || null,
        data.voltage || null, data.wattage || null,
        data.weight_g || null, data.max_payload_g || null,
        JSON.stringify(data.inputs || []), JSON.stringify(data.outputs || []),
        JSON.stringify(data.media_slots || []),
        data.mounting_standard || null, data.thread_size || null,
      ]
    );
  }
}
