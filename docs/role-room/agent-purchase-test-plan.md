# The Role Room Agent — Purchase flow test plan

End-to-end manual test procedure for the entitlement + Stripe pipeline.
Run this against staging (or a production tenant in test mode) before
toggling the add-on live.

## 0. Pre-flight

### Server env (Render UI — backend service)

| Variable | Expected |
|---|---|
| `ANTHROPIC_API_KEY` | set |
| `ROLE_ROOM_AGENT_CLAUDE_ENABLED` | `true` |
| `STRIPE_SECRET_KEY` | **test mode** key (`sk_test_...`) while validating |
| `STRIPE_ROLE_ROOM_AGENT_PRICE_ID` | price id of the add-on product (create in Stripe dashboard first) |
| `ROLE_ROOM_AGENT_CHECKOUT_SUCCESS_URL` | `https://<staging-host>/dashboard?agent=activated` |
| `ROLE_ROOM_AGENT_CHECKOUT_CANCEL_URL` | `https://<staging-host>/dashboard` |
| `STRIPE_WEBHOOK_SECRET` (Role Room) | signing secret for `/api/billing/webhook` |

### Stripe dashboard

1. Create product **"The Role Room Agent"**, recurring monthly, 99 NOK. Copy the Price ID.
2. Add webhook endpoint → `https://<staging-api>/api/billing/webhook` subscribed to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`

### DB — verify schema

```sql
SELECT to_regclass('public.role_room_agent_entitlements');  -- not null
SELECT to_regclass('public.role_room_ai_consent');           -- not null
SELECT to_regclass('public.role_room_ai_audit_log');         -- not null
```

All three should return the table name, not null. If any is null, the
migration didn't run.

## 1. Happy path — trial

1. Log in as a **non-admin** test user with a Basic or Prototype subscription.
2. Open Role Room → select a project → go to the **Agent** tab.
3. **Expected:** `AgentPaywallDialog` appears (pre-flight entitlement check returned `allowed=false`).
4. Click **"Start 14-dagers prøve"**.
5. **Expected:** dialog shows "Prøveperiode startet" and closes after ~1s. Chat input becomes usable.

### DB check

```sql
SELECT status, source, trial_ends_at, granted_at
FROM role_room_agent_entitlements
WHERE user_id = '<test-user-id>'
ORDER BY granted_at DESC
LIMIT 1;
```

Expect: one row with `status='trial'`, `source='trial'`, `trial_ends_at` ~14 days out.

### Send a test message

- Type "Hva mangler i briefen?" and send.
- **Expected:** transparency banner appears, response streams in, no 402.

### Audit check

```sql
SELECT status, action, model, prompt_tokens
FROM role_room_ai_audit_log
WHERE user_id = '<test-user-id>'
ORDER BY created_at DESC LIMIT 5;
```

Expect at least one `status='ok'` row tagged with the action.

## 2. Re-attempt trial (should be blocked)

1. As the same user, open paywall again (e.g. revoke + reopen) and click **"Start 14-dagers prøve"**.
2. **Expected:** error "Du har allerede brukt prøveperioden — velg add-on eller oppgrader."

## 3. Buy add-on

1. Click **"Kjøp add-on"** in the paywall.
2. **Expected:** redirect to Stripe hosted checkout.
3. Pay with test card `4242 4242 4242 4242`, any future date, any CVC.
4. **Expected:** redirect to the `ROLE_ROOM_AGENT_CHECKOUT_SUCCESS_URL`.

### DB check after webhook

```sql
SELECT status, source, stripe_subscription_id, granted_at, revoked_at
FROM role_room_agent_entitlements
WHERE user_id = '<test-user-id>'
ORDER BY granted_at DESC
LIMIT 2;
```

Expect: newest row with `status='active'`, `source='addon_monthly'`,
`stripe_subscription_id='sub_...'`. The earlier trial row should have
`revoked_at` populated (superseded).

### Stripe dashboard check

Customer > subscriptions should show an active monthly recurring
subscription.

## 4. Subscription cancellation

1. In Stripe dashboard (test mode) → Customers → cancel the subscription immediately.
2. Wait ~5s for webhook.

### DB check

```sql
SELECT status, source, revoked_at, notes
FROM role_room_agent_entitlements
WHERE stripe_subscription_id = '<sub_id>';
```

Expect: `status='expired'`, `revoked_at IS NOT NULL`, `notes` contains `"Revoked via Stripe: customer.subscription.deleted"`.

### UI check

- Send a new message in the chat.
- **Expected:** 402 → paywall reopens → user sees upsell again.

## 5. Payment failure

Create a subscription with test card `4000 0000 0000 0341` (decline on renewal). Wait until next invoice attempt or use Stripe CLI to trigger
`invoice.payment_failed`:

```bash
stripe trigger invoice.payment_failed --override invoice:subscription=<sub_id>
```

### DB check

```sql
SELECT status, notes
FROM role_room_agent_entitlements
WHERE stripe_subscription_id = '<sub_id>'
ORDER BY granted_at DESC LIMIT 1;
```

Expect: `status='expired'`, `notes` includes `"invoice.payment_failed"`.

## 6. Admin bypass

1. Log in as an admin/owner user.
2. Open Agent tab.
3. **Expected:** no paywall, agent works immediately.
4. **DB check:** NO entitlement row should be created for admin (bypass is in-code, not DB-backed).

## 7. Admin grant / revoke

1. As admin, open the **AI Governance** tab in Role Room admin.
2. Go to **Entitlements** sub-tab.
3. Grant a 7-day trial to a specific user by id.
4. **DB check:** new row with `source='admin_grant'`, `status='trial'`, `trial_ends_at ~7 days out`.
5. Revoke — row gets `revoked_at` populated.

## 8. DPO overview correctness

- Open **AI Governance → Oversikt**. Verify KPI cards update after the tests above — active consents, call counts, cache-hit rate.

## Common failures + fixes

| Symptom | Cause | Fix |
|---|---|---|
| 503 `not_configured` on add-on checkout | `STRIPE_ROLE_ROOM_AGENT_PRICE_ID` unset | Set in Render → redeploy |
| Checkout works but no entitlement row after payment | Webhook signature mismatch | Check `STRIPE_WEBHOOK_SECRET` matches dashboard |
| Webhook returns 500 | DB connection or metadata.product missing | Check Render logs for `[role-room-agent-entitlement]` |
| Paywall dialog won't close | `onEntitlementChanged` didn't re-fetch | Reload page — state will hydrate |
| Agent returns 402 but paywall says user is entitled | Stale frontend cache | User clicks "Ny samtale" or reloads |
| Admin still sees paywall | Role not propagating in session | Check `x-role-room-role` header, should be `admin` / `owner` |
