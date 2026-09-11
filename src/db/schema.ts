import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Larder — supplier ordering and stock for an independent café.
 *
 * The schema is deliberately incomplete. Each thing left out is a different
 * *kind* of change for an agent to make, because the point of this repo is to
 * be worked on:
 *
 *   goods-in / deliveries   — migration, plus idempotency on a retried receipt
 *   wastage and stock loss  — migration, and it changes what "on hand" means
 *   supplier price history  — migration, touches money, needs a decision about
 *                             whether an old order keeps its old price
 *   recipes and yield       — the one that makes par levels calculable rather
 *                             than typed in by hand
 *
 * The interesting hazard here is **units**, and it is deliberately not solved.
 * Stock is counted in base units — grams, millilitres, or each — while
 * suppliers sell in packs: a 1kg bag of beans, a case of 12 bottles. Every
 * quantity below is an integer with no unit attached to it, so nothing stops
 * a pack count being put where a base-unit count belongs. See
 * `src/lib/reorder.ts`, and the README.
 */

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "sent",
  "received",
  "cancelled",
]);

/** What a quantity is counted in. Stock is always held in the base unit. */
export const baseUnitEnum = pgEnum("base_unit", ["g", "ml", "each"]);

export const supplier = pgTable("supplier", {
  email: text("email").notNull().default(""),
  id: text("id").primaryKey(),
  /** Days between sending an order and it arriving. */
  leadTimeDays: integer("lead_time_days").notNull().default(2),
  /** Orders below this are refused by the supplier, in pence. */
  minimumOrderPence: integer("minimum_order_pence").notNull().default(0),
  name: text("name").notNull(),
});

/** Something the café keeps in stock. */
export const ingredient = pgTable("ingredient", {
  /** Grams, millilitres, or countable things. Stock is always in this. */
  baseUnit: baseUnitEnum("base_unit").notNull().default("g"),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /**
   * The level to reorder back up to, **in base units**.
   *
   * Typed in by hand today. Calculating it from recipes and covers is a
   * README task, and the reason `recipe` does not exist yet.
   */
  parLevel: integer("par_level").notNull().default(0),
});

/**
 * What one supplier sells one ingredient as.
 *
 * This is where units stop being simple: `packSize` is how many base units are
 * in one pack, so a 1kg bag of coffee is `packSize: 1000` of an ingredient
 * whose base unit is `g`. An order line counts **packs**. A stock count
 * counts **base units**. Nothing in the type system keeps those apart.
 */
export const supplierProduct = pgTable(
  "supplier_product",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredient.id, { onDelete: "cascade" }),
    /** Base units per pack. A case of 12 × 330ml bottles is 3960. */
    packSize: integer("pack_size").notNull().default(1),
    /** How the pack is described on the invoice: "1kg bag", "case of 12". */
    packLabel: text("pack_label").notNull().default("unit"),
    pricePencePerPack: integer("price_pence_per_pack").notNull().default(0),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("supplier_product_idx").on(
      table.supplierId,
      table.ingredientId
    ),
  ]
);

/**
 * A physical count, on a date.
 *
 * Append-only: what is on hand is the most recent count, not a running total
 * that deliveries and sales adjust. That is the honest model for a café that
 * counts on a Monday, and it is why receiving a delivery does not yet change
 * anything — see the README.
 */
export const stockCount = pgTable(
  "stock_count",
  {
    countedAt: timestamp("counted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    countedBy: text("counted_by").notNull().default(""),
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredient.id, { onDelete: "cascade" }),
    /** In the ingredient's base unit. Never packs. */
    quantity: integer("quantity").notNull().default(0),
  },
  (table) => [
    index("stock_count_ingredient_idx").on(
      table.ingredientId,
      table.countedAt
    ),
  ]
);

export const purchaseOrder = pgTable(
  "purchase_order",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: text("id").primaryKey(),
    note: text("note").notNull().default(""),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    status: orderStatusEnum("status").notNull().default("draft"),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "cascade" }),
  },
  (table) => [index("purchase_order_supplier_idx").on(table.supplierId)]
);

export const orderLine = pgTable(
  "order_line",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => purchaseOrder.id, { onDelete: "cascade" }),
    /** **Packs**, not base units. The single most confusable column here. */
    packs: integer("packs").notNull().default(0),
    /** Copied at order time, so a later price change does not rewrite history. */
    pricePencePerPack: integer("price_pence_per_pack").notNull().default(0),
    productId: text("product_id")
      .notNull()
      .references(() => supplierProduct.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("order_line_idx").on(table.orderId, table.productId),
    index("order_line_order_idx").on(table.orderId),
  ]
);

export const supplierRelations = relations(supplier, ({ many }) => ({
  orders: many(purchaseOrder),
  products: many(supplierProduct),
}));

export const ingredientRelations = relations(ingredient, ({ many }) => ({
  counts: many(stockCount),
  products: many(supplierProduct),
}));

export const supplierProductRelations = relations(
  supplierProduct,
  ({ one, many }) => ({
    ingredient: one(ingredient, {
      fields: [supplierProduct.ingredientId],
      references: [ingredient.id],
    }),
    lines: many(orderLine),
    supplier: one(supplier, {
      fields: [supplierProduct.supplierId],
      references: [supplier.id],
    }),
  })
);

export const stockCountRelations = relations(stockCount, ({ one }) => ({
  ingredient: one(ingredient, {
    fields: [stockCount.ingredientId],
    references: [ingredient.id],
  }),
}));

export const purchaseOrderRelations = relations(
  purchaseOrder,
  ({ one, many }) => ({
    lines: many(orderLine),
    supplier: one(supplier, {
      fields: [purchaseOrder.supplierId],
      references: [supplier.id],
    }),
  })
);

export const orderLineRelations = relations(orderLine, ({ one }) => ({
  order: one(purchaseOrder, {
    fields: [orderLine.orderId],
    references: [purchaseOrder.id],
  }),
  product: one(supplierProduct, {
    fields: [orderLine.productId],
    references: [supplierProduct.id],
  }),
}));
