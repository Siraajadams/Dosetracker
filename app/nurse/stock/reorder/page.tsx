
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getAssignedFacilities,
  getProducts,
  getBalances,
  createDepotOrder,
  type StockProduct,
} from "@/lib/fpStock";
import { supabase } from "@/lib/supabaseClient";

type Facility = {
  id: string;
  name: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function currentMonth(): string {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0")
  );
}

function csvCell(value: string | number): string {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  background: "#164c7e",
  color: "#fff",
  padding: "12px 18px",
  border: 0,
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

export default function ReorderPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facility, setFacility] = useState("");
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [balances, setBalances] = useState<Map<string, number>>(
    new Map()
  );
  const [quantities, setQuantities] = useState<
    Record<string, string>
  >({});
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [orderId, setOrderId] = useState("");
  const [submittedItems, setSubmittedItems] = useState<
    { product_id: string; quantity: number }[]
  >([]);
  const [submittedBalances, setSubmittedBalances] = useState<
    Map<string, number>
  >(new Map());
  const [submittedFacilityName, setSubmittedFacilityName] =
    useState("");
  const [submittedMonth, setSubmittedMonth] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [ids, meds] = await Promise.all([
          getAssignedFacilities(),
          getProducts(),
        ]);

        const { data: sites, error } = await supabase
          .from("sites")
          .select("id,name")
          .in("id", ids);

        if (error) throw error;
        if (cancelled) return;

        const siteNames = new Map(
          (sites || []).map((site) => [
            String(site.id),
            String(site.name || site.id),
          ])
        );

        setFacilities(
          ids.map((id) => ({
            id,
            name: siteNames.get(id) || id,
          }))
        );

        setProducts(meds);

        if (ids.length === 1) {
          setFacility(ids[0]);
        }
      } catch (error) {
        if (!cancelled) setMessage(errorMessage(error));
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
    if (!facility) {
      setBalances(new Map());
      return;
    }

    let cancelled = false;

    async function loadBalances() {
      setLoadingStock(true);

      try {
        const data = await getBalances(facility);
        if (!cancelled) setBalances(data);
      } catch (error) {
        if (!cancelled) setMessage(errorMessage(error));
      } finally {
        if (!cancelled) setLoadingStock(false);
      }
    }

    void loadBalances();

    return () => {
      cancelled = true;
    };
  }, [facility]);

  const facilityName =
    facilities.find((f) => f.id === facility)?.name ||
    "Not selected";

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.icn_number || "").toLowerCase().includes(query)
    );
  }, [products, search]);

  const items = useMemo(() => {
    return products
      .map((p) => ({
        product_id: p.id,
        quantity: Number(quantities[p.id] || 0),
      }))
      .filter((item) => item.quantity > 0);
  }, [products, quantities]);

  const totalQuantity = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const invalidQuantity = Object.values(quantities).some(
    (value) =>
      value !== "" &&
      (!Number.isSafeInteger(Number(value)) ||
        Number(value) < 0)
  );

  async function refreshStock() {
    if (!facility) return;

    setLoadingStock(true);
    setMessage("");

    try {
      setBalances(await getBalances(facility));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoadingStock(false);
    }
  }

  async function createOrder() {
    if (busy || orderId) return;

    setMessage("");

    if (!facility) {
      setMessage("Please select a pharmacy.");
      return;
    }

    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      setMessage("Select a valid order month.");
      return;
    }

    if (invalidQuantity) {
      setMessage("Enter valid whole-number quantities.");
      return;
    }

    if (!items.length) {
      setMessage("Enter at least one medication quantity.");
      return;
    }

    setBusy(true);

    let createdId = "";

    try {
      createdId = await createDepotOrder(
        facility,
        month,
        items
      );

      setOrderId(createdId);
      setSubmittedItems(items.map((item) => ({ ...item })));
      setSubmittedBalances(new Map(balances));
      setSubmittedFacilityName(facilityName);
      setSubmittedMonth(month);

      // Prepare the existing order for depot submission.
      const { error } = await supabase.rpc(
        "fp_prepare_depot_order",
        { p_order_id: createdId }
      );

      if (error) throw error;

      setMessage(
        "Depot order prepared successfully. Download " +
        "the order and send it through the authorised " +
        "depot ordering channel."
      );
    } catch (error) {
      setMessage(
        createdId
          ? "Order created with reference " +
              createdId +
              ", but depot preparation failed: " +
              errorMessage(error) +
              ". Check order history before retrying."
          : errorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadOrder() {
    if (!orderId) return;

    const rows = [
      ["DoseTrack Family Planning Depot Order"],
      ["Order Reference", orderId],
      ["Pharmacy", submittedFacilityName],
      ["Facility ID", facility],
      ["Order Month", submittedMonth],
      ["Date Generated", new Date().toLocaleDateString("en-ZA")],
      [],
      [
        "ICN Number",
        "Medication",
        "Unit",
        "Current Stock",
        "Quantity Requested",
      ],
      ...submittedItems.map((item) => {
        const p = products.find(
          (product) => product.id === item.product_id
        );

        return [
          p?.icn_number || "",
          p?.name || item.product_id,
          p?.unit || "",
          submittedBalances.get(item.product_id) || 0,
          item.quantity,
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `DoseTrack-Depot-Order-${orderId}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main
      style={{
        maxWidth: 1150,
        margin: "30px auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
        color: "#1e293b",
      }}
    >
      <Link href="/nurse/stock">
        ← Stock Dashboard
      </Link>

      <header style={{ margin: "24px 0" }}>
        <h1 style={{ marginBottom: 8 }}>
          Medication Reorder
        </h1>
        <p style={{ color: "#64748b" }}>
          DoseTrack Family Planning | Depot Ordering
        </p>
      </header>

      <section
        style={{
          background: "#f8fafc",
          padding: 22,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <h2>Pharmacy Order Details</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 18,
          }}
        >
          <label>
            <strong>Pharmacy</strong>
            <select
              style={{ ...fieldStyle, marginTop: 8 }}
              value={facility}
              disabled={!!orderId}
              onChange={(e) => {
                setFacility(e.target.value);
                setQuantities({});
                setBalances(new Map());
                setMessage("");
              }}
            >
              <option value="">Select pharmacy</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <strong>Order Month</strong>
            <input
              type="month"
              style={{ ...fieldStyle, marginTop: 8 }}
              value={month}
              disabled={!!orderId}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        </div>

        <p style={{ color: "#64748b" }}>
          {loading
            ? "Loading pharmacy information..."
            : `${facilities.length} assigned pharmacy(s)`}
        </p>
      </section>

      <section
        style={{
          background: "#fff",
          padding: 20,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
        }}
      >
        <h2>Medication Order Form</h2>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <input
            placeholder="Search medication or ICN number"
            aria-label="Search medication or ICN number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              ...fieldStyle,
              flex: "1 1 260px",
              width: "auto",
            }}
          />

          <button
            type="button"
            onClick={() => void refreshStock()}
            disabled={!facility || loadingStock}
            style={{
              ...buttonStyle,
              background: "#475569",
            }}
          >
            {loadingStock ? "Refreshing..." : "Refresh Stock"}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 680,
            }}
          >
            <thead style={{ background: "#164c7e", color: "#fff" }}>
              <tr>
                {[
                  "ICN",
                  "Medication",
                  "Unit",
                  "Current Stock",
                  "Order Quantity",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: 12,
                      textAlign: "left",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((p, index) => (
                <tr
                  key={p.id}
                  style={{
                    background:
                      index % 2 === 0 ? "#fff" : "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <td style={{ padding: 12 }}>
                    {p.icn_number || "—"}
                  </td>

                  <td style={{ padding: 12 }}>
                    <strong>{p.name}</strong>
                  </td>

                  <td style={{ padding: 12 }}>
                    {p.unit}
                  </td>

                  <td style={{ padding: 12 }}>
                    {loadingStock
                      ? "..."
                      : balances.get(p.id) ?? 0}
                  </td>

                  <td style={{ padding: 12 }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      aria-label={`Order quantity for ${p.name}`}
                      disabled={!facility || !!orderId}
                      value={quantities[p.id] || ""}
                      onChange={(e) =>
                        setQuantities((old) => ({
                          ...old,
                          [p.id]: e.target.value,
                        }))
                      }
                      style={{
                        ...fieldStyle,
                        width: 110,
                      }}
                    />
                  </td>
                </tr>
              ))}

              {!filteredProducts.length && (
                <tr>
                  <td colSpan={5} style={{ padding: 20 }}>
                    No matching medications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={{
          marginTop: 24,
          padding: 22,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#f8fafc",
        }}
      >
        <h2>Order Summary</h2>

        <p>
          <strong>Pharmacy:</strong> {facilityName}
        </p>
        <p>
          <strong>Order month:</strong> {month}
        </p>
        <p>
          <strong>Medication lines:</strong> {items.length}
        </p>
        <p>
          <strong>Total units requested:</strong>{" "}
          {totalQuantity}
        </p>

        {!orderId ? (
          <button
            type="button"
            onClick={() => void createOrder()}
            disabled={
              busy ||
              loading ||
              loadingStock ||
              !facility ||
              !items.length ||
              invalidQuantity
            }
            style={{
              ...buttonStyle,
              opacity:
                busy ||
                loading ||
                loadingStock ||
                !facility ||
                !items.length ||
                invalidQuantity
                  ? 0.5
                  : 1,
            }}
          >
            {busy ? "Preparing Order..." : "Prepare Depot Order"}
          </button>
        ) : (
          <div>
            <p>
              <strong>Order reference:</strong> {orderId}
            </p>

            <button
              type="button"
              onClick={downloadOrder}
              style={buttonStyle}
            >
              Download Depot Order CSV
            </button>

            <p style={{ color: "#475569" }}>
              Submit the downloaded order through the
              authorised depot ordering channel.
            </p>

            <Link href="/nurse/stock/orders">
              View Depot Order History
            </Link>
          </div>
        )}

        {message && (
          <p
            role="status"
            style={{
              marginTop: 18,
              padding: 12,
              background: "#e2e8f0",
              borderRadius: 8,
              overflowWrap: "anywhere",
            }}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
