"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  nothing_below_par: "Nothing to order from them right now.",
};

/**
 * There is no sign-in yet, so an order is drafted as the café rather than as a
 * person. Real auth is a README task.
 */
export function DraftOrderButton({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  const [drafted, setDrafted] = useState(false);
  const [pending, startTransition] = useTransition();

  const draft = () => {
    startTransition(async () => {
      const response = await fetch("/api/order", {
        body: JSON.stringify({ supplierId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = await response.json();

      if (result.ok) {
        setDrafted(true);
        toast.success(`Draft order for ${supplierName}. Nothing sent yet.`);
        return;
      }
      toast.error(MESSAGES[result.reason] ?? "That did not work.");
    });
  };

  if (drafted) {
    return (
      <Button disabled variant="secondary">
        Drafted
      </Button>
    );
  }

  return (
    <Button disabled={pending} onClick={draft} size="sm">
      {pending ? "Drafting…" : "Draft order"}
    </Button>
  );
}
