import { db } from "./index";
import {
  ingredient,
  orderLine,
  purchaseOrder,
  stockCount,
  supplier,
  supplierProduct,
} from "./schema";

/**
 * A week's worth of a small café, and one shelf that has run down.
 *
 * The numbers are chosen so the unit problem is visible rather than subtle:
 * house espresso is 1.2kg against a 5kg par, and it is sold in 1kg bags. The
 * right answer is four bags. See README.
 *
 * Oat milk is deliberately sold in `packSize: 1` — it is counted by the carton
 * and bought by the carton — because that is the row where ordering base units
 * and ordering packs give the *same* answer. Any test that only covers oat
 * milk passes.
 */

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const SUPPLIERS = [
  {
    email: "orders@rowanroasters.test",
    id: "sup_rowan",
    leadTimeDays: 2,
    minimumOrderPence: 4000,
    name: "Rowan Roasters",
  },
  {
    email: "trade@fieldandchurn.test",
    id: "sup_field",
    leadTimeDays: 1,
    minimumOrderPence: 2500,
    name: "Field & Churn",
  },
  {
    email: "hello@millgatebakery.test",
    id: "sup_mill",
    leadTimeDays: 1,
    minimumOrderPence: 0,
    name: "Millgate Bakery",
  },
];

const INGREDIENTS = [
  { baseUnit: "g", id: "ing_espresso", name: "House espresso", parLevel: 5000 },
  { baseUnit: "g", id: "ing_decaf", name: "Decaf espresso", parLevel: 2000 },
  { baseUnit: "ml", id: "ing_milk", name: "Whole milk", parLevel: 24_000 },
  { baseUnit: "each", id: "ing_oat", name: "Oat milk", parLevel: 24 },
  { baseUnit: "g", id: "ing_choc", name: "Drinking chocolate", parLevel: 3000 },
  { baseUnit: "each", id: "ing_pastry", name: "Butter croissants", parLevel: 40 },
] as const;

const PRODUCTS = [
  {
    id: "prd_espresso",
    ingredientId: "ing_espresso",
    packLabel: "1kg bag",
    packSize: 1000,
    pricePencePerPack: 2200,
    supplierId: "sup_rowan",
  },
  {
    id: "prd_decaf",
    ingredientId: "ing_decaf",
    packLabel: "1kg bag",
    packSize: 1000,
    pricePencePerPack: 2400,
    supplierId: "sup_rowan",
  },
  {
    id: "prd_milk",
    ingredientId: "ing_milk",
    packLabel: "case of 6 × 2L",
    packSize: 12_000,
    pricePencePerPack: 780,
    supplierId: "sup_field",
  },
  {
    // Counted by the carton and bought by the carton: the one row where
    // ordering base units and ordering packs happen to agree.
    id: "prd_oat",
    ingredientId: "ing_oat",
    packLabel: "carton",
    packSize: 1,
    pricePencePerPack: 145,
    supplierId: "sup_field",
  },
  {
    id: "prd_choc",
    ingredientId: "ing_choc",
    packLabel: "1.5kg tub",
    packSize: 1500,
    pricePencePerPack: 1650,
    supplierId: "sup_field",
  },
  {
    id: "prd_pastry",
    ingredientId: "ing_pastry",
    packLabel: "tray of 12",
    packSize: 12,
    pricePencePerPack: 1080,
    supplierId: "sup_mill",
  },
];

/** Monday's count. Three things are under par, three are fine. */
const COUNTS = [
  { id: "cnt_espresso", ingredientId: "ing_espresso", quantity: 1200 },
  { id: "cnt_decaf", ingredientId: "ing_decaf", quantity: 2400 },
  { id: "cnt_milk", ingredientId: "ing_milk", quantity: 9000 },
  { id: "cnt_oat", ingredientId: "ing_oat", quantity: 9 },
  { id: "cnt_choc", ingredientId: "ing_choc", quantity: 3200 },
  { id: "cnt_pastry", ingredientId: "ing_pastry", quantity: 16 },
];

async function main() {
  // Children first, so a re-seed is a reset rather than a conflict.
  await db.delete(orderLine);
  await db.delete(purchaseOrder);
  await db.delete(stockCount);
  await db.delete(supplierProduct);
  await db.delete(ingredient);
  await db.delete(supplier);

  await db.insert(supplier).values(SUPPLIERS);
  await db.insert(ingredient).values([...INGREDIENTS]);
  await db.insert(supplierProduct).values(PRODUCTS);
  await db.insert(stockCount).values(
    COUNTS.map((row) => ({
      ...row,
      countedAt: daysAgo(1),
      countedBy: "Nadia",
    }))
  );

  process.stdout.write(
    `Seeded ${SUPPLIERS.length} suppliers, ${INGREDIENTS.length} ingredients, ${COUNTS.length} counts.\n` +
      "Under par: House espresso, Whole milk, Oat milk, Butter croissants.\n"
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
