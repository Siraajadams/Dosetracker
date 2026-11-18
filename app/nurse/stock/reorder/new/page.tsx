
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  createDepotOrder,
  getAssignedPharmacies,
  getBalances,
  getProducts,
  type StockFacility,
  type StockProduct,
} from "@/lib/fpStock";

type OrderLine = {
  product_id: string;
  quantity: string;
};

export default function NewMedicationOrderPage() {
  const searchParams = useSearchParams();

  const requestedSite = searchParams.get("site_id") || "";

  const [facilities, setFacilities] = useState<StockFacility[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [balances, setBalances] = useState<Map<string, number>>(
    new Map()
  );

  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );

  const [lines, setLines] = useState<OrderLine[]>([
    { product_id: "", quantity: "" },
  ]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [sites, medicationList] = await Promise.all([
          getAssignedPharmacies(),
          getProducts(),
        ]);

        setFacilities(sites);
        setProducts(medicationList);

        const selected = sites.some(
          (site) => site.id === requestedSite
        )
          ? requestedSite
          : sites.length === 1
          ? sites[0].id
          : "";

        setFacilityId(selected);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load medication ordering."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [requestedSite]);

  useEffect(() => {
    let cancelled = false;

    async function loadBalances() {
      setBalances(new Map());

      if (!facilityId) return;

      try {
        const result = await getBalances(facilityId);

        if (!cancelled) {
          setBalances(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load stock balances."
          );
        }
      }
    }

    void loadBalances();

    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  const selectedFacility = facilities.find(
    (site) => site.id === facilityId
  );

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  function updateLine(
    index: number,
    field: keyof OrderLine,
    value: string
  ) {
    setLines((current) =>
      current.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      { product_id: "", quantity: "" },
    ]);
  }

  function removeLine(index: number) {
    setLines((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  async function submitOrder() {
    setError("");
    setSuccess("");

    if (!facilityId) {
      setError("Please select a clinic.");
      return;
    }

    if (
      lines.some(
        (line) =>
          !line.product_id ||
          !/^[1-9]\d*$/.test(line.quantity) ||
          !Number.isSafeInteger(Number(line.quantity))
      )
    ) {
      setError(
        "Select a medication and enter a valid positive whole-number quantity for every row."
      );
      return;
    }

    const ids = lines.map((line) => line.product_id);

    if (new Set(ids).size !== ids.length) {
      setError(
        "The same medication appears more than once. Combine quantities into one row."
      );
      return;
    }

    try {
      setSubmitting(true);

      const items = lines.map((line) => ({
        product_id: line.product_id,
        quantity: Number(line.quantity),
      }));

      const id = await createDepotOrder(
        facilityId,
        month,
        items
      );

      setOrderId(id);
      setSuccess("Medication order submitted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit medication order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const totalQuantity = lines.reduce((sum, line) => {
    const value = Number(line.quantity);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  if (loading) {
    return <main style={styles.page}>Loading stock system...</main>;
  }

  return (
    <main style={styles.page}>
      <div className="no-print">
        <Link href="/nurse/stock/reorder">
          ← Back to Medication Orders
        </Link>
      </div>

      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>
            DoseTrack Family Planning
          </p>
          <h1 style={styles.title}>New Medication Order</h1>
          <p style={styles.subtitle}>
            Order medication from the Family Planning Depot
            using your existing clinic stock records.
          </p>
        </div>
      </header>

      {error && (
        <div style={styles.error} role="alert">
          {error}
        </div>
      )}

      {success && (
        <div style={styles.success} role="status">
          {success}
          <p>Order reference: {orderId}</p>
        </div>
      )}

      <section style={styles.card}>
        <h2>Clinic and order details</h2>

        <div style={styles.grid}>
          <label style={styles.field}>
            Clinic
            <select
              style={styles.input}
              value={facilityId}
              disabled={Boolean(orderId)}
              onChange={(e) => setFacilityId(e.target.value)}
            >
              <option value="">Select clinic</option>
              {facilities.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            Order month
            <input
              type="month"
              style={styles.input}
              value={month}
              disabled={Boolean(orderId)}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section style={styles.card}>
        <h2>Medication requirements</h2>
        <p style={styles.subtitle}>
          Stock on hand is retrieved from the Stock Received
          inventory system.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Medication</th>
                <th style={styles.th}>ICN</th>
                <th style={styles.th}>Unit</th>
                <th style={styles.th}>Stock on hand</th>
                <th style={styles.th}>Order quantity</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {lines.map((line, index) => {
                const product = productMap.get(line.product_id);

                return (
                  <tr key={index}>
                    <td style={styles.td}>
                      <select
                        style={styles.input}
                        value={line.product_id}
                        disabled={Boolean(orderId)}
                        onChange={(e) =>
                          updateLine(
                            index,
                            "product_id",
                            e.target.value
                          )
                        }
                      >
                        <option value="">Select medication</option>
                        {products.map((p) => (
                          <option
                            key={p.id}
                            value={p.id}
                            disabled={lines.some(
                              (other, i) =>
                                i !== index &&
                                other.product_id === p.id
                            )}
                          >
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={styles.td}>
                      {product?.icn_number || "—"}
                    </td>

                    <td style={styles.td}>
                      {product?.unit || "—"}
                    </td>

                    <td style={styles.td}>
                      {product
                        ? balances.get(product.id) ?? 0
                        : "—"}
                    </td>

                    <td style={styles.td}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        style={{
                          ...styles.input,
                          width: 110,
                        }}
                        value={line.quantity}
                        disabled={Boolean(orderId)}
                        onChange={(e) =>
                          updateLine(
                            index,
                            "quantity",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td style={styles.td}>
                      <button
                        type="button"
                        disabled={
                          lines.length === 1 ||
                          Boolean(orderId)
                        }
                        onClick={() => removeLine(index)}
                        style={styles.removeButton}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!orderId && (
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={addLine}
          >
            + Add another medication
          </button>
        )}

        <p>
          <strong>Total medications:</strong> {lines.length}
          {" | "}
          <strong>Total units ordered:</strong> {totalQuantity}
        </p>
      </section>

      <section style={styles.card}>
        <h2>Medication Order Report</h2>

        <p>
          <strong>Clinic:</strong>{" "}
          {selectedFacility?.name || "Not selected"}
        </p>
        <p>
          <strong>Order month:</strong> {month}
        </p>
        <p>
          <strong>Depot:</strong> Family Planning Depot
        </p>
        <p>
          <strong>Order reference:</strong>{" "}
          {orderId || "Pending submission"}
        </p>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Medication</th>
              <th style={styles.th}>ICN</th>
              <th style={styles.th}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {lines
              .filter((line) => line.product_id)
              .map((line, index) => {
                const product = productMap.get(line.product_id);

                return (
                  <tr key={index}>
                    <td style={styles.td}>
                      {product?.name || "Unknown"}
                    </td>
                    <td style={styles.td}>
                      {product?.icn_number || "—"}
                    </td>
                    <td style={styles.td}>
                      {line.quantity}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        <div className="no-print" style={styles.actions}>
          {!orderId && (
            <button
              type="button"
              style={styles.primaryButton}
              disabled={submitting || !facilityId}
              onClick={submitOrder}
            >
              {submitting
                ? "Submitting..."
                : "Submit Medication Order"}
            </button>
          )}

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </section>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          main {
            padding: 0 !important;
          }
          button, select, input {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1250,
    margin: "0 auto",
    padding: 24,
    fontFamily: "Arial, sans-serif",
    color: "#17324d",
    background: "#f5f8fc",
    minHeight: "100vh",
  },
  header: {
    marginTop: 20,
    marginBottom: 24,
  },
  eyebrow: {
    color: "#087e8b",
    fontWeight: 700,
  },
  title: {
    fontSize: 30,
    marginBottom: 8,
  },
  subtitle: {
    color: "#66788a",
    lineHeight: 1.6,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dce5ed",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: "white",
    color: "#17324d",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 16,
    marginBottom: 20,
  },
  th: {
    padding: 12,
    textAlign: "left",
    background: "#eaf2f7",
    borderBottom: "1px solid #ccd9e4",
  },
  td: {
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
  },
  actions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 24,
  },
  primaryButton: {
    background: "#087e8b",
    color: "white",
    padding: "12px 20px",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryButton: {
    background: "#e6eff5",
    color: "#17324d",
    padding: "12px 18px",
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    cursor: "pointer",
    marginTop: 10,
  },
  removeButton: {
    background: "#fff0f0",
    color: "#a32626",
    border: "1px solid #f1c4c4",
    borderRadius: 6,
    padding: "8px 12px",
    cursor: "pointer",
  },
  error: {
    background: "#fff0f0",
    color: "#9b2226",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  success: {
    background: "#e9f7ef",
    color: "#176b42",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
};
