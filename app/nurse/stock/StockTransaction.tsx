
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getAssignedFacilities,
  getProducts,
  getBalances,
  recordStock,
  type StockProduct,
} from "@/lib/fpStock";

type Movement = "received" | "dispensed" | "wasted";

export default function StockTransaction({
  type,
}: {
  type: Movement;
}) {
  const [facilities, setFacilities] = useState<string[]>([]);
  const [facility, setFacility] = useState("");
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [ids, meds] = await Promise.all([
          getAssignedFacilities(),
          getProducts(),
        ]);
        setFacilities(ids);
        setProducts(meds);
        if (ids.length === 1) setFacility(ids[0]);
        if (meds.length) setProduct(meds[0].id);
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Loading failed"
        );
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (!facility || !product) return;

    let cancelled = false;
    getBalances(facility)
      .then((balances) => {
        if (!cancelled) {
          setBalance(balances.get(product) || 0);
        }
      })
      .catch((e) => {
        if (!cancelled) setMessage(e.message);
      });

    return () => { cancelled = true; };
  }, [facility, product]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const qty = Number(quantity);

    if (!Number.isSafeInteger(qty) || qty <= 0) {
      setMessage("Enter a valid whole-number quantity.");
      return;
    }

    if (!facility || !product) {
      setMessage("Select pharmacy and medication.");
      return;
    }

    if (type === "wasted" && !reason.trim()) {
      setMessage("Enter the reason for wastage.");
      return;
    }

    setBusy(true);
    try {
      await recordStock(
        facility, product, type, qty, reason, reference
      );

      setMessage("Stock movement saved successfully.");
      setQuantity("");
      setReason("");
      setReference("");

      const balances = await getBalances(facility);
      setBalance(balances.get(product) || 0);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Save failed"
      );
    } finally {
      setBusy(false);
    }
  }

  const title = {
    received: "Stock Received",
    dispensed: "Stock Dispensed",
    wasted: "Stock Wasted",
  }[type];

  return (
    <main style={{
      maxWidth: 680,
      margin: "40px auto",
      padding: 20,
      fontFamily: "Arial"
    }}>
      <Link href="/nurse/stock">← Stock Dashboard</Link>
      <h1>{title}</h1>

      <form onSubmit={submit}
        style={{ display: "grid", gap: 16 }}>

        <label>
          Pharmacy
          <select
            required
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            style={{ display: "block", width: "100%", padding: 12 }}
          >
            <option value="">Select pharmacy</option>
            {facilities.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>

        <label>
          Medication
          <select
            required
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            style={{ display: "block", width: "100%", padding: 12 }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </label>

        <div>
          <strong>Available stock: </strong>
          {balance === null ? "Loading..." : balance}
        </div>

        <label>
          Quantity
          <input
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{ display: "block", width: "100%", padding: 12 }}
          />
        </label>

        <label>
          {type === "wasted" ? "Wastage reason" : "Notes"}
          <textarea
            required={type === "wasted"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ display: "block", width: "100%", padding: 12 }}
          />
        </label>

        <label>
          Delivery / transaction reference
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            style={{ display: "block", width: "100%", padding: 12 }}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: 14,
            background: "#164c7e",
            color: "white",
            border: 0,
            borderRadius: 8
          }}
        >
          {busy ? "Saving..." : `Save ${title}`}
        </button>
      </form>

      {message && <p role="status">{message}</p>}
    </main>
  );
}
