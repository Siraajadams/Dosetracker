
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

  async function load() {
    try {
      const facilities = await getAssignedFacilities();

      if (!facilities.length) {
        setOrders([]);
        return;
      }

      const { data, error } = await supabase
        .from("fp_depot_orders")
        .select(
          "id,order_number,facility_id,order_month," +
          "status,created_at,submitted_at"
        )
        .in("facility_id", facilities)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data || []) as Order[]);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Loading failed"
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function confirmSubmission(id: string) {
    const reference = window.prompt(
      "Enter the depot submission reference or email confirmation ID:"
    );

    if (!reference?.trim()) return;

    setBusyId(id);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "fp_confirm_depot_submission",
        {
          p_order_id: id,
          p_submission_reference: reference.trim(),
        }
      );

      if (error) throw error;
      await load();
      setMessage("Depot submission recorded.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Update failed"
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main style={{
      maxWidth: 1000,
      margin: "40px auto",
      padding: 20,
      fontFamily: "Arial"
    }}>
      <Link href="/nurse/stock">
        ← Stock Dashboard
      </Link>

      <h1>Depot Order History</h1>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Month</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.order_number}</td>
                <td>{o.order_month}</td>
                <td>{o.status}</td>
                <td>
                  {new Date(o.created_at)
                    .toLocaleDateString("en-ZA")}
                </td>
                <td>
                  {o.status === "ready_to_send" && (
                    <button
                      disabled={busyId === o.id}
                      onClick={() =>
                        confirmSubmission(o.id)
                      }
                    >
                      Confirm sent to depot
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <p role="status">{message}</p>}
    </main>
  );
}
