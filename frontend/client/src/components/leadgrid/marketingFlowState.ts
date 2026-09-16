/**
 * marketingFlowState.ts — tilstandsmaskinen for /leadgrid/markedsforing.
 *
 * Ren og testbar: tar rå input (modul, prosjekt, status fra backend, hvilke
 * mutasjoner som kjører, postfremdrift) og gir ÉN tilstand med ÉN
 * primærhandling. Siden rendrer tilstanden; den bestemmer ingenting selv.
 *
 * Prinsipper (brukersentrert UX):
 *   - progressive disclosure: bare det aktive steget er utfoldet
 *   - én primærhandling per tilstand; alt annet er sekundært
 *   - alle tilstander er designet, ikke bare «happy path»
 */

export type MarketingFlowStep = "map" | "plan" | "posts";

export interface MarketingFlowOrganization {
  name: string | null;
  website: string | null;
  orgNumber: string | null;
  naceCode: string | null;
  naceDescription: string | null;
  industry: string | null;
  canBootstrap: boolean;
  canEditProfile: boolean;
  orgNumberEditable: boolean;
}

export interface MarketingFlowStatus {
  organization: MarketingFlowOrganization | null;
  bootstrap: {
    available: boolean;
    versionNumber: number | null;
    generatedAt: string | null;
    ready: boolean;
    missingFields: string[];
  };
  plan: { exists: false } | { exists: true; id: string; status: string; horizonDays: number };
}

export interface MarketingFlowInput {
  moduleLoading: boolean;
  moduleEnabled: boolean;
  projectId: string | null;
  statusLoading: boolean;
  statusError: { error: string; required?: string } | null;
  status: MarketingFlowStatus | null;
  mapping: boolean;
  mapFailed: boolean;
  planning: boolean;
  planFailed: boolean;
  activating: boolean;
  postsProgress: { generated: number; expected: number; complete: boolean } | null;
}

export type MarketingFlowState =
  | { kind: "locked" }
  | { kind: "no_project" }
  | { kind: "loading" }
  | { kind: "access_denied"; reason: "mangler_tillatelse" | "ikke_medlem_av_org" | "other"; required?: string; error: string }
  | { kind: "org_incomplete"; canEdit: boolean; orgNumberEditable: boolean }
  | { kind: "ready_to_map"; remap: boolean }
  | { kind: "mapping" }
  | { kind: "map_failed" }
  | { kind: "mapped_incomplete"; missing: string[] }
  | { kind: "ready_to_plan" }
  | { kind: "planning" }
  | { kind: "plan_failed" }
  | { kind: "plan_draft"; planId: string }
  | { kind: "generating_posts"; planId: string; generated: number; expected: number }
  | { kind: "active"; planId: string };

export interface MarketingFlowView {
  state: MarketingFlowState;
  /** Steget som er utfoldet i stepperen (null = steady-state / ingen stepper). */
  activeStep: MarketingFlowStep | null;
  /** Fullførte steg (vises som oppsummeringslinje). */
  completedSteps: MarketingFlowStep[];
  /** Én primærhandling — eller null når tilstanden ikke har noen (venter). */
  primaryAction: MarketingFlowAction | null;
  /** Sekundære handlinger (skjules bak overflow-meny). */
  secondaryActions: MarketingFlowAction[];
  /** Er siden i steady-state (plan aktiv med poster)? */
  steady: boolean;
}

export type MarketingFlowAction =
  | "edit_org_profile"
  | "map"
  | "remap"
  | "retry_map"
  | "generate_plan"
  | "retry_plan"
  | "activate_plan"
  | "new_plan"
  | "open_chat";

const STEP_ORDER: MarketingFlowStep[] = ["map", "plan", "posts"];

/** Menneskelige etiketter for felter kartleggingen kan mangle (readiness). */
export const MISSING_FIELD_LABELS: Record<string, { label: string; hint: string }> = {
  "companyProfile.companyName": {
    label: "Selskapsnavn",
    hint: "Legg inn navnet på organisasjonen.",
  },
  "companyProfile.industry": {
    label: "Bransje",
    hint: "Org.nr. gir bransje automatisk fra Brønnøysund. Eller skriv den her.",
  },
  "companyProfile.targetAudience": {
    label: "Målgruppe",
    hint: "Beskriv kundene med én setning, f.eks. «byggefirmaer på Østlandet med 5–50 ansatte».",
  },
  "companyProfile.toneAndBrandSignals (minst 3)": {
    label: "Tone og merkevare",
    hint: "Tre ord om hvordan dere vil fremstå, f.eks. «jordnær, presis, rask».",
  },
  "storyLogicDraft.contentStoryLogic.businessObjective": {
    label: "Forretningsmål",
    hint: "Hva markedsføringen skal oppnå, f.eks. «10 nye møter i måneden».",
  },
  "storyLogicDraft.contentStoryLogic.audienceProblem": {
    label: "Kundens problem",
    hint: "Hva kundene sliter med som dere løser.",
  },
  "storyLogicDraft.contentStoryLogic.keyPromise": {
    label: "Hovedløfte",
    hint: "Én setning om hva kunden får.",
  },
};

export function describeMissingField(key: string): { label: string; hint: string } {
  return (
    MISSING_FIELD_LABELS[key] ?? {
      label: key,
      hint: "Skriv det inn under, så tas det med i neste kartlegging.",
    }
  );
}

export function deriveMarketingFlowState(input: MarketingFlowInput): MarketingFlowView {
  const view = (
    state: MarketingFlowState,
    activeStep: MarketingFlowStep | null,
    primaryAction: MarketingFlowAction | null,
    secondaryActions: MarketingFlowAction[] = [],
  ): MarketingFlowView => {
    const activeIdx = activeStep ? STEP_ORDER.indexOf(activeStep) : STEP_ORDER.length;
    return {
      state,
      activeStep,
      completedSteps: STEP_ORDER.slice(0, activeIdx),
      primaryAction,
      secondaryActions,
      steady: state.kind === "active",
    };
  };

  if (input.moduleLoading) return view({ kind: "loading" }, null, null);
  if (!input.moduleEnabled) return view({ kind: "locked" }, null, null);
  if (!input.projectId) return view({ kind: "no_project" }, null, null);

  if (input.statusError) {
    const e = input.statusError;
    if (e.error === "module_locked") return view({ kind: "locked" }, null, null);
    const reason =
      e.error === "mangler_tillatelse" || e.error === "ikke_medlem_av_org" ? e.error : "other";
    return view({ kind: "access_denied", reason, required: e.required, error: e.error }, null, null);
  }
  if (input.statusLoading || !input.status) return view({ kind: "loading" }, null, null);

  const { status } = input;

  // ── Steg 1: kartlegging ─────────────────────────────────────────────
  if (input.mapping) return view({ kind: "mapping" }, "map", null);
  if (input.mapFailed) return view({ kind: "map_failed" }, "map", "retry_map");
  if (!status.bootstrap.available) {
    if (!status.organization?.canBootstrap) {
      return view(
        {
          kind: "org_incomplete",
          canEdit: Boolean(status.organization?.canEditProfile),
          orgNumberEditable: Boolean(status.organization?.orgNumberEditable),
        },
        "map",
        status.organization?.canEditProfile ? "edit_org_profile" : null,
      );
    }
    return view({ kind: "ready_to_map", remap: false }, "map", "map");
  }
  if (!status.bootstrap.ready) {
    return view(
      { kind: "mapped_incomplete", missing: status.bootstrap.missingFields },
      "map",
      "remap",
    );
  }

  // ── Steg 2: plan ─────────────────────────────────────────────────────
  if (input.planning) return view({ kind: "planning" }, "plan", null);
  if (input.planFailed) return view({ kind: "plan_failed" }, "plan", "retry_plan", ["remap"]);
  if (!status.plan.exists) return view({ kind: "ready_to_plan" }, "plan", "generate_plan", ["remap"]);

  // ── Steg 3: poster / aktivering ──────────────────────────────────────
  const plan = status.plan;
  if (plan.status !== "active") {
    if (input.activating) return view({ kind: "planning" }, "posts", null);
    return view({ kind: "plan_draft", planId: plan.id }, "posts", "activate_plan", ["new_plan", "remap"]);
  }
  const progress = input.postsProgress;
  if (progress && !progress.complete) {
    return view(
      { kind: "generating_posts", planId: plan.id, generated: progress.generated, expected: progress.expected },
      "posts",
      null,
      ["open_chat"],
    );
  }

  // ── Steady-state ─────────────────────────────────────────────────────
  return view({ kind: "active", planId: plan.id }, null, "open_chat", ["new_plan", "remap"]);
}

/** Kort, menneskelig oppsummering av et fullført steg (stepper-linjen). */
export function summarizeStep(step: MarketingFlowStep, status: MarketingFlowStatus | null): string {
  if (!status) return "";
  if (step === "map") {
    const org = status.organization;
    const parts = [
      status.bootstrap.generatedAt
        ? `Kartlagt ${new Date(status.bootstrap.generatedAt).toLocaleDateString("nb-NO")}`
        : "Kartlagt",
      org?.naceDescription
        ? `${org.naceDescription}${org.naceCode ? ` (${org.naceCode})` : ""}`
        : org?.industry ?? null,
      org?.website ? "nettsted ok" : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (step === "plan") {
    return status.plan.exists
      ? `Plan ${status.plan.status === "active" ? "aktiv" : "utkast"} · ${status.plan.horizonDays} dager`
      : "";
  }
  return status.plan.exists && status.plan.status === "active" ? "Poster klare" : "";
}
