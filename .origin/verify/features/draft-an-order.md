# draft-an-order

## What it is

Drafting a purchase order for one supplier: the app turns everything below par
from that supplier into a draft order. It is never sent — what to buy is a
judgement about cash and delivery days, so a person presses send. Each drafted
line is meant to be a number of **packs** of one product.

## How a user reaches it

The Draft order button at the foot of each supplier's card on `/`. It `POST`s to
`/api/order` and shows a toast ("Draft order for <supplier>. Nothing sent yet.")
on success, or "Nothing to order from them right now." on a `nothing_below_par`.

## How an agent drives it

`POST http://localhost:3000/api/order` with `content-type: application/json` and
body `{"supplierId":"sup_<name>"}` (see Drive in the recipe). Seeded supplier
ids: `sup_rowan` (House espresso), `sup_field` (Whole milk, Oat milk), `sup_mill`
(Butter croissants). The response is:

- `200 {"ok":true,"orderId":"pur_…","lines":<n>}`
- `409 {"ok":false,"reason":"nothing_below_par"}` when that supplier has nothing
  below par (`sup_none` is a seeded-free id that lands here)
- `400 {"ok":false,"reason":"bad_request"}` when the body is not `{supplierId}`

Drafting changes the seeded database; `bun run db:seed` restores it.

## What proves it works

For `sup_rowan`, the response is HTTP 200 with `ok:true`, `lines:1`, and an
`orderId`. Read the order and its line back from Postgres: exactly one
`purchase_order` row exists with that `id`, `status='draft'`,
`supplier_id='sup_rowan'`, and exactly one `order_line` for it. The line's
`packs` must equal `ceil(shortfall / pack_size)` — for House espresso,
`ceil(3800 / 1000) = 4`.

**This proof currently fails, and that is Larder's first task.** The line is
written with `packs = 3800` (the base-unit shortfall) instead of `4`, because
`packsToOrder` in `src/lib/reorder.ts` returns `row.shortfall` and that value is
inserted straight into `order_line.packs`. `bun run verify` measures it — on the
seeded data it prints `FAIL — 3 of 4 lines order base units as if they were
packs.` and exits non-zero. The README section "The unit bug" says the same:
*"It fails today. That is the task."* A later run reading this file must treat
the failing `packs` proof as the repo's known defect, not a broken recipe.

The cases that do work, and prove the endpoint and its guards:

- `sup_none` → HTTP 409 `{"ok":false,"reason":"nothing_below_par"}`, and no
  `purchase_order` row is written.
- a body without `supplierId`, e.g. `{"nope":true}` → HTTP 400
  `{"ok":false,"reason":"bad_request"}`, and no row is written.
- `sup_field` → HTTP 200 `lines:2` (Whole milk and Oat milk); `sup_mill` →
  HTTP 200 `lines:1` (Butter croissants).
