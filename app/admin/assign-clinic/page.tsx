"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setAuthorized(false);
    setError("");
    setNotice("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/family-planning/login");
        return;
      }
      const { data: isAdmin, error: adminError } = await supabase.rpc("dt_is_super_admin");
      if (adminError) throw adminError;
      if (isAdmin !== true) throw new Error("Super Admin access required.");

      const [staffResult, facilityResult] = await Promise.all([
        supabase.from("staff_profiles")
          .select("id,full_name,email")
          .eq("role", "nurse")
          .eq("approval_status", "approved")
          .eq("is_active", true)
          .order("full_name"),
        supabase.from("fp_facilities")
          .select("id,name,mhfl_number,cfs_number,demander_number")
          .order("name"),
      ]);
      if (staffResult.error) throw staffResult.error;
      if (facilityResult.error) throw facilityResult.error;
      const staff = (staffResult.data ?? []) as Nurse[];
      setNurses(staff);
      setFacilities((facilityResult.data ?? []) as Facility[]);
      setNurseId(previous => {
        if (requestedStaffId && staff.some(n => n.id === requestedStaffId)) return requestedStaffId;
        if (previous && staff.some(n => n.id === previous)) return previous;
        return staff.length === 1 ? staff[0].id : "";
      });
      setAuthorized(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load clinic assignments.");
    } finally {
      setLoading(false);
    }
  }, [router, requestedStaffId]);

  useEffect(() => { void loadPage(); }, [loadPage]);

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
    async function load() {
      const { data, error: membershipError } = await supabase
        .from("fp_memberships")
        .select("facility_id,user_id,role,active")
        .eq("user_id", nurseId)
        .eq("role", NURSE_ROLE);
      if (cancelled) return;
      if (membershipError) {
        setError(membershipError.message);
      } else {
        const ids = ((data ?? []) as Membership[])
          .filter(m => m.active)
          .map(m => m.facility_id);
        setSaved(ids);
        setSelected(ids);
      }
      setLoadingAssignments(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [authorized, nurseId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return facilities.filter(f =>
      !q || [f.name, f.mhfl_number, f.cfs_number, f.demander_number]
        .some(v => (v ?? "").toLowerCase().includes(q))
    );
  }, [facilities, search]);

  async function saveAssignments() {
    if (!authorized || !nurseId || saving || loadingAssignments) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const { data: isAdmin, error: adminError } = await supabase.rpc("dt_is_super_admin");
      if (adminError || isAdmin !== true) throw new Error("Super Admin access required.");

      const { data: staff, error: staffError } = await supabase
        .from("staff_profiles").select("id")
        .eq("id", nurseId).eq("role", "nurse")
        .eq("approval_status", "approved").eq("is_active", true)
        .maybeSingle();
      if (staffError) throw staffError;
      if (!staff) throw new Error("Nurse is not approved and active.");

      // Check selected facility IDs exist. fp_facilities has no is_active column.
      if (selected.length) {
        const { data: valid, error: validError } = await supabase
          .from("fp_facilities").select("id").in("id", selected);
        if (validError) throw validError;
        if ((valid ?? []).length !== selected.length) {
          throw new Error("One or more clinics no longer exist. Refresh the page.");
        }
      }

      const { data: existing, error: existingError } = await supabase
        .from("fp_memberships")
        .select("facility_id,user_id,role,active")
        .eq("user_id", nurseId).eq("role", NURSE_ROLE);
      if (existingError) throw existingError;
      const rows = (existing ?? []) as Membership[];
      const existingIds = new Set(rows.map(m => m.facility_id));
      const wantedIds = new Set(selected);
      const activate = rows.filter(m => wantedIds.has(m.facility_id) && !m.active);
      const deactivate = rows.filter(m => !wantedIds.has(m.facility_id) && m.active);
      const create = selected.filter(id => !existingIds.has(id));

      // Uses separate requests: if one fails, reload and reconcile before retrying.
      for (const m of activate) {
        const { error: updateError } = await supabase.from("fp_memberships")
          .update({ active: true })
          .eq("user_id", nurseId).eq("facility_id", m.facility_id).eq("role", NURSE_ROLE);
        if (updateError) throw updateError;
      }
      for (const facilityId of create) {
        const { error: insertError } = await supabase.from("fp_memberships")
          .insert({ user_id: nurseId, facility_id: facilityId, role: NURSE_ROLE, active: true });
        if (insertError) throw insertError;
      }
      for (const m of deactivate) {
        const { error: updateError } = await supabase.from("fp_memberships")
          .update({ active: false })
          .eq("user_id", nurseId).eq("facility_id", m.facility_id).eq("role", NURSE_ROLE);
        if (updateError) throw updateError;
      }
      const { data: refreshed, error: refreshError } = await supabase
        .from("fp_memberships").select("facility_id,active")
        .eq("user_id", nurseId).eq("role", NURSE_ROLE);
      if (refreshError) throw refreshError;
      const ids = (refreshed ?? []).filter(m => m.active).map(m => m.facility_id);
      setSaved(ids);
      setSelected(ids);
      setNotice(`Saved ${ids.length} active clinic assignment(s).`);
    } catch (e) {
      setError((e instanceof Error ? e.message : "Unable to save assignments.") +
        " If changes were partially saved, refresh before trying again.");
    } finally {
      setSaving(false);
    }
  }

  const nurse = nurses.find(n => n.id === nurseId);
  const changed = [...selected].sort().join("|") !== [...saved].sort().join("|");
  const added = selected.filter(id => !saved.includes(id)).length;
  const removed = saved.filter(id => !selected.includes(id)).length;

  if (loading) return (
    <main className="min-h-screen bg-[#f6f8fa] p-8 text-slate-600">
      <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">Loading nurse assignments…</div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f6f8fa] px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <nav className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-800 text-xl font-bold text-white">D</div>
            <div><p className="font-bold tracking-tight text-slate-900">DoseTrack</p><p className="text-xs text-slate-500">Family Planning Administration</p></div>
          </div>
          <button type="button" onClick={() => router.push("/admin/nurses")} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50">← Nurse Administration</button>
        </nav>

        <header className="border-b border-slate-200 pb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700"><span className="h-2 w-2 rounded-full bg-teal-600"/> Staff access management</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Assign nurses to clinics</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Control which facilities each approved nurse can access. Select a nurse, review their existing assignments, then save any changes.</p>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900">{notice}</div>}

        {authorized && <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Approved nurses</p><p className="mt-2 text-3xl font-bold text-slate-900">{nurses.length}</p><p className="mt-1 text-xs text-slate-500">Eligible for assignment</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available clinics</p><p className="mt-2 text-3xl font-bold text-slate-900">{facilities.length}</p><p className="mt-1 text-xs text-slate-500">In facility directory</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current selection</p><p className="mt-2 text-3xl font-bold text-teal-800">{nurseId ? selected.length : "—"}</p><p className="mt-1 text-xs text-slate-500">Clinics assigned to selected nurse</p></div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-sm font-bold text-teal-800">01</span><div><h2 className="text-lg font-bold">Select a nurse</h2><p className="text-sm text-slate-500">Only approved and active nurses are listed</p></div></div>
                <label htmlFor="nurse" className="mb-2 block text-sm font-semibold text-slate-700">Registered nurse</label>
                <select id="nurse" value={nurseId} onChange={e => { setNurseId(e.target.value); setNotice(""); }} disabled={saving || loadingAssignments} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:opacity-60">
                  <option value="">Choose an approved nurse…</option>
                  {nurses.map(n => <option key={n.id} value={n.id}>{n.full_name || "Unnamed nurse"}{n.email ? ` — ${n.email}` : ""}</option>)}
                </select>
                {nurses.length === 0 && <p className="mt-3 text-sm text-amber-700">No approved active nurses found. Review registrations under Staff Approvals.</p>}
                {nurse && <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800">{(nurse.full_name || "N").slice(0,1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{nurse.full_name || "Unnamed nurse"}</p><p className="truncate text-xs text-slate-500">{nurse.email || "No email on profile"}</p></div><span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Approved</span></div>}
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-sm font-bold text-teal-800">02</span><div><h2 className="text-lg font-bold">Facility access</h2><p className="text-sm text-slate-500">Tick the clinics this nurse may access</p></div></div>
                  <label htmlFor="clinic-search" className="mt-6 mb-2 block text-sm font-semibold text-slate-700">Find a facility</label>
                  <div className="relative"><span className="pointer-events-none absolute left-4 top-3 text-slate-400">⌕</span><input id="clinic-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clinic, MHFL, CFS or Demander number" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"/></div>
                </div>
                {!nurseId ? <div className="px-6 py-16 text-center text-sm text-slate-500">Select a nurse above to view and edit their clinic assignments.</div> : loadingAssignments ? <div className="px-6 py-14 text-center text-sm text-slate-500">Loading existing clinic assignments…</div> : <div className="max-h-[490px] overflow-y-auto divide-y divide-slate-100">
                  {filtered.map(f => <label key={f.id} className={`flex cursor-pointer items-start gap-4 px-6 py-4 transition-colors hover:bg-slate-50 ${selected.includes(f.id) ? "bg-teal-50/50" : ""}`}>
                    <input type="checkbox" checked={selected.includes(f.id)} disabled={saving || loadingAssignments} onChange={() => setSelected(previous => previous.includes(f.id) ? previous.filter(id => id !== f.id) : [...previous, f.id])} className="mt-1 h-4 w-4 shrink-0 accent-teal-700"/>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{f.name}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{[f.mhfl_number && `MHFL ${f.mhfl_number}`, f.cfs_number && `CFS ${f.cfs_number}`, f.demander_number && `Demander ${f.demander_number}`].filter(Boolean).join("  ·  ") || "No facility identifiers recorded"}</span></span>
                    {selected.includes(f.id) && <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">Selected</span>}
                  </label>)}
                  {filtered.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No matching clinics found.</div>}
                </div>}
              </section>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-base font-bold">Assignment summary</h2><p className="mt-1 text-xs text-slate-500">Changes for the selected nurse</p>
                <div className="mt-5 space-y-3 border-y border-slate-100 py-4 text-sm"><div className="flex justify-between"><span className="text-slate-600">Currently saved</span><strong>{nurseId ? saved.length : "—"}</strong></div><div className="flex justify-between"><span className="text-slate-600">Selected clinics</span><strong>{nurseId ? selected.length : "—"}</strong></div><div className="flex justify-between"><span className="text-slate-600">New assignments</span><strong className="text-teal-700">+{added}</strong></div><div className="flex justify-between"><span className="text-slate-600">Access removals</span><strong className="text-rose-700">−{removed}</strong></div></div>
                <button type="button" onClick={() => void saveAssignments()} disabled={!nurseId || !changed || saving || loadingAssignments || facilities.length === 0} className="mt-5 w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300">{saving ? "Saving changes…" : "Save assignments"}</button>
                <p className="mt-3 text-xs leading-5 text-slate-500">Saving activates selected clinic memberships and deactivates removed memberships. Historical records remain unchanged.</p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-bold">Quick navigation</h3><div className="mt-4 space-y-2"><button type="button" onClick={() => router.push("/admin/staff-approvals")} className="block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">Nurse registrations & approvals →</button><button type="button" onClick={() => router.push("/family-planning/dashboard")} className="block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">Family Planning dashboard →</button><button type="button" onClick={() => void loadPage()} disabled={saving} className="block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Refresh data ↻</button></div></section>
            </aside>
          </div>
        </>}
      </div>
    </main>
  );
}

export default function AssignClinicPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f8fa] p-8">Loading clinic assignments…</main>}><AssignClinicContent /></Suspense>;
}
