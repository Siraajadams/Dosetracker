"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type UsageRow = {
  site_id: string;
  pharmacy: string;
  province: string;
  city: string;
  period_month: string | null;
  contraceptive: string | null;
  administration_events: number;
  quantity_used: number;
  unit: string;
  has_recorded_usage: boolean;
};
type GroupBy = "month" | "year" | "province" | "city" | "pharmacy" | "contraceptive";
type StatusFilter = "all" | "reporting" | "no-activity";
type Tab = "overview" | "facilities" | "contraceptives" | "details";
type GroupedRow = { label: string; unit: string; events: number; quantity: number };
type Facility = { id: string; name: string; province: string; city: string; events: number; products: Set<string> };
const groupOptions: { value: GroupBy; label: string }[] = [
  { value: "month", label: "Month" }, { value: "year", label: "Year" },
  { value: "province", label: "Province" }, { value: "city", label: "City" },
  { value: "pharmacy", label: "Healthcare Facility" }, { value: "contraceptive", label: "Contraceptive" },
];
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const number = (n: number) => n.toLocaleString("en-ZA");
function normalizeRow(input: Record<string, unknown>): UsageRow {
  return {
    site_id: String(input.site_id ?? ""),
    pharmacy: String(input.pharmacy ?? "Unnamed Healthcare Facility"),
    province: String(input.province ?? "Unassigned"),
    city: String(input.city ?? "Unassigned"),
    period_month: input.period_month ? String(input.period_month).slice(0, 7) : null,
    contraceptive: input.contraceptive ? String(input.contraceptive) : null,
    administration_events: Number(input.administration_events) || 0,
    quantity_used: Number(input.quantity_used) || 0,
    unit: String(input.unit ?? "administration events"),
    has_recorded_usage: input.has_recorded_usage === true,
  };
}
function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
function downloadCSV(filename: string, headers: string[], data: unknown[][]) {
  const lines = [headers.map(csvCell).join(","), ...data.map((r) => r.map(csvCell).join(","))];
  const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ChartBars({ data, empty }: { data: { label: string; value: number }[]; empty?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <div className="empty">{empty ?? "No recorded administrations for these filters."}</div>;
  return <div className="bar-list">{data.map((d) => <div className="bar-row" key={d.label}>
    <span className="bar-label" title={d.label}>{d.label}</span>
    <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(d.value > 0 ? 1 : 0, (d.value / max) * 100)}%` }} /></div>
    <strong className="bar-number">{number(d.value)}</strong>
  </div>)}</div>;
}
export default function ContraceptiveUsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [year, setYear] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [medication, setMedication] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      if (!auth.user) throw new Error("Please sign in to view this report.");
      const { data: isAdmin, error: adminError } = await supabase.rpc("dt_is_super_admin");
      if (adminError) throw new Error(adminError.message);
      if (isAdmin !== true) throw new Error("Super Administrator access required.");
      const { data, error: reportError } = await supabase.rpc("fp_facility_contraceptive_analytics");
      if (reportError) throw new Error(reportError.message);
      if (!Array.isArray(data)) throw new Error("Unexpected reporting data format.");
      setRows(data.map((item) => normalizeRow(item as Record<string, unknown>)));
      setLastUpdated(new Date().toLocaleString("en-ZA"));
    } catch (err: unknown) {
      setRows([]); setError(err instanceof Error ? err.message : "Unable to load analytics.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [year, province, city, pharmacy, medication, status, search, groupBy, tab]);
  const years = useMemo(() => unique(rows.map((r) => r.period_month?.slice(0, 4) ?? "")), [rows]);
  const provinces = useMemo(() => unique(rows.map((r) => r.province)), [rows]);
  const cities = useMemo(() => unique(rows.filter((r) => !province || r.province === province).map((r) => r.city)), [rows, province]);
  const pharmacies = useMemo(() => unique(rows.filter((r) => (!province || r.province === province) && (!city || r.city === city)).map((r) => r.pharmacy)), [rows, province, city]);
  const medications = useMemo(() => unique(rows.map((r) => r.contraceptive ?? "")), [rows]);
  const locationRows = useMemo(() => rows.filter((r) =>
    (!province || r.province === province) && (!city || r.city === city) &&
    (!pharmacy || r.pharmacy === pharmacy) &&
    (!search || r.pharmacy.toLowerCase().includes(search.trim().toLowerCase()))
  ), [rows, province, city, pharmacy, search]);
  const usageRows = useMemo(() => locationRows.filter((r) =>
    r.administration_events > 0 && (!year || r.period_month?.slice(0, 4) === year) &&
    (!medication || r.contraceptive === medication)
  ), [locationRows, year, medication]);
  const facilityMap = useMemo(() => {
    const map = new Map<string, Facility>();
    for (const r of locationRows) {
      if (!r.site_id) continue;
      if (!map.has(r.site_id)) map.set(r.site_id, { id: r.site_id, name: r.pharmacy, province: r.province, city: r.city, events: 0, products: new Set() });
    }
    for (const r of usageRows) {
      const f = map.get(r.site_id);
      if (!f) continue;
      f.events += r.administration_events;
      if (r.contraceptive) f.products.add(r.contraceptive);
    }
    return map;
  }, [locationRows, usageRows]);
  const allFacilities = useMemo(() => [...facilityMap.values()], [facilityMap]);
  const facilities = useMemo(() => allFacilities.filter((f) =>
    status === "all" || (status === "reporting" ? f.events > 0 : f.events === 0)
  ).sort((a, b) => a.name.localeCompare(b.name)), [allFacilities, status]);
  const visibleUsageRows = useMemo(() => status === "no-activity" ? [] : usageRows.filter((r) => status !== "reporting" || (facilityMap.get(r.site_id)?.events ?? 0) > 0), [usageRows, status, facilityMap]);
  const totals = useMemo(() => ({
    facilities: allFacilities.length,
    reporting: allFacilities.filter((f) => f.events > 0).length,
    noActivity: allFacilities.filter((f) => f.events === 0).length,
    events: usageRows.reduce((s, r) => s + r.administration_events, 0),
    provinces: unique(usageRows.filter((r) => r.province !== "Unassigned").map((r) => r.province)).length,
    products: unique(usageRows.map((r) => r.contraceptive ?? "")).length,
  }), [allFacilities, usageRows]);
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedRow>();
    for (const r of usageRows) {
      const label = ({ month: r.period_month, year: r.period_month?.slice(0, 4), province: r.province, city: r.city, pharmacy: r.pharmacy, contraceptive: r.contraceptive }[groupBy]) || "Unspecified";
      const key = `${label}::${r.unit}`;
      const g = map.get(key) ?? { label, unit: r.unit, events: 0, quantity: 0 };
      g.events += r.administration_events; g.quantity += r.quantity_used; map.set(key, g);
    }
    return [...map.values()].sort((a, b) => groupBy === "month" || groupBy === "year" ? a.label.localeCompare(b.label) : b.events - a.events);
  }, [usageRows, groupBy]);
  const monthChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of usageRows) if (r.period_month) map.set(r.period_month, (map.get(r.period_month) ?? 0) + r.administration_events);
    return [...map].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
  }, [usageRows]);
  const medicationChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of usageRows) if (r.contraceptive) map.set(r.contraceptive, (map.get(r.contraceptive) ?? 0) + r.administration_events);
    return [...map].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
  }, [usageRows]);
  const topFacilities = useMemo(() => [...allFacilities].filter((f) => f.events > 0).sort((a, b) => b.events - a.events).slice(0, 10).map((f) => ({ label: f.name, value: f.events })), [allFacilities]);
  const exportSummary = () => downloadCSV(`contraceptive-usage-${groupBy}-${year || "all-years"}.csv`, ["Group", "Unit", "Administration Events", "Quantity (Event-Based Proxy)"], grouped.map((r) => [r.label, r.unit, r.events, r.quantity]));
  const exportFacilities = () => downloadCSV("family-planning-facility-coverage.csv", ["Facility ID", "Healthcare Facility", "Province", "City", "Administration Events", "Contraceptive Products", "Reporting Status"], facilities.map((f) => [f.id, f.name, f.province, f.city, f.events, [...f.products].join("; "), f.events > 0 ? "Reporting" : "No recorded activity"]));
  const exportDetailed = () => downloadCSV("family-planning-detailed-usage.csv", ["Facility ID", "Healthcare Facility", "Province", "City", "Month", "Contraceptive", "Administration Events", "Quantity (Event-Based Proxy)", "Unit"], visibleUsageRows.map((r) => [r.site_id, r.pharmacy, r.province, r.city, r.period_month, r.contraceptive, r.administration_events, r.quantity_used, r.unit]));
  const resetFilters = () => { setYear(""); setProvince(""); setCity(""); setPharmacy(""); setMedication(""); setStatus("all"); setSearch(""); setGroupBy("month"); };
  const pagination = (count: number) => {
    const pages = Math.max(1, Math.ceil(count / pageSize));
    return <div className="pagination"><span>{count === 0 ? "0 results" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${count}`}</span><div><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button></div></div>;
  };
  return <main className="analytics">
    <div className="shell">
      <header className="hero"><div><div className="eyebrow">DOSETRACK / FAMILY PLANNING</div><h1>Reporting &amp; Analytics</h1><p>National contraceptive programme monitoring and facility performance</p><span className="updated">{lastUpdated ? `Data refreshed: ${lastUpdated}` : "Live reporting data"}</span></div><div className="header-actions"><Link href="/family-planning/dashboard">← Dashboard</Link><Link href="/admin/medications">Medication Catalogue</Link><button onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "↻ Refresh data"}</button></div></header>
      {error && <section className="alert" role="alert"><strong>Unable to load analytics</strong><p>{error}</p><button onClick={() => void load()}>Try again</button></section>}
      <section className="filter-panel"><div className="section-top"><div><h2>Report filters</h2><p>Refine your reporting view across locations, dates and contraceptives.</p></div><button className="text-button" onClick={resetFilters}>Clear filters</button></div>
        <div className="filter-grid">
          <label>Year<select value={year} onChange={(e) => setYear(e.target.value)}><option value="">All years</option>{years.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>Province<select value={province} onChange={(e) => { setProvince(e.target.value); setCity(""); setPharmacy(""); }}><option value="">All provinces</option>{provinces.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>City<select value={city} onChange={(e) => { setCity(e.target.value); setPharmacy(""); }}><option value="">All cities</option>{cities.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>Healthcare facility<select value={pharmacy} onChange={(e) => setPharmacy(e.target.value)}><option value="">All facilities</option>{pharmacies.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>Contraceptive<select value={medication} onChange={(e) => setMedication(e.target.value)}><option value="">All contraceptives</option>{medications.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>Reporting status<select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}><option value="all">All facilities</option><option value="reporting">Reporting facilities</option><option value="no-activity">No recorded activity</option></select></label>
          <label>Group summary by<select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>{groupOptions.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
          <label>Find facility<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pharmacy or clinic" /></label>
        </div>
      </section>
      <section className="kpis" aria-label="Reporting metrics">{[
        { label: "Registered facilities", value: totals.facilities, note: "Within selected locations" },
        { label: "Reporting facilities", value: totals.reporting, note: "With recorded administrations" },
        { label: "No recorded activity", value: totals.noActivity, note: "Within selected period" },
        { label: "Administration events", value: totals.events, note: "Recorded contraceptive events" },
        { label: "Reporting provinces", value: totals.provinces, note: "With recorded activity" },
        { label: "Contraceptives used", value: totals.products, note: "Distinct recorded products" },
      ].map((k) => <article className="kpi" key={k.label}><span>{k.label}</span><strong>{loading ? "…" : number(k.value)}</strong><small>{k.note}</small></article>)}</section>
      <nav className="tabs" aria-label="Report sections">{([
        ["overview", "National overview"], ["facilities", "Facility performance"],
        ["contraceptives", "Contraceptive usage"], ["details", "Detailed records"],
      ] as [Tab, string][]).map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}>{label}</button>)}</nav>
      {tab === "overview" && <><div className="charts"><section className="panel"><div className="section-top"><div><h2>Monthly administrations</h2><p>Recorded administration events over time</p></div></div><ChartBars data={monthChart} /></section><section className="panel"><div className="section-top"><div><h2>Contraceptive utilisation</h2><p>Top products by administration events</p></div></div><ChartBars data={medicationChart} /></section></div><section className="panel"><div className="section-top"><div><h2>Top reporting facilities</h2><p>Facilities with the most recorded administrations</p></div><button onClick={() => setTab("facilities")}>View all facilities</button></div><ChartBars data={topFacilities} /></section></>}
      {tab === "facilities" && <section className="panel"><div className="section-top"><div><h2>Facility coverage &amp; performance</h2><p>Registered facilities, including facilities without recorded administrations</p></div><button className="primary" disabled={loading || !facilities.length} onClick={exportFacilities}>↓ Export facilities CSV</button></div><div className="table-scroll"><table><thead><tr><th>Healthcare facility</th><th>Province</th><th>City</th><th className="num">Events</th><th className="num">Products</th><th>Status</th></tr></thead><tbody>{facilities.slice((page - 1) * pageSize, page * pageSize).map((f) => <tr key={f.id}><td className="name">{f.name}</td><td>{f.province}</td><td>{f.city}</td><td className="num">{number(f.events)}</td><td className="num">{f.products.size}</td><td><span className={`status ${f.events > 0 ? "positive" : "neutral"}`}>{f.events > 0 ? "Reporting" : "No recorded activity"}</span></td></tr>)}</tbody></table>{!loading && !facilities.length && <div className="empty">No facilities match the selected filters.</div>}</div>{pagination(facilities.length)}</section>}
      {tab === "contraceptives" && <section className="panel"><div className="section-top"><div><h2>Usage by {groupOptions.find((g) => g.value === groupBy)?.label}</h2><p>Aggregated administration events and event-based quantities</p></div><button className="primary" disabled={loading || !grouped.length} onClick={exportSummary}>↓ Export summary CSV</button></div><div className="table-scroll"><table><thead><tr><th>Group</th><th>Unit</th><th className="num">Administration events</th><th className="num">Event-based quantity</th></tr></thead><tbody>{grouped.slice((page - 1) * pageSize, page * pageSize).map((r) => <tr key={`${r.label}-${r.unit}`}><td className="name">{r.label}</td><td>{r.unit}</td><td className="num">{number(r.events)}</td><td className="num">{number(r.quantity)}</td></tr>)}</tbody></table>{!loading && !grouped.length && <div className="empty">No contraceptive administrations match the selected filters.</div>}</div>{pagination(grouped.length)}</section>}
      {tab === "details" && <section className="panel"><div className="section-top"><div><h2>Detailed contraceptive usage</h2><p>Monthly records by facility and contraceptive</p></div><button className="primary" disabled={loading || !visibleUsageRows.length} onClick={exportDetailed}>↓ Export detailed CSV</button></div><div className="table-scroll"><table><thead><tr><th>Month</th><th>Facility</th><th>Province</th><th>City</th><th>Contraceptive</th><th className="num">Events</th><th className="num">Quantity proxy</th></tr></thead><tbody>{visibleUsageRows.slice((page - 1) * pageSize, page * pageSize).map((r, i) => <tr key={`${r.site_id}-${r.period_month}-${r.contraceptive}-${(page - 1) * pageSize + i}`}><td>{r.period_month ?? "—"}</td><td className="name">{r.pharmacy}</td><td>{r.province}</td><td>{r.city}</td><td>{r.contraceptive ?? "—"}</td><td className="num">{number(r.administration_events)}</td><td className="num">{number(r.quantity_used)}</td></tr>)}</tbody></table>{!loading && !visibleUsageRows.length && <div className="empty">No detailed usage records match these filters.</div>}</div>{pagination(visibleUsageRows.length)}</section>}
      <footer className="footnote"><strong>Reporting definitions:</strong> Reporting is based on recorded contraceptive administrations. Facilities with no recorded activity may still deliver services. Quantity is an administration-event proxy, not verified stock consumption. Province and city come from facility master data. Facility coverage is filtered by location; year and contraceptive filters apply to activity totals.</footer>
    </div>
    <style jsx>{`
      .analytics{min-height:100vh;background:#f3f6fa;color:#1b2b45;font-family:Arial,Helvetica,sans-serif;padding:30px 22px}.shell{max-width:1450px;margin:auto}.hero{display:flex;align-items:flex-start;justify-content:space-between;gap:22px;flex-wrap:wrap;margin-bottom:24px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:1.5px;color:#0f766e}.hero h1{font-size:30px;letter-spacing:-.6px;margin:10px 0}.hero p,.section-top p{font-size:13px;color:#64748b;margin:6px 0}.updated{font-size:11px;color:#8290a4;display:block;margin-top:10px}.header-actions{display:flex;gap:8px;flex-wrap:wrap}.header-actions a,.header-actions button,.section-top button,.pagination button{border:1px solid #d9e2ec;background:white;color:#26405a;text-decoration:none;padding:10px 13px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer}.filter-panel,.panel,.kpi{background:white;border:1px solid #e1e7ef;border-radius:13px;box-shadow:0 3px 14px rgba(24,45,70,.025)}.filter-panel{padding:21px;margin-bottom:18px}.section-top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:19px}.section-top h2{font-size:17px;margin:0}.text-button{border:0!important;color:#0f766e!important;padding:8px!important}.filter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}.filter-grid label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:700;color:#53647a}.filter-grid select,.filter-grid input{width:100%;min-width:0;border:1px solid #dce4ed;border-radius:8px;background:#fbfcfe;color:#1b2b45;padding:10px;font-size:12px;min-height:39px}.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:23px}.kpi{padding:19px;display:flex;flex-direction:column;gap:8px}.kpi span{font-size:12px;font-weight:700;color:#64748b}.kpi strong{font-size:30px;color:#0f766e;font-variant-numeric:tabular-nums}.kpi small{font-size:11px;color:#8793a4}.tabs{display:flex;gap:5px;overflow-x:auto;border-bottom:1px solid #dbe3ed;margin-bottom:18px}.tabs button{white-space:nowrap;border:0;border-bottom:3px solid transparent;background:transparent;padding:13px 17px;font-size:12px;color:#64748b;font-weight:700;cursor:pointer}.tabs button.active{color:#0f766e;border-bottom-color:#0f766e}.charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panel{padding:21px;margin-bottom:17px;min-width:0}.bar-list{display:flex;flex-direction:column;gap:13px;padding:8px 0}.bar-row{display:grid;grid-template-columns:minmax(100px,160px) minmax(80px,1fr) 55px;align-items:center;gap:11px}.bar-label{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4c6077}.bar-track{height:13px;background:#edf3f6;border-radius:20px;overflow:hidden}.bar-fill{height:100%;background:linear-gradient(90deg,#0f766e,#2cb9a5);border-radius:20px}.bar-number{text-align:right;font-size:12px;font-variant-numeric:tabular-nums}.primary{background:#0f766e!important;color:white!important;border-color:#0f766e!important}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:760px}th{text-align:left;background:#f7f9fc;color:#65758b;font-size:10px;letter-spacing:.5px;text-transform:uppercase;padding:13px}td{border-top:1px solid #edf1f5;padding:14px 13px;font-size:12px;color:#45566c}td.name{font-weight:700;color:#263b52}.num{text-align:right;font-variant-numeric:tabular-nums}.status{display:inline-block;border-radius:30px;padding:6px 9px;font-size:10px;font-weight:700;white-space:nowrap}.positive{background:#e2f5ed;color:#087b50}.neutral{background:#fff4de;color:#966014}.pagination{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid #edf1f5;padding-top:15px;margin-top:10px;color:#66768a;font-size:12px}.pagination>div{display:flex;gap:10px;align-items:center}.pagination button:disabled,.section-top button:disabled,.header-actions button:disabled{opacity:.45;cursor:not-allowed}.empty{text-align:center;padding:38px 14px;color:#8090a3;font-size:13px}.footnote{color:#718198;font-size:11px;line-height:1.7;margin:16px 0 30px}.alert{border:1px solid #f2b9b9;background:#fff1f1;color:#a12626;padding:17px;border-radius:9px;margin-bottom:20px}.alert p{font-size:13px}.alert button{padding:8px 12px;border-radius:6px;background:white;border:1px solid #f2b9b9;cursor:pointer}@media(max-width:1050px){.filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:750px){.analytics{padding:17px 12px}.hero h1{font-size:25px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.charts{grid-template-columns:1fr}.bar-row{grid-template-columns:105px minmax(50px,1fr) 45px}.panel,.filter-panel{padding:15px}}@media(max-width:480px){.filter-grid{grid-template-columns:1fr}.kpis{gap:8px}.kpi{padding:13px}.kpi strong{font-size:25px}.tabs button{padding:11px}}
    `}</style>
  </main>;
}
