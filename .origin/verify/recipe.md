# Verifying Larder

How to launch Larder, check it is ready, drive it and stop it. Paste each block
from the repository root. `.origin/verify/features/` has one file per feature:
this file is *how* to drive, those are *what* to drive and *what proves it*.

## Launch

Larder is a Next.js app on :3000 against a local Postgres on :5435. Start the
database, write the env file the app reads, apply the schema, seed a Monday
count, then start the app in the background.

```bash
bun install
bun run db:start          # Postgres 18 on localhost:5435 (docker compose up -d db)

# The app reads DATABASE_URL from .env.local, and Next loads .env.local by
# itself. `.env.example` is tracked (via `!.env.example` in .gitignore), so the
# README's `cp` works here.
cp .env.example .env.local

# drizzle.config.ts loads .env.local with dotenv itself, so drizzle-kit already
# has DATABASE_URL and `bun --env-file` is not needed. `push` can still ask for a
# TTY confirmation an agent shell will not have, so force it.
bun run db:push --force
bun run db:seed           # 6 ingredients; 4 below par (espresso, milk, oat milk, croissants)

# Start the app detached, logging to a file.
nohup bun run dev > /tmp/larder-dev.log 2>&1 &
```

Postgres is accepting connections within a few seconds. `next dev` prints
`Ready` almost at once and compiles the first request in a second or two more,
so give the app 15 seconds before the Doctor.

`db:start` publishes host port **5435**, so nothing else may already be holding
it; if something is, publish the db on another port and set `DATABASE_URL` to
match before `db:push`.

## Doctor

One command; exits 0 only when the app is up and serving the seeded shortfalls.

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/ | grep -qx 200 \
  && curl -fsS http://localhost:3000/ | grep -q 'What has run down' \
  && curl -fsS http://localhost:3000/ | grep -q 'House espresso' \
  && ! curl -fsS http://localhost:3000/ | grep -q 'Nothing is below par'
```

The order sheet is server-rendered from Postgres on every request
(`export const dynamic = "force-dynamic"`), so a 200 that names a seeded
ingredient (rather than the "Nothing is below par" empty state) means both the
app and its database are ready. Do not drive until this passes.

## Drive

Base URL `http://localhost:3000`. There is no auth: every order is drafted as
the café, by nobody (real auth is a README task).

- `GET /` — the order sheet HTML, server-rendered. React separates adjacent
  text nodes with `<!-- -->` comments, so read it as text rather than raw tags.
- `POST /api/order` — JSON body `{"supplierId":"sup_<name>"}` with header
  `content-type: application/json`. Seeded supplier ids: `sup_rowan` (House
  espresso), `sup_field` (Whole milk, Oat milk), `sup_mill` (Butter
  croissants). The response is:
  - `200 {"ok":true,"orderId":"pur_…","lines":<n>}`
  - `409 {"ok":false,"reason":"nothing_below_par"}` when that supplier has
    nothing below par (any unknown id, e.g. `sup_none`, also lands here)
  - `400 {"ok":false,"reason":"bad_request"}` when the body is not `{supplierId}`
- For the unit bug, `bun run verify` drives `packsToOrder` directly against
  Postgres (it does not go through HTTP): it prints, per shortfall, the packs the
  app would order next to the packs that would reach par, and exits non-zero
  when they disagree. It **exits 1 today, on purpose** — see the README, "The
  unit bug".

Drafting changes the seeded database. `bun run db:seed` restores it.

## Evidence

Keep observations in `$HOME/.origin/artifacts/` (Origin collects them beside the
diff). Keep, per feature: the exact request you sent, the raw response (status
and body), and the row you read back from Postgres. The HTTP status alone is not
evidence that an order was drafted — the `purchase_order` row and its
`order_line` are.

```bash
mkdir -p "$HOME/.origin/artifacts"
curl -fsS http://localhost:3000/ -o "$HOME/.origin/artifacts/order-sheet.html"
curl -s -X POST http://localhost:3000/api/order -H 'content-type: application/json' \
  -d '{"supplierId":"sup_rowan"}' -w '\nHTTP %{http_code}\n' \
  | tee "$HOME/.origin/artifacts/draft-order-rowan.json"
bun run verify 2>&1 | tee "$HOME/.origin/artifacts/verify.log"   # exits 1: the known defect
```

Read the drafted order and its lines back, with the pack size needed to judge
whether the line is right:

```bash
bun --env-file=.env.local -e "$(cat <<'TS'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const orders = await sql`select id, status, supplier_id from purchase_order order by created_at desc`;
const lines = await sql`
  select ol.order_id, ol.packs, sp.pack_size, sp.pack_label, i.name
  from order_line ol
  join supplier_product sp on sp.id = ol.product_id
  join ingredient i on i.id = sp.ingredient_id
  order by ol.order_id`;
console.log(JSON.stringify({ orders, lines }, null, 2));
await sql.end();
TS
)" | tee "$HOME/.origin/artifacts/order-rows.json"
```

## Cleanup

Stop exactly what Launch started — the dev server and the database container —
and nothing else. `$PWD` is the repository root, so the `pkill` matches this
checkout's `next dev` and no other.

```bash
pkill -f "$PWD/node_modules/.bin/next dev"   # the app Launch started
bun run db:stop                              # the database Launch started
```
