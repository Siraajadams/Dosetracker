
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAssignedFacilities } from "@/lib/fpStock";

type Order = {
  id: string;
  order_number: string;
  facility_id: string;
  order_month: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
};

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const facilities = await getAssignedFacilities();

      if (facilities.length === 0) {
        setOrders([]);
        return;
      }

      const result = await supabase
        .from("fp_depot_orders")
        .select("*")
        .in("facility_id", facilities)
        .order("created_at", { ascending: false });

      if (result.error) {
        throw new Error(result.error.message);
      }

      const rawData: unknown = result.data;

      if (!Array.isArray(rawData)) {
        throw new Error("Unexpected order data format.");
      }

      const parsedOrders: Order[] = rawData
        .filter((item): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null &&
          !Array.isArray(item)
        )
        .filter((item) =>
          typeof item.id === "string" &&
          typeof item.order_number === "string" &&
          typeof item.facility_id === "string" &&
          typeof item.order_month === "string" &&
          typeof item.status === "string" &&
          typeof item.created_at === "string"
        )
        .map((item) => ({
          id: String(item.id),
          order_number: String(item.order_number),
          facility_id: String(item.facility_id),
          order_month: String(item.order_month),
          status: String(item.status),
          created_at: String(item.created_at),
          submitted_at:
            typeof item.submitted_at === "string"
              ? item.submitted_at
              : null,
        }));

      setOrders(parsedOrders);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load depot orders."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function confirmSubmission(orderId: string) {
    const reference = window.prompt(
      "Enter depot submission reference or email confirmation ID:"
    );

    if (!reference || !reference.trim()) return;

    setBusyId(orderId);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "fp_confirm_depot_submission",
        {
          p_order_id: orderId,
          p_submission_reference: reference.trim(),
        }
      );

      if (error) throw new Error(error.message);

      await load();
      setMessage("Depot submission recorded successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update order."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <Link href="/nurse/stock">
        ← Stock Dashboard
      </Link>

      <h1 style={{ marginTop: 24 }}>
        Depot Order History
      </h1>

      <p>
        View medication orders submitted by your
        assigned pharmacies.
      </p>

      {message && (
        <p
          role="status"
          style={{
            padding: 14,
            background: "#e0f2fe",
            borderRadius: 8,
          }}
        >
          {message}
        </p>
      )}

      {loading ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p>No depot orders found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 20,
            }}
          >
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ padding: 12 }}>Order</th>
                <th style={{ padding: 12 }}>Pharmacy</th>
                <th style={{ padding: 12 }}>Month</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Created</th>
                <th style={{ padding: 12 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <td style={{ padding: 12 }}>
                    {order.order_number}
                  </td>

                  <td style={{ padding: 12 }}>
                    {order.facility_id}
                  </td>

                  <td style={{ padding: 12 }}>
                    {order.order_month}
                  </td>

                  <td style={{ padding: 12 }}>
                    {order.status}
                  </td>

                  <td style={{ padding: 12 }}>
                    {new Date(
                      order.created_at
                    ).toLocaleDateString("en-ZA")}
                  </td>

                  <td style={{ padding: 12 }}>
                    {order.status === "ready_to_send" ? (
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() =>
                          void confirmSubmission(order.id)
                        }
                        style={{
                          padding: "10px 14px",
                          background: "#0f766e",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        {busyId === order.id
                          ? "Saving..."
                          : "Confirm Sent"}
                      </button>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 30 }}>
        <Link href="/nurse/stock/reorder">
          + Create New Depot Order
        </Link>
      </div>
    </main>
  );
}
