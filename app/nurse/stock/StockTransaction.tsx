
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getAssignedPharmacies,
  getProducts,
  getBalances,
  getStockBatches,
  findProductByBarcode,
  recordStockBatch,
  type StockFacility,
  type StockProduct,
  type StockBatch,
  type StockMovement,
} from "@/lib/fpStock";

type Props = {
  type: StockMovement;
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  marginTop: 6,
  boxSizing: "border-box",
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#334155",
};

export default function StockTransaction({ type }: Props) {
  const [facilities, setFacilities] =
    useState<StockFacility[]>([]);
  const [facility, setFacility] = useState("");
  const [products, setProducts] =
    useState<StockProduct[]>([]);
  const [product, setProduct] = useState("");

  const [barcode, setBarcode] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] =
    useState<StockBatch[]>([]);

  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [balance, setBalance] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const title = {
    received: "Stock Received",
    dispensed: "Stock Dispensed",
    wasted: "Stock Wasted",
  }[type];

  const selectedProduct = products.find(
    (p) => p.id === product
  );

  async function refreshStock(
    facilityId: string,
    productId: string
  ) {
    const [balances, batchRows] = await Promise.all([
      getBalances(facilityId),
      getStockBatches(facilityId, productId),
    ]);

    setBalance(balances.get(productId) ?? 0);
    setBatches(batchRows);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [pharmacies, medications] =
          await Promise.all([
            getAssignedPharmacies(),
            getProducts(),
          ]);

        if (cancelled) return;

        setFacilities(pharmacies);
        setProducts(medications);

        if (pharmacies.length === 1) {
          setFacility(pharmacies[0].id);
        }

        if (medications.length) {
          setProduct(medications[0].id);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load stock data."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!facility || !product) {
      setBalance(null);
      setBatches([]);
      setBatchId("");
      return;
    }

    let cancelled = false;

    async function loadStock() {
      try {
        const [balances, batchRows] =
          await Promise.all([
            getBalances(facility),
            getStockBatches(facility, product),
          ]);

        if (cancelled) return;

        setBalance(balances.get(product) ?? 0);
        setBatches(batchRows);
        setBatchId("");
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load stock."
          );
        }
      }
    }

    void loadStock();

    return () => {
      cancelled = true;
    };
  }, [facility, product]);

  async function lookupBarcode() {
    setMessage("");

    if (!barcode.trim()) {
      setMessage("Enter or scan a barcode.");
      return;
    }

    try {
      const found = await findProductByBarcode(
        barcode.trim()
      );

      if (!found) {
        setMessage(
          "Barcode not found. Select the medication manually."
        );
        return;
      }

      setProduct(found.id);
      setMessage(
        `Medication identified: ${found.name}`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Barcode lookup failed."
      );
    }
  }

  async function submit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    const qty = Number(quantity);

    if (!facility || !product) {
      setMessage("Select pharmacy and medication.");
      return;
    }

    if (
      !Number.isSafeInteger(qty) ||
      qty <= 0
    ) {
      setMessage(
        "Enter a valid whole-number quantity."
      );
      return;
    }

    if (type === "received") {
      if (!batchNumber.trim() || !expiryDate) {
        setMessage(
          "Batch number and expiry date are required."
        );
        return;
      }
    } else {
      if (!batchId) {
        setMessage("Select a medication batch.");
        return;
      }

      const selectedBatch = batches.find(
        (batch) => batch.id === batchId
      );

      if (
        !selectedBatch ||
        qty > selectedBatch.quantity_on_hand
      ) {
        setMessage(
          "Quantity exceeds available batch stock."
        );
        return;
      }
    }

    if (type === "wasted" && !reason.trim()) {
      setMessage("Enter a wastage reason.");
      return;
    }

    setBusy(true);

    try {
      await recordStockBatch(
        facility,
        product,
        type,
        qty,
        {
          batchId:
            type === "received"
              ? undefined
              : batchId,
          batchNumber:
            type === "received"
              ? batchNumber.trim()
              : undefined,
          expiryDate:
            type === "received"
              ? expiryDate
              : undefined,
          reason,
          reference,
        }
      );

      setMessage(
        `${title} saved successfully.`
      );

      setQuantity("");
      setReason("");
      setReference("");
      setBatchNumber("");
      setExpiryDate("");
      setBatchId("");

      await refreshStock(facility, product);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save transaction."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "30px auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <Link
        href="/nurse/stock"
        style={{ color: "#2563eb" }}
      >
        ← Back to Stock Dashboard
      </Link>

      <header style={{ margin: "24px 0" }}>
        <h1 style={{ marginBottom: 8 }}>
          DoseTrack | {title}
        </h1>
        <p style={{ color: "#64748b" }}>
          Family Planning Pharmacy Inventory
        </p>
      </header>

      <section
        style={{
          padding: 24,
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          background: "#fff",
        }}
      >
        {loading ? (
          <p>Loading pharmacy inventory...</p>
        ) : (
          <form
            onSubmit={submit}
            style={{
              display: "grid",
              gap: 20,
            }}
          >
            <label style={labelStyle}>
              Pharmacy
              <select
                style={inputStyle}
                required
                value={facility}
                onChange={(e) =>
                  setFacility(e.target.value)
                }
              >
                <option value="">
                  Select pharmacy
                </option>
                {facilities.map((site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <label style={labelStyle}>
                Scan / Enter Barcode
                <input
                  style={inputStyle}
                  value={barcode}
                  placeholder="Scan barcode or enter number"
                  onChange={(e) =>
                    setBarcode(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void lookupBarcode();
                    }
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() =>
                  void lookupBarcode()
                }
                style={{
                  marginTop: 10,
                  padding: "10px 18px",
                  background: "#e2e8f0",
                  border: 0,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Find Medication
              </button>
            </div>

            <label style={labelStyle}>
              Medication
              <select
                style={inputStyle}
                required
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value);
                  setBatchId("");
                }}
              >
                <option value="">
                  Select medication
                </option>
                {products.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </label>

            <div
              style={{
                padding: 18,
                background: "#eff6ff",
                borderRadius: 10,
              }}
            >
              <strong>Current Stock Balance</strong>
              <h2 style={{ margin: "8px 0" }}>
                {balance === null
                  ? "—"
                  : balance}
                {" "}
                {selectedProduct?.unit ?? ""}
              </h2>
            </div>

            {type === "received" ? (
              <>
                <label style={labelStyle}>
                  Batch Number
                  <input
                    style={inputStyle}
                    required
                    value={batchNumber}
                    placeholder="e.g. LOT2026A001"
                    onChange={(e) =>
                      setBatchNumber(e.target.value)
                    }
                  />
                </label>

                <label style={labelStyle}>
                  Expiry Date
                  <input
                    type="date"
                    style={inputStyle}
                    required
                    value={expiryDate}
                    onChange={(e) =>
                      setExpiryDate(e.target.value)
                    }
                  />
                </label>
              </>
            ) : (
              <label style={labelStyle}>
                Select Batch
                <select
                  style={inputStyle}
                  required
                  value={batchId}
                  onChange={(e) =>
                    setBatchId(e.target.value)
                  }
                >
                  <option value="">
                    Select available batch
                  </option>
                  {batches.map((batch) => (
                    <option
                      key={batch.id}
                      value={batch.id}
                    >
                      {batch.batch_number}
                      {" | Exp: "}
                      {batch.expiry_date}
                      {" | Qty: "}
                      {batch.quantity_on_hand}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label style={labelStyle}>
              Quantity
              <input
                type="number"
                min="1"
                step="1"
                required
                style={inputStyle}
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value)
                }
              />
            </label>

            <label style={labelStyle}>
              {type === "wasted"
                ? "Wastage Reason"
                : "Notes"}
              <textarea
                style={inputStyle}
                rows={3}
                required={type === "wasted"}
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value)
                }
              />
            </label>

            <label style={labelStyle}>
              Delivery / Transaction Reference
              <input
                style={inputStyle}
                value={reference}
                onChange={(e) =>
                  setReference(e.target.value)
                }
              />
            </label>

            <button
              type="submit"
              disabled={busy || !facility}
              style={{
                padding: 15,
                background: "#164c7e",
                color: "white",
                border: 0,
                borderRadius: 9,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy
                ? "Saving..."
                : `Save ${title}`}
            </button>

            {message && (
              <p
                role="status"
                style={{
                  padding: 12,
                  background: "#f1f5f9",
                  borderRadius: 8,
                }}
              >
                {message}
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
