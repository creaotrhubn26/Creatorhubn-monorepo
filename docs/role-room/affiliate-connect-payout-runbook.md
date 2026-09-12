# Role Room affiliate payouts

## Production model

- One Stripe Connect Express **company** account per approved affiliate organization.
- CreatorHub collects the customer payment on the platform account and sends a
  separate Stripe Transfer after the commission has matured.
- Core subscription commission defaults to 15%; optional storage add-ons default
  to 5%. Both values are stored per partner in basis points.
- Commission matures after 30 days. Batches run monthly with a default minimum of
  100,000 minor units (NOK 1,000).
- Refunds and chargebacks are immutable signed adjustments. A negative balance is
  carried forward; historical commission rows are never rewritten.
- A platform Transfer and the connected account's bank Payout are separate states
  and are audited separately.

## Required Stripe webhook setup

Keep the existing platform webhook and enable the applicable platform events:

- `invoice.paid`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`
- `charge.dispute.funds_reinstated`
- `transfer.created`
- `transfer.updated`
- `transfer.reversed`

Create a connected-account webhook for:

`https://creatorhub-backend-rtbl.onrender.com/api/role-room/billing/connect-webhook`

Enable:

- `account.updated`
- `payout.created`
- `payout.updated`
- `payout.paid`
- `payout.failed`
- `payout.canceled`

Store its signing secret only as `ROLE_ROOM_STRIPE_CONNECT_WEBHOOK_SECRET` in
Render. It must not reuse the platform webhook secret.

## Safe activation sequence

1. Deploy migrations 0576 and 0577 before the application commit.
2. Verify the production route returns 401 without a session and the Connect
   webhook fails closed without a valid Stripe signature.
3. Register one real affiliate organization through the admin endpoint. Do not
   create placeholder legal entities.
4. Let an organization administrator complete Stripe-hosted KYC from the Role
   Room storage dialog.
5. Confirm `detailsSubmitted`, `payoutsEnabled`, and the transfers capability are
   all ready.
6. Keep `ROLE_ROOM_AFFILIATE_PAYOUTS_ENABLED=false` while reconciling accrued,
   adjusted, matured, and available totals against Stripe invoices.
7. Enable the flag only after the first partner is approved and run one
   admin-initiated batch. Reconcile the stored Transfer ID and connected bank
   payout before allowing the monthly cron to take over.

## Kill switch and retry behavior

Set `ROLE_ROOM_AFFILIATE_PAYOUTS_ENABLED=false` to stop all new transfers. Stripe
idempotency keys are persisted per payout batch, so retrying a pending batch does
not create a second transfer. Webhook event IDs are also persisted and failed or
stale processing events can be reclaimed safely.

The monthly cron runs only on the first day of the month and only when the flag
is explicitly true. Render generates `ROLE_ROOM_AFFILIATE_PAYOUT_CRON_SECRET` and
shares it with the cron service through a service reference.
