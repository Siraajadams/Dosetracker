
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Nurse = {
  id: string;
  full_name: string | null;
  email: string | null;
  sanc_number: string | null;
  mobile_number: string | null;
  professional_category: string | null;
  approval_status: string | null;
  is_active: boolean | null;
};

const menu = [
  { label: "Dashboard", href: "/admin", icon: "▦" },
  { label: "Nurse Management", href: "/admin/nurses", icon: "♙" },
  { label: "Nurse Approvals", href: "/admin/staff-approvals", icon: "✓" },
  { label: "Clinic Assignment", href: "/admin/assign-clinic", icon: "⌁" },
  { label: "Clinics", href: "/admin/clinics", icon: "⌂" },
  { label: "Medications", href: "/admin/medications", icon: "+" },
];

function StatusBadge({
  value,
}: {
  value: string;
}) {
  const status = value.toLowerCase();

  const colour =
    status === "active" || status === "approved"
      ? "green"
      : status === "pending"
      ? "amber"
      : "gray";

  return (
    <span className={`dt-badge ${colour}`}>
      <span className="dt-dot" />
      {value}
    </span>
  );
}

export default function NursesPage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadNurses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        setNurses([]);
        setError("Please sign in to access Nurse Management.");
        return;
      }

      const { data: isAdmin, error: roleError } =
        await supabase.rpc("dt_is_super_admin");

      if (roleError || isAdmin !== true) {
        setNurses([]);
        setError("Access denied. Super administrator required.");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("staff_profiles")
        .select(
          "id,full_name,email,sanc_number,mobile_number,professional_category,approval_status,is_active"
        )
        .eq("role", "nurse")
        .or("approval_status.is.null,approval_status.neq.rejected")
        .order("full_name", { ascending: true });

      if (fetchError) throw fetchError;

      setNurses((data ?? []) as Nurse[]);
    } catch (err) {
      setNurses([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load nurse records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNurses();
  }, [loadNurses]);

  const stats = useMemo(() => {
    const active = nurses.filter(
      (n) => n.is_active === true
    ).length;

    const pending = nurses.filter(
      (n) =>
        (n.approval_status ?? "pending").toLowerCase() ===
        "pending"
    ).length;

    return {
      total: nurses.length,
      active,
      pending,
      inactive: nurses.length - active,
    };
  }, [nurses]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return nurses.filter((n) =>
      [
        n.full_name,
        n.email,
        n.sanc_number,
        n.mobile_number,
        n.professional_category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [nurses, search]);

  return (
    <div className="dt-app">
      <aside className={`dt-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dt-brand">
          <div className="dt-logo">✚</div>
          <div>
            <div className="dt-brand-name">DoseTrack</div>
            <div className="dt-brand-sub">FAMILY PLANNING</div>
          </div>
        </div>

        <div className="dt-menu-label">ADMINISTRATION</div>

        <nav className="dt-nav">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`dt-nav-item ${
                item.href === "/admin/nurses" ? "selected" : ""
              }`}
            >
              <span className="dt-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="dt-sidebar-footer">
          <div className="dt-avatar">SA</div>
          <div>
            <strong>Super Administrator</strong>
            <small>Family Planning Portal</small>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="dt-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="dt-main">
        <header className="dt-topbar">
          <div className="dt-top-left">
            <button
              className="dt-menu-button"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <span>Family Planning</span>
            <span className="dt-separator">/</span>
            <strong>Nurse Management</strong>
          </div>

          <span className="dt-admin-tag">
            ● Admin Portal
          </span>
        </header>

        <main className="dt-content">
          <div className="dt-heading">
            <div>
              <div className="dt-eyebrow">
                STAFF ADMINISTRATION
              </div>
              <h1>Nurse Management</h1>
              <p>
                View registered nurses, professional credentials
                and account status.
              </p>
            </div>

            <button
              className="dt-refresh"
              onClick={() => void loadNurses()}
              disabled={loading}
            >
              ↻ {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {error && (
            <div className="dt-error" role="alert">
              {error}
            </div>
          )}

          {!error && (
            <>
              <section className="dt-stats">
                <div className="dt-stat">
                  <div className="dt-stat-label">
                    Registered Nurses
                  </div>
                  <div className="dt-stat-value">
                    {stats.total}
                  </div>
                  <div className="dt-stat-note">
                    Excluding rejected
                  </div>
                </div>

                <div className="dt-stat">
                  <div className="dt-stat-label">
                    Active Nurses
                  </div>
                  <div className="dt-stat-value green-text">
                    {stats.active}
                  </div>
                  <div className="dt-stat-note">
                    Active accounts
                  </div>
                </div>

                <div className="dt-stat">
                  <div className="dt-stat-label">
                    Pending Approval
                  </div>
                  <div className="dt-stat-value amber-text">
                    {stats.pending}
                  </div>
                  <div className="dt-stat-note">
                    Awaiting review
                  </div>
                </div>

                <div className="dt-stat">
                  <div className="dt-stat-label">
                    Inactive Nurses
                  </div>
                  <div className="dt-stat-value">
                    {stats.inactive}
                  </div>
                  <div className="dt-stat-note">
                    Not currently active
                  </div>
                </div>
              </section>

              <section className="dt-panel">
                <div className="dt-panel-header">
                  <div>
                    <h2>Nurse Directory</h2>
                    <p>
                      All non-rejected registered nursing staff
                    </p>
                  </div>
                  <span className="dt-count">
                    {filtered.length} records
                  </span>
                </div>

                <div className="dt-toolbar">
                  <div className="dt-search">
                    <span>⌕</span>
                    <input
                      aria-label="Search nurses"
                      placeholder="Search name, email, SANC or mobile..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="dt-table-scroll">
                  <table className="dt-table">
                    <thead>
                      <tr>
                        <th>NURSE</th>
                        <th>SANC NUMBER</th>
                        <th>MOBILE</th>
                        <th>CATEGORY</th>
                        <th>APPROVAL</th>
                        <th>ACCOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((nurse) => (
                        <tr key={nurse.id}>
                          <td>
                            <div className="dt-nurse-cell">
                              <div className="dt-nurse-avatar">
                                {(nurse.full_name || "N")
                                  .trim()
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div className="dt-nurse-info">
                                <strong>
                                  {nurse.full_name || "Unnamed Nurse"}
                                </strong>
                                <small>{nurse.email || "—"}</small>
                              </div>
                            </div>
                          </td>
                          <td className="dt-mono">
                            {nurse.sanc_number || "—"}
                          </td>
                          <td>{nurse.mobile_number || "—"}</td>
                          <td>
                            {(nurse.professional_category || "—")
                              .replace(/_/g, " ")}
                          </td>
                          <td>
                            <StatusBadge
                              value={
                                nurse.approval_status || "Pending"
                              }
                            />
                          </td>
                          <td>
                            <StatusBadge
                              value={
                                nurse.is_active
                                  ? "Active"
                                  : "Inactive"
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {loading && (
                    <div className="dt-empty">
                      Loading nurse records...
                    </div>
                  )}

                  {!loading && filtered.length === 0 && (
                    <div className="dt-empty">
                      No matching nurses found.
                    </div>
                  )}
                </div>

                <div className="dt-panel-footer">
                  Showing {filtered.length} of {nurses.length} nurses
                </div>
              </section>

              <div className="dt-help">
                <span>Need to approve a nurse?</span>
                <Link href="/admin/staff-approvals">
                  Open Nurse Approvals →
                </Link>
                <span className="dt-help-divider">|</span>
                <span>Need to assign a clinic?</span>
                <Link href="/admin/assign-clinic">
                  Clinic Assignment →
                </Link>
              </div>
            </>
          )}
        </main>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; }

        .dt-app {
          min-height: 100vh;
          display: flex;
          background: #f4f7fb;
          color: #172b4d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .dt-sidebar {
          width: 252px;
          flex-shrink: 0;
          background: #0d1d33;
          color: #cbd5e1;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          z-index: 30;
        }

        .dt-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 28px 22px 32px;
          border-bottom: 1px solid #23364d;
        }

        .dt-logo {
          background: #0d9488;
          color: white;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-size: 25px;
          font-weight: bold;
        }

        .dt-brand-name {
          font-size: 21px;
          font-weight: 800;
          color: white;
          letter-spacing: -0.6px;
        }

        .dt-brand-sub {
          color: #5eead4;
          font-size: 10px;
          letter-spacing: 1.5px;
          margin-top: 4px;
          font-weight: 700;
        }

        .dt-menu-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.6px;
          color: #64748b;
          padding: 30px 24px 14px;
        }

        .dt-nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 0 12px;
        }

        .dt-nav-item {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 15px;
          border-radius: 9px;
          text-decoration: none;
          color: #aebdd0;
          font-size: 13px;
          font-weight: 600;
          transition: background 0.15s;
        }

        .dt-nav-item:hover {
          background: #1c3049;
          color: white;
        }

        .dt-nav-item.selected {
          background: #123e49;
          color: #5eead4;
          border-left: 3px solid #14b8a6;
        }

        .dt-nav-icon {
          width: 20px;
          text-align: center;
          font-size: 18px;
        }

        .dt-sidebar-footer {
          margin-top: auto;
          border-top: 1px solid #23364d;
          padding: 22px 16px;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .dt-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #164e63;
          color: #67e8f9;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 800;
        }

        .dt-sidebar-footer strong,
        .dt-sidebar-footer small {
          display: block;
        }

        .dt-sidebar-footer strong {
          color: white;
          font-size: 12px;
        }

        .dt-sidebar-footer small {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .dt-main {
          flex: 1;
          min-width: 0;
        }

        .dt-topbar {
          height: 70px;
          background: white;
          border-bottom: 1px solid #e5eaf1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 36px;
          gap: 16px;
        }

        .dt-top-left {
          display: flex;
          gap: 12px;
          align-items: center;
          color: #64748b;
          font-size: 13px;
        }

        .dt-top-left strong { color: #172b4d; }
        .dt-separator { color: #cbd5e1; }

        .dt-admin-tag {
          background: #e7f8f3;
          color: #047857;
          border-radius: 20px;
          padding: 8px 14px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .dt-menu-button {
          display: none;
          border: 0;
          background: transparent;
          cursor: pointer;
          font-size: 22px;
        }

        .dt-content {
          max-width: 1500px;
          margin: auto;
          padding: 36px;
        }

        .dt-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .dt-eyebrow {
          font-size: 10px;
          letter-spacing: 1.7px;
          font-weight: 800;
          color: #0d9488;
          margin-bottom: 10px;
        }

        .dt-heading h1 {
          font-size: 29px;
          margin: 0 0 9px;
          font-weight: 800;
          letter-spacing: -0.7px;
          color: #13253d;
        }

        .dt-heading p {
          margin: 0;
          font-size: 13px;
          color: #64748b;
          line-height: 1.6;
        }

        .dt-refresh {
          border: 1px solid #dbe4ee;
          background: white;
          padding: 11px 19px;
          border-radius: 9px;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
          white-space: nowrap;
        }

        .dt-refresh:disabled {
          opacity: 0.5;
          cursor: wait;
        }

        .dt-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 17px;
          margin-bottom: 27px;
        }

        .dt-stat {
          background: white;
          border: 1px solid #e5eaf1;
          border-radius: 13px;
          padding: 22px;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.025);
        }

        .dt-stat-label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }

        .dt-stat-value {
          font-size: 34px;
          font-weight: 800;
          color: #172b4d;
          margin: 13px 0 7px;
        }

        .green-text { color: #059669; }
        .amber-text { color: #d97706; }

        .dt-stat-note {
          font-size: 11px;
          color: #94a3b8;
        }

        .dt-panel {
          background: white;
          border: 1px solid #e5eaf1;
          border-radius: 13px;
          overflow: hidden;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.025);
        }

        .dt-panel-header {
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .dt-panel-header h2 {
          margin: 0 0 7px;
          font-size: 17px;
          font-weight: 800;
        }

        .dt-panel-header p {
          margin: 0;
          color: #94a3b8;
          font-size: 12px;
        }

        .dt-count {
          background: #e8f7f5;
          color: #0f766e;
          border-radius: 20px;
          padding: 7px 12px;
          font-size: 11px;
          font-weight: 800;
        }

        .dt-toolbar {
          padding: 0 24px 22px;
        }

        .dt-search {
          border: 1px solid #dbe4ee;
          border-radius: 9px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          max-width: 520px;
          background: #fafcff;
        }

        .dt-search span {
          font-size: 24px;
          color: #94a3b8;
        }

        .dt-search input {
          width: 100%;
          padding: 13px 0;
          border: 0;
          outline: none;
          background: transparent;
          color: #172b4d;
          font-size: 13px;
        }

        .dt-table-scroll { overflow-x: auto; }

        .dt-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          min-width: 900px;
        }

        .dt-table th {
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          letter-spacing: 0.8px;
          font-weight: 800;
          padding: 15px 20px;
          border-top: 1px solid #e5eaf1;
          border-bottom: 1px solid #e5eaf1;
        }

        .dt-table td {
          padding: 17px 20px;
          border-bottom: 1px solid #edf1f5;
          font-size: 12px;
          color: #475569;
        }

        .dt-table tbody tr:hover {
          background: #f8fbfd;
        }

        .dt-nurse-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .dt-nurse-avatar {
          flex-shrink: 0;
          width: 37px;
          height: 37px;
          border-radius: 10px;
          background: #e0f2f1;
          color: #0f766e;
          display: grid;
          place-items: center;
          font-size: 14px;
          font-weight: 800;
        }

        .dt-nurse-info strong {
          display: block;
          font-size: 12px;
          color: #172b4d;
          margin-bottom: 5px;
        }

        .dt-nurse-info small {
          display: block;
          font-size: 11px;
          color: #94a3b8;
          overflow-wrap: anywhere;
        }

        .dt-mono {
          font-family: monospace;
          overflow-wrap: anywhere;
        }

        .dt-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 20px;
          padding: 6px 11px;
          font-size: 11px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .dt-badge.green {
          background: #dcfce7;
          color: #15803d;
        }

        .dt-badge.amber {
          background: #fef3c7;
          color: #92400e;
        }

        .dt-badge.gray {
          background: #f1f5f9;
          color: #64748b;
        }

        .dt-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .dt-panel-footer {
          padding: 17px 24px;
          color: #94a3b8;
          font-size: 11px;
        }

        .dt-empty {
          padding: 48px;
          text-align: center;
          color: #94a3b8;
          font-size: 13px;
        }

        .dt-error {
          padding: 16px;
          margin-bottom: 20px;
          border: 1px solid #fecaca;
          border-radius: 9px;
          color: #b91c1c;
          background: #fef2f2;
          font-size: 13px;
        }

        .dt-help {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-top: 24px;
          font-size: 12px;
          color: #64748b;
        }

        .dt-help a {
          color: #0f766e;
          font-weight: 700;
          text-decoration: none;
        }

        .dt-help-divider {
          color: #cbd5e1;
          margin: 0 10px;
        }

        .dt-overlay { display: none; }

        @media (max-width: 1100px) {
          .dt-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .dt-content { padding: 25px; }
        }

        @media (max-width: 800px) {
          .dt-sidebar {
            position: fixed;
            left: -270px;
            transition: left 0.2s ease;
          }

          .dt-sidebar.open { left: 0; }

          .dt-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 20;
            background: rgba(0, 0, 0, 0.45);
            border: 0;
          }

          .dt-menu-button { display: block; }
          .dt-topbar { padding: 0 20px; }
          .dt-content { padding: 20px; }
          .dt-heading { align-items: flex-start; }
          .dt-heading h1 { font-size: 24px; }
        }

        @media (max-width: 520px) {
          .dt-stats { gap: 10px; }
          .dt-stat { padding: 16px; }
          .dt-stat-value { font-size: 28px; }
          .dt-heading { flex-direction: column; }
          .dt-admin-tag { display: none; }
          .dt-panel-header { padding: 18px; }
          .dt-toolbar { padding: 0 18px 18px; }
        }
      `}</style>
    </div>
  );
}
