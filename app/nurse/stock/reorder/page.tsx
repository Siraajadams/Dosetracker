
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  getAssignedFacilities,
  getProducts,
  getBalances,
  createDepotOrder,
  type StockProduct,
} from "@/lib/fpStock";

export default function ReorderPage() {
  const [facilities, setFacilities] = useState<string[]>([]);
  const [facility, setFacility] = useState("");
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [balances, setBalances] = useState<Map<string, number>>(
    new Map()
  );
  const [quantities, setQuantities] = useState<
    Record<string, string>
  >({});
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [orderId, setOrderId] = useState("");
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
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Loading failed"
        );
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (!facility) return;
    let cancelled = false;

    getBalances(facility)
      .then((data) => {
        if (!cancelled) setBalances(data);
      })
      .catch((e) => {
        if (!cancelled) setMessage(e.message);
      });

    return () => { cancelled = true; };
  }, [facility]);

  async function createOrder() {
    setMessage("");

    const items = Object.entries(quantities)
      .filter(([, value]) => Number(value) > 0)
      .map(([product_id, value]) => ({
        product_id,
        quantity: Number(value),
      }));

    if (!facility || !items.length) {
      setMessage("Select a pharmacy and order quantities.");
      return;
    }

    if (items.some((i) =>
      !Number.isSafeInteger(i.quantity) ||
      i.quantity <= 0
    )) {
      setMessage("Quantities must be positive whole numbers.");
      return;
    }

    setBusy(true);
    try {
      const id = await createDepotOrder(
        facility, month, items
      );

      const { error } = await supabase.rpc(
        "fp_prepare_depot_order",
        { p_order_id: id }
      );
      if (error) throw error;

      setOrderId(id);
      setMessage(
        "Depot order prepared. Download or copy the order " +
        "and submit it through the authorised depot channel."
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Order failed"
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadOrder() {
    const rows = [
      "DoseTrack Family Planning Depot Order",
      `Order ID,${orderId}`,
      `Facility ID,${facility}`,
      `Month,${month}`,
      "",
      "ICN,Medication,Unit,Current Stock,Quantity Requested",
      ...products
        .filter((p) => Number(quantities[p.id]) > 0)
        .map((p) =>
          [
            p.icn_number || "",
            `"${p.name.replace(/"/g, '""')}"`,
            p.unit,
            balances.get(p.id) || 0,
            quantities[p.id],
          ].join(",")
        ),
    ];

    const blob = new Blob(
      [rows.join("\r\n")],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `depot-order-${orderId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{
      maxWidth: 1000,
      margin: "30px auto",
      padding: 20,
      fontFamily: "Arial"
    }}>
      <Link href="/nurse/stock">
        ← Stock Dashboard
      </Link>

      <h1>Medication Reorder</h1>
      <p>Create a depot order for your assigned pharmacy.</p>

      <label>
        Pharmacy
        <select
          value={facility}
          onChange={(e) => {
            setFacility(e.target.value);
            setQuantities({});
            setOrderId("");
          }}
          style={{ display: "block", padding: 12 }}
        >
          <option value="">Select pharmacy</option>
          {facilities.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>

      <p>
        Order month:{" "}
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse"
        }}>
          <thead>
            <tr>
              <th align="left">Medication</th>
              <th>Unit</th>
              <th>Current stock</th>
              <th>Order quantity</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: 12 }}>{p.name}</td>
                <td align="center">{p.unit}</td>
                <td align="center">
                  {balances.get(p.id) || 0}
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!!orderId}
                    value={quantities[p.id] || ""}
                    onChange={(e) =>
                      setQuantities((old) => ({
                        ...old,
                        [p.id]: e.target.value,
                      }))
                    }
                    style={{ width: 90, padding: 8 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!orderId && (
        <button
          onClick={createOrder}
          disabled={busy || !facility}
          style={{
            marginTop: 24,
            padding: 14,
            background: "#164c7e",
            color: "white",
            border: 0,
            borderRadius: 8
          }}
        >
          {busy ? "Preparing..." : "Prepare Depot Order"}
        </button>
      )}

      {orderId && (
        <div style={{ marginTop: 20 }}>
          <p>Order reference: {orderId}</p>
          <button onClick={downloadOrder}>
            Download Depot Order CSV
          </button>
          <p>
            Send the file to the depot using its approved
            ordering channel.
          </p>
          <Link href="/nurse/stock/orders">
            View Order History
          </Link>
        </div>
      )}

      {message && <p role="status">{message}</p>}
    </main>
  );
}
