
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  getAssignedFacilities,
  getProducts,
  getBalances,
  recordStock,
  type StockProduct,
} from "@/lib/fpStock";

type Movement = "received" | "dispensed" | "wasted";

type Pharmacy = {
  id: string;
  name: string;
};

type Batch = {
  id: string;
  batch_number: string;
  expiry_date: string;
  quantity_on_hand: number;
};

export default function StockTransaction({
  type,
}: {
  type: Movement;
}) {
  const [facilities, setFacilities] = useState<Pharmacy[]>([]);
  const [facility, setFacility] = useState("");
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [product, setProduct] = useState("");
  const [barcode, setBarcode] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
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

        setProducts(meds);

        if (meds.length) setProduct(meds[0].id);

        if (ids.length) {
          const { data, error } = await supabase
            .from("sites")
            .select("id,name")
            .in("id", ids);

          if (error) throw error;

          const names = (data || []) as Pharmacy[];
          setFacilities(names);

          if (names.length === 1) {
            setFacility(names[0].id);
          }
        }
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Loading failed"
        );
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!facility || !product) {
      setBalance(null);
      setBatches([]);
      return;
    }

    let cancelled = false;

    async function loadStock() {
      try {
        const [balances, batchResult] = await Promise.all([
          getBalances(facility),
          supabase
            .from("fp_stock_batches")
            .select(
              "id,batch_number,expiry_date,quantity_on_hand"
            )
            .eq("facility_id", facility)
            .eq("product_id", product)
            .gt("quantity_on_hand", 0)
            .order("expiry_date", { ascending: true }),
        ]);

        if (batchResult.error) throw batchResult.error;

        if (!cancelled) {
          setBalance(balances.get(product) ?? 0);
          const rows = batchResult.data as unknown as Batch[];
          setBatches(rows || []);
          setBatchId(rows?.[0]?.id || "");
        }
      } catch (e) {
        if (!cancelled) {
          setMessage(
            e instanceof Error ? e.message : "Stock loading failed"
          );
        }
      }
    }

    void loadStock();

    return () => {
      cancelled = true;
    };
  }, [facility, product]);

  function lookupBarcode(value: string) {
    setBarcode(value);

    const found = products.find(
      (p) =>
        "barcode" in p &&
        String(p.barcode) === value
    );

    if (found) {
      setProduct(found.id);
      setMessage(`Product identified: ${found.name}`);
    }
  }

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

    if (type === "received") {
      if (!batchNumber.trim() || !expiryDate) {
        setMessage("Batch number and expiry date are required.");
        return;
      }
    } else {
      if (!batchId) {
        setMessage("Select a stock batch.");
        return;
      }

      const selected = batches.find((b) => b.id === batchId);

      if (!selected || qty > selected.quantity_on_hand) {
        setMessage("Insufficient stock in the selected batch.");
        return;
      }

      if (
        type === "dispensed" &&
        selected.expiry_date <
          new Date().toLocaleDateString("en-CA")
      ) {
        setMessage("Expired medication cannot be dispensed.");
        return;
      }
    }

    if (type === "wasted" && !reason.trim()) {
      setMessage("Enter the wastage reason.");
      return;
    }

    setBusy(true);

    try {
      // Requires updated batch-aware RPC.
      const { error } = await supabase.rpc(
        "fp_record_stock_batch",
        {
          p_facility_id: facility,
          p_product_id: product,
          p_type: type,
          p_quantity: qty,
          p_batch_id: type === "received" ? null : batchId,
          p_batch_number:
            type === "received" ? batchNumber.trim() : null,
          p_expiry_date:
            type === "received" ? expiryDate : null,
          p_reason: reason.trim() || null,
          p_reference: reference.trim() || null,
        }
      );

      if (error) throw error;

      setMessage("Stock transaction saved successfully.");
      setQuantity("");
      setReason("");
      setReference("");
      setBatchNumber("");
      setExpiryDate("");

      const balances = await getBalances(facility);
      setBalance(balances.get(product) ?? 0);

      const { data: updatedBatches, error: batchError } =
        await supabase
          .from("fp_stock_batches")
          .select(
            "id,batch_number,expiry_date,quantity_on_hand"
          )
          .eq("facility_id", facility)
          .eq("product_id", product)
          .gt("quantity_on_hand", 0)
          .order("expiry_date");

      if (batchError) throw batchError;

      const rows = updatedBatches as unknown as Batch[];
      setBatches(rows || []);
      setBatchId(rows?.[0]?.id || "");
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    marginTop: 6,
    boxSizing: "border-box",
    background: "white",
    color: "#0f172a",
  };

  const selectedProduct = products.find((p) => p.id === product);

  return (
    <main
      style={{
        maxWidth: 850,
        margin: "32px auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <Link href="/nurse/stock">
        ← Pharmacy Stock Dashboard
      </Link>

      <div style={{ marginTop: 24, marginBottom: 28 }}>
        <h1 style={{ color: "#164c7e", marginBottom: 6 }}>
          DoseTrack
        </h1>
        <p style={{ color: "#64748b" }}>
          Family Planning / Pharmacy Inventory
        </p>
        <h2>{title}</h2>
      </div>

      <form
        onSubmit={submit}
        style={{
          display: "grid",
          gap: 20,
          padding: 24,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
        }}
      >
        <label>
          <strong>Pharmacy</strong>
          <select
            required
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select pharmacy</option>
            {facilities.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <strong>Product Barcode</strong>
          <input
            value={barcode}
            onChange={(e) => lookupBarcode(e.target.value)}
            placeholder="Scan or enter product barcode"
            style={inputStyle}
          />
          <small style={{ color: "#64748b" }}>
            Supports USB and Bluetooth scanners that enter
            barcode text. Camera scanning requires an
            additional scanner component.
          </small>
        </div>

        <label>
          <strong>Medication</strong>
          <select
            required
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            style={inputStyle}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            padding: 18,
            background: "#e0f2fe",
            borderRadius: 10,
          }}
        >
          <strong>{selectedProduct?.name || "Medication"}</strong>
          <p style={{ marginBottom: 0 }}>
            Available stock: {balance ?? "Loading..."}{" "}
            {selectedProduct?.unit || ""}
          </p>
        </div>

        {type === "received" ? (
          <>
            <label>
              <strong>Batch Number</strong>
              <input
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="Enter batch number"
                style={inputStyle}
              />
            </label>

            <label>
              <strong>Expiry Date</strong>
              <input
                required
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                style={inputStyle}
              />
            </label>
          </>
        ) : (
          <label>
            <strong>Select Batch</strong>
            <select
              required
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} | Exp: {b.expiry_date} |
                  Available: {b.quantity_on_hand}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          <strong>Quantity</strong>
          <input
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label>
          <strong>
            {type === "wasted" ? "Wastage Reason" : "Notes"}
          </strong>
          <textarea
            required={type === "wasted"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={inputStyle}
            rows={3}
          />
        </label>

        <label>
          <strong>Delivery / Transaction Reference</strong>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: 16,
            background: "#164c7e",
            color: "white",
            border: 0,
            borderRadius: 9,
            cursor: busy ? "wait" : "pointer",
            fontWeight: 600,
          }}
        >
          {busy ? "Saving..." : `Save ${title}`}
        </button>

        {message && (
          <p role="status" style={{ margin: 0 }}>
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
