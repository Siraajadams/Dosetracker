
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAssignedFacilities } from "@/lib/fpStock";

type Transfer = {
  id: string;
  source_facility_id: string;
  destination_facility_id: string;
  status: string;
  reason: string | null;
  created_at: string;
};

type Site = {
  id: string;
  site_name: string;
};

type Filter = "all" | "incoming" | "outgoing" | "pending";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f4f8fa",
  padding: "28px 16px",
  fontFamily: "Arial, sans-serif",
  color: "#17333b",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 22,
};

const primaryButton: React.CSSProperties = {
  background: "#164c7e",
  color: "#fff",
  padding: "13px 18px",
  border: 0,
  borderRadius: 9,
  fontWeight: 700,
  cursor: "pointer",
};

export default function StockTransfersPage() {
  const router = useRouter();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Please sign in to view transfers.");
      }

      const facilities = await getAssignedFacilities();
      setAssigned(facilities);

      if (facilities.length === 0) {
        setTransfers([]);
        setSites([]);
        return;
      }

      const [transferResult, siteResult] = await Promise.all([
        supabase
          .from("fp_stock_transfers")
          .select(
            "id,source_facility_id,destination_facility_id,status,reason,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(500),

        supabase
          .from("sites")
          .select("id,site_name")
          .order("site_name"),
      ]);

      if (transferResult.error) throw transferResult.error;
      if (siteResult.error) throw siteResult.error;

      const visible = (
        (transferResult.data || []) as Transfer[]
      ).filter(
        (t) =>
          facilities.includes(t.source_facility_id) ||
          facilities.includes(t.destination_facility_id)
      );

      setTransfers(visible);
      setSites((siteResult.data || []) as Site[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load stock transfers."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  function clinicName(id: string) {
    return sites.find((s) => s.id === id)?.site_name || id;
  }

  function openNewTransfer() {
    const path = "/nurse/stock/transfers/new";

    if (assigned.length === 1) {
      router.push(
        `${path}?site_id=${encodeURIComponent(assigned[0])}`
      );
      return;
    }

    router.push(path);
  }

  const visibleTransfers = transfers.filter((transfer) => {
    if (
      filter === "incoming" &&
      !assigned.includes(transfer.destination_facility_id)
    ) {
      return false;
    }

    if (
      filter === "outgoing" &&
      !assigned.includes(transfer.source_facility_id)
    ) {
      return false;
    }

    if (
      filter === "pending" &&
      !["requested", "approved", "dispatched"].includes(
        transfer.status
      )
    ) {
      return false;
    }

    const term = search.trim().toLowerCase();

    if (!term) return true;

    return [
      transfer.id,
      transfer.reason || "",
      transfer.status,
      clinicName(transfer.source_facility_id),
      clinicName(transfer.destination_facility_id),
    ].some((value) => value.toLowerCase().includes(term));
  });

  const pendingCount = transfers.filter((t) =>
    ["requested", "approved", "dispatched"].includes(t.status)
  ).length;

  const completedCount = transfers.filter(
    (t) => t.status === "received"
  ).length;

  const stats = [
    { label: "Total Transfers", value: transfers.length },
    { label: "Pending / In Progress", value: pendingCount },
    { label: "Completed Transfers", value: completedCount },
    { label: "Assigned Clinics", value: assigned.length },
  ];

  function statusStyle(status: string): React.CSSProperties {
    const colors: Record<string, [string, string]> = {
      requested: ["#fef3c7", "#92400e"],
      approved: ["#ccfbf1", "#0f766e"],
      dispatched: ["#dbeafe", "#1d4ed8"],
      received: ["#dcfce7", "#166534"],
      cancelled: ["#fee2e2", "#991b1b"],
    };

    const [background, color] =
      colors[status] || ["#f1f5f9", "#475569"];

    return {
      background,
      color,
      padding: "7px 12px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      textTransform: "capitalize",
    };
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.push("/nurse/stock")}
          style={{
            background: "transparent",
            border: 0,
            color: "#164c7e",
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← Stock Management
        </button>

        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            margin: "28px 0",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#0f766e",
                letterSpacing: 1,
              }}
            >
              DOSETRACK / FAMILY PLANNING
            </p>

            <h1 style={{ marginBottom: 8 }}>
              Inter-Clinic Stock Transfers
            </h1>

            <p style={{ color: "#64748b", lineHeight: 1.6 }}>
              Request, approve, dispatch and receive
              medication stock between clinics.
            </p>
          </div>

          <button
            type="button"
            onClick={openNewTransfer}
            style={primaryButton}
          >
            + New Transfer Request
          </button>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: 16,
              borderRadius: 9,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(200px,1fr))",
            gap: 16,
            marginBottom: 26,
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label} style={cardStyle}>
              <span
                style={{ fontSize: 13, color: "#64748b" }}
              >
                {stat.label}
              </span>

              <strong
                style={{
                  display: "block",
                  fontSize: 30,
                  color: "#0f766e",
                  marginTop: 12,
                }}
              >
                {stat.value}
              </strong>
            </div>
          ))}
        </div>

        <section style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Transfer Register</h2>
              <p style={{ color: "#64748b", fontSize: 13 }}>
                Incoming and outgoing medication transfers
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadTransfers()}
              disabled={loading}
              style={{
                padding: "10px 16px",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#fff",
                color: "#164c7e",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
              margin: "22px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {(
                ["all", "incoming", "outgoing", "pending"] as Filter[]
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background:
                      filter === value ? "#164c7e" : "#fff",
                    color:
                      filter === value ? "#fff" : "#164c7e",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {value.charAt(0).toUpperCase() +
                    value.slice(1)}
                </button>
              ))}
            </div>

            <input
              type="search"
              placeholder="Search transfers or clinics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "11px 14px",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                minWidth: 230,
                maxWidth: "100%",
              }}
            />
          </div>

          {loading ? (
            <p style={{ padding: 25 }}>
              Loading stock transfers...
            </p>
          ) : assigned.length === 0 ? (
            <p style={{ padding: 25, color: "#64748b" }}>
              No clinics assigned to your account.
            </p>
          ) : visibleTransfers.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
              }}
            >
              <h3>No transfers found</h3>

              <p style={{ color: "#64748b" }}>
                Create your first stock transfer request.
              </p>

              <button
                type="button"
                onClick={openNewTransfer}
                style={primaryButton}
              >
                Create Transfer Request
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {visibleTransfers.map((transfer) => (
                <button
                  key={transfer.id}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/nurse/stock/transfers/${transfer.id}`
                    )
                  }
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 18,
                    width: "100%",
                    textAlign: "left",
                    padding: 20,
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <strong>
                      {clinicName(
                        transfer.source_facility_id
                      )}
                      {" → "}
                      {clinicName(
                        transfer.destination_facility_id
                      )}
                    </strong>

                    <p style={{ color: "#64748b" }}>
                      {transfer.reason || "No reason recorded"}
                    </p>

                    <small style={{ color: "#94a3b8" }}>
                      Ref:{" "}
                      {transfer.id.slice(0, 8).toUpperCase()}
                    </small>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={statusStyle(transfer.status)}>
                      {transfer.status.replaceAll("_", " ")}
                    </span>

                    <small style={{ color: "#64748b" }}>
                      {new Date(
                        transfer.created_at
                      ).toLocaleDateString("en-ZA")}
                    </small>

                    <strong style={{ color: "#0f766e" }}>
                      View Details →
                    </strong>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            ...cardStyle,
            background: "#edf7f5",
            marginTop: 26,
          }}
        >
          <h2>Stock Transfer Workflow</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(180px,1fr))",
              gap: 18,
            }}
          >
            {[
              ["1. Request", "Receiving clinic requests stock."],
              ["2. Approve", "Sending clinic approves."],
              ["3. Dispatch", "Sending clinic dispatches stock."],
              ["4. Receive", "Receiving clinic confirms receipt."],
            ].map(([title, description]) => (
              <div key={title}>
                <strong style={{ color: "#0f766e" }}>
                  {title}
                </strong>

                <p
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    lineHeight: 1.6,
                  }}
                >
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
