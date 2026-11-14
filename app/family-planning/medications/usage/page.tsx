
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

type GroupBy =
  | "month"
  | "year"
  | "province"
  | "city"
  | "pharmacy"
  | "contraceptive";

type StatusFilter =
  | "all"
  | "reporting"
  | "no-activity";

type GroupedRow = {
  label: string;
  unit: string;
  events: number;
  quantity: number;
};

const groupOptions: {
  value: GroupBy;
  label: string;
}[] = [
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "province", label: "Province" },
  { value: "city", label: "City" },
  { value: "pharmacy", label: "Healthcare Facility" },
  { value: "contraceptive", label: "Contraceptive" },
];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function normalizeRow(
  input: Record<string, unknown>
): UsageRow {
  return {
    site_id: String(input.site_id ?? ""),
    pharmacy: String(
      input.pharmacy ?? "Unnamed Healthcare Facility"
    ),
    province: String(
      input.province ?? "Unassigned"
    ),
    city: String(input.city ?? "Unassigned"),
    period_month: input.period_month
      ? String(input.period_month)
      : null,
    contraceptive: input.contraceptive
      ? String(input.contraceptive)
      : null,
    administration_events:
      Number(input.administration_events) || 0,
    quantity_used:
      Number(input.quantity_used) || 0,
    unit: String(
      input.unit ?? "administration events"
    ),
    has_recorded_usage:
      input.has_recorded_usage === true,
  };
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(raw)
    ? "'" + raw
    : raw;

  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCSV(
  filename: string,
  headers: string[],
  data: unknown[][]
) {
  const lines = [
    headers.map(csvCell).join(","),
    ...data.map((row) =>
      row.map(csvCell).join(",")
    ),
  ];

  const blob = new Blob(
    [lines.join("\r\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(
    () => URL.revokeObjectURL(url),
    1000
  );
}

export default function ContraceptiveUsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] =
    useState("");

  const [year, setYear] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [medication, setMedication] = useState("");
  const [groupBy, setGroupBy] =
    useState<GroupBy>("month");
  const [status, setStatus] =
    useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      if (!auth.user) {
        throw new Error(
          "Please sign in to view this report."
        );
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError) {
        throw new Error(adminError.message);
      }

      if (isAdmin !== true) {
        throw new Error(
          "Super Administrator access required."
        );
      }

      const { data, error: reportError } =
        await supabase.rpc(
          "fp_facility_contraceptive_analytics"
        );

      if (reportError) {
        throw new Error(reportError.message);
      }

      if (!Array.isArray(data)) {
        throw new Error(
          "Unexpected reporting data format."
        );
      }

      setRows(
        data.map((item) =>
          normalizeRow(
            item as Record<string, unknown>
          )
        )
      );

      setLastUpdated(
        new Date().toLocaleString()
      );
    } catch (err: unknown) {
      setRows([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const years = useMemo(
    () =>
      unique(
        rows
          .map((r) =>
            r.period_month?.slice(0, 4) ?? ""
          )
          .filter(Boolean)
      ),
    [rows]
  );

  const provinces = useMemo(
    () => unique(rows.map((r) => r.province)),
    [rows]
  );

  const cities = useMemo(
    () =>
      unique(
        rows
          .filter(
            (r) =>
              !province ||
              r.province === province
          )
          .map((r) => r.city)
      ),
    [rows, province]
  );

  const pharmacies = useMemo(
    () =>
      unique(
        rows
          .filter(
            (r) =>
              (!province ||
                r.province === province) &&
              (!city || r.city === city)
          )
          .map((r) => r.pharmacy)
      ),
    [rows, province, city]
  );

  const medications = useMemo(
    () =>
      unique(
        rows.map(
          (r) => r.contraceptive ?? ""
        )
      ),
    [rows]
  );

  // Facility/location filters apply to all rows.
  const locationRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!province ||
            r.province === province) &&
          (!city || r.city === city) &&
          (!pharmacy ||
            r.pharmacy === pharmacy) &&
          (!search ||
            r.pharmacy
              .toLowerCase()
              .includes(search.toLowerCase()))
      ),
    [
      rows,
      province,
      city,
      pharmacy,
      search,
    ]
  );

  // Year and medication filters apply to usage.
  const usageRows = useMemo(
    () =>
      locationRows.filter(
        (r) =>
          r.administration_events > 0 &&
          (!year ||
            r.period_month?.slice(0, 4) ===
              year) &&
          (!medication ||
            r.contraceptive === medication)
      ),
    [locationRows, year, medication]
  );

  // Count facilities once, even when they have
  // multiple medication/month records.
  const facilityMap = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        province: string;
        city: string;
        events: number;
        products: Set<string>;
      }
    >();

    for (const row of locationRows) {
      if (!row.site_id) continue;

      if (!map.has(row.site_id)) {
        map.set(row.site_id, {
          id: row.site_id,
          name: row.pharmacy,
          province: row.province,
          city: row.city,
          events: 0,
          products: new Set<string>(),
        });
      }
    }

    for (const row of usageRows) {
      const facility = map.get(row.site_id);

      if (!facility) continue;

      facility.events +=
        row.administration_events;

      if (row.contraceptive) {
        facility.products.add(
          row.contraceptive
        );
      }
    }

    return map;
  }, [locationRows, usageRows]);

  const facilities = useMemo(() => {
    return [...facilityMap.values()]
      .filter((f) => {
        if (status === "reporting") {
          return f.events > 0;
        }

        if (status === "no-activity") {
          return f.events === 0;
        }

        return true;
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [facilityMap, status]);

  const totals = useMemo(() => {
    const all = [...facilityMap.values()];

    const reporting = all.filter(
      (f) => f.events > 0
    ).length;

    return {
      facilities: all.length,
      reporting,
      noActivity: all.length - reporting,
      events: usageRows.reduce(
        (sum, r) =>
          sum + r.administration_events,
        0
      ),
      provinces: unique(
        usageRows
          .filter(
            (r) =>
              r.province !== "Unassigned"
          )
          .map((r) => r.province)
      ).length,
      products: unique(
        usageRows.map(
          (r) => r.contraceptive ?? ""
        )
      ).length,
    };
  }, [facilityMap, usageRows]);

  const grouped = useMemo(() => {
    const map = new Map<string, GroupedRow>();

    for (const row of usageRows) {
      let label = "";

      switch (groupBy) {
        case "month":
          label = row.period_month ?? "";
          break;
        case "year":
          label =
            row.period_month?.slice(0, 4) ?? "";
          break;
        case "province":
          label = row.province;
          break;
        case "city":
          label = row.city;
          break;
        case "pharmacy":
          label = row.pharmacy;
          break;
        case "contraceptive":
          label = row.contraceptive ?? "";
          break;
      }

      label = label || "Unspecified";

      const key = `${label}::${row.unit}`;

      const item = map.get(key) ?? {
        label,
        unit: row.unit,
        events: 0,
        quantity: 0,
      };

      item.events +=
        row.administration_events;
      item.quantity += row.quantity_used;

      map.set(key, item);
    }

    return [...map.values()].sort(
      (a, b) =>
        groupBy === "month" ||
        groupBy === "year"
          ? a.label.localeCompare(b.label)
          : b.events - a.events
    );
  }, [usageRows, groupBy]);

  const visibleUsageRows = useMemo(() => {
    if (status === "no-activity") return [];

    return usageRows.filter(
      (r) =>
        status !== "reporting" ||
        (facilityMap.get(r.site_id)?.events ??
          0) > 0
    );
  }, [usageRows, status, facilityMap]);

  function exportSummary() {
    downloadCSV(
      `contraceptive-usage-${groupBy}-${
        year || "all-years"
      }.csv`,
      [
        "Group",
        "Unit",
        "Administration Events",
        "Quantity (Event-Based Proxy)",
      ],
      grouped.map((r) => [
        r.label,
        r.unit,
        r.events,
        r.quantity,
      ])
    );
  }

  function exportFacilities() {
    downloadCSV(
      "family-planning-facility-coverage.csv",
      [
        "Facility ID",
        "Healthcare Facility",
        "Province",
        "City",
        "Administration Events",
        "Contraceptive Products",
        "Reporting Status",
      ],
      facilities.map((f) => [
        f.id,
        f.name,
        f.province,
        f.city,
        f.events,
        [...f.products].join("; "),
        f.events > 0
          ? "Reporting"
          : "No recorded activity",
      ])
    );
  }

  function exportDetailed() {
    downloadCSV(
      "family-planning-detailed-usage.csv",
      [
        "Facility ID",
        "Healthcare Facility",
        "Province",
        "City",
        "Month",
        "Contraceptive",
        "Administration Events",
        "Quantity (Event-Based Proxy)",
        "Unit",
      ],
      visibleUsageRows.map((r) => [
        r.site_id,
        r.pharmacy,
        r.province,
        r.city,
        r.period_month,
        r.contraceptive,
        r.administration_events,
        r.quantity_used,
        r.unit,
      ])
    );
  }

  return (
    <main className="usage-page">
      <header className="usage-header">
        <div>
          <div className="eyebrow">
            DOSETRACK / FAMILY PLANNING
          </div>

          <h1>
            Contraceptive Usage Analytics
          </h1>

          <p>
            National contraceptive utilisation,
            facility coverage and reporting.
          </p>

          {lastUpdated && (
            <p className="updated">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>

        <div className="actions">
          <Link href="/admin/medications">
  Medication Catalogue
</Link>

          <button
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            onClick={exportSummary}
            disabled={loading || !grouped.length}
          >
            Export Summary
          </button>

          <button
            onClick={exportDetailed}
            disabled={
              loading || !visibleUsageRows.length
            }
          >
            Export Detailed Usage
          </button>

          <button
            className="primary"
            onClick={exportFacilities}
            disabled={loading || !facilities.length}
          >
            Export Facilities
          </button>
        </div>
      </header>

      {error && (
        <section className="error" role="alert">
          <strong>Unable to load analytics</strong>
          <p>{error}</p>
          <button onClick={() => void load()}>
            Try Again
          </button>
        </section>
      )}

      <section className="filters">
        <label>
          Year
          <select
            value={year}
            onChange={(e) =>
              setYear(e.target.value)
            }
          >
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label>
          Province
          <select
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              setCity("");
              setPharmacy("");
            }}
          >
            <option value="">
              All Provinces
            </option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label>
          City
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPharmacy("");
            }}
          >
            <option value="">All Cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label>
          Healthcare Facility
          <select
            value={pharmacy}
            onChange={(e) =>
              setPharmacy(e.target.value)
            }
          >
            <option value="">
              All Facilities
            </option>
            {pharmacies.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label>
          Contraceptive
          <select
            value={medication}
            onChange={(e) =>
              setMedication(e.target.value)
            }
          >
            <option value="">
              All Contraceptives
            </option>
            {medications.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label>
          Group Report By
          <select
            value={groupBy}
            onChange={(e) =>
              setGroupBy(
                e.target.value as GroupBy
              )
            }
          >
            {groupOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Facility Reporting Status
          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as StatusFilter
              )
            }
          >
            <option value="all">
              All Facilities
            </option>
            <option value="reporting">
              Reporting Facilities
            </option>
            <option value="no-activity">
              No Recorded Activity
            </option>
          </select>
        </label>

        <label>
          Search Facility
          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search pharmacy or clinic"
          />
        </label>
      </section>

      <section className="stats">
        <div className="stat">
          <span>Registered Active Facilities</span>
          <strong>{totals.facilities}</strong>
        </div>

        <div className="stat">
          <span>Reporting Facilities</span>
          <strong>{totals.reporting}</strong>
        </div>

        <div className="stat">
          <span>No Recorded Activity</span>
          <strong>{totals.noActivity}</strong>
        </div>

        <div className="stat">
          <span>Administration Events</span>
          <strong>
            {totals.events.toLocaleString()}
          </strong>
        </div>

        <div className="stat">
          <span>Reporting Provinces</span>
          <strong>{totals.provinces}</strong>
        </div>

        <div className="stat">
          <span>Contraceptives Used</span>
          <strong>{totals.products}</strong>
        </div>
      </section>

      <section className="report">
        <div className="report-heading">
          <div>
            <h2>Facility Coverage</h2>
            <p>
              All registered active facilities,
              including those with zero recorded
              administrations.
            </p>
          </div>
          <span>
            {facilities.length} facilities
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>HEALTHCARE FACILITY</th>
                <th>PROVINCE</th>
                <th>CITY</th>
                <th>EVENTS</th>
                <th>PRODUCTS</th>
                <th>STATUS</th>
              </tr>
            </thead>

            <tbody>
              {facilities.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.name}</strong>
                  </td>
                  <td>{f.province}</td>
                  <td>{f.city}</td>
                  <td>
                    {f.events.toLocaleString()}
                  </td>
                  <td>{f.products.size}</td>
                  <td>
                    <span
                      className={
                        f.events > 0
                          ? "status reporting"
                          : "status no-activity"
                      }
                    >
                      {f.events > 0
                        ? "Reporting"
                        : "No recorded activity"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && !facilities.length && (
            <div className="empty">
              No facilities match the filters.
            </div>
          )}
        </div>
      </section>

      <section className="report">
        <div className="report-heading">
          <h2>
            Usage by{" "}
            {
              groupOptions.find(
                (g) => g.value === groupBy
              )?.label
            }
          </h2>
          <span>{grouped.length} rows</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>GROUP</th>
                <th>UNIT</th>
                <th>ADMINISTRATION EVENTS</th>
                <th>EVENT-BASED QUANTITY</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((r) => (
                <tr
                  key={`${r.label}-${r.unit}`}
                >
                  <td>
                    <strong>{r.label}</strong>
                  </td>
                  <td>{r.unit}</td>
                  <td>
                    {r.events.toLocaleString()}
                  </td>
                  <td>
                    {r.quantity.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && !grouped.length && (
            <div className="empty">
              No contraceptive administrations
              match the selected filters.
            </div>
          )}
        </div>
      </section>

      <section className="report">
        <div className="report-heading">
          <h2>Detailed Contraceptive Usage</h2>
          <span>
            {visibleUsageRows.length} rows
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MONTH</th>
                <th>FACILITY</th>
                <th>PROVINCE</th>
                <th>CITY</th>
                <th>CONTRACEPTIVE</th>
                <th>EVENTS</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsageRows.map(
                (r, index) => (
                  <tr
                    key={`${r.site_id}-${r.period_month}-${r.contraceptive}-${index}`}
                  >
                    <td>{r.period_month}</td>
                    <td>{r.pharmacy}</td>
                    <td>{r.province}</td>
                    <td>{r.city}</td>
                    <td>{r.contraceptive}</td>
                    <td>
                      {r.administration_events}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          {!loading &&
            !visibleUsageRows.length && (
              <div className="empty">
                No detailed usage records for
                these filters.
              </div>
            )}
        </div>
      </section>

      <p className="footnote">
        Reporting is based on recorded
        contraceptive administrations. A facility
        with no recorded activity may still be
        delivering services. Quantity is currently
        an administration-event proxy, not
        verified stock consumption. Province and
        city reflect available facility master data.
      </p>

      <style jsx>{`
        .usage-page {
          min-height: 100vh;
          background: #f4f7fb;
          color: #172b4d;
          padding: 32px;
          font-family: Arial, sans-serif;
        }

        .usage-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 26px;
        }

        .eyebrow {
          color: #0d9488;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        h1 {
          font-size: 28px;
          margin: 12px 0;
        }

        h2 {
          font-size: 18px;
          margin: 0;
        }

        p {
          color: #64748b;
          font-size: 13px;
          line-height: 1.6;
        }

        .updated {
          font-size: 11px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        button,
        .actions a {
          border: 1px solid #dbe4ee;
          border-radius: 8px;
          background: white;
          color: #334155;
          padding: 11px 14px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .actions .primary {
          background: #0f766e;
          border-color: #0f766e;
          color: white;
        }

        .filters {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 16px;
          background: white;
          padding: 22px;
          border: 1px solid #e5eaf1;
          border-radius: 12px;
          margin-bottom: 24px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
        }

        select,
        input {
          width: 100%;
          min-width: 0;
          padding: 12px;
          border: 1px solid #dbe4ee;
          border-radius: 8px;
          background: white;
          color: #172b4d;
          font: inherit;
        }

        .stats {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat {
          background: white;
          border: 1px solid #e5eaf1;
          border-radius: 12px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .stat span {
          color: #64748b;
          font-size: 12px;
        }

        .stat strong {
          color: #0f766e;
          font-size: 30px;
        }

        .report {
          background: white;
          border: 1px solid #e5eaf1;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .report-heading {
          padding: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .report-heading span {
          color: #64748b;
          font-size: 12px;
          white-space: nowrap;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 750px;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          padding: 15px;
          text-align: left;
        }

        td {
          padding: 16px;
          border-top: 1px solid #edf1f5;
          font-size: 12px;
        }

        .status {
          display: inline-block;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 700;
        }

        .reporting {
          color: #047857;
          background: #d1fae5;
        }

        .no-activity {
          color: #92400e;
          background: #fef3c7;
        }

        .empty {
          padding: 35px;
          text-align: center;
          color: #64748b;
        }

        .error {
          padding: 18px;
          margin-bottom: 20px;
          border-radius: 8px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .error p {
          color: #b91c1c;
        }

        .footnote {
          margin-top: 12px;
          font-size: 12px;
        }

        @media (max-width: 1000px) {
          .filters {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .stats {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 550px) {
          .usage-page {
            padding: 16px;
          }

          .filters,
          .stats {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 23px;
          }
        }
      `}</style>
    </main>
  );
}
