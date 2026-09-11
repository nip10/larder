import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DraftOrderButton } from "@/components/draft-order-button";
import { costOf, packsToOrder, shortfalls, stockLevels } from "@/lib/reorder";

/** The order sheet. Everything starts from what has run down. */
export const dynamic = "force-dynamic";

const UNIT_LABEL: Record<string, string> = { each: "", g: "g", ml: "ml" };

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const quantity = (value: number, unit: string) =>
  `${value.toLocaleString("en-GB")}${UNIT_LABEL[unit] ?? ""}`;

export default async function OrderSheetPage() {
  const [rows, levels] = await Promise.all([shortfalls(), stockLevels()]);

  const bySupplier = new Map<string, typeof rows>();
  for (const row of rows) {
    bySupplier.set(row.supplierId, [
      ...(bySupplier.get(row.supplierId) ?? []),
      row,
    ]);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Larder</h1>
        <p className="mt-1 text-muted-foreground">
          What has run down, and who to buy it from.
        </p>
      </header>

      <div className="space-y-8">
        {[...bySupplier.entries()].map(([supplierId, lines]) => {
          const first = lines[0];
          if (!first) {
            return null;
          }

          return (
            <section key={supplierId}>
              <h2 className="mb-3 flex items-baseline justify-between text-sm font-medium text-muted-foreground">
                <span>{first.supplierName}</span>
                <span className="font-mono tabular-nums">
                  {money(costOf(lines))}
                </span>
              </h2>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {lines.length} below par
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {lines.map((line) => (
                    <div
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-3 last:border-0 last:pb-0"
                      key={line.productId}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {line.ingredientName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {quantity(line.onHand, line.unit)} on hand · par{" "}
                          {quantity(line.parLevel, line.unit)} ·{" "}
                          {line.packLabel}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        order {packsToOrder(line).toLocaleString("en-GB")} ×{" "}
                        {line.packLabel}
                      </Badge>
                    </div>
                  ))}

                  <div className="flex justify-end pt-1">
                    <DraftOrderButton
                      supplierId={supplierId}
                      supplierName={first.supplierName}
                    />
                  </div>
                </CardContent>
              </Card>
            </section>
          );
        })}

        {rows.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing is below par. Run <code>bun run db:seed</code>.
          </p>
        ) : null}

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Everything on the shelf
          </h2>
          <Card>
            <CardContent className="space-y-2 py-4">
              {levels.map((row) => (
                <div
                  className="flex items-baseline justify-between gap-4 text-sm"
                  key={row.id}
                >
                  <span>{row.name}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {quantity(row.onHand, row.baseUnit)} /{" "}
                    {quantity(row.parLevel, row.baseUnit)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
