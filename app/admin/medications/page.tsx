"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import DoseTrackWorkspace from "@/components/family-planning/DoseTrackWorkspace";
import s from "@/components/family-planning/DoseTrackRecords.module.css";

type Medication = {
  id: string; icn_code: string | null; medication_name: string; generic_name: string | null;
  category: string; dosage_form: string | null; strength: string | null; stock_unit: string;
  administration_route: string | null; is_government_stock: boolean; is_active: boolean;
};
type Form = Omit<Medication, "id">;
const initialForm: Form = {
  icn_code: "", medication_name: "", generic_name: "", category: "Injectable Contraceptive",
  dosage_form: "", strength: "", stock_unit: "unit", administration_route: "",
  is_government_stock: true, is_active: true,
};
const knownCategories = ["Barrier Contraceptive", "Contraceptive Implant", "Emergency contraception", "Injectable Contraceptive", "Intrauterine device", "Oral Contraceptive", "Procedure Consumable", "Other"];

export default function MedicationCataloguePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>({ ...initialForm });

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (authError || !auth.user) { router.replace("/family-planning/login"); return; }
      const result = await supabase.rpc("dt_is_super_admin");
      if (cancelled) return;
      if (result.error || result.data !== true) setError(result.error?.message || "Super Administrator access required.");
      else setAuthorized(true);
      setChecking(false);
    }
    void checkAccess();
    return () => { cancelled = true; };
  }, [router]);

  const loadMedications = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const { data, error: queryError } = await supabase.from("fp_medication_catalogue").select("*").order("medication_name");
      if (queryError) throw new Error(queryError.message);
      setMedications((data ?? []) as unknown as Medication[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load medication catalogue.");
    } finally { setBusy(false); }
  }, []);
  useEffect(() => { if (authorized) void loadMedications(); }, [authorized, loadMedications]);

  const categories = useMemo(() => Array.from(new Set([...knownCategories, ...medications.map(m => m.category)])).sort(), [medications]);
  const filtered = useMemo(() => medications.filter(m => {
    const matchText = [m.icn_code, m.medication_name, m.generic_name, m.category].join(" ").toLowerCase().includes(search.trim().toLowerCase());
    return matchText && (category === "All" || m.category === category) && (status === "All" || (status === "Active" ? m.is_active : !m.is_active));
  }), [medications, search, category, status]);

  function startAdd() { setForm({ ...initialForm }); setEditingId(null); setShowForm(true); setError(""); setMessage(""); }
  function startEdit(m: Medication) {
    setEditingId(m.id);
    setForm({ icn_code: m.icn_code, medication_name: m.medication_name, generic_name: m.generic_name, category: m.category, dosage_form: m.dosage_form, strength: m.strength, stock_unit: m.stock_unit, administration_route: m.administration_route, is_government_stock: m.is_government_stock, is_active: m.is_active });
    setShowForm(true); setError(""); setMessage("");
  }
  function change<K extends keyof Form>(key: K, value: Form[K]) { setForm(prev => ({ ...prev, [key]: value })); }

  async function save() {
    if (!form.medication_name.trim() || !form.category.trim() || !form.stock_unit.trim()) { setError("Medication name, category and stock unit are required."); return; }
    setSaving(true); setError(""); setMessage("");
    const payload = {
      icn_code: form.icn_code?.trim() || null, medication_name: form.medication_name.trim(), generic_name: form.generic_name?.trim() || null,
      category: form.category.trim(), dosage_form: form.dosage_form?.trim() || null, strength: form.strength?.trim() || null,
      stock_unit: form.stock_unit.trim(), administration_route: form.administration_route?.trim() || null,
      is_government_stock: form.is_government_stock, is_active: form.is_active, updated_at: new Date().toISOString(),
    };
    // The existing Supabase client may have stale generated database types. Runtime writes still respect RLS.
    try {
      const result = editingId
        ? await supabase.from("fp_medication_catalogue").update(payload).eq("id", editingId).select("id").single()
        : await supabase.from("fp_medication_catalogue").insert(payload).select("id").single();
      if (result.error) throw new Error(result.error.message);
      setShowForm(false); setEditingId(null);
      await loadMedications();
      setMessage("Medication saved successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save medication."); }
    finally { setSaving(false); }
  }
  async function toggle(m: Medication) {
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: updateError } = await supabase.from("fp_medication_catalogue")
        .update({ is_active: !m.is_active, updated_at: new Date().toISOString() }).eq("id", m.id).select("id").single();
      if (updateError) throw new Error(updateError.message);
      await loadMedications(); setMessage("Medication status updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update status."); }
    finally { setBusy(false); }
  }

  if (checking) return <p style={{ padding: 35, fontFamily: "system-ui" }}>Checking administrator permissions…</p>;
  if (!authorized) return <main style={{ padding: 35, fontFamily: "system-ui" }}><h1>Access restricted</h1><p role="alert">{error}</p><Link href="/family-planning/dashboard">Return to dashboard</Link></main>;

  return <DoseTrackWorkspace isAdmin title="Medication Catalogue" section="Medication Management" breadcrumb="Medications" description="Manage contraceptives, stock classifications and medication availability.">
    <div className={s.actions}>
      <Link className={s.button} href="/admin">Admin Dashboard</Link>
      <button type="button" className={s.primary} onClick={startAdd}>+ Add Medication</button>
      <button type="button" className={s.button} disabled={busy} onClick={() => void loadMedications()}>{busy ? "Refreshing…" : "Refresh"}</button>
    </div>
    {error && <div role="alert" className={s.error}>{error}</div>}
    {message && <div role="status" className={s.notice}>{message}</div>}
    <div className={s.stats}>
      <div className={s.stat}><span className={s.statLabel}>Total medications</span><strong>{medications.length}</strong><small>Catalogue records</small></div>
      <div className={s.stat}><span className={s.statLabel}>Active</span><strong>{medications.filter(m => m.is_active).length}</strong><small>Available for selection</small></div>
      <div className={s.stat}><span className={s.statLabel}>Government stock</span><strong>{medications.filter(m => m.is_government_stock).length}</strong><small>Government-classified items</small></div>
    </div>
    {showForm && <section className={s.panel}>
      <h2>{editingId ? "Edit Medication" : "Add Medication"}</h2>
      <div className={s.formGrid}>
        {([ ["medication_name", "Medication name *"], ["generic_name", "Generic name"], ["icn_code", "ICN code"], ["dosage_form", "Dosage form"], ["strength", "Strength"], ["stock_unit", "Stock unit *"], ["administration_route", "Administration route"] ] as const).map(([key, label]) =>
          <div className={s.field} key={key}><label htmlFor={`med-${key}`}>{label}</label><input id={`med-${key}`} className={s.input} value={form[key] ?? ""} onChange={e => change(key, e.target.value)} /></div>
        )}
        <div className={s.field}><label htmlFor="med-category">Category *</label><select id="med-category" className={s.select} value={form.category} onChange={e => change("category", e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
        <label className={s.checkbox}><input type="checkbox" checked={form.is_government_stock} onChange={e => change("is_government_stock", e.target.checked)} />Government stock</label>
        <label className={s.checkbox}><input type="checkbox" checked={form.is_active} onChange={e => change("is_active", e.target.checked)} />Active</label>
      </div>
      <div className={s.formActions}><button className={s.primary} type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save Medication"}</button><button className={s.button} type="button" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button></div>
    </section>}
    <section className={s.panel}>
      <h2>Medication Records</h2>
      <div className={s.filters}>
        <div className={s.field}><label htmlFor="med-search">Search medications</label><input id="med-search" className={s.input} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, generic name or ICN" /></div>
        <div className={s.field}><label htmlFor="med-category-filter">Category</label><select id="med-category-filter" className={s.select} value={category} onChange={e => setCategory(e.target.value)}><option value="All">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className={s.field}><label htmlFor="med-status">Status</label><select id="med-status" className={s.select} value={status} onChange={e => setStatus(e.target.value)}><option value="All">All statuses</option><option>Active</option><option>Inactive</option></select></div>
      </div>
      <p className={s.count}>{busy ? "Loading…" : `Showing ${filtered.length} of ${medications.length} medication records`}</p>
      <div className={s.tableWrap}><table className={s.table}><thead><tr><th>ICN</th><th>Medication</th><th>Generic</th><th>Category</th><th>Strength</th><th>Stock unit</th><th>Government</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {filtered.map(m => <tr key={m.id}><td>{m.icn_code || "—"}</td><td><strong>{m.medication_name}</strong></td><td>{m.generic_name || "—"}</td><td>{m.category}</td><td>{m.strength || "—"}</td><td>{m.stock_unit}</td><td>{m.is_government_stock ? "Yes" : "No"}</td><td><span className={`${s.pill} ${m.is_active ? "" : s.inactive}`}>{m.is_active ? "Active" : "Inactive"}</span></td><td><div className={s.rowActions}><button className={s.textButton} type="button" onClick={() => startEdit(m)}>Edit</button><button className={s.textButton} type="button" disabled={busy} onClick={() => void toggle(m)}>{m.is_active ? "Deactivate" : "Activate"}</button></div></td></tr>)}
        {!busy && filtered.length === 0 && <tr><td className={s.empty} colSpan={9}>No matching medications found.</td></tr>}
      </tbody></table></div>
    </section>
  </DoseTrackWorkspace>;
}
