# Iskina SME simulator

Virtual HATOD consumers and merchant agents exercising the **real** API — no
direct database writes, no mocked transitions.

## Setup

```bash
# in the repo root, with Postgres and the API running
pnpm dev                 # API on :3008
pnpm sim:seed            # creates SIM Kitchen / SIM Aircon / SIM LPG
```

The simulator reads the root `.env`:

- `CHANNEL_PLATFORM_KEY` (required)
- `SIM_BASE_URL` (default `http://localhost:3008`)
- `SIM_MERCHANT_PHONE` (default `+639170000001`)

The merchant phone must be able to sign in with a **dev OTP**. Against staging,
run with `AUTH_ALLOW_DEV_OTP=true` and `AUTH_EXPOSE_DEV_OTP=true`; the simulator
refuses to continue if the API does not return a dev code.

## Commands

| Command                                       | What it proves                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm sim:seed`                               | onboarding, catalog creation, theme publish through the API                                          |
| `pnpm sim:food`                               | quote → order → SSE event → accept → prepare → ready → out → delivered → cash → complete → analytics |
| `pnpm sim:aircon`                             | booking with a schedule, no delivery fee, schedule → start → complete                                |
| `pnpm sim:lpg`                                | refill intake and delivery flow                                                                      |
| `pnpm sim:failures`                           | cancel, double-cancel 409, late-cancel 409, invalid transition 409, idempotent replay, reject        |
| `pnpm sim:mixed --orders=20 --concurrency=5`  | concurrent orders across all three verticals, fully processed                                        |
| `pnpm sim:load --orders=100 --concurrency=10` | latency p50/p95, throughput, error count                                                             |
| `pnpm sim:traffic --duration=10m --rate=2`    | continuous random orders, timing, failures and idempotent replays                                    |
| `pnpm sim:replay sim-reports/<file>.json`     | re-run a recorded scenario                                                                           |

Reports are written to `sim-reports/` (gitignored). Tokens, OTPs and the platform
key are never written to a report.

## Traffic options

```bash
pnpm sim:traffic --duration=10m --rate=2 --failure-rate=0.1
pnpm sim:traffic --orders=50 --business=aling-nena --step-delay=250
pnpm sim:traffic --vertical=aircon --seed=42 --concurrency=3
```

| Flag                                  | Meaning                                                    |
| ------------------------------------- | ---------------------------------------------------------- |
| `--duration=10m` / `--orders=N`       | stop after a window or a count                             |
| `--rate=2`                            | orders per second (jittered)                               |
| `--vertical=food\|aircon\|lpg\|mixed` | cart mix                                                   |
| `--failure-rate=0.1`                  | share that rejects, cancels, or hits a blocked late cancel |
| `--business=<slug>`                   | target an existing store instead of the SIM stores         |
| `--step-delay=500`                    | ms between merchant transitions                            |
| `--seed=42`                           | reproducible randomness                                    |

Each order gets a random cart, quantity, customer, drop-off point, and a future
slot for bookings. About 5% are duplicate `idempotencyKey` placements, which must
return the same order.

## Safety

- Localhost by default.
- A remote host requires `SIM_ALLOW_REMOTE=1`.
- `sme.iskina.cc` additionally requires `SIM_ALLOW_PRODUCTION=1`; simulated
  orders will contaminate analytics, so use a dedicated tenant.
- Simulated orders are identifiable by the `SIM` customer/name prefix and their
  `sim-*` idempotency keys.

## Known gaps the simulator records

- Order expiry has no sweep yet, so the `EXPIRED` path is not exercised.
- There are no webhooks; realtime is verified through the merchant SSE stream.
- Analytics are live queries, so load runs will make those queries heavier.
