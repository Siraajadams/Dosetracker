
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = Record<string, unknown> & {
  id: string;
};

type Membership = {
  facility_id: string;
  role: string;
  active: boolean;
};

const navigation = [
  { label: "Dashboard", href: "/family-planning/dashboard", icon: "▦" },
  { label: "Manage Clinics", href: "/admin/clinics", icon: "▤" },
  { label: "Nurse Administration", href: "/admin/nurses", icon: "♙" },
  { label: "Clinic Assignments", href: "/admin/assign-clinic", icon: "⇄" },
  { label: "Staff Approvals", href: "/admin/staff-approvals", icon: "✓" },
  { label: "Medication Catalogue", href: "/admin/medications", icon: "✚" },
  { label: "Patient Management", href: "/family-planning/patients", icon: "♧" },
];

function field(
  record: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return "";
}

function formatDate(value: string): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export default function FamilyPlanningPatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      setLoading(true);
      setError("");

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (cancelled) return;

        if (authError || !auth.user) {
          router.replace("/family-planning/login");
          return;
        }

        setEmail(auth.user.email ?? "");

        const adminResult = await supabase.rpc("dt_is_super_admin");
        if (cancelled) return;

        if (adminResult.error) {
          setError(adminResult.error.message);
          return;
        }

        const admin = adminResult.data === true;
        setIsSuperAdmin(admin);

        const { data, error: membershipError } = await supabase
          .from("fp_memberships")
          .select("facility_id, role, active")
          .eq("user_id", auth.user.id)
          .eq("active", true);

        if (cancelled) return;

        if (membershipError) {
          setError(membershipError.message);
          return;
        }

        const activeMemberships = (data ?? []) as Membership[];
        setMemberships(activeMemberships);

        if (activeMemberships.length > 0) {
          setFacilityId(activeMemberships[0].facility_id);
        } else if (!admin) {
          setError(
            "No active clinic assignment found. Contact the administrator."
          );
        } else {
          setError(
            "Super Admin access verified, but no clinic is assigned. " +
            "Assign a clinic to view its patient records."
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to verify clinic access."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadPatients = useCallback(async () => {
    if (!facilityId) return;

    setBusy(true);
    setError("");
    setPatients([]);

    try {
      const { data, error: queryError } = await supabase
        .from("fp_patients")
        .select("*")
        .eq("facility_id", facilityId)
        .limit(500);

      if (queryError) throw new Error(queryError.message);

      setPatients((data ?? []) as unknown as Patient[]);
    } catch (err) {
      setPatients([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load patient records."
      );
    } finally {
      setBusy(false);
    }
  }, [facilityId]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const genders = useMemo(() => {
    return Array.from(
      new Set(
        patients
          .map((patient) => field(patient, "gender", "sex"))
          .filter(Boolean)
      )
    ).sort();
  }, [patients]);

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const searchable = [
        field(patient, "first_name", "name"),
        field(patient, "surname", "last_name"),
        field(patient, "id_number", "sa_id_number"),
        field(patient, "passport_number"),
        field(patient, "mobile_number", "contact_number"),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchable.includes(
        search.trim().toLowerCase()
      );

      const gender = field(patient, "gender", "sex");

      const matchesGender =
        genderFilter === "All" || gender === genderFilter;

      return matchesSearch && matchesGender;
    });
  }, [patients, search, genderFilter]);

  const withContact = patients.filter((patient) =>
    field(patient, "mobile_number", "contact_number")
  ).length;

  const withDOB = patients.filter((patient) =>
    field(patient, "date_of_birth", "dob")
  ).length;

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    router.replace("/family-planning/login");
  }

  if (loading) {
    return (
      <main className="dt-loading">
        Checking clinic access...
      </main>
    );
  }

  return (
    <div className="dt-app">
      <style>{styles}</style>

      <aside
        className={`dt-sidebar ${
          sidebarOpen ? "dt-sidebar-open" : ""
        }`}
      >
        <div className="dt-brand">
          <div className="dt-brand-mark">✳</div>
          <div>
            <strong>DoseTrack</strong>
            <small>FAMILY PLANNING</small>
          </div>
        </div>

        <div className="dt-side-label">WORKSPACE</div>

        <nav className="dt-nav" aria-label="Main navigation">
          {navigation
            .filter(
              (item) =>
                isSuperAdmin ||
                [
                  "/family-planning/dashboard",
                  "/family-planning/patients",
                ].includes(item.href)
            )
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`dt-nav-link ${
                  item.href === "/family-planning/patients"
                    ? "dt-nav-active"
                    : ""
                }`}
              >
                <span className="dt-nav-icon">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>

        <div className="dt-sidebar-footer">
          <div className="dt-sidebar-avatar">
            {email.slice(0, 1).toUpperCase() || "U"}
          </div>
          <div className="dt-sidebar-user">
            <strong>
              {isSuperAdmin
                ? "Super Administrator"
                : "Clinical Staff"}
            </strong>
            <small>{email}</small>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="dt-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="dt-main">
        <header className="dt-topbar">
          <div className="dt-top-left">
            <button
              className="dt-menu"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>

            <span>Family Planning</span>
            <span>/</span>
            <strong>Patient Management</strong>
          </div>

          <div className="dt-top-actions">
            <span className="dt-role-pill">
              ● {isSuperAdmin ? "Super Admin" : "Clinical Access"}
            </span>

            <button
              className="dt-signout"
              onClick={() => void signOut()}
            >
              Sign out ↗
            </button>
          </div>
        </header>

        <div className="dt-content">
          <div className="dt-eyebrow">
            FAMILY PLANNING / PATIENT MANAGEMENT
          </div>

          <section className="dt-hero">
            <span className="dt-hero-chip">
              PATIENT MANAGEMENT
            </span>

            <h1>Patient Records</h1>

            <p>
              Manage patient registrations, search records and
              review clinical history for your assigned clinic.
            </p>

            <span className="dt-hero-symbol">♧</span>
          </section>

          <div className="dt-stats">
            <div className="dt-stat">
              <span>Total Patients</span>
              <strong>{patients.length}</strong>
              <small>Records loaded for selected clinic</small>
            </div>

            <div className="dt-stat">
              <span>With Contact Details</span>
              <strong>{withContact}</strong>
              <small>Patients with a recorded phone number</small>
            </div>

            <div className="dt-stat">
              <span>With Date of Birth</span>
              <strong>{withDOB}</strong>
              <small>Patients with recorded DOB</small>
            </div>
          </div>

          <section className="dt-panel">
            <div className="dt-panel-header">
              <div>
                <h2>Patient Management</h2>
                <p>
                  Search patient records and open clinical history.
                </p>
              </div>

              <div className="dt-actions">
                <button
                  className="dt-button dt-button-outline"
                  disabled={busy || !facilityId}
                  onClick={() => void loadPatients()}
                >
                  {busy ? "Refreshing..." : "Refresh"}
                </button>

                {facilityId && (
                  <Link
                    href="/nurse/patients/new"
                    className="dt-button dt-button-primary"
                  >
                    + Register Patient
                  </Link>
                )}
              </div>
            </div>

            {error && (
              <div className="dt-error" role="alert">
                {error}
              </div>
            )}

            {facilityId && (
              <>
                <div className="dt-filters">
                  <label className="dt-field">
                    <span>Search Patient</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Name, surname, ID or passport"
                    />
                  </label>

                  <label className="dt-field">
                    <span>Gender</span>
                    <select
                      value={genderFilter}
                      onChange={(event) =>
                        setGenderFilter(event.target.value)
                      }
                    >
                      <option value="All">All genders</option>
                      {genders.map((gender) => (
                        <option key={gender} value={gender}>
                          {gender}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="dt-field">
                    <span>Assigned Clinic</span>
                    <select
                      value={facilityId}
                      disabled={memberships.length <= 1}
                      onChange={(event) => {
                        setPatients([]);
                        setFacilityId(event.target.value);
                      }}
                    >
                      {memberships.map((membership) => (
                        <option
                          key={membership.facility_id}
                          value={membership.facility_id}
                        >
                          {membership.facility_id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="dt-record-count">
                  {busy
                    ? "Loading patients..."
                    : `Showing ${filteredPatients.length} of ${patients.length} patient records`}
                </p>

                <div className="dt-table-wrap">
                  <table className="dt-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>ID / Passport</th>
                        <th>Date of Birth</th>
                        <th>Gender</th>
                        <th>Contact</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredPatients.map((patient) => {
                        const firstName = field(
                          patient,
                          "first_name",
                          "name"
                        );

                        const surname = field(
                          patient,
                          "surname",
                          "last_name"
                        );

                        return (
                          <tr key={patient.id}>
                            <td className="dt-patient-name">
                              {`${firstName} ${surname}`.trim() ||
                                "Unnamed patient"}
                            </td>

                            <td>
                              {field(
                                patient,
                                "id_number",
                                "sa_id_number",
                                "passport_number"
                              ) || "—"}
                            </td>

                            <td>
                              {formatDate(
                                field(
                                  patient,
                                  "date_of_birth",
                                  "dob"
                                )
                              )}
                            </td>

                            <td>
                              {field(
                                patient,
                                "gender",
                                "sex"
                              ) || "—"}
                            </td>

                            <td>
                              {field(
                                patient,
                                "mobile_number",
                                "contact_number"
                              ) || "—"}
                            </td>

                            <td>
                              <Link
                                href={`/nurse/patients/${encodeURIComponent(
                                  patient.id
                                )}`}
                                className="dt-action-link"
                              >
                                View History →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}

                      {!busy &&
                        filteredPatients.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="dt-empty"
                            >
                              No matching patients found.
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <footer className="dt-footer">
            DoseTrack © 2026 · Family Planning Management
          </footer>
        </div>
      </main>
    </div>
  );
}

const styles = `
.dt-app{--ink:#172d36;--muted:#647781;--line:#e3eaf0;display:flex;min-height:100vh;background:#f5f8fa;color:var(--ink);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px}
.dt-app *{box-sizing:border-box}
.dt-app button,.dt-app input,.dt-app select{font:inherit}
.dt-app button{cursor:pointer}
.dt-app button:disabled{cursor:not-allowed;opacity:.5}
.dt-sidebar{width:266px;flex-shrink:0;background:#10383f;color:#d8eaeb;display:flex;flex-direction:column;min-height:100vh;position:sticky;top:0;height:100vh;z-index:30}
.dt-brand{display:flex;align-items:center;gap:12px;padding:31px 24px 34px;border-bottom:1px solid #ffffff18}
.dt-brand-mark{height:42px;width:42px;display:grid;place-items:center;background:#1b6c69;color:#fff;font-size:27px;border-radius:13px}
.dt-brand strong{font-size:23px;letter-spacing:-.8px;color:#fff;display:block;line-height:1.1}
.dt-brand small{display:block;letter-spacing:2px;font-size:9px;color:#8fbabc;margin-top:7px;font-weight:700}
.dt-side-label{font-size:10px;font-weight:800;letter-spacing:1.7px;color:#80a8ad;margin:31px 26px 12px}
.dt-nav{padding:0 13px;overflow-y:auto;flex:1}
.dt-nav-link{display:flex;gap:12px;align-items:center;padding:12px 13px;border-radius:10px;text-decoration:none;color:#c8dadd;font-size:13px;font-weight:550;margin:3px 0}
.dt-nav-link:hover{background:#ffffff13;color:#fff}
.dt-nav-active{background:#22656b;color:#fff;font-weight:700}
.dt-nav-icon{width:22px;text-align:center;font-size:17px}
.dt-sidebar-footer{border-top:1px solid #ffffff20;padding:20px 17px;display:flex;gap:11px;align-items:center}
.dt-sidebar-avatar{width:36px;height:36px;border-radius:50%;background:#2d777a;display:grid;place-items:center;font-weight:800;color:#fff}
.dt-sidebar-user{min-width:0}
.dt-sidebar-user strong{display:block;font-size:12px;color:#fff}
.dt-sidebar-user small{display:block;max-width:168px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#a4c5c7;margin-top:3px}
.dt-main{flex:1;min-width:0}
.dt-topbar{height:77px;background:#fff;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:0 37px;gap:15px}
.dt-top-left,.dt-top-actions{display:flex;align-items:center;gap:12px;font-size:13px}
.dt-top-left{color:#6b7e87}
.dt-top-left strong{color:#203b43}
.dt-role-pill{color:#0b756b;background:#e9f8f3;padding:8px 12px;border-radius:30px;font-size:11px;font-weight:800}
.dt-signout{background:#fff;border:1px solid #dbe4e9;border-radius:9px;padding:9px 13px;font-weight:700;color:#35505a}
.dt-menu{display:none;border:0;background:transparent;font-size:23px;color:#123b40}
.dt-content{max-width:1400px;margin:auto;padding:38px 38px 20px}
.dt-eyebrow{font-size:10px;letter-spacing:1.9px;color:#6b858b;font-weight:850;margin-bottom:15px}
.dt-hero{background:linear-gradient(112deg,#0d444a 0%,#126e70 70%,#22898a 100%);border-radius:21px;min-height:230px;padding:40px 43px;position:relative;overflow:hidden;color:#fff;box-shadow:0 12px 30px #0a45451a}
.dt-hero-chip{display:inline-block;background:#ffffff20;border:1px solid #ffffff35;border-radius:30px;padding:8px 12px;font-size:10px;letter-spacing:1.2px;font-weight:800}
.dt-hero h1{font-size:clamp(27px,3vw,39px);letter-spacing:-1.3px;line-height:1.14;margin:21px 0 13px;font-weight:800}
.dt-hero p{font-size:14px;color:#d2eeeb;line-height:1.75;max-width:650px;margin:0}
.dt-hero-symbol{position:absolute;right:65px;top:35px;font-size:125px;color:#ffffff35}
.dt-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px;margin:21px 0 28px}
.dt-stat{background:#fff;border:1px solid var(--line);border-radius:15px;padding:22px 23px;display:flex;flex-direction:column;min-height:130px;box-shadow:0 3px 14px #1b435006}
.dt-stat span{font-size:12px;color:#758791}
.dt-stat strong{font-size:29px;letter-spacing:-.5px;margin-top:12px}
.dt-stat small{font-size:11px;color:#83949b;margin-top:5px}
.dt-panel{background:#fff;border:1px solid var(--line);border-radius:17px;padding:25px;box-shadow:0 3px 12px #1b435005}
.dt-panel-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px}
.dt-panel-header h2{font-size:21px;margin:0 0 7px}
.dt-panel-header p{font-size:12px;color:var(--muted);margin:0}
.dt-actions{display:flex;gap:10px;flex-wrap:wrap}
.dt-button{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:9px;padding:11px 16px;font-size:12px;font-weight:750;border:1px solid #dbe4e9}
.dt-button-primary{background:#0e756d;border-color:#0e756d;color:#fff}
.dt-button-outline{background:#fff;color:#35505a}
.dt-filters{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;margin-bottom:18px}
.dt-field{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:700;color:#49626c}
.dt-field input,.dt-field select{width:100%;min-height:43px;border:1px solid #dbe4e9;border-radius:9px;padding:10px 12px;background:#fff;color:#172d36;outline:none}
.dt-field input:focus,.dt-field select:focus{border-color:#0e756d;box-shadow:0 0 0 3px #0e756d15}
.dt-record-count{font-size:12px;color:#758791;margin:14px 0}
.dt-table-wrap{overflow-x:auto}
.dt-table{width:100%;border-collapse:collapse;text-align:left;font-size:12px}
.dt-table th{background:#f5f8fa;color:#607681;font-weight:800;padding:14px 12px;white-space:nowrap}
.dt-table td{padding:14px 12px;border-bottom:1px solid #edf1f4;color:#334b54;vertical-align:middle}
.dt-patient-name{font-weight:750;color:#172d36!important}
.dt-action-link{color:#08776d;text-decoration:none;font-size:12px;font-weight:750;white-space:nowrap}
.dt-action-link:hover{text-decoration:underline}
.dt-empty{text-align:center;padding:32px!important;color:#7c8991!important}
.dt-error{padding:13px 15px;border-radius:9px;margin-bottom:18px;font-size:12px;background:#fff0f0;color:#a02727;border:1px solid #f0c9c9}
.dt-footer{border-top:1px solid #dfe7eb;padding:20px 0;margin-top:30px;color:#91a1a9;font-size:10px}
.dt-loading{padding:45px;font-family:system-ui;color:#17464b}
.dt-backdrop{display:none}
@media(max-width:1000px){.dt-hero-symbol{opacity:.3}.dt-filters{grid-template-columns:1fr 1fr}.dt-filters .dt-field:first-child{grid-column:1/-1}}
@media(max-width:800px){.dt-sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .2s}.dt-sidebar-open{transform:translateX(0)}.dt-backdrop{display:block;position:fixed;inset:0;background:#0b263a70;z-index:20;border:0}.dt-menu{display:block}.dt-topbar{padding:0 20px}.dt-content{padding:24px 18px}.dt-hero{padding:30px 25px;min-height:210px}.dt-hero-symbol{display:none}.dt-stats{gap:10px}.dt-stat{padding:15px}}
@media(max-width:560px){.dt-role-pill{display:none}.dt-stats{grid-template-columns:1fr}.dt-panel{padding:16px}.dt-panel-header{flex-direction:column;align-items:flex-start}.dt-filters{grid-template-columns:1fr}.dt-filters .dt-field:first-child{grid-column:auto}.dt-hero h1{font-size:28px}}
`;
