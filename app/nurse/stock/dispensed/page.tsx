"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Clinic = { id: string; site_name: string };
type Administration = {
  id: string; patient_id: string; site_id: string;
  catalogue_item_id: string | null; medication_name: string | null;
  batch_number: string | null; expiry_date: string | null;
  administered_at: string; administered_by: string | null;
  visit_id: string | null;
};
type Movement = {
  id: string; facility_id: string; product_id: string;
  batch_id: string | null; movement_type: string;
  quantity: number; reference: string | null; created_at: string;
};
type Product = { id: string; name: string; unit: string | null };
type Catalogue = { id: string; medication_name: string; icn_code: string | null };
type StockProduct = { id: string; name: string; icn_number: string | null };
type Balance = { facility_id: string; product_id: string; quantity_on_hand: number };
type Period = "daily" | "weekly" | "monthly";

function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function periodRange(period: Period, selected: string) {
  const [y, m, d] = selected.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  if (period === "weekly") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === "monthly") {
    start.setDate(1);
  }
  const end = new Date(start);
  if (period === "daily") end.setDate(end.getDate() + 1);
  if (period === "weekly") end.setDate(end.getDate() + 7);
  if (period === "monthly") end.setMonth(end.getMonth() + 1);
  return { from: localDay(start), toExclusive: localDay(end) };
}
function readableDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}
function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
function csvEscape(value: unknown) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}
function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function DispensedPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [period, setPeriod] = useState<Period>("monthly");
  const [selectedDate, setSelectedDate] = useState(() => localDay(new Date()));
  const [medicationFilter, setMedicationFilter] = useState("");
  const [administrations, setAdministrations] = useState<Administration[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [catalogue, setCatalogue] = useState<Catalogue[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockProducts, setStockProducts] = useState<StockProduct[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [selectedMedication, setSelectedMedication] = useState<string | null>(null);
  const range = useMemo(() => periodRange(period, selectedDate), [period, selectedDate]);

  const loadClinics = useCallback(async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error("Please sign in to view stock usage reports.");
    const { data: assignments, error: assignmentError } = await supabase
      .from("nurse_site_assignments").select("site_id").eq("nurse_id", auth.user.id);
    if (assignmentError) throw assignmentError;
    const ids = Array.from(new Set((assignments ?? []).map((a) => String(a.site_id))));
    if (!ids.length) return [] as Clinic[];
    const { data: sites, error: sitesError } = await supabase
      .from("sites").select("id,site_name").in("id", ids)
      .eq("is_active", true).order("site_name");
    if (sitesError) throw sitesError;
    return (sites ?? []).map((s) => ({ id: String(s.id), site_name: String(s.site_name) }));
  }, []);

  const loadReport = useCallback(async (allowed: Clinic[]) => {
    if (!allowed.length) {
      setAdministrations([]); setMovements([]); setBalances([]);
      return;
    }
    const ids = allowed.map((c) => c.id);
    // Date filters are applied server-side, avoiding an unrestricted clinical-data download.
    const [a, m, c, p, sp, b] = await Promise.all([
      supabase.from("medication_administrations")
        .select("id,patient_id,site_id,catalogue_item_id,medication_name,batch_number,expiry_date,administered_at,administered_by,visit_id")
        .in("site_id", ids).gte("administered_at", `${range.from}T00:00:00`)
        .lt("administered_at", `${range.toExclusive}T00:00:00`)
        .order("administered_at", { ascending: false }).limit(10000),
      supabase.from("fp_stock_batch_movements")
        .select("id,facility_id,product_id,batch_id,movement_type,quantity,reference,created_at")
        .in("facility_id", ids).gte("created_at", `${range.from}T00:00:00`)
        .lt("created_at", `${range.toExclusive}T00:00:00`)
        .order("created_at", { ascending: false }).limit(10000),
      supabase.from("fp_medication_catalogue").select("id,medication_name,icn_code"),
      supabase.from("fp_stock_products").select("id,name,unit"),
      supabase.from("fp_stock_products").select("id,name,icn_number"),
      supabase.from("fp_stock_balances").select("facility_id,product_id,quantity_on_hand").in("facility_id", ids),
    ]);
    for (const result of [a, m, c, p, sp, b]) {
      if (result.error) throw result.error;
    }
    setAdministrations((a.data ?? []) as unknown as Administration[]);
    setMovements((m.data ?? []) as unknown as Movement[]);
    setCatalogue((c.data ?? []) as unknown as Catalogue[]);
    setProducts((p.data ?? []) as unknown as Product[]);
    setStockProducts((sp.data ?? []) as unknown as StockProduct[]);
    setBalances((b.data ?? []) as unknown as Balance[]);
    setWarning(
      (a.data?.length === 10000 || m.data?.length === 10000)
        ? "The report reached the 10,000-row limit. Narrow the period or clinic before exporting."
        : ""
    );
  }, [range.from, range.toExclusive]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true); setError("");
      try {
        const assigned = await loadClinics();
        if (cancelled) return;
        setClinics(assigned);
        setClinicId((previous) => assigned.some((c) => c.id === previous)
          ? previous : assigned.length === 1 ? assigned[0].id : "");
      } catch (e) { if (!cancelled) setError(message(e)); }
      finally { if (!cancelled) setLoading(false); }
    }
    void init();
    return () => { cancelled = true; };
  }, [loadClinics]);

  useEffect(() => {
    if (loading || error || !clinics.length) return;
    let cancelled = false;
    async function run() {
      setRefreshing(true); setError("");
      try { await loadReport(clinics); }
      catch (e) { if (!cancelled) setError(message(e)); }
      finally { if (!cancelled) setRefreshing(false); }
    }
    void run();
    return () => { cancelled = true; };
  }, [clinics, loading, loadReport]);

  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c.site_name])), [clinics]);
  const catalogueMap = useMemo(() => new Map(catalogue.map((c) => [c.id, c])), [catalogue]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const icnMap = useMemo(() => new Map(stockProducts.filter((p) => p.icn_number).map((p) => [String(p.icn_number).trim(), p.id])), [stockProducts]);
  const administrationProduct = useCallback((a: Administration) => {
    const item = a.catalogue_item_id ? catalogueMap.get(a.catalogue_item_id) : undefined;
    return item?.icn_code ? icnMap.get(String(item.icn_code).trim()) ?? null : null;
  }, [catalogueMap, icnMap]);
  const medicationName = useCallback((a: Administration) => {
    return a.medication_name || (a.catalogue_item_id ? catalogueMap.get(a.catalogue_item_id)?.medication_name : undefined) || "Unspecified medication";
  }, [catalogueMap]);
  const filteredAdministrations = useMemo(() => administrations.filter((a) =>
    (!clinicId || a.site_id === clinicId) &&
    (!medicationFilter || administrationProduct(a) === medicationFilter)
  ), [administrations, clinicId, medicationFilter, administrationProduct]);
  const filteredMovements = useMemo(() => movements.filter((m) =>
    (!clinicId || m.facility_id === clinicId) &&
    (!medicationFilter || m.product_id === medicationFilter)
  ), [movements, clinicId, medicationFilter]);
  const filteredBalances = useMemo(() => balances.filter((b) =>
    (!clinicId || b.facility_id === clinicId) &&
    (!medicationFilter || b.product_id === medicationFilter)
  ), [balances, clinicId, medicationFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; administrations: number; patients: Set<string>; units: number; productId: string | null }>();
    for (const a of filteredAdministrations) {
      const productId = administrationProduct(a);
      const name = medicationName(a);
      const key = productId ?? `clinical:${a.catalogue_item_id ?? name}`;
      const row = map.get(key) ?? { name, administrations: 0, patients: new Set<string>(), units: 0, productId };
      row.administrations += 1;
      row.patients.add(a.patient_id);
      map.set(key, row);
    }
    for (const m of filteredMovements) {
      const key = m.product_id;
      const row = map.get(key) ?? { name: productMap.get(key)?.name ?? "Unknown stock product", administrations: 0, patients: new Set<string>(), units: 0, productId: key };
      if (["dispensed", "issued", "administered"].includes(m.movement_type.toLowerCase())) row.units += Number(m.quantity || 0);
      map.set(key, row);
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredAdministrations, filteredMovements, administrationProduct, medicationName, productMap]);
  const patientCount = useMemo(() => new Set(filteredAdministrations.map((a) => a.patient_id)).size, [filteredAdministrations]);
  const unitsUsed = useMemo(() => filteredMovements.filter((m) => ["dispensed", "issued", "administered"].includes(m.movement_type.toLowerCase())).reduce((n, m) => n + Number(m.quantity || 0), 0), [filteredMovements]);
  const onHand = useMemo(() => filteredBalances.reduce((n, b) => n + Number(b.quantity_on_hand || 0), 0), [filteredBalances]);
  const drilldown = useMemo(() => filteredAdministrations.filter((a) => {
    if (!selectedMedication) return false;
    const id = administrationProduct(a);
    return (id ?? `clinical:${a.catalogue_item_id ?? medicationName(a)}`) === selectedMedication;
  }), [filteredAdministrations, selectedMedication, administrationProduct, medicationName]);

  function exportSummary() {
    downloadCsv(`dosetrack-stock-usage-${range.from}-${period}.csv`, [
      ["Clinic", "Period start", "Period end (exclusive)", "Medication", "Administrations", "Patients", "Stock units recorded as used"],
      ...grouped.map((r) => [clinicId ? clinicMap.get(clinicId) : "All assigned clinics", range.from, range.toExclusive, r.name, r.administrations, r.patients.size, r.units]),
    ]);
  }
  function exportPatients() {
    downloadCsv(`dosetrack-administrations-${range.from}.csv`, [
      ["Clinic", "Patient ID", "Medication", "Date of service", "Batch", "Expiry", "Healthcare worker ID", "Visit ID", "Administration ID"],
      ...drilldown.map((a) => [clinicMap.get(a.site_id), a.patient_id, medicationName(a), a.administered_at, a.batch_number, a.expiry_date, a.administered_by, a.visit_id, a.id]),
    ]);
  }

  return (
    <main className="usage-page">
      <div className="usage-wrap">
        <header className="usage-header">
          <div><div className="eyebrow">DOSETRACK / STOCK MANAGEMENT</div><h1>Stock Usage Reports</h1><p>Daily, weekly and monthly clinical medication usage by clinic. Reporting only — no stock is deducted on this page.</p></div>
          <div className="usage-actions"><button onClick={() => window.print()} className="btn secondary">Print</button><Link href="/nurse/dashboard" className="btn secondary">Back to Dashboard</Link></div>
        </header>
        {error && <div role="alert" className="alert error">{error}</div>}
        {warning && <div role="status" className="alert warning">{warning}</div>}
        {loading ? <section className="panel">Loading assigned clinics...</section> : <>
          <section className="panel">
            <div className="panel-head"><h2>Report Filters</h2><button className="btn secondary" disabled={refreshing} onClick={() => void loadReport(clinics).catch((e) => setError(message(e)))}>{refreshing ? "Refreshing..." : "Refresh Report"}</button></div>
            <div className="filters">
              <label>Reporting period<select value={period} onChange={(e) => { setPeriod(e.target.value as Period); setSelectedMedication(null); }}><option value="daily">Daily</option><option value="weekly">Weekly (Monday–Sunday)</option><option value="monthly">Monthly</option></select></label>
              <label>Reference date<input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedMedication(null); }} /></label>
              <label>Clinic<select value={clinicId} onChange={(e) => { setClinicId(e.target.value); setSelectedMedication(null); }}><option value="">All assigned clinics</option>{clinics.map((c) => <option key={c.id} value={c.id}>{c.site_name}</option>)}</select></label>
              <label>Medication<select value={medicationFilter} onChange={(e) => { setMedicationFilter(e.target.value); setSelectedMedication(null); }}><option value="">All medications</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ""}</option>)}</select></label>
            </div>
            <p className="small">Reporting window: {range.from} to {range.toExclusive} (end exclusive). Clinic access is restricted to your assignments.</p>
          </section>
          <div className="metrics">
            <div className="metric"><span>Administrations</span><strong>{filteredAdministrations.length}</strong></div>
            <div className="metric"><span>Patients served</span><strong>{patientCount}</strong></div>
            <div className="metric"><span>Recorded stock units used</span><strong>{unitsUsed}</strong></div>
            <div className="metric"><span>Current stock on hand</span><strong>{onHand}</strong></div>
          </div>
          <section className="panel">
            <div className="panel-head"><div><h2>Medication Usage Summary</h2><p>Choose a medication to drill down to patient and date of service.</p></div><button className="btn primary" onClick={exportSummary} disabled={!grouped.length}>Export CSV</button></div>
            <div className="table-scroll"><table><thead><tr><th>Medication</th><th>Administrations</th><th>Patients</th><th>Recorded units used</th><th></th></tr></thead><tbody>
              {grouped.length ? grouped.map((r) => <tr key={r.key}><td>{r.name}</td><td>{r.administrations}</td><td>{r.patients.size}</td><td>{r.units}</td><td><button className="link-button" onClick={() => setSelectedMedication(r.key)}>View patients</button></td></tr>) : <tr><td colSpan={5}>No usage records for the selected period.</td></tr>}
            </tbody></table></div>
            <p className="small">Administration counts come from clinical records. Stock units used come only from batch movements marked dispensed, issued or administered. They are not interchangeable.</p>
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>Patient-level Drill-down</h2><p>{selectedMedication ? `Showing ${drilldown.length} clinical administration records` : "Select View patients above to see the underlying clinical records."}</p></div><button className="btn secondary" disabled={!selectedMedication || !drilldown.length} onClick={exportPatients}>Export Patient CSV</button></div>
            {selectedMedication && <div className="table-scroll"><table><thead><tr><th>Date of service</th><th>Clinic</th><th>Patient reference</th><th>Medication</th><th>Batch</th><th>Expiry</th><th>Clinical record</th></tr></thead><tbody>
              {drilldown.length ? drilldown.map((a) => <tr key={a.id}><td>{readableDate(a.administered_at)}</td><td>{clinicMap.get(a.site_id) ?? "—"}</td><td>{a.patient_id}</td><td>{medicationName(a)}</td><td>{a.batch_number ?? "—"}</td><td>{a.expiry_date ?? "—"}</td><td><Link href={`/nurse/patients/${encodeURIComponent(a.patient_id)}`}>View patient</Link></td></tr>) : <tr><td colSpan={7}>No linked clinical administrations found. Stock movement records may not yet be linked to patient administrations.</td></tr>}
            </tbody></table></div>}
          </section>
          <section className="panel notice"><h2>Inventory reconciliation note</h2><p>Stock usage reports do not record dispensing. Clinical administrations must be linked to stock deductions through a secure, atomic database operation. Until that connection is implemented, recorded stock usage may be lower than the number of administrations. Stock on hand reflects current balances, not a historical period-end balance.</p></section>
        </>}
      </div>
      <style jsx global>{`
        .usage-page{min-height:100vh;background:#f4f8fa;color:#17333b;font-family:Arial,sans-serif;padding:28px 18px}
        .usage-wrap{max-width:1200px;margin:0 auto}.usage-header,.panel-head,.usage-actions{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .usage-header{margin-bottom:24px}.usage-header h1{font-size:30px;margin:8px 0}.usage-header p,.panel-head p,.small{color:#5b7079;line-height:1.5}
        .eyebrow{color:#0f766e;font-weight:800;font-size:11px;letter-spacing:1.3px}.panel{background:white;border:1px solid #e1e8ed;border-radius:14px;padding:24px;margin-bottom:20px}
        .panel h2{margin:0 0 8px;font-size:19px}.filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:16px}
        .filters label{display:flex;flex-direction:column;gap:8px;font-weight:700;font-size:13px}.filters select,.filters input{width:100%;box-sizing:border-box;border:1px solid #d8e2e8;border-radius:8px;padding:11px;background:white;color:#17333b;font:inherit}
        .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:9px;padding:11px 16px;text-decoration:none;font-size:13px;font-weight:700;cursor:pointer;border:1px solid #d8e2e8}.btn.primary{background:#0f766e;border-color:#0f766e;color:white}.btn.secondary{background:white;color:#35505a}.btn:disabled{opacity:.5;cursor:not-allowed}
        .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}.metric{background:#eaf6f4;border:1px solid #d3e9e5;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px}.metric span{font-size:13px;color:#4d6c71}.metric strong{font-size:30px;color:#0f766e}
        .table-scroll{overflow-x:auto;margin-top:16px}table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}th,td{padding:13px;border-bottom:1px solid #e1e8ed;white-space:nowrap}th{background:#f4f8fa;color:#35505a}td a,.link-button{color:#0f766e;font-weight:700}.link-button{border:0;background:none;text-decoration:underline;cursor:pointer;padding:0}
        .alert{padding:14px;border-radius:9px;margin-bottom:16px}.alert.error{background:#fff0f0;color:#a02727}.alert.warning{background:#fff8e5;color:#805a00}.notice{border-left:4px solid #0f766e}.small{font-size:12px}
        @media(max-width:900px){.filters,.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.filters,.metrics{grid-template-columns:1fr}.usage-page{padding:16px 12px}.panel{padding:17px}}
        @media print{.usage-actions,.btn,.filters,.link-button{display:none!important}.usage-page{padding:0;background:white}.panel{break-inside:avoid}}
      `}</style>
    </main>
  );
}
