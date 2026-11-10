"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "../admin-dashboard.css";
const PAGE = "clinics";
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

type FacilityDraft = Pick<Facility, "name" | "mhfl_number" | "cfs_number" | "demander_number" | "email" | "phone">;

const blankDraft: FacilityDraft = {
  name: "", mhfl_number: "", cfs_number: "", demander_number: "", email: "", phone: "",
};

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
  const trimOrNull = (value: string | null) => value?.trim() || null;
  return {
    name: draft.name.trim(),
    mhfl_number: trimOrNull(draft.mhfl_number),
    cfs_number: trimOrNull(draft.cfs_number),
    demander_number: trimOrNull(draft.demander_number),
    email: trimOrNull(draft.email),
    phone: trimOrNull(draft.phone),
  };
}

const fields: { key: keyof FacilityDraft; label: string; type?: string }[] = [
  { key: "name", label: "Clinic name" },
  { key: "mhfl_number", label: "MHFL number" },
  { key: "cfs_number", label: "CFS number" },
  { key: "demander_number", label: "Demander number" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Telephone" },
];

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
  const [draft, setDraft] = useState<FacilityDraft>(blankDraft);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setAuthorized(false);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/family-planning/login");
        return;
      }
      const { data: isAdmin, error: adminError } = await supabase.rpc("dt_is_super_admin");
      if (adminError) throw adminError;
      if (isAdmin !== true) throw new Error("Super Admin access required.");
      setAuthorized(true);
      const { data, error: facilitiesError } = await supabase
        .from("fp_facilities")
        .select("id,name,mhfl_number,cfs_number,demander_number,email,phone")
        .order("name");
      if (facilitiesError) throw facilitiesError;
      setFacilities((data ?? []) as Facility[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load clinics.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return facilities.filter(f =>
      !q || [f.name, f.mhfl_number, f.cfs_number, f.demander_number, f.email, f.phone]
        .some(value => (value ?? "").toLowerCase().includes(q))
    );
  }, [facilities, search]);

  function edit(f: Facility) {
    setEditingId(f.id);
    setDraft(toDraft(f));
    setError("");
    setNotice("");
  }

  function create() {
    setEditingId("new");
    setDraft({ ...blankDraft });
    setError("");
    setNotice("");
  }

  async function save() {
    if (!authorized || !editingId || saving) return;
    const payload = toPayload(draft);
    if (!payload.name) { setError("Clinic name is required."); return; }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const { data: isAdmin, error: adminError } = await supabase.rpc("dt_is_super_admin");
      if (adminError || isAdmin !== true) throw new Error("Super Admin access required.");
      if (editingId === "new") {
        const { error: insertError } = await supabase.from("fp_facilities").insert(payload);
        if (insertError) throw insertError;
        setNotice("Clinic created successfully.");
      } else {
        const { data: updated, error: updateError } = await supabase
          .from("fp_facilities")
          .update(payload)
          .eq("id", editingId)
          .select("id");
        if (updateError) throw updateError;
        if (!updated?.length) throw new Error("Clinic was not updated. Check Super Admin RLS permissions.");
        setNotice("Clinic updated successfully.");
      }
      setEditingId(null);
      const { data, error: reloadError } = await supabase
        .from("fp_facilities")
        .select("id,name,mhfl_number,cfs_number,demander_number,email,phone")
        .order("name");
      if (reloadError) throw reloadError;
      setFacilities((data ?? []) as Facility[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save clinic.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="p-6">Loading Family Planning clinics...</main>;

  return (
    <main className="dt-admin"><aside className="dt-sidebar"><div className="dt-brand">Dose<span>Track</span></div><div className="dt-brand-sub">FAMILY PLANNING</div><div className="dt-nav-label">WORKSPACE</div><nav className="dt-nav"><Link href="/family-planning/dashboard"><span>◫</span><span className="dt-nav-text">Overview</span></Link><Link href="/admin/clinics" className={PAGE === "clinics" ? "dt-current" : ""}><span>▦</span><span className="dt-nav-text">Manage Clinics</span></Link><Link href="/admin/nurses"><span>♙</span><span className="dt-nav-text">Nurse Administration</span></Link><Link href="/admin/assign-clinic" className={PAGE === "assign" ? "dt-current" : ""}><span>⇄</span><span className="dt-nav-text">Clinic Assignments</span></Link><Link href="/admin/staff-approvals"><span>✓</span><span className="dt-nav-text">Staff Approvals</span></Link></nav><div className="dt-sidebar-footer">SECURE ADMINISTRATION<br/>DoseTrack • Family Planning</div></aside><div className="dt-main"><div className="dt-content space-y-6">
        <div className="dt-topline"><span className="dt-breadcrumb">Administration / Facility network</span><Link href="/family-planning/dashboard">← Back to dashboard</Link></div>
        <header className="dt-hero"><div><div className="dt-eyebrow">FACILITY NETWORK</div><h1>Manage Clinics</h1><p>Manage locations, facility identifiers and contact information across your network.</p></div><div className="dt-hero-icon">▦</div></header>
        <div className="dt-metrics"><div className="dt-metric"><div className="dt-metric-label">Total facilities</div><div className="dt-metric-value">{facilities.length}</div><div className="dt-metric-foot">Registered clinic records</div></div><div className="dt-metric"><div className="dt-metric-label">Complete identifiers</div><div className="dt-metric-value">{facilities.filter(f => f.mhfl_number && f.cfs_number && f.demander_number).length}</div><div className="dt-metric-foot">MHFL, CFS and Demander present</div></div><div className="dt-metric"><div className="dt-metric-label">Needs attention</div><div className="dt-metric-value">{facilities.filter(f => !f.mhfl_number || !f.cfs_number || !f.demander_number).length}</div><div className="dt-metric-foot">Missing one or more identifiers</div></div></div>
        {error && <p role="alert" className="rounded-lg bg-red-100 p-4 text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-teal-100 p-4 text-teal-900">{notice}</p>}
        {authorized && <>
          <section className="dt-panel">
            <div className="dt-toolbar">
              <div>
                <h2 className="text-xl font-semibold">Clinic directory</h2>
                <p className="dt-toolbar-sub">Search and maintain facility master records • {facilities.length} clinics in the database</p>
              </div>
              <button type="button" onClick={create} disabled={saving} className="dt-primary disabled:opacity-50">Add Clinic</button>
            </div>
            <label htmlFor="clinic-search" className="mt-5 block text-sm font-medium">Search clinics</label>
            <input id="clinic-search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name, MHFL, CFS, Demander, email or telephone"
              className="mt-1 w-full rounded-lg border p-3" />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-100"><tr>
                  <th className="p-3">Clinic</th><th className="p-3">MHFL</th><th className="p-3">CFS</th>
                  <th className="p-3">Demander</th><th className="p-3">Contact</th><th className="p-3">Action</th>
                </tr></thead>
                <tbody>
                  {filtered.map(f => <tr key={f.id} className="border-t align-top">
                    <td className="p-3 font-medium">{f.name}</td>
                    <td className="p-3">{f.mhfl_number || "—"}</td>
                    <td className="p-3">{f.cfs_number || "—"}</td>
                    <td className="p-3">{f.demander_number || "—"}</td>
                    <td className="p-3">{f.email || "—"}<span className="block">{f.phone || ""}</span></td>
                    <td className="p-3"><button type="button" onClick={() => edit(f)} disabled={saving}
                      className="font-semibold text-teal-700 underline disabled:opacity-50">Edit</button></td>
                  </tr>)}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="p-4 text-slate-600">No matching clinics found.</p>}
            </div>
          </section>
          {editingId && <section className="dt-panel">
            <h2 className="dt-form-heading">{editingId === "new" ? "Add new facility" : "Edit facility details"}</h2>
            <p className="dt-form-caption">Editing does not change the clinic's UUID or existing memberships.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {fields.map(field => <label key={field.key} className="block text-sm font-medium">
                {field.label}{field.key === "name" ? " *" : ""}
                <input type={field.type || "text"} value={draft[field.key] ?? ""}
                  onChange={e => setDraft(previous => ({ ...previous, [field.key]: e.target.value }))}
                  disabled={saving} className="mt-1 w-full rounded-lg border p-3" />
              </label>)}
            </div>
            <div className="dt-bottom-actions">
              <button type="button" onClick={() => void save()} disabled={saving}
                className="dt-primary disabled:opacity-50">{saving ? "Saving..." : "Save Clinic"}</button>
              <button type="button" onClick={() => setEditingId(null)} disabled={saving}
                className="dt-secondary disabled:opacity-50">Cancel</button>
            </div>
          </section>}
          <div className="dt-bottom-actions">
            <button type="button" onClick={() => void load()} disabled={saving}
              className="dt-secondary disabled:opacity-50">Refresh Clinics</button>
            <Link href="/admin/assign-clinic" className="dt-secondary">Assign Nurses to Clinics</Link>
          </div>
        </>}
      </div></div>
    </main>
  );
}
