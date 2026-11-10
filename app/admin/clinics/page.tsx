
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Facility = {
  id: string;
  name: string;
  mhfl_number: string | null;
  cfs_number: string | null;
  demander_number: string | null;
  email: string | null;
  phone: string | null;
};

type FacilityDraft = Omit<Facility, "id">;

const emptyDraft: FacilityDraft = {
  name: "",
  mhfl_number: "",
  cfs_number: "",
  demander_number: "",
  email: "",
  phone: "",
};

const fields: {
  key: keyof FacilityDraft;
  label: string;
  type?: string;
}[] = [
  { key: "name", label: "Clinic name" },
  { key: "mhfl_number", label: "MHFL number" },
  { key: "cfs_number", label: "CFS number" },
  { key: "demander_number", label: "Demander number" },
  { key: "email", label: "Email address", type: "email" },
  { key: "phone", label: "Telephone number", type: "tel" },
];

const navItems = [
  { label: "Dashboard", href: "/family-planning/dashboard", icon: "◫" },
  { label: "Manage Clinics", href: "/admin/clinics", icon: "▦" },
  { label: "Nurse Administration", href: "/admin/nurses", icon: "♙" },
  { label: "Clinic Assignments", href: "/admin/assign-clinic", icon: "⇄" },
  { label: "Staff Approvals", href: "/admin/staff-approvals", icon: "✓" },
];

const styles = `
.dt-admin {
  --teal: #087f80;
  --navy: #103b43;
  --muted: #66798a;
  --line: #e1e9ee;
  min-height: 100vh;
  display: flex;
  background: #f3f7fa;
  color: #18323e;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
.dt-admin * { box-sizing: border-box; }

.dt-sidebar {
  width: 250px;
  flex: 0 0 250px;
  min-height: 100vh;
  padding: 30px 18px;
  background: linear-gradient(180deg,#123e47,#0a303a);
  color: white;
  position: sticky;
  top: 0;
  align-self: flex-start;
}
.dt-brand {
  font-size: 27px;
  font-weight: 800;
  letter-spacing: -1px;
}
.dt-brand span { color: #5bdfcc; }
.dt-brand-sub {
  color: #9bc1c7;
  font-size: 10px;
  letter-spacing: 2px;
  margin-top: 5px;
}
.dt-nav-label {
  margin: 38px 12px 12px;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #84abb3;
}
.dt-nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.dt-nav a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px;
  border-radius: 11px;
  color: #d0e4e7;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}
.dt-nav a:hover,
.dt-nav a.active {
  background: #24636a;
  color: white;
}
.dt-nav-icon { font-size: 19px; }
.dt-sidebar-footer {
  margin-top: 45px;
  padding: 20px 10px;
  border-top: 1px solid #35616a;
  color: #9bc1c7;
  font-size: 11px;
  line-height: 1.8;
}
.dt-main {
  flex: 1;
  min-width: 0;
  padding: 30px 38px 65px;
}
.dt-content {
  max-width: 1350px;
  margin: 0 auto;
}
.dt-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  margin-bottom: 24px;
  font-size: 12px;
  color: #708595;
}
.dt-topline a {
  color: #147e82;
  text-decoration: none;
  font-weight: 700;
}
.dt-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 32px;
  border-radius: 20px;
  background: linear-gradient(115deg,#164e59,#087e81);
  color: white;
  box-shadow: 0 10px 26px #0c60631f;
  margin-bottom: 24px;
}
.dt-eyebrow {
  color: #a5e6de;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
}
.dt-hero h1 {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -1px;
  margin: 8px 0 10px;
}
.dt-hero p {
  color: #d2f0ef;
  font-size: 14px;
  line-height: 1.7;
}
.dt-hero-icon {
  font-size: 64px;
  opacity: 0.8;
}
.dt-metrics {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 16px;
  margin-bottom: 25px;
}
.dt-metric {
  background: white;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 21px;
  box-shadow: 0 3px 14px #143d4708;
}
.dt-metric-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.dt-metric-value {
  color: #123f48;
  font-size: 32px;
  font-weight: 800;
  margin-top: 9px;
}
.dt-metric-foot {
  color: #8697a2;
  font-size: 11px;
  margin-top: 4px;
}
.dt-panel {
  background: white;
  border: 1px solid var(--line);
  border-radius: 17px;
  padding: 26px;
  box-shadow: 0 3px 18px #153c4808;
  margin-bottom: 22px;
}
.dt-panel h2 {
  color: #173d46;
  font-size: 20px;
  font-weight: 750;
  margin: 0;
}
.dt-subtitle {
  color: #708392;
  font-size: 13px;
  margin-top: 6px;
}
.dt-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.dt-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: #087e80;
  color: white;
  border: 0;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}
.dt-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  background: white;
  border: 1px solid #d6e1e7;
  border-radius: 10px;
  color: #345665;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
.dt-primary:disabled,
.dt-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dt-label {
  display: block;
  color: #294b58;
  font-size: 13px;
  font-weight: 650;
  margin-bottom: 8px;
}
.dt-input {
  width: 100%;
  min-height: 46px;
  border: 1px solid #d6e1e7;
  border-radius: 10px;
  padding: 12px 14px;
  background: white;
  color: #18323e;
  outline: none;
}
.dt-input:focus {
  border-color: #0c898a;
  box-shadow: 0 0 0 3px #0c898a19;
}
.dt-table-wrap {
  overflow-x: auto;
  margin-top: 22px;
}
.dt-table {
  width: 100%;
  min-width: 850px;
  border-collapse: collapse;
  text-align: left;
}
.dt-table thead {
  background: #f4f8fa;
}
.dt-table th {
  color: #566e7b;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  padding: 16px 13px;
}
.dt-table td {
  border-top: 1px solid #edf1f4;
  padding: 17px 13px;
  font-size: 13px;
  vertical-align: top;
}
.dt-table tbody tr:hover {
  background: #f7fbfb;
}
.dt-clinic-name {
  color: #173d46;
  font-weight: 750;
}
.dt-muted {
  color: #738692;
  font-size: 12px;
}
.dt-edit {
  background: #e8f7f5;
  color: #087a72;
  padding: 8px 14px;
  border: 0;
  border-radius: 8px;
  font-weight: 750;
  cursor: pointer;
}
.dt-form-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 20px;
  margin-top: 25px;
}
.dt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}
.dt-alert {
  border-radius: 11px;
  padding: 15px 18px;
  margin-bottom: 20px;
  font-size: 13px;
}
.dt-error {
  background: #fef2f2;
  color: #991b1b;
}
.dt-success {
  background: #ecfdf5;
  color: #065f46;
}
.dt-empty {
  padding: 35px;
  text-align: center;
  color: #738692;
}
@media (max-width: 950px) {
  .dt-sidebar {
    width: 78px;
    flex-basis: 78px;
    padding: 24px 10px;
  }
  .dt-brand { font-size: 16px; }
  .dt-brand-sub,
  .dt-nav-label,
  .dt-nav-text,
  .dt-sidebar-footer { display: none; }
  .dt-nav a { justify-content: center; }
  .dt-main { padding: 22px; }
}
@media (max-width: 620px) {
  .dt-admin { display: block; }
  .dt-sidebar {
    width: 100%;
    min-height: 0;
    position: relative;
    padding: 15px;
  }
  .dt-brand { font-size: 23px; }
  .dt-brand-sub { display: block; }
  .dt-nav {
    flex-direction: row;
    overflow-x: auto;
    margin-top: 15px;
  }
  .dt-nav a {
    white-space: nowrap;
    padding: 9px;
  }
  .dt-nav-text {
    display: inline;
    font-size: 11px;
  }
  .dt-main { padding: 16px; }
  .dt-hero { padding: 23px; }
  .dt-hero h1 { font-size: 25px; }
  .dt-hero-icon { display: none; }
  .dt-metrics {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .dt-form-grid { grid-template-columns: 1fr; }
  .dt-panel { padding: 18px; }
}
`;

function toDraft(f: Facility): FacilityDraft {
  return {
    name: f.name,
    mhfl_number: f.mhfl_number ?? "",
    cfs_number: f.cfs_number ?? "",
    demander_number: f.demander_number ?? "",
    email: f.email ?? "",
    phone: f.phone ?? "",
  };
}

function toPayload(draft: FacilityDraft) {
  const trimOrNull = (value: string | null) =>
    value?.trim() || null;

  return {
    name: draft.name.trim(),
    mhfl_number: trimOrNull(draft.mhfl_number),
    cfs_number: trimOrNull(draft.cfs_number),
    demander_number: trimOrNull(draft.demander_number),
    email: trimOrNull(draft.email),
    phone: trimOrNull(draft.phone),
  };
}

export default function AdminClinicsPage() {
  const router = useRouter();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FacilityDraft>({
    ...emptyDraft,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setAuthorized(false);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/family-planning/login");
        return;
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError) throw adminError;

      if (isAdmin !== true) {
        throw new Error("Super Admin access required.");
      }

      setAuthorized(true);

      const { data, error: facilitiesError } = await supabase
        .from("fp_facilities")
        .select(
          "id,name,mhfl_number,cfs_number,demander_number,email,phone"
        )
        .order("name");

      if (facilitiesError) throw facilitiesError;

      setFacilities((data ?? []) as Facility[]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load clinics."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return facilities.filter(
      (f) =>
        !q ||
        [
          f.name,
          f.mhfl_number,
          f.cfs_number,
          f.demander_number,
          f.email,
          f.phone,
        ].some((value) =>
          (value ?? "").toLowerCase().includes(q)
        )
    );
  }, [facilities, search]);

  const completeCount = facilities.filter(
    (f) =>
      f.mhfl_number &&
      f.cfs_number &&
      f.demander_number
  ).length;

  const incompleteCount = facilities.length - completeCount;

  function edit(f: Facility) {
    setEditingId(f.id);
    setDraft(toDraft(f));
    setError("");
    setNotice("");
  }

  function create() {
    setEditingId("new");
    setDraft({ ...emptyDraft });
    setError("");
    setNotice("");
  }

  async function save() {
    if (!authorized || !editingId || saving) return;

    const payload = toPayload(draft);

    if (!payload.name) {
      setError("Clinic name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Please sign in again.");
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError || isAdmin !== true) {
        throw new Error("Super Admin access required.");
      }

      if (editingId === "new") {
        const { error: insertError } = await supabase
          .from("fp_facilities")
          .insert(payload);

        if (insertError) throw insertError;

        setNotice("Clinic created successfully.");
      } else {
        const { data: updated, error: updateError } =
          await supabase
            .from("fp_facilities")
            .update(payload)
            .eq("id", editingId)
            .select("id");

        if (updateError) throw updateError;

        if (!updated?.length) {
          throw new Error(
            "Clinic was not updated. Check Super Admin RLS permissions."
          );
        }

        setNotice("Clinic updated successfully.");
      }

      setEditingId(null);

      const { data, error: reloadError } = await supabase
        .from("fp_facilities")
        .select(
          "id,name,mhfl_number,cfs_number,demander_number,email,phone"
        )
        .order("name");

      if (reloadError) throw reloadError;

      setFacilities((data ?? []) as Facility[]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save clinic."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dt-admin">
      <style>{styles}</style>

      <aside className="dt-sidebar">
        <div className="dt-brand">
          Dose<span>Track</span>
        </div>

        <div className="dt-brand-sub">
          FAMILY PLANNING
        </div>

        <div className="dt-nav-label">
          WORKSPACE
        </div>

        <nav className="dt-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.href === "/admin/clinics"
                  ? "active"
                  : ""
              }
            >
              <span className="dt-nav-icon">
                {item.icon}
              </span>
              <span className="dt-nav-text">
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="dt-sidebar-footer">
          SECURE ADMINISTRATION
          <div>DoseTrack • Family Planning</div>
        </div>
      </aside>

      <div className="dt-main">
        <div className="dt-content">
          <div className="dt-topline">
            <span>
              Administration / Facility Network
            </span>

            <Link href="/family-planning/dashboard">
              ← Back to Dashboard
            </Link>
          </div>

          <header className="dt-hero">
            <div>
              <div className="dt-eyebrow">
                FACILITY NETWORK
              </div>

              <h1>Manage Clinics</h1>

              <p>
                Manage locations, facility identifiers and
                contact information across your network.
              </p>
            </div>

            <div className="dt-hero-icon">
              ▦
            </div>
          </header>

          {loading ? (
            <section className="dt-panel">
              <h2>Loading clinics...</h2>
              <p className="dt-subtitle">
                Checking your administrator permissions
                and retrieving facility records.
              </p>
            </section>
          ) : (
            <>
              {authorized && (
                <div className="dt-metrics">
                  <div className="dt-metric">
                    <div className="dt-metric-label">
                      Total Facilities
                    </div>
                    <div className="dt-metric-value">
                      {facilities.length}
                    </div>
                    <div className="dt-metric-foot">
                      Registered clinic records
                    </div>
                  </div>

                  <div className="dt-metric">
                    <div className="dt-metric-label">
                      Complete Identifiers
                    </div>
                    <div className="dt-metric-value">
                      {completeCount}
                    </div>
                    <div className="dt-metric-foot">
                      MHFL, CFS and Demander present
                    </div>
                  </div>

                  <div className="dt-metric">
                    <div className="dt-metric-label">
                      Needs Attention
                    </div>
                    <div className="dt-metric-value">
                      {incompleteCount}
                    </div>
                    <div className="dt-metric-foot">
                      Missing one or more identifiers
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="dt-alert dt-error" role="alert">
                  {error}
                </div>
              )}

              {notice && (
                <div className="dt-alert dt-success" role="status">
                  {notice}
                </div>
              )}

              {authorized && (
                <>
                  <section className="dt-panel">
                    <div className="dt-toolbar">
                      <div>
                        <h2>Clinic Directory</h2>
                        <p className="dt-subtitle">
                          Search and maintain facility master
                          records • {facilities.length} clinics
                        </p>
                      </div>

                      <button
                        type="button"
                        className="dt-primary"
                        onClick={create}
                        disabled={saving}
                      >
                        + Add Clinic
                      </button>
                    </div>

                    <div style={{ marginTop: 25 }}>
                      <label
                        htmlFor="clinic-search"
                        className="dt-label"
                      >
                        Search Clinics
                      </label>

                      <input
                        id="clinic-search"
                        className="dt-input"
                        value={search}
                        onChange={(e) =>
                          setSearch(e.target.value)
                        }
                        placeholder="Search by clinic name, MHFL, CFS, Demander or contact"
                      />
                    </div>

                    <div className="dt-table-wrap">
                      <table className="dt-table">
                        <thead>
                          <tr>
                            <th>Clinic</th>
                            <th>MHFL</th>
                            <th>CFS</th>
                            <th>Demander</th>
                            <th>Contact</th>
                            <th>Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filtered.map((f) => (
                            <tr key={f.id}>
                              <td>
                                <div className="dt-clinic-name">
                                  {f.name}
                                </div>
                                <div className="dt-muted">
                                  Registered facility
                                </div>
                              </td>

                              <td>
                                {f.mhfl_number || "—"}
                              </td>

                              <td>
                                {f.cfs_number || "—"}
                              </td>

                              <td>
                                {f.demander_number || "—"}
                              </td>

                              <td>
                                <div>
                                  {f.email || "—"}
                                </div>
                                <div className="dt-muted">
                                  {f.phone || ""}
                                </div>
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="dt-edit"
                                  onClick={() => edit(f)}
                                  disabled={saving}
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {filtered.length === 0 && (
                        <div className="dt-empty">
                          No matching clinics found.
                        </div>
                      )}
                    </div>
                  </section>

                  {editingId && (
                    <section className="dt-panel">
                      <h2>
                        {editingId === "new"
                          ? "Add New Facility"
                          : "Edit Facility Details"}
                      </h2>

                      <p className="dt-subtitle">
                        Maintain clinic identifiers and
                        contact information. Editing does
                        not change the facility UUID or
                        existing nurse memberships.
                      </p>

                      <div className="dt-form-grid">
                        {fields.map((field) => (
                          <div key={field.key}>
                            <label
                              htmlFor={`field-${field.key}`}
                              className="dt-label"
                            >
                              {field.label}
                              {field.key === "name"
                                ? " *"
                                : ""}
                            </label>

                            <input
                              id={`field-${field.key}`}
                              type={field.type || "text"}
                              className="dt-input"
                              value={draft[field.key] ?? ""}
                              onChange={(e) =>
                                setDraft((previous) => ({
                                  ...previous,
                                  [field.key]:
                                    e.target.value,
                                }))
                              }
                              disabled={saving}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="dt-actions">
                        <button
                          type="button"
                          className="dt-primary"
                          onClick={() => void save()}
                          disabled={saving}
                        >
                          {saving
                            ? "Saving..."
                            : "Save Clinic"}
                        </button>

                        <button
                          type="button"
                          className="dt-secondary"
                          onClick={() =>
                            setEditingId(null)
                          }
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </div>
                    </section>
                  )}

                  <div className="dt-actions">
                    <button
                      type="button"
                      className="dt-secondary"
                      onClick={() => void load()}
                      disabled={saving}
                    >
                      Refresh Clinics
                    </button>

                    <Link
                      href="/admin/assign-clinic"
                      className="dt-secondary"
                    >
                      Assign Nurses to Clinics
                    </Link>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
