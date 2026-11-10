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

  const complete = facilities.filter(f => f.mhfl_number && f.cfs_number && f.demander_number).length;
  const missing = facilities.length - complete;
  const inputClass = "mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

  if (loading) return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-center text-slate-600" role="status">
      Loading clinic directory…
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-lg font-bold text-white">D</div>
            <div><p className="font-bold tracking-tight text-slate-900">DoseTrack</p><p className="text-xs text-slate-500">Family Planning · Administration</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/family-planning/dashboard" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Dashboard</Link>
            <Link href="/admin/assign-clinic" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Nurse Assignments</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Facility master data</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Manage Clinics</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Maintain clinic identifiers and contact details across your Family Planning network.</p>
          </div>
          {authorized && <button type="button" onClick={create} disabled={saving} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50">+ Add Clinic</button>}
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-900">{notice}</div>}

        {authorized && <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total clinics", value: facilities.length, note: "Registered facilities" },
              { label: "Complete identifiers", value: complete, note: "MHFL, CFS & Demander recorded" },
              { label: "Needs attention", value: missing, note: "One or more identifiers missing" },
            ].map(stat => <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{stat.label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p><p className="mt-2 text-xs text-slate-500">{stat.note}</p>
            </div>)}
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-5 py-5 md:px-6">
              <div><h2 className="text-lg font-bold text-slate-900">Clinic directory</h2><p className="mt-1 text-sm text-slate-500">{filtered.length} of {facilities.length} clinics shown</p></div>
              <button type="button" onClick={() => void load()} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Refresh list</button>
            </div>
            <div className="px-5 py-5 md:px-6">
              <label htmlFor="clinic-search" className="block text-sm font-semibold text-slate-700">Search facilities</label>
              <div className="relative mt-2"><span aria-hidden="true" className="pointer-events-none absolute left-4 top-3 text-slate-400">⌕</span>
                <input id="clinic-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by clinic, MHFL, CFS, Demander or contact…" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr>
                  <th className="px-6 py-4 font-semibold">Clinic</th><th className="px-5 py-4 font-semibold">MHFL</th><th className="px-5 py-4 font-semibold">CFS</th><th className="px-5 py-4 font-semibold">Demander</th><th className="px-5 py-4 font-semibold">Contact</th><th className="px-5 py-4 font-semibold">Details</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(f => <tr key={f.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4"><div className="font-semibold text-slate-900">{f.name}</div><div className="mt-1 text-xs text-slate-400">Facility record</div></td>
                    <td className="px-5 py-4 text-slate-600">{f.mhfl_number || "—"}</td>
                    <td className="px-5 py-4 text-slate-600">{f.cfs_number || "—"}</td>
                    <td className="px-5 py-4 text-slate-600">{f.demander_number || "—"}</td>
                    <td className="px-5 py-4 text-slate-600"><div>{f.email || "—"}</div><div className="mt-1 text-xs">{f.phone || ""}</div></td>
                    <td className="px-5 py-4"><button type="button" onClick={() => edit(f)} disabled={saving} className="rounded-lg border border-teal-200 px-3 py-2 font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50">Edit clinic</button></td>
                  </tr>)}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="px-6 py-12 text-center text-sm text-slate-500">No matching clinics found. Try another search.</p>}
            </div>
          </section>

          {editingId && <section id="clinic-editor" className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
              <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Facility details</p><h2 className="mt-2 text-2xl font-bold">{editingId === "new" ? "Add new clinic" : "Edit clinic"}</h2><p className="mt-2 text-sm text-slate-500">Changes preserve the facility ID and existing nurse assignments.</p></div>
              <button type="button" onClick={() => setEditingId(null)} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Close</button>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {fields.map(field => <label key={field.key} className="block text-sm font-semibold text-slate-700">
                {field.label}{field.key === "name" && <span className="text-red-600"> *</span>}
                <input type={field.type || "text"} value={draft[field.key] ?? ""} onChange={e => setDraft(previous => ({ ...previous, [field.key]: e.target.value }))} disabled={saving} className={inputClass} />
              </label>)}
            </div>
            <div className="mt-7 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
              <button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{saving ? "Saving…" : editingId === "new" ? "Create clinic" : "Save changes"}</button>
              <button type="button" onClick={() => setEditingId(null)} disabled={saving} className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            </div>
          </section>}
        </>}
      </div>
    </main>
  );
}
