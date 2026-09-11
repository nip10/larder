# Larder

Supplier ordering and stock for an independent café. Next.js, Drizzle,
Postgres, shadcn/ui.

> This app exists to be **worked on**. It is a target for an agent pipeline —
> a real repo, with real migrations and a real deploy, so that "an agent
> shipped a feature and a human approved the risky part" is something you can
> watch rather than something you're told.
>
> It is the sibling of [cadence](https://github.com/nip10/cadence), and it is
> deliberately a different *kind* of app. Cadence's hard part is time: slots,
> capacity, and two people going for the last spot at once. Larder's hard part
> is arithmetic: units, pack sizes, and par levels. They break in different
> ways on purpose.
>
> It is therefore deliberately unfinished, and the one part that is
> deliberately broken is documented below.

## Running it

```bash
bun install
bun run db:start          # Postgres 18 on port 5435
cp .env.example .env.local
bun run db:push
bun run db:seed
bun run dev               # http://localhost:3000
```

The seed builds a Monday stock count across six things a small café actually
buys, and leaves four of them under par — including **house espresso at 1.2kg
against a 5kg par**, because that is where the interesting behaviour is.

## The model

| Table | What it is |
| --- | --- |
| `supplier` | who you buy from, with a lead time and a minimum order |
| `ingredient` | something kept in stock, with a **par level in base units** |
| `supplier_product` | what one supplier sells one ingredient as, in **packs** |
| `stock_count` | a physical count on a date, in **base units** |
| `purchase_order` | an order to a supplier |
| `order_line` | a product and a number of **packs** |

Stock is append-only: what is on hand is the most recent count, not a running
total that deliveries adjust. That is the honest model for a café that counts
on a Monday, and it is why receiving a delivery does not change stock yet.

## The unit bug

Stock is counted in base units — grams, millilitres, or each. Suppliers sell
in packs: a 1kg bag of beans, a case of six 2-litre milks, a tray of twelve
croissants. `supplier_product.pack_size` is how many base units are in one
pack.

`packsToOrder` in `src/lib/reorder.ts` returns the shortfall — a base-unit
figure — and that number goes straight into `order_line.packs`, which counts
packs. Every quantity in the schema is a bare `integer` with no unit attached,
so nothing catches it. Measured, on the seeded data:

```
ingredient              short     pack   orders  should be
----------------------------------------------------------
Whole milk            15000ml    12000    15000          2   ←
Oat milk                   15        1       15         15
Butter croissants          24       12       24          2   ←
House espresso          3800g     1000     3800          4   ←
----------------------------------------------------------
order total suggested : £200880.95
order total correct   :    £146.95
```

Three thousand eight hundred bags of coffee. Note the row that is **right**:
oat milk is counted by the carton and bought by the carton, so its pack size
is 1 and both answers agree. A test that covers only oat milk passes, which is
how a bug like this survives review.

`bun run verify` measures it and exits non-zero. **It fails today. That is the
task.**

Fixing it needs a decision, which is the point:

- **Convert at the boundary** — `Math.ceil(shortfall / packSize)` where the
  order line is built. One line, no migration, and the next person to write a
  quantity can make the same mistake again.
- **Make the units unmixable** — carry the unit in the type, so a base-unit
  figure cannot be assigned to a pack count. Bigger change, touches every
  quantity, and it ends the class of bug rather than this instance of it.

That trade-off — cheap fix now versus the thing that stops it recurring — is
worth a person seeing, and is exactly the sort of call this repo exists to
surface.

## What is missing, on purpose

Each of these is a different *kind* of change, which is why they were left out.

| Task | Why it is interesting |
| --- | --- |
| **Goods-in / receiving a delivery** | migration, plus idempotency — a retried receipt must not count stock twice |
| **Wastage and stock loss** | migration, and it changes what "on hand" means |
| **Supplier price history** | migration, touches money, and needs a decision about whether an old order keeps its old price |
| **Recipes and yield** | the change that makes par levels calculable instead of typed in by hand |
| **Real auth** | every order is currently drafted as the café, by nobody |
| **Admin: edit suppliers and par levels** | CRUD, and the first thing with a design surface worth reviewing |
| **Bump a dependency** | the change that looks safest and historically is not |

## Deploying

Vercel, with Supabase for Postgres. Set `DATABASE_URL` to the Supabase
**connection pooling** URI — the client sets `prepare: false`, which is what
that pooler needs.

Preview deploys per branch are the durable review surface: one immutable URL
per commit, which outlives the machine the work was done on.

## Scripts

```
bun run dev          bun run build        bun run start
bun run db:start     bun run db:stop      bun run db:push
bun run db:generate  bun run db:migrate   bun run db:seed
bun run verify
```
