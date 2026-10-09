# order-sheet

## What it is

The order sheet: everything the café has run down on, grouped by supplier, each
supplier's total cost, and a list of every ingredient on the shelf with its on
hand and par. It is the app's only page, and where ordering starts.

## How a user reaches it

Open `/` in a browser. It is the app's only page, and every draft order starts
here via a supplier's Draft order button (`draft-an-order`).

## How an agent drives it

`GET http://localhost:3000/` (see Drive in the recipe). The page is
server-rendered from Postgres on every request
(`export const dynamic = "force-dynamic"`), so the order sheet is in the HTML.
React separates adjacent text nodes with `<!-- -->` comments.

## What proves it works

`GET /` returns 200, its HTML contains `What has run down`, and it does not
contain `Nothing is below par` — the seeded shortfalls rendered rather than the
empty state. On the seeded data the four under-par lines appear under their
three suppliers:

- **Field & Churn** — `2 below par`: `Whole milk`, `9,000ml on hand · par
  24,000ml · case of 6 × 2L`; and `Oat milk`, `9 on hand · par 24 · carton`.
- **Millgate Bakery** — `1 below par`: `Butter croissants`, `16 on hand · par 40
  · tray of 12`.
- **Rowan Roasters** — `1 below par`: `House espresso`, `1,200g on hand · par
  5,000g · 1kg bag`.

The `Everything on the shelf` section lists all six ingredients with on hand /
par: `Butter croissants 16 / 40`, `Decaf espresso 2,400g / 2,000g`, `Drinking
chocolate 3,200g / 3,000g`, `House espresso 1,200g / 5,000g`, `Oat milk 9 / 24`,
`Whole milk 9,000ml / 24,000ml`.

The `order N × <pack label>` badge on each line and each supplier's total cost
are both computed by `packsToOrder`, so they carry the unit bug: `House espresso`
renders `order 3,800 × 1kg bag` and Rowan Roasters shows `£83600.00`, where the
correct figures are `4` bags and `£88.00`. That is the same defect
`draft-an-order` proves and `bun run verify` measures; it is the repo's known
task, not a broken proof of this feature.
