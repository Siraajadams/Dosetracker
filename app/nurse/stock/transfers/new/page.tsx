
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAssignedFacilities } from "@/lib/fpStock";

type Transfer = {
  id: string;
  source_facility_id: string;
  destination_facility_id: string;
  status: string;
  reason: string;
  created_at: string;
};

type Site = {
  id: string;
  site_name: string;
};

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in.");

      const ids = await getAssignedFacilities();
      setAssigned(ids);

      if (!ids.length) {
        setTransfers([]);
        setSites([]);
        return;
      }

      const [t, s] = await Promise.all([
        supabase
          .from("fp_stock_transfers")
          .select(
            "id,source_facility_id,destination_facility_id,status,reason,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("sites")
          .select("id,site_name"),
      ]);

      if (t.error) throw t.error;
      if (s.error) throw s.error;

      setTransfers(
        ((t.data || []) as Transfer[]).filter(
          (row) =>
            ids.includes(row.source_facility_id) ||
            ids.includes(row.destination_facility_id)
        )
      );
      setSites((s.data || []) as Site[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load transfers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const name = (id: string) =>
    sites.find((s) => s.id === id)?.site_name || id;

  const visible = transfers.filter((t) => {
    if (filter === "incoming")
      return assigned.includes(t.destination_facility_id);
    if (filter === "outgoing")
      return assigned.includes(t.source_facility_id);
    if (filter === "pending")
      return ["requested", "approved", "dispatched"].includes(t.status);
    return true;
  });

  return (
    <main style={page}>
      <Link href="/nurse/stock">← Stock Dashboard</Link>

      <header style={header}>
        <div>
          <p style={eyebrow}>DOSETRACK / FAMILY PLANNING</p>
          <h1>Inter-Clinic Stock Transfers</h1>
          <p style={muted}>
            Request, approve, dispatch and receive stock between clinics.
          </p>
        </div>
        <Link href="/nurse/stock/transfers/new" style={primaryLink}>
          + New Transfer Request
        </Link>
      </header>

      {error && <p role="alert" style={errorBox}>{error}</p>}

      <section style={card}>
        <div style={header}>
          <h2>Transfer History</h2>
          <button onClick={() => void load()} style={button}>
            Refresh
          </button>
        </div>

        <div style={filters}>
          {["all", "incoming", "outgoing", "pending"].map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                ...button,
                background: filter === value ? "#164c7e" : "#fff",
                color: filter === value ? "#fff" : "#164c7e",
              }}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p>Loading transfers...</p>
        ) : !assigned.length ? (
          <p>No clinics are assigned to your account.</p>
        ) : !visible.length ? (
          <p>No transfers found.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {visible.map((t) => (
              <Link
                key={t.id}
                href={`/nurse/stock/transfers/${t.id}`}
                style={transferCard}
              >
                <div style={header}>
                  <strong>{name(t.source_facility_id)}</strong>
                  <span style={{ color: "#0f766e" }}>→</span>
                  <strong>{name(t.destination_facility_id)}</strong>
                </div>
                <p style={muted}>{t.reason}</p>
                <div style={header}>
                  <span style={statusStyle}>{t.status.replaceAll("_", " ")}</span>
                  <span style={muted}>
                    {new Date(t.created_at).toLocaleDateString("en-ZA")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1150, margin: "30px auto", padding: 20,
  fontFamily: "Arial, sans-serif", color: "#17333b",
};
const header: React.CSSProperties = {
  display: "flex", justifyContent: "space-between",
  alignItems: "center", gap: 16, flexWrap: "wrap",
};
const eyebrow: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, color: "#0f766e",
};
const muted: React.CSSProperties = { color: "#64748b", fontSize: 14 };
const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0",
  borderRadius: 14, padding: 22, marginTop: 24,
};
const transferCard: React.CSSProperties = {
  display: "block", padding: 18, borderRadius: 10,
  border: "1px solid #e2e8f0", textDecoration: "none",
  color: "#17333b",
};
const button: React.CSSProperties = {
  border: "1px solid #cbd5e1", borderRadius: 8,
  padding: "10px 14px", cursor: "pointer",
  background: "#fff", color: "#164c7e", fontWeight: 700,
};
const filters: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20,
};
const primaryLink: React.CSSProperties = {
  background: "#164c7e", color: "#fff", padding: "12px 18px",
  borderRadius: 8, textDecoration: "none", fontWeight: 700,
};
const statusStyle: React.CSSProperties = {
  background: "#e6f7ef", color: "#087f5b",
  borderRadius: 20, padding: "6px 12px",
  fontSize: 12, fontWeight: 700,
};
const errorBox: React.CSSProperties = {
  background: "#fff0f0", color: "#a02727",
  padding: 14, borderRadius: 8,
};

