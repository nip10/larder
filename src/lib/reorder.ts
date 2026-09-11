import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  orderLine,
  purchaseOrder,
  stockCount,
  supplierProduct,
} from "@/db/schema";

/**
 * What to order, and how much of it.
 *
 * Stock is held in base units — grams, millilitres, each — and suppliers sell
 * in packs. Everything below is an `integer` with no unit attached, which is
 * the whole hazard: the shortfall is a base-unit figure and an order line
 * counts packs, and nothing but care keeps one out of the other.
 *
 * See README — "The unit bug". This is the first task in this repo.
 */

export interface Shortfall {
  ingredientId: string;
  ingredientName: string;
  /** Base units, e.g. grams. */
  onHand: number;
  packLabel: string;
  /** Base units in one pack. */
  packSize: number;
  /** Base units. */
  parLevel: number;
  pricePencePerPack: number;
  productId: string;
  /** Base units below par. Zero when there is enough. */
  shortfall: number;
  supplierId: string;
  supplierName: string;
  unit: string;
}

const newId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().slice(0, 12)}`;

/** The most recent count for each ingredient, in base units. */
export async function onHandByIngredient(): Promise<Map<string, number>> {
  const counts = await db
    .select({
      countedAt: stockCount.countedAt,
      ingredientId: stockCount.ingredientId,
      quantity: stockCount.quantity,
    })
    .from(stockCount)
    .orderBy(desc(stockCount.countedAt));

  const latest = new Map<string, number>();
  for (const row of counts) {
    // Ordered newest first, so the first one seen wins.
    if (!latest.has(row.ingredientId)) {
      latest.set(row.ingredientId, row.quantity);
    }
  }
  return latest;
}

/** Everything below its par level, with the product that refills it. */
export async function shortfalls(): Promise<Shortfall[]> {
  const [products, onHand] = await Promise.all([
    db.query.supplierProduct.findMany({
      with: { ingredient: true, supplier: true },
    }),
    onHandByIngredient(),
  ]);

  const rows: Shortfall[] = [];
  for (const product of products) {
    const held = onHand.get(product.ingredientId) ?? 0;
    const par = product.ingredient.parLevel;
    if (held >= par) {
      continue;
    }

    rows.push({
      ingredientId: product.ingredientId,
      ingredientName: product.ingredient.name,
      onHand: held,
      packLabel: product.packLabel,
      packSize: product.packSize,
      parLevel: par,
      pricePencePerPack: product.pricePencePerPack,
      productId: product.id,
      shortfall: par - held,
      supplierId: product.supplierId,
      supplierName: product.supplier.name,
      unit: product.ingredient.baseUnit,
    });
  }

  return rows.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

/** How much to order to get back up to par. */
export function packsToOrder(row: Shortfall): number {
  return row.shortfall;
}

/** What a suggested order costs, in pence. */
export function costOf(rows: Shortfall[]): number {
  return rows.reduce(
    (total, row) => total + packsToOrder(row) * row.pricePencePerPack,
    0
  );
}

/**
 * Turn everything below par for one supplier into a draft order.
 *
 * Draft, not sent: what to buy is a judgement about cash and delivery days
 * that the app does not have enough to make, so a person presses send. That
 * split is deliberate and is not one of the README tasks.
 */
export async function draftOrderFor(supplierId: string) {
  const rows = (await shortfalls()).filter(
    (row) => row.supplierId === supplierId
  );
  if (rows.length === 0) {
    return { ok: false as const, reason: "nothing_below_par" as const };
  }

  const orderId = newId("pur");
  await db
    .insert(purchaseOrder)
    .values({ id: orderId, status: "draft", supplierId });

  await db.insert(orderLine).values(
    rows.map((row) => ({
      id: newId("lin"),
      orderId,
      packs: packsToOrder(row),
      pricePencePerPack: row.pricePencePerPack,
      productId: row.productId,
    }))
  );

  return { lines: rows.length, ok: true as const, orderId };
}

/** Every ingredient with its latest count, for the stock page. */
export async function stockLevels() {
  const [ingredients, onHand] = await Promise.all([
    db.query.ingredient.findMany({ orderBy: (fields) => fields.name }),
    onHandByIngredient(),
  ]);

  return ingredients.map((row) => ({
    ...row,
    onHand: onHand.get(row.id) ?? 0,
  }));
}

/** A single ingredient's supplier products, for the order page. */
export async function productsFor(ingredientId: string) {
  return await db.query.supplierProduct.findMany({
    where: eq(supplierProduct.ingredientId, ingredientId),
    with: { supplier: true },
  });
}
