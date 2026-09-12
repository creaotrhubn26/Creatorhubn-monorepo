-- ── 254_academy_payouts.sql ────────────────────────────────────────
-- Academy payout-forespørsler. Erstatter de hardkodede payouts som lå
-- i AdminDashboard.tsx (renderAcademyPanel) — instruktører forespør
-- utbetaling, admin godkjenner/avviser/markerer som betalt.
--
-- Lifecycle:
--   pending  → approved → paid
--                ↘ rejected
--
-- 4 endepunkt drives av denne tabellen:
--   GET  /api/admin/academy/payouts        — list (status-filter)
--   POST /api/admin/academy/payouts/:id/approve
--   POST /api/admin/academy/payouts/:id/reject
--   POST /api/admin/academy/payouts/:id/mark-paid
--
-- Seed-blokken nederst legger inn 3 demo-pending rader så Academy-fanen
-- i admin viser samme «3 ventende»-mønster som mockup-en hadde.
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS academy_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL,
  amount_nok INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'paid' | 'rejected'
  bank_account_last4 TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_by TEXT,
  rejection_reason TEXT,
  stripe_transfer_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academy_payouts_status_idx
  ON academy_payouts (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS academy_payouts_instructor_idx
  ON academy_payouts (instructor_id);

-- Seed 3 demo-pending payouts (matcher det som var hardkodet i UI).
-- Vi seeder bare hvis det allerede finnes instruktører OG ingen pending
-- payouts er registrert fra før — slik at migrasjonen er idempotent.
INSERT INTO academy_payouts (instructor_id, amount_nok, bank_account_last4, requested_at, notes)
SELECT i.id, amounts.amount, amounts.last4, amounts.requested, amounts.note
FROM academy_instructors i
JOIN (VALUES
  (12000, '8901', '2026-05-28'::timestamptz, 'John Doe Photography'),
  (5500,  '4567', '2026-05-30'::timestamptz, 'Jane Smith Video'),
  (3000,  '2345', '2026-06-01'::timestamptz, 'Demo Instructor')
) AS amounts(amount, last4, requested, note) ON TRUE
WHERE i.display_name IN ('Daniel Qazi', 'Demo Instructor')
  AND NOT EXISTS (
    SELECT 1 FROM academy_payouts WHERE status = 'pending'
  )
LIMIT 3
ON CONFLICT DO NOTHING;
