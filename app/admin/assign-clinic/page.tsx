
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Nurse = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Facility = {
  id: string;
  name: string;
  mhfl_number: string | null;
  cfs_number: string | null;
  demander_number: string | null;
};

type Membership = {
  facility_id: string;
  user_id: string;
  role: string;
  active: boolean;
};

const NURSE_ROLE = "nurse";

const styles = `
.dt-admin {
  --navy: #103b43;
  --teal: #087f80;
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
  color: #66798a;
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
.dt-clinic-list {
  display: grid;
  gap: 11px;
  max-height: 510px;
  overflow-y: auto;
  margin-top: 20px;
}
.dt-clinic-row {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 17px;
  border: 1px solid #e0e9ed;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.dt-clinic-row:hover {
  background: #f5fbfb;
}
.dt-clinic-row.selected {
  background: #ecf9f7;
  border-color: #6ec4bb;
}
.dt-clinic-row input {
  width: 18px;
  height: 18px;
  margin-top: 3px;
  accent-color: #087e80;
}
.dt-clinic-name {
  color: #173d46;
  font-size: 14px;
  font-weight: 750;
}
.dt-clinic-meta {
  color: #738692;
  font-size: 12px;
  margin-top: 6px;
  line-height: 1.7;
}
.dt-summary {
  background: #f0f8f8;
  border: 1px solid #d4e9e7;
  border-radius: 13px;
  padding: 20px;
  margin-top: 20px;
}
.dt-summary h3 {
  margin: 0 0 10px;
  color: #174e53;
  font-size: 16px;
}
.dt-summary p {
  margin: 5px 0;
  color: #54717a;
  font-size: 13px;
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
  .dt-panel { padding: 18px; }
}
`;

const navItems = [
  {
    label: "Dashboard",
    href: "/family-planning/dashboard",
    icon: "◫",
  },
  {
    label: "Manage Clinics",
    href: "/admin/clinics",
    icon: "▦",
  },
  {
    label: "Nurse Administration",
    href: "/admin/nurses",
    icon: "♙",
  },
  {
    label: "Clinic Assignments",
    href: "/admin/assign-clinic",
    icon: "⇄",
  },
  {
    label: "Staff Approvals",
    href: "/admin/staff-approvals",
    icon: "✓",
  },
];

function AssignClinicContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStaffId = searchParams.get("staffId");

  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [nurseId, setNurseId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setAuthorized(false);
    setError("");
    setNotice("");

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

      const [staffResult, facilityResult] =
        await Promise.all([
          supabase
            .from("staff_profiles")
            .select("id,full_name,email")
            .eq("role", "nurse")
            .eq("approval_status", "approved")
            .eq("is_active", true)
            .order("full_name"),
          supabase
            .from("fp_facilities")
            .select(
              "id,name,mhfl_number,cfs_number,demander_number"
            )
            .order("name"),
        ]);

      if (staffResult.error) throw staffResult.error;
      if (facilityResult.error) throw facilityResult.error;

      const staff = (staffResult.data ?? []) as Nurse[];

      setNurses(staff);
      setFacilities(
        (facilityResult.data ?? []) as Facility[]
      );

      setNurseId((previous) => {
        if (
          requestedStaffId &&
          staff.some((n) => n.id === requestedStaffId)
        ) {
          return requestedStaffId;
        }

        if (
          previous &&
          staff.some((n) => n.id === previous)
        ) {
          return previous;
        }

        return staff.length === 1 ? staff[0].id : "";
      });

      setAuthorized(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load clinic assignments."
      );
    } finally {
      setLoading(false);
    }
  }, [router, requestedStaffId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!authorized || !nurseId) {
      setSelected([]);
      setSaved([]);
      setLoadingAssignments(false);
      return;
    }

    let cancelled = false;

    setLoadingAssignments(true);
    setError("");
    setNotice("");
    setSelected([]);
    setSaved([]);

    async function loadAssignments() {
      const { data, error: membershipError } =
        await supabase
          .from("fp_memberships")
          .select("facility_id,user_id,role,active")
          .eq("user_id", nurseId)
          .eq("role", NURSE_ROLE);

      if (cancelled) return;

      if (membershipError) {
        setError(membershipError.message);
      } else {
        const ids = (
          (data ?? []) as Membership[]
        )
          .filter((m) => m.active)
          .map((m) => m.facility_id);

        setSaved(ids);
        setSelected(ids);
      }

      setLoadingAssignments(false);
    }

    void loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [authorized, nurseId]);

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
        ].some((v) =>
          (v ?? "").toLowerCase().includes(q)
        )
    );
  }, [facilities, search]);

  const selectedNurse = nurses.find(
    (n) => n.id === nurseId
  );

  const added = selected.filter(
    (id) => !saved.includes(id)
  );

  const removed = saved.filter(
    (id) => !selected.includes(id)
  );

  const hasChanges =
    added.length > 0 || removed.length > 0;

  async function saveAssignments() {
    if (
      !authorized ||
      !nurseId ||
      saving ||
      loadingAssignments
    ) {
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

      const { data: staff, error: staffError } =
        await supabase
          .from("staff_profiles")
          .select("id")
          .eq("id", nurseId)
          .eq("role", "nurse")
          .eq("approval_status", "approved")
          .eq("is_active", true)
          .maybeSingle();

      if (staffError) throw staffError;

      if (!staff) {
        throw new Error(
          "Nurse is not approved and active."
        );
      }

      if (selected.length) {
        const { data: valid, error: validError } =
          await supabase
            .from("fp_facilities")
            .select("id")
            .in("id", selected);

        if (validError) throw validError;

        if ((valid ?? []).length !== selected.length) {
          throw new Error(
            "One or more clinics no longer exist. Refresh the page."
          );
        }
      }

      const { data: existing, error: existingError } =
        await supabase
          .from("fp_memberships")
          .select("facility_id,user_id,role,active")
          .eq("user_id", nurseId)
          .eq("role", NURSE_ROLE);

      if (existingError) throw existingError;

      const rows = (existing ?? []) as Membership[];

      const existingIds = new Set(
        rows.map((m) => m.facility_id)
      );

      const wantedIds = new Set(selected);

      const activate = rows.filter(
        (m) =>
          wantedIds.has(m.facility_id) &&
          !m.active
      );

      const deactivate = rows.filter(
        (m) =>
          !wantedIds.has(m.facility_id) &&
          m.active
      );

      const create = selected.filter(
        (id) => !existingIds.has(id)
      );

      for (const m of activate) {
        const { error: updateError } =
          await supabase
            .from("fp_memberships")
            .update({ active: true })
            .eq("user_id", nurseId)
            .eq("facility_id", m.facility_id)
            .eq("role", NURSE_ROLE);

        if (updateError) throw updateError;
      }

      for (const facilityId of create) {
        const { error: insertError } =
          await supabase
            .from("fp_memberships")
            .insert({
              user_id: nurseId,
              facility_id: facilityId,
              role: NURSE_ROLE,
              active: true,
            });

        if (insertError) throw insertError;
      }

      for (const m of deactivate) {
        const { error: updateError } =
          await supabase
            .from("fp_memberships")
            .update({ active: false })
            .eq("user_id", nurseId)
            .eq("facility_id", m.facility_id)
            .eq("role", NURSE_ROLE);

        if (updateError) throw updateError;
      }

      const { data: refreshed, error: refreshError } =
        await supabase
          .from("fp_memberships")
          .select("facility_id,active")
          .eq("user_id", nurseId)
          .eq("role", NURSE_ROLE);

      if (refreshError) throw refreshError;

      const ids = (refreshed ?? [])
        .filter((m) => m.active)
        .map((m) => m.facility_id);

      setSaved(ids);
      setSelected(ids);

      setNotice(
        `Saved ${ids.length} active clinic assignment(s).`
      );
    } catch (e) {
      setError(
        (e instanceof Error
          ? e.message
          : "Unable to save assignments.") +
          " If changes were partially saved, refresh before trying again."
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
                item.href === "/admin/assign-clinic"
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
              Administration / Workforce Management
            </span>

            <Link href="/family-planning/dashboard">
              ← Back to Dashboard
            </Link>
          </div>

          <header className="dt-hero">
            <div>
              <div className="dt-eyebrow">
                WORKFORCE MANAGEMENT
              </div>

              <h1>Clinic Assignments</h1>

              <p>
                Manage nurse access to Family Planning
                facilities across your network.
              </p>
            </div>

            <div className="dt-hero-icon">
              ⇄
            </div>
          </header>

          {loading ? (
            <section className="dt-panel">
              <h2>Loading assignments...</h2>
              <p className="dt-subtitle">
                Verifying administrator permissions
                and retrieving staff records.
              </p>
            </section>
          ) : (
            <>
              {authorized && (
                <div className="dt-metrics">
                  <div className="dt-metric">
                    <div className="dt-metric-label">
                      Approved Nurses
                    </div>

                    <div className="dt-metric-value">
                      {nurses.length}
                    </div>

                    <div className="dt-metric-foot">
                      Active approved nurse profiles
                    </div>
                  </div>

                  <div className="dt-metric">
                    <div className="dt-metric-label">
                      Available Clinics
                    </div>

                    <div className="dt-metric-value">
                      {facilities.length}
                    </div>

                    <div className="dt-metric-foot">
                      Facilities in the network
                    </div>
                  </div>

                  <div className="dt-metric">
                    <div className="dt-metric-label">
                      Selected Assignments
                    </div>

                    <div className="dt-metric-value">
                      {selected.length}
                    </div>

                    <div className="dt-metric-foot">
                      For the currently selected nurse
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div
                  className="dt-alert dt-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {notice && (
                <div
                  className="dt-alert dt-success"
                  role="status"
                >
                  {notice}
                </div>
              )}

              {authorized && (
                <>
                  <section className="dt-panel">
                    <div className="dt-toolbar">
                      <div>
                        <h2>Select Nurse</h2>
                        <p className="dt-subtitle">
                          Choose an approved and active
                          nurse to manage clinic access.
                        </p>
                      </div>

                      <Link
                        href="/admin/staff-approvals"
                        className="dt-secondary"
                      >
                        Staff Approvals
                      </Link>
                    </div>

                    <div style={{ marginTop: 24 }}>
                      <label
                        htmlFor="nurse"
                        className="dt-label"
                      >
                        Approved Nurse
                      </label>

                      <select
                        id="nurse"
                        className="dt-input"
                        value={nurseId}
                        onChange={(e) => {
                          setNurseId(e.target.value);
                          setNotice("");
                        }}
                        disabled={
                          saving || loadingAssignments
                        }
                      >
                        <option value="">
                          Select an approved nurse
                        </option>

                        {nurses.map((n) => (
                          <option
                            key={n.id}
                            value={n.id}
                          >
                            {n.full_name ||
                              "Unnamed nurse"}
                            {n.email
                              ? ` (${n.email})`
                              : ""}
                          </option>
                        ))}
                      </select>

                      {nurses.length === 0 && (
                        <p
                          className="dt-subtitle"
                          style={{
                            color: "#b45309",
                          }}
                        >
                          No approved active nurses found.
                        </p>
                      )}
                    </div>
                  </section>

                  {nurseId && (
                    <section className="dt-panel">
                      <div className="dt-toolbar">
                        <div>
                          <h2>Assign Facilities</h2>

                          <p className="dt-subtitle">
                            {selectedNurse?.full_name ||
                              "Selected nurse"}
                            {selectedNurse?.email
                              ? ` • ${selectedNurse.email}`
                              : ""}
                          </p>
                        </div>

                        <span className="dt-subtitle">
                          {facilities.length} facilities
                          available
                        </span>
                      </div>

                      <div style={{ marginTop: 24 }}>
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
                          placeholder="Search by clinic name, MHFL, CFS or Demander"
                        />
                      </div>

                      {loadingAssignments ? (
                        <div className="dt-empty">
                          Loading existing assignments...
                        </div>
                      ) : (
                        <>
                          <div className="dt-clinic-list">
                            {filtered.map((f) => {
                              const checked =
                                selected.includes(f.id);

                              return (
                                <label
                                  key={f.id}
                                  className={
                                    checked
                                      ? "dt-clinic-row selected"
                                      : "dt-clinic-row"
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={saving}
                                    onChange={() =>
                                      setSelected(
                                        (previous) =>
                                          previous.includes(
                                            f.id
                                          )
                                            ? previous.filter(
                                                (id) =>
                                                  id !== f.id
                                              )
                                            : [
                                                ...previous,
                                                f.id,
                                              ]
                                      )
                                    }
                                  />

                                  <div>
                                    <div className="dt-clinic-name">
                                      {f.name}
                                    </div>

                                    <div className="dt-clinic-meta">
                                      {f.mhfl_number
                                        ? `MHFL: ${f.mhfl_number}  `
                                        : ""}
                                      {f.cfs_number
                                        ? `CFS: ${f.cfs_number}  `
                                        : ""}
                                      {f.demander_number
                                        ? `Demander: ${f.demander_number}`
                                        : ""}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}

                            {filtered.length === 0 && (
                              <div className="dt-empty">
                                No matching clinics found.
                              </div>
                            )}
                          </div>

                          <div className="dt-summary">
                            <h3>Assignment Summary</h3>

                            <p>
                              Current saved assignments:{" "}
                              <strong>
                                {saved.length}
                              </strong>
                            </p>

                            <p>
                              Selected assignments:{" "}
                              <strong>
                                {selected.length}
                              </strong>
                            </p>

                            <p>
                              New assignments:{" "}
                              <strong>
                                +{added.length}
                              </strong>
                            </p>

                            <p>
                              Assignments to remove:{" "}
                              <strong>
                                -{removed.length}
                              </strong>
                            </p>
                          </div>

                          <div className="dt-actions">
                            <button
                              type="button"
                              className="dt-primary"
                              onClick={() =>
                                void saveAssignments()
                              }
                              disabled={
                                saving ||
                                !hasChanges ||
                                facilities.length === 0
                              }
                            >
                              {saving
                                ? "Saving..."
                                : "Save Clinic Assignments"}
                            </button>

                            <button
                              type="button"
                              className="dt-secondary"
                              onClick={() =>
                                setSelected([...saved])
                              }
                              disabled={
                                saving || !hasChanges
                              }
                            >
                              Discard Changes
                            </button>
                          </div>
                        </>
                      )}
                    </section>
                  )}

                  <div className="dt-actions">
                    <button
                      type="button"
                      className="dt-secondary"
                      onClick={() =>
                        void loadPage()
                      }
                      disabled={saving}
                    >
                      Refresh
                    </button>

                    <Link
                      href="/admin/clinics"
                      className="dt-secondary"
                    >
                      Manage Clinics
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

export default function AssignClinicPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 32 }}>
          Loading clinic assignments...
        </main>
      }
    >
      <AssignClinicContent />
    </Suspense>
  );
}
