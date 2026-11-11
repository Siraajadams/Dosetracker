
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
  period_month: string;
  province: string;
  city: string;
  pharmacy: string;
  contraceptive: string;
  administration_events: number;
  quantity_used: number;
  unit: string;
};

type GroupBy =
  | "month"
  | "year"
  | "province"
  | "city"
  | "pharmacy"
  | "contraceptive";

const groupOptions: {
  value: GroupBy;
  label: string;
}[] = [
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "province", label: "Province" },
  { value: "city", label: "City" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "contraceptive", label: "Contraceptive" },
];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text)
    ? "'" + text
    : text;

  return `"${safe.replace(/"/g, '""')}"`;
}

function normalizeRow(
  row: Partial<UsageRow>
): UsageRow {
  return {
    period_month: String(row.period_month ?? ""),
    province: String(row.province ?? ""),
    city: String(row.city ?? ""),
    pharmacy: String(row.pharmacy ?? ""),
    contraceptive: String(row.contraceptive ?? ""),
    administration_events:
      Number(row.administration_events) || 0,
    quantity_used: Number(row.quantity_used) || 0,
    unit: String(row.unit ?? "units"),
  };
}

export default function ContraceptiveUsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  // All Years is selected by default.
  const [year, setYear] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [medication, setMedication] = useState("");
  const [groupBy, setGroupBy] =
    useState<GroupBy>("month");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Check authentication.
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw new Error(
          `Authentication error: ${authError.message}`
        );
      }

      if (!auth.user) {
        throw new Error(
          "Please sign in to view contraceptive usage."
        );
      }

      // 2. Verify super-admin permissions.
      const { data: admin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError) {
        console.error(
          "Super admin verification failed:",
          adminError
        );

        throw new Error(
          `Unable to verify administrator access: ${
            adminError.message
          }`
        );
      }

      if (admin !== true) {
        throw new Error(
          "Only the super administrator can access " +
          "national contraceptive usage reports."
        );
      }

      // 3. Retrieve the reporting data.
      const { data, error: reportError } =
        await supabase.rpc(
          "fp_contraceptive_usage_report"
        );

      if (reportError) {
        console.error(
          "Contraceptive usage report error:",
          reportError
        );

        throw new Error(
          `Unable to load usage report: ${
            reportError.message
          }`
        );
      }

      if (!Array.isArray(data)) {
        throw new Error(
          "The reporting function returned an " +
          "unexpected data format."
        );
      }

      // 4. Normalize the reporting records.
      const normalized = data.map((record) =>
        normalizeRow(record as Partial<UsageRow>)
      );

      setRows(normalized);
      setLastUpdated(new Date().toLocaleString());

      console.info(
        "Contraceptive usage records loaded:",
        normalized.length
      );
    } catch (err: unknown) {
      console.error(
        "Contraceptive analytics load failed:",
        err
      );

      setRows([]);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load contraceptive usage."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Available years.
  const years = useMemo(
    () =>
      unique(
        rows.map((r) =>
          r.period_month.slice(0, 4)
        )
      ),
    [rows]
  );

  // Province options.
  const provinces = useMemo(
    () => unique(rows.map((r) => r.province)),
    [rows]
  );

  // City options depend on province.
  const cities = useMemo(
    () =>
      unique(
        rows
          .filter(
            (r) =>
              !province || r.province === province
          )
          .map((r) => r.city)
      ),
    [rows, province]
  );

  // Pharmacy options depend on location.
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
        rows.map((r) => r.contraceptive)
      ),
    [rows]
  );

  // Apply all report filters.
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!year ||
            r.period_month.slice(0, 4) ===
              year) &&
          (!province ||
            r.province === province) &&
          (!city || r.city === city) &&
          (!pharmacy ||
            r.pharmacy === pharmacy) &&
          (!medication ||
            r.contraceptive === medication)
      ),
    [
      rows,
      year,
      province,
      city,
      pharmacy,
      medication,
    ]
  );

  // Summary statistics.
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.events +=
          Number(row.administration_events) || 0;

        acc.quantity +=
          Number(row.quantity_used) || 0;

        return acc;
      },
      { events: 0, quantity: 0 }
    );
  }, [filtered]);

  const reportingPharmacies = useMemo(
    () =>
      unique(
        filtered.map((r) => r.pharmacy)
      ).length,
    [filtered]
  );

  const reportingProvinces = useMemo(
    () =>
      unique(
        filtered.map((r) => r.province)
      ).length,
    [filtered]
  );

  // Group the filtered data.
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        unit: string;
        events: number;
        quantity: number;
      }
    >();

    for (const row of filtered) {
      let label = "";

      switch (groupBy) {
        case "year":
          label = row.period_month.slice(0, 4);
          break;

        case "month":
          label = row.period_month.slice(0, 7);
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
          label = row.contraceptive;
          break;
      }

      label = label || "Unspecified";

      const unit = row.unit || "units";

      // Keep different measurement units separate.
      const key = `${label}::${unit}`;

      const existing = map.get(key) ?? {
        label,
        unit,
        events: 0,
        quantity: 0,
      };

      existing.events +=
        Number(row.administration_events) || 0;

      existing.quantity +=
        Number(row.quantity_used) || 0;

      map.set(key, existing);
    }

    return [...map.values()].sort((a, b) => {
      if (
        groupBy === "month" ||
        groupBy === "year"
      ) {
        return a.label.localeCompare(b.label);
      }

      return b.events - a.events;
    });
  }, [filtered, groupBy]);

  // CSV export.
  function exportCSV() {
    if (grouped.length === 0) return;

    const header = [
      "Group",
      "Unit",
      "Administration Events",
      "Quantity Used",
    ];

    const lines = [
      header.map(csvCell).join(","),
      ...grouped.map((row) =>
        [
          row.label,
          row.unit,
          row.events,
          row.quantity,
        ]
          .map(csvCell)
          .join(",")
      ),
    ];

    const blob = new Blob(
      [lines.join("\r\n")],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download =
      `contraceptive-usage-${groupBy}-` +
      `${year || "all-years"}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="usage-page">
      <div className="usage-header">
        <div>
          <div className="eyebrow">
            DOSETRACK / FAMILY PLANNING
          </div>

          <h1>Contraceptive Usage Analytics</h1>

          <p>
            Monthly and annual contraceptive usage
            across provinces, cities and pharmacies.
          </p>

          {lastUpdated && (
            <p className="updated">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>

        <div className="actions">
          <Link href="/family-planning/medications">
            Medication Catalogue
          </Link>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            type="button"
            className="primary"
            onClick={exportCSV}
            disabled={
              loading || grouped.length === 0
            }
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          <strong>Unable to load analytics</strong>
          <p>{error}</p>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="notice">
          No usage records were returned by the
          reporting function. Check that
          fp_contraceptive_usage_report includes
          the recorded medication administrations.
        </div>
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
            <option value="">All Provinces</option>

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
          Pharmacy
          <select
            value={pharmacy}
            onChange={(e) =>
              setPharmacy(e.target.value)
            }
          >
            <option value="">
              All Pharmacies
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
      </section>

      <section className="stats">
        <div className="stat">
          <span>Administration Events</span>
          <strong>
            {totals.events.toLocaleString()}
          </strong>
        </div>

        <div className="stat">
          <span>Recorded Quantities</span>
          <strong>
            {totals.quantity.toLocaleString()}
          </strong>
          <small>
            Mixed units — see breakdown below
          </small>
        </div>

        <div className="stat">
          <span>Reporting Pharmacies</span>
          <strong>
            {reportingPharmacies}
          </strong>
        </div>

        <div className="stat">
          <span>Reporting Provinces</span>
          <strong>
            {reportingProvinces}
          </strong>
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

          <span>
            {grouped.length} rows
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  {groupBy.toUpperCase()}
                </th>
                <th>UNIT</th>
                <th>ADMINISTRATION EVENTS</th>
                <th>QUANTITY USED</th>
              </tr>
            </thead>

            <tbody>
              {grouped.map((row) => (
                <tr
                  key={`${row.label}-${row.unit}`}
                >
                  <td>
                    <strong>
                      {row.label}
                    </strong>
                  </td>

                  <td>{row.unit}</td>

                  <td>
                    {row.events.toLocaleString()}
                  </td>

                  <td>
                    {row.quantity.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && (
            <div className="empty">
              Loading contraceptive usage...
            </div>
          )}

          {!loading &&
            !error &&
            grouped.length === 0 && (
              <div className="empty">
                No recorded contraceptive usage
                for the selected filters.
              </div>
            )}
        </div>
      </section>

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
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 28px;
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

        p {
          color: #64748b;
          font-size: 13px;
        }

        .updated {
          font-size: 11px;
          color: #64748b;
          margin-top: 10px;
        }

        .actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .actions button,
        .actions a {
          padding: 11px 15px;
          border: 1px solid #dbe4ee;
          border-radius: 8px;
          background: white;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        .actions .primary {
          background: #0f766e;
          color: white;
          border-color: #0f766e;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .filters {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 16px;
          padding: 22px;
          border-radius: 12px;
          background: white;
          border: 1px solid #e5eaf1;
          margin-bottom: 24px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
        }

        select {
          padding: 12px;
          border: 1px solid #dbe4ee;
          border-radius: 8px;
          background: white;
          color: #172b4d;
          width: 100%;
        }

        .stats {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat {
          background: white;
          border: 1px solid #e5eaf1;
          padding: 22px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .stat span {
          color: #64748b;
          font-size: 12px;
        }

        .stat strong {
          font-size: 30px;
          color: #0f766e;
        }

        .stat small {
          color: #94a3b8;
          font-size: 10px;
        }

        .report {
          background: white;
          border: 1px solid #e5eaf1;
          border-radius: 12px;
          overflow: hidden;
        }

        .report-heading {
          padding: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        h2 {
          font-size: 17px;
          margin: 0;
        }

        .report-heading span {
          color: #64748b;
          font-size: 12px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 650px;
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

        .empty {
          padding: 35px;
          text-align: center;
          color: #64748b;
        }

        .error {
          padding: 18px;
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .error p {
          color: #b91c1c;
          margin: 10px 0;
        }

        .error button {
          padding: 9px 14px;
          background: white;
          border: 1px solid #fecaca;
          border-radius: 7px;
          cursor: pointer;
        }

        .notice {
          padding: 16px;
          background: #fff7ed;
          color: #9a3412;
          border: 1px solid #fed7aa;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 13px;
        }

        @media (max-width: 900px) {
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

          .filters {
            grid-template-columns: 1fr;
          }

          .stats {
            grid-template-columns: 1fr 1fr;
          }

          h1 {
            font-size: 23px;
          }
        }
      `}</style>
    </main>
  );
}
