# HATOD channel contract (iskina-sme side)

HATOD is the consumer app. It reads storefronts and places orders through the
platform channel; merchants keep operating in the merchant app and web
dashboard. Delivery execution stays with HATOD dispatch.

## Credentials

| Caller               | Credential                                          | Scope                   |
| -------------------- | --------------------------------------------------- | ----------------------- |
| HATOD                | `CHANNEL_PLATFORM_KEY` (server-side env, ≥24 chars) | every active storefront |
| Business integration | `sk_test_` / `sk_live_` key from the dashboard      | one business            |

The platform key is sent as `Authorization: Bearer …` and is compared in
constant time. It is never returned by an API and never stored in the database.
Business keys cannot list storefronts (`403`), by design.

## Endpoints

| Route                                    | Purpose                                                               |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `GET /api/v1/channel/storefronts?limit=` | Active storefronts: id, slug, name, vertical, lat/lng                 |
| `GET /api/v1/channel/storefronts/:slug`  | Business + vertical config + published theme + catalog                |
| `GET /api/v1/channel/theme?businessId=`  | Theme only (platform) or the key's business                           |
| `POST /api/v1/channel/quotes`            | Server-side cart price; `businessId` required for the platform key    |
| `POST /api/v1/channel/orders`            | Place an order; `Idempotency-Key`-style `idempotencyKey` per business |
| `GET /api/v1/channel/orders/:id`         | Not built yet — merchant/webhook status is next                       |

Only active businesses and available items appear. Prices are integer centavos.
The client never sends a total.

### Quote

```bash
curl -s -X POST "$SME/api/v1/channel/quotes" \
  -H "Authorization: Bearer $CHANNEL_PLATFORM_KEY" \
  -H 'content-type: application/json' \
  -d '{"businessId":"…","items":[{"itemId":"…","quantity":2}],
       "delivery":{"address":"Lahug, Cebu City","lat":10.32,"lng":123.9}}'
```

### Place an order

```bash
curl -s -X POST "$SME/api/v1/channel/orders" \
  -H "Authorization: Bearer $CHANNEL_PLATFORM_KEY" \
  -H 'content-type: application/json' \
  -d '{"businessId":"…",
       "customer":{"name":"Ana","phone":"0917…","hatodUserId":"user-42"},
       "items":[{"itemId":"…","quantity":1}],
       "delivery":{"address":"IT Park","lat":10.329,"lng":123.906},
       "idempotencyKey":"hatod-order-8f2c"}'
```

Repeating the same `idempotencyKey` for the same business returns the existing
order instead of creating a second one.

## HATOD adapter plan (M5b)

1. Add `MARKETPLACE_BACKEND=internal|iskina-sme` to HATOD's API.
2. Implement a client with `ISKINA_SME_BASE_URL` + `ISKINA_SME_PLATFORM_KEY`.
3. Map HATOD's `ServiceOrder` reads/writes to the channel routes:
   - discovery → `GET /channel/storefronts`
   - store page → `GET /channel/storefronts/:slug`
   - cart price → `POST /channel/quotes`
   - checkout → `POST /channel/orders`
4. Keep HATOD's delivery job creation; iskina-sme decides _what_ was sold, HATOD
   decides _who_ drives.
5. Prove parity in staging with a full food delivery and an aircon booking
   before switching `MARKETPLACE_BACKEND` for any percentage of traffic.
6. Do not drop HATOD marketplace tables until the flag has been at `iskina-sme`
   for a full cycle and backfill is signed off.

## Not built yet

- Order status read/webhooks back to HATOD (needed for tracking screens).
- Customer cancellation through the channel.
- City/radius coverage filters on discovery.
- 5-minute analytics rollups (currently live queries).
