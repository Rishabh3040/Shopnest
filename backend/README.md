# Backend operations

## Razorpay checkout

Configure these server-side environment variables before enabling checkout:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Never expose the key secret or webhook secret to the frontend. Configure a
Razorpay webhook pointing to `https://<backend-host>/api/payment/webhook` and
subscribe to `payment.captured`, `payment.failed`, `refund.processed`, and
`refund.failed`. Use Razorpay test
credentials for local testing and live credentials only on the deployed HTTPS
service.

The server recalculates prices from MongoDB, creates a pending order, verifies
the provider signature and payment state, captures authorized payments, and
deducts inventory in the same MongoDB transaction that marks an order paid.
Payment controller operations run through explicit sequential stages: checkout
validation/idempotency, provider order creation, signature and provider-state
verification, settlement, and post-settlement actions. Webhooks use the same
stage pattern for signature validation, event routing, and state updates; a
failed stage stops the pipeline and returns through the existing error path.
An active checkout for the same user and cart is reused across tabs/reloads.
If two distinct captures nevertheless arrive for one order, only the first is
settled and deducted from inventory; each additional captured payment is
persisted and refunded. Refunds use a stored request ID in Razorpay refund notes
to reconcile timeouts and webhook retries. Admins can review refund status from
the orders page and retry failed duplicate-payment refunds. Keep the Razorpay
refund webhooks enabled so pending refunds are marked complete or failed.
Paid orders with unavailable inventory are retained for admin review and are
not eligible for fulfillment. After replenishing stock, an admin can allocate
it from `/admin/orders`. Admins can advance allocated paid orders through
`pending → processing → shipped → delivered` from the same page.

MongoDB must run as a replica set (including local development) to support
atomic payment settlement and ledger transfers. Production deployments with
automatic index creation disabled must create these indexes on the existing
`oders` collection before deploying checkout:

```javascript
db.oders.createIndex(
  { checkoutKey: 1 },
  {
    unique: true,
    partialFilterExpression: { checkoutKey: { $type: "string" } },
  },
);
db.oders.createIndex(
  { paymentOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentOrderId: { $type: "string" } },
  },
);
db.oders.createIndex(
  { paymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentId: { $type: "string", $gt: "" } },
  },
);
db.oders.createIndex(
  { activeCheckoutKey: 1 },
  {
    unique: true,
    partialFilterExpression: { activeCheckoutKey: { $type: "string" } },
  },
);
db.paymentrefunds.createIndex({ capturedPaymentId: 1 }, { unique: true });
db.paymentrefunds.createIndex({ order: 1, createdAt: -1 });
```
