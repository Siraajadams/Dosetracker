"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import "../admin-dashboard.css";
const PAGE = "assign";
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

  if (loading) return <main className="p-6">Loading Family Planning clinic assignments...</main>;
  return (
    <main className="dt-admin"><aside className="dt-sidebar"><div className="dt-brand">Dose<span>Track</span></div><div className="dt-brand-sub">FAMILY PLANNING</div><div className="dt-nav-label">WORKSPACE</div><nav className="dt-nav"><Link href="/family-planning/dashboard"><span>◫</span><span className="dt-nav-text">Overview</span></Link><Link href="/admin/clinics" className={PAGE === "clinics" ? "dt-current" : ""}><span>▦</span><span className="dt-nav-text">Manage Clinics</span></Link><Link href="/admin/nurses"><span>♙</span><span className="dt-nav-text">Nurse Administration</span></Link><Link href="/admin/assign-clinic" className={PAGE === "assign" ? "dt-current" : ""}><span>⇄</span><span className="dt-nav-text">Clinic Assignments</span></Link><Link href="/admin/staff-approvals"><span>✓</span><span className="dt-nav-text">Staff Approvals</span></Link></nav><div className="dt-sidebar-footer">SECURE ADMINISTRATION<br/>DoseTrack • Family Planning</div></aside><div className="dt-main"><div className="dt-content space-y-6">
        <div className="dt-topline"><span className="dt-breadcrumb">Administration / Nurse administration / Clinic assignments</span><Link href="/family-planning/dashboard">← Back to dashboard</Link></div>
        <header className="dt-hero"><div><div className="dt-eyebrow">WORKFORCE MANAGEMENT</div><h1>Clinic Assignments</h1><p>Control which facilities approved nurses can access across your network.</p></div><div className="dt-hero-icon">⇄</div></header>
        <div className="dt-metrics"><div className="dt-metric"><div className="dt-metric-label">Approved nurses</div><div className="dt-metric-value">{nurses.length}</div><div className="dt-metric-foot">Eligible for clinic assignment</div></div><div className="dt-metric"><div className="dt-metric-label">Available clinics</div><div className="dt-metric-value">{facilities.length}</div><div className="dt-metric-foot">In your facility network</div></div><div className="dt-metric"><div className="dt-metric-label">Selected assignments</div><div className="dt-metric-value">{selected.length}</div><div className="dt-metric-foot">{saved.length} currently saved for this nurse</div></div></div>
        {error && <p role="alert" className="rounded-lg bg-red-100 p-4 text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-teal-100 p-4 text-teal-900">{notice}</p>}
        {authorized && <>
          <section className="dt-panel">
            <div className="dt-form-heading">Select an approved nurse</div><p className="dt-form-caption mb-4">Choose a nurse to review or change facility access.</p><label htmlFor="nurse" className="mb-2 block font-semibold">Nurse profile</label>
            <select id="nurse" value={nurseId}
              onChange={e => { setNurseId(e.target.value); setNotice(""); }}
              disabled={saving || loadingAssignments}
              className="w-full rounded-lg border p-3">
              <option value="">Select an approved nurse</option>
              {nurses.map(n => <option key={n.id} value={n.id}>
                {n.full_name || "Unnamed nurse"}{n.email ? ` (${n.email})` : ""}
              </option>)}
            </select>
            {nurses.length === 0 && <p className="mt-3 text-amber-700">No approved active nurses found.</p>}
          </section>
          {nurseId && <section className="dt-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Assign facilities</h2>
              <span className="text-sm text-slate-600">{facilities.length} facilities available</span>
            </div>
            <label htmlFor="clinic-search" className="mt-4 block text-sm font-medium">Search clinics</label>
            <input id="clinic-search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Clinic name, MHFL, CFS or Demander"
              className="mt-1 w-full rounded-lg border p-3" />
            {loadingAssignments ? <p className="mt-4">Loading existing assignments...</p> : <>
              <div className="mt-4 max-h-[440px] space-y-2 overflow-y-auto">
                {filtered.map(f => <label key={f.id}
                  className="dt-choice flex cursor-pointer gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={selected.includes(f.id)}
                    disabled={saving || loadingAssignments}
                    onChange={() => setSelected(previous => previous.includes(f.id)
                      ? previous.filter(id => id !== f.id) : [...previous, f.id])} />
                  <span><strong>{f.name}</strong><span className="block text-sm text-slate-600">
                    {f.mhfl_number ? `MHFL: ${f.mhfl_number}  ` : ""}
                    {f.cfs_number ? `CFS: ${f.cfs_number}  ` : ""}
                    {f.demander_number ? `Demander: ${f.demander_number}` : ""}
                  </span></span>
                </label>)}
                {filtered.length === 0 && <p className="text-slate-600">No matching clinics.</p>}
              </div>
              <p className="mt-4 font-semibold">Selected: {selected.length} | Saved: {saved.length}</p>
              <button type="button" onClick={() => void saveAssignments()}
                disabled={saving || loadingAssignments || facilities.length === 0}
                className="dt-primary mt-4 disabled:opacity-50">
                {saving ? "Saving..." : "Save Clinic Assignments"}
              </button>
            </>}
          </section>}
          <div className="dt-bottom-actions">
            <button type="button" onClick={() => router.push("/admin/staff-approvals")}
              className="dt-secondary">Staff Approvals</button>
            <button type="button" onClick={() => void loadPage()} disabled={saving}
              className="dt-secondary disabled:opacity-50">Refresh</button>
          </div>
        </>}
      </div></div>
    </main>
  );
}

export default function AssignClinicPage() {
  return <Suspense fallback={<main className="p-6">Loading clinic assignments...</main>}>
    <AssignClinicContent />
  </Suspense>;
}
