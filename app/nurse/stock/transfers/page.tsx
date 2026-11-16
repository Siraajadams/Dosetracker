
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

type Filter = "all" | "incoming" | "outgoing" | "pending";

export default function StockTransfersPage() {
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
        throw new Error("Please sign in to access stock transfers.");
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

      const accessible = (
        (transferResult.data || []) as Transfer[]
      ).filter(
        (t) =>
          facilities.includes(t.source_facility_id) ||
          facilities.includes(t.destination_facility_id)
      );

      setTransfers(accessible);
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
      transfer.reason,
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

  function statusColor(status: string): React.CSSProperties {
    if (status === "received") {
      return { background: "#dcfce7", color: "#166534" };
    }

    if (status === "dispatched") {
      return { background: "#dbeafe", color: "#1d4ed8" };
    }

    if (status === "approved") {
      return { background: "#ccfbf1", color: "#0f766e" };
    }

    if (status === "cancelled") {
      return { background: "#fee2e2", color: "#991b1b" };
    }

    return { background: "#fef3c7", color: "#92400e" };
  }

  return (
    <main className="transfer-page">
      <div className="transfer-container">
        <Link href="/nurse/stock" className="back-link">
          ← Stock Management
        </Link>

        <header className="transfer-header">
          <div>
            <p className="eyebrow">DOSETRACK / FAMILY PLANNING</p>
            <h1>Inter-Clinic Stock Transfers</h1>
            <p className="subtitle">
              Request medication stock, manage approvals,
              dispatch stock and confirm receipt between clinics.
            </p>
          </div>

          <Link
            href="/nurse/stock/transfers/new"
            className="primary-link"
          >
            + New Transfer Request
          </Link>
        </header>

        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        <section className="summary-grid">
          <div className="summary-card">
            <span>Total Transfers</span>
            <strong>{transfers.length}</strong>
          </div>

          <div className="summary-card">
            <span>Pending / In Progress</span>
            <strong>{pendingCount}</strong>
          </div>

          <div className="summary-card">
            <span>Completed Transfers</span>
            <strong>{completedCount}</strong>
          </div>

          <div className="summary-card">
            <span>Assigned Clinics</span>
            <strong>{assigned.length}</strong>
          </div>
        </section>

        <section className="transfer-panel">
          <div className="panel-header">
            <div>
              <h2>Transfer Register</h2>
              <p>Incoming and outgoing medication transfers</p>
            </div>

            <button
              className="refresh-button"
              onClick={() => void loadTransfers()}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          <div className="toolbar">
            <div className="filters">
              {(
                ["all", "incoming", "outgoing", "pending"] as Filter[]
              ).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={
                    filter === value
                      ? "filter-button active"
                      : "filter-button"
                  }
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
              className="search-input"
            />
          </div>

          {loading ? (
            <div className="empty-state">
              Loading stock transfers...
            </div>
          ) : assigned.length === 0 ? (
            <div className="empty-state">
              No clinics are assigned to your account.
              Contact the DoseTrack administrator.
            </div>
          ) : visibleTransfers.length === 0 ? (
            <div className="empty-state">
              <h3>No transfers found</h3>
              <p>
                New stock transfer requests will appear here.
              </p>
              <Link
                href="/nurse/stock/transfers/new"
                className="primary-link"
              >
                Create Transfer Request
              </Link>
            </div>
          ) : (
            <div className="transfer-list">
              {visibleTransfers.map((transfer) => (
                <Link
                  key={transfer.id}
                  href={`/nurse/stock/transfers/${transfer.id}`}
                  className="transfer-item"
                >
                  <div className="transfer-main">
                    <div className="clinic-route">
                      <strong>
                        {clinicName(transfer.source_facility_id)}
                      </strong>
                      <span className="route-arrow">→</span>
                      <strong>
                        {clinicName(transfer.destination_facility_id)}
                      </strong>
                    </div>

                    <p>{transfer.reason}</p>

                    <span className="reference">
                      Ref: {transfer.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <div className="transfer-meta">
                    <span
                      className="status-pill"
                      style={statusColor(transfer.status)}
                    >
                      {transfer.status.replaceAll("_", " ")}
                    </span>

                    <span className="date">
                      {new Date(
                        transfer.created_at
                      ).toLocaleDateString("en-ZA")}
                    </span>

                    <span className="open-text">
                      View Details →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="workflow">
          <h2>How Stock Transfers Work</h2>

          <div className="workflow-grid">
            <div>
              <strong>1. Request</strong>
              <p>Receiving clinic requests medication stock.</p>
            </div>

            <div>
              <strong>2. Approve</strong>
              <p>Sending clinic approves the request.</p>
            </div>

            <div>
              <strong>3. Dispatch</strong>
              <p>Sending clinic records the stock dispatched.</p>
            </div>

            <div>
              <strong>4. Receive</strong>
              <p>Receiving clinic confirms physical receipt.</p>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .transfer-page {
          min-height: 100vh;
          background: #f4f8fa;
          padding: 30px 20px;
          font-family: Arial, sans-serif;
          color: #17333b;
        }

        .transfer-container {
          max-width: 1180px;
          margin: 0 auto;
        }

        .back-link {
          color: #164c7e;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }

        .transfer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          margin: 25px 0;
        }

        .transfer-header h1 {
          font-size: 30px;
          margin: 8px 0;
        }

        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #0f766e;
        }

        .subtitle {
          color: #64748b;
          max-width: 680px;
          line-height: 1.6;
        }

        .primary-link {
          display: inline-block;
          background: #164c7e;
          color: white;
          padding: 13px 18px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 28px;
        }

        .summary-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: white;
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }

        .summary-card span {
          font-size: 13px;
          color: #64748b;
        }

        .summary-card strong {
          font-size: 29px;
          color: #0f766e;
        }

        .transfer-panel {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 24px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 21px;
        }

        .panel-header p {
          color: #64748b;
          font-size: 13px;
        }

        .refresh-button {
          padding: 10px 16px;
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          color: #164c7e;
          cursor: pointer;
          font-weight: 700;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin: 22px 0;
        }

        .filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-button {
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #164c7e;
          font-weight: 700;
          cursor: pointer;
        }

        .filter-button.active {
          background: #164c7e;
          color: white;
          border-color: #164c7e;
        }

        .search-input {
          padding: 11px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          min-width: 240px;
        }

        .transfer-list {
          display: grid;
          gap: 12px;
        }

        .transfer-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          text-decoration: none;
          color: inherit;
        }

        .transfer-item:hover {
          border-color: #0f766e;
          background: #f8fdfc;
        }

        .clinic-route {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .route-arrow {
          color: #0f766e;
          font-size: 20px;
        }

        .transfer-main p {
          color: #64748b;
          font-size: 14px;
        }

        .reference {
          color: #94a3b8;
          font-size: 12px;
        }

        .transfer-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          white-space: nowrap;
        }

        .status-pill {
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .date {
          color: #64748b;
          font-size: 12px;
        }

        .open-text {
          color: #0f766e;
          font-size: 12px;
          font-weight: 700;
        }

        .empty-state {
          padding: 45px 20px;
          text-align: center;
          color: #64748b;
        }

        .empty-state .primary-link {
          margin-top: 14px;
        }

        .error-box {
          background: #fff0f0;
          color: #a02727;
          padding: 14px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .workflow {
          background: #edf7f5;
          border: 1px solid #d5eae5;
          border-radius: 14px;
          padding: 24px;
          margin-top: 28px;
        }

        .workflow h2 {
          font-size: 19px;
        }

        .workflow-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .workflow-grid strong {
          color: #0f766e;
        }

        .workflow-grid p {
          color: #64748b;
          font-size: 13px;
          line-height: 1.6;
        }

        @media (max-width: 800px) {
          .summary-grid,
          .workflow-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .transfer-page {
            padding: 18px 12px;
          }

          .summary-grid,
          .workflow-grid {
            grid-template-columns: 1fr;
          }

          .transfer-item {
            flex-direction: column;
            align-items: flex-start;
          }

          .transfer-meta {
            align-items: flex-start;
          }

          .transfer-panel {
            padding: 16px;
          }

          .search-input {
            min-width: 0;
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
