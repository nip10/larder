import { packsToOrder, shortfalls } from "@/lib/reorder";

/**
 * Measure what the reorder suggestion actually asks you to buy.
 *
 * Run against a seeded database. It prints, per shortfall, the quantity the
 * app would put on a purchase order next to the quantity that would get the
 * shelf back to par — and exits non-zero when they disagree.
 *
 * Today it fails, on purpose. That is the task.
 */

const money = (pence: number) =>
  `£${(pence / 100).toFixed(2)}`.padStart(10, " ");

const rows = await shortfalls();
if (rows.length === 0) {
  process.stderr.write("Nothing is below par. Run `bun run db:seed` first.\n");
  process.exit(1);
}

let wrong = 0;
let suggestedPence = 0;
let correctPence = 0;

process.stdout.write(
  `${"ingredient".padEnd(20)}${"short".padStart(9)}${"pack".padStart(9)}${"orders".padStart(9)}${"should be".padStart(11)}\n`
);
process.stdout.write(`${"-".repeat(58)}\n`);

for (const row of rows) {
  const suggested = packsToOrder(row);
  const correct = Math.ceil(row.shortfall / row.packSize);

  suggestedPence += suggested * row.pricePencePerPack;
  correctPence += correct * row.pricePencePerPack;
  if (suggested !== correct) {
    wrong += 1;
  }

  process.stdout.write(
    row.ingredientName.padEnd(20) +
      `${row.shortfall}${row.unit === "each" ? "" : row.unit}`.padStart(9) +
      String(row.packSize).padStart(9) +
      String(suggested).padStart(9) +
      String(correct).padStart(11) +
      (suggested === correct ? "" : "   ←") +
      "\n"
  );
}

process.stdout.write(`${"-".repeat(58)}\n`);
process.stdout.write(`order total suggested : ${money(suggestedPence)}\n`);
process.stdout.write(`order total correct   : ${money(correctPence)}\n`);

const passed = wrong === 0;
process.stdout.write(
  passed
    ? "\nPASS — every line orders packs.\n"
    : `\nFAIL — ${wrong} of ${rows.length} lines order base units as if they were packs.\n`
);

// The exit code is the verdict, so a pipeline stage running this sees the
// same answer a person reading it does.
process.exit(passed ? 0 : 1);
