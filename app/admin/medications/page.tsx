
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Medication = {
  id: string;
  icn_code: string | null;
  medication_name: string;
  generic_name: string | null;
  category: string;
  dosage_form: string | null;
  strength: string | null;
  stock_unit: string;
  administration_route: string | null;
  is_government_stock: boolean;
  is_active: boolean;
};

type MedicationForm = Omit<Medication, "id">;

const initialForm: MedicationForm = {
  icn_code: "",
  medication_name: "",
  generic_name: "",
  category: "Injectable Contraceptive",
  dosage_form: "",
  strength: "",
  stock_unit: "unit",
  administration_route: "",
  is_government_stock: true,
  is_active: true,
};

const defaultCategories = [
  "Barrier Contraceptive",
  "Contraceptive Implant",
  "Emergency contraception",
  "Injectable Contraceptive",
  "Intrauterine device",
  "Oral Contraceptive",
  "Procedure Consumable",
  "Other",
];

const navigation = [
  { label: "Dashboard", href: "/admin", icon: "▦" },
  { label: "Manage Clinics", href: "/admin/clinics", icon: "▤" },
  { label: "Nurse Administration", href: "/admin/nurses", icon: "♙" },
  { label: "Clinic Assignments", href: "/admin/assign-clinic", icon: "⇄" },
  { label: "Staff Approvals", href: "/admin/staff-approvals", icon: "✓" },
  { label: "Medication Catalogue", href: "/admin/medications", icon: "✚" },
  { label: "Patient Management", href: "/family-planning/patients", icon: "♧" },
];

function optional(value: string | null): string | null {
  return value?.trim() || null;
}

export default function MedicationCataloguePage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState("");

  const [medications, setMedications] = useState<Medication[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MedicationForm>(initialForm);

  const loadMedications = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("fp_medication_catalogue")
        .select("*")
        .order("medication_name");

      if (queryError) throw new Error(queryError.message);

      setMedications((data ?? []) as unknown as Medication[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load medication catalogue."
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (cancelled) return;

        if (authError || !auth.user) {
          router.replace("/family-planning/login");
          return;
        }

        setEmail(auth.user.email ?? "");

        const { data, error: roleError } =
          await supabase.rpc("dt_is_super_admin");

        if (cancelled) return;

        if (roleError || data !== true) {
          setError("Super Administrator access required.");
          return;
        }

        setAuthorized(true);
      } catch {
        if (!cancelled) {
          setError("Unable to verify administrator access.");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authorized) void loadMedications();
  }, [authorized, loadMedications]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set([
          ...defaultCategories,
          ...medications.map((m) => m.category),
        ])
      ).sort(),
    [medications]
  );

  const filtered = useMemo(() => {
    return medications.filter((med) => {
      const text = [
        med.medication_name,
        med.generic_name,
        med.icn_code,
        med.category,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = text.includes(
        search.trim().toLowerCase()
      );

      const matchesCategory =
        categoryFilter === "All" ||
        med.category === categoryFilter;

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active"
          ? med.is_active
          : !med.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [medications, search, categoryFilter, statusFilter]);

  function updateForm<K extends keyof MedicationForm>(
    key: K,
    value: MedicationForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function addMedication() {
    setEditingId(null);
    setForm({ ...initialForm });
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function editMedication(med: Medication) {
    setEditingId(med.id);
    setForm({
      icn_code: med.icn_code,
      medication_name: med.medication_name,
      generic_name: med.generic_name,
      category: med.category,
      dosage_form: med.dosage_form,
      strength: med.strength,
      stock_unit: med.stock_unit,
      administration_route: med.administration_route,
      is_government_stock: med.is_government_stock,
      is_active: med.is_active,
    });
    setShowForm(true);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveMedication() {
    if (
      !form.medication_name.trim() ||
      !form.category.trim() ||
      !form.stock_unit.trim()
    ) {
      setError("Medication name, category and stock unit are required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      icn_code: optional(form.icn_code),
      medication_name: form.medication_name.trim(),
      generic_name: optional(form.generic_name),
      category: form.category.trim(),
      dosage_form: optional(form.dosage_form),
      strength: optional(form.strength),
      stock_unit: form.stock_unit.trim(),
      administration_route: optional(form.administration_route),
      is_government_stock: form.is_government_stock,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    try {
      // The existing Supabase generated types may be outdated.
      // The table and column names here match the existing schema.
      const table = supabase.from("fp_medication_catalogue");

      const result = editingId
        ? await table
            .update(payload)
            .eq("id", editingId)
            .select("id")
            .single()
        : await table
            .insert(payload)
            .select("id")
            .single();

      if (result.error) throw new Error(result.error.message);

      setShowForm(false);
      setEditingId(null);
      await loadMedications();
      setMessage("Medication saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save medication."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(med: Medication) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("fp_medication_catalogue")
        .update({
          is_active: !med.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", med.id)
        .select("id")
        .single();

      if (updateError) throw new Error(updateError.message);

      await loadMedications();
      setMessage("Medication status updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update medication."
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    router.replace("/family-planning/login");
  }

  if (checking) {
    return <main className="dt-loading">Checking administrator access...</main>;
  }

  if (!authorized) {
    return (
      <main className="dt-loading">
        <h2>Access restricted</h2>
        <p>{error}</p>
        <Link href="/family-planning/dashboard">
          Return to dashboard
        </Link>
      </main>
    );
  }

  return (
    <div className="dt-app">
      <style>{styles}</style>

      <aside className={`dt-sidebar ${sidebarOpen ? "dt-sidebar-open" : ""}`}>
        <div className="dt-brand">
          <div className="dt-brand-mark">✳</div>
          <div>
            <strong>DoseTrack</strong>
            <small>FAMILY PLANNING</small>
          </div>
        </div>

        <div className="dt-side-label">WORKSPACE</div>

        <nav className="dt-nav">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`dt-nav-link ${
                item.href === "/admin/medications"
                  ? "dt-nav-active"
                  : ""
              }`}
            >
              <span className="dt-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="dt-sidebar-footer">
          <div className="dt-sidebar-avatar">
            {email.slice(0, 1).toUpperCase() || "A"}
          </div>
          <div className="dt-sidebar-user">
            <strong>Super Administrator</strong>
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
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <span>Administration</span>
            <span>/</span>
            <strong>Medication Catalogue</strong>
          </div>

          <div className="dt-top-actions">
            <span className="dt-role-pill">● Super Admin</span>
            <button className="dt-signout" onClick={() => void signOut()}>
              Sign out ↗
            </button>
          </div>
        </header>

        <div className="dt-content">
          <div className="dt-eyebrow">
            ADMINISTRATION / MEDICATION MANAGEMENT
          </div>

          <section className="dt-hero">
            <span className="dt-hero-chip">
              MEDICATION MANAGEMENT
            </span>
            <h1>Medication Catalogue</h1>
            <p>
              Manage contraceptives, stock classifications and
              medication availability across your network.
            </p>
            <span className="dt-hero-symbol">✚</span>
          </section>

          <div className="dt-stats">
            <div className="dt-stat">
              <span>Total Medications</span>
              <strong>{medications.length}</strong>
              <small>Catalogue records</small>
            </div>
            <div className="dt-stat">
              <span>Active Medications</span>
              <strong>
                {medications.filter((m) => m.is_active).length}
              </strong>
              <small>Available for selection</small>
            </div>
            <div className="dt-stat">
              <span>Government Stock</span>
              <strong>
                {medications.filter((m) => m.is_government_stock).length}
              </strong>
              <small>Government stock classification</small>
            </div>
          </div>

          <section className="dt-panel">
            <div className="dt-panel-header">
              <div>
                <h2>Medication Management</h2>
                <p>Search, register and maintain medication records.</p>
              </div>

              <div className="dt-actions">
                <button
                  className="dt-button dt-button-outline"
                  disabled={busy}
                  onClick={() => void loadMedications()}
                >
                  {busy ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  className="dt-button dt-button-primary"
                  onClick={addMedication}
                >
                  + Add Medication
                </button>
              </div>
            </div>

            {error && <div className="dt-error" role="alert">{error}</div>}
            {message && <div className="dt-success" role="status">{message}</div>}

            {showForm && (
              <div className="dt-form-panel">
                <h3>{editingId ? "Edit Medication" : "Add Medication"}</h3>

                <div className="dt-form-grid">
                  {(
                    [
                      ["medication_name", "Medication Name *"],
                      ["generic_name", "Generic Name"],
                      ["icn_code", "ICN Code"],
                      ["dosage_form", "Dosage Form"],
                      ["strength", "Strength"],
                      ["stock_unit", "Stock Unit *"],
                      ["administration_route", "Administration Route"],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="dt-field" key={key}>
                      <span>{label}</span>
                      <input
                        value={form[key] ?? ""}
                        onChange={(e) => updateForm(key, e.target.value)}
                      />
                    </label>
                  ))}

                  <label className="dt-field">
                    <span>Category *</span>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        updateForm("category", e.target.value)
                      }
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="dt-checkbox">
                    <input
                      type="checkbox"
                      checked={form.is_government_stock}
                      onChange={(e) =>
                        updateForm("is_government_stock", e.target.checked)
                      }
                    />
                    Government Stock
                  </label>

                  <label className="dt-checkbox">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        updateForm("is_active", e.target.checked)
                      }
                    />
                    Active Medication
                  </label>
                </div>

                <div className="dt-actions">
                  <button
                    className="dt-button dt-button-primary"
                    disabled={saving}
                    onClick={() => void saveMedication()}
                  >
                    {saving ? "Saving..." : "Save Medication"}
                  </button>
                  <button
                    className="dt-button dt-button-outline"
                    disabled={saving}
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="dt-filters">
              <label className="dt-field">
                <span>Search Medication</span>
                <input
                  type="search"
                  placeholder="Name, generic name or ICN code"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>

              <label className="dt-field">
                <span>Category</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="All">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="dt-field">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>

            <p className="dt-record-count">
              Showing {filtered.length} of {medications.length} medication records
            </p>

            <div className="dt-table-wrap">
              <table className="dt-table">
                <thead>
                  <tr>
                    <th>ICN</th>
                    <th>Medication</th>
                    <th>Generic</th>
                    <th>Category</th>
                    <th>Strength</th>
                    <th>Stock Unit</th>
                    <th>Government</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((med) => (
                    <tr key={med.id}>
                      <td>{med.icn_code || "—"}</td>
                      <td className="dt-med-name">{med.medication_name}</td>
                      <td>{med.generic_name || "—"}</td>
                      <td>{med.category}</td>
                      <td>{med.strength || "—"}</td>
                      <td>{med.stock_unit}</td>
                      <td>{med.is_government_stock ? "Yes" : "No"}</td>
                      <td>
                        <span className={`dt-status ${med.is_active ? "dt-active" : "dt-inactive"}`}>
                          {med.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="dt-row-actions">
                          <button onClick={() => editMedication(med)}>
                            Edit
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => void toggleActive(med)}
                          >
                            {med.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!busy && filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="dt-empty">
                        No matching medications found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
.dt-button{border-radius:9px;padding:11px 16px;font-size:12px;font-weight:750;border:1px solid #dbe4e9}
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
.dt-med-name{font-weight:750;color:#172d36!important}
.dt-status{display:inline-block;border-radius:30px;padding:5px 9px;font-size:10px;font-weight:800}
.dt-active{background:#e9f8f3;color:#08776d}
.dt-inactive{background:#f2f3f5;color:#7c8991}
.dt-row-actions{display:flex;gap:10px;white-space:nowrap}
.dt-row-actions button{background:none;border:0;color:#08776d;font-size:12px;font-weight:750;padding:3px}
.dt-empty{text-align:center;padding:32px!important;color:#7c8991!important}
.dt-form-panel{background:#f8fbfc;border:1px solid #dfe9ed;border-radius:13px;padding:23px;margin-bottom:25px}
.dt-form-panel h3{font-size:19px;margin:0 0 20px}
.dt-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin-bottom:20px}
.dt-checkbox{display:flex;gap:9px;align-items:center;font-size:12px;font-weight:700;color:#49626c}
.dt-error,.dt-success{padding:13px 15px;border-radius:9px;margin-bottom:18px;font-size:12px}
.dt-error{background:#fff0f0;color:#a02727;border:1px solid #f0c9c9}
.dt-success{background:#e9f8f3;color:#08776d;border:1px solid #bfe7dd}
.dt-footer{border-top:1px solid #dfe7eb;padding:20px 0;margin-top:30px;color:#91a1a9;font-size:10px}
.dt-loading{padding:45px;font-family:system-ui;color:#17464b}
.dt-backdrop{display:none}
@media(max-width:1000px){.dt-hero-symbol{opacity:.3}.dt-filters{grid-template-columns:1fr 1fr}.dt-filters .dt-field:first-child{grid-column:1/-1}}
@media(max-width:800px){.dt-sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .2s}.dt-sidebar-open{transform:translateX(0)}.dt-backdrop{display:block;position:fixed;inset:0;background:#0b263a70;z-index:20;border:0}.dt-menu{display:block}.dt-topbar{padding:0 20px}.dt-content{padding:24px 18px}.dt-hero{padding:30px 25px;min-height:210px}.dt-hero-symbol{display:none}.dt-stats{gap:10px}.dt-stat{padding:15px}}
@media(max-width:560px){.dt-role-pill{display:none}.dt-stats{grid-template-columns:1fr}.dt-panel{padding:16px}.dt-panel-header{flex-direction:column;align-items:flex-start}.dt-filters,.dt-form-grid{grid-template-columns:1fr}.dt-filters .dt-field:first-child{grid-column:auto}.dt-hero h1{font-size:28px}}
`;
