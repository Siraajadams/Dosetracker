
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Clinic = {
  id: string;
  site_name: string;
  is_active: boolean;
  alternative_name: string | null;
  facility_type: string | null;
  mhfl_number: string | null;
  cfs_number: string | null;
  demander_number: string | null;
  reporting_facility_code: string | null;
  sapc_registration_number: string | null;
  responsible_pharmacist: string | null;
  facility_manager: string | null;
  contact_person: string | null;
  contact_number: string | null;
  email: string | null;
  stock_ordering_contact: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  postal_code: string | null;
};

type FieldKey = Exclude<
  keyof Clinic,
  "id" | "is_active"
>;

const groups: {
  title: string;
  fields: { key: FieldKey; label: string }[];
}[] = [
  {
    title: "Facility Information",
    fields: [
      { key: "site_name", label: "Official Clinic Name *" },
      { key: "alternative_name", label: "Alternative / Trading Name" },
      { key: "facility_type", label: "Facility Type" },
    ],
  },
  {
    title: "Government & Registration Identifiers",
    fields: [
      { key: "mhfl_number", label: "MHFL Number" },
      { key: "cfs_number", label: "CFS Number" },
      { key: "demander_number", label: "Demander Number" },
      {
        key: "reporting_facility_code",
        label: "Reporting Facility Code",
      },
      {
        key: "sapc_registration_number",
        label: "SAPC Registration Number",
      },
    ],
  },
  {
    title: "Facility Contact Details",
    fields: [
      { key: "facility_manager", label: "Facility Manager" },
      {
        key: "responsible_pharmacist",
        label: "Responsible Pharmacist",
      },
      { key: "contact_person", label: "Contact Person" },
      { key: "contact_number", label: "Contact Number" },
      { key: "email", label: "Facility Email" },
      {
        key: "stock_ordering_contact",
        label: "Stock Ordering Contact",
      },
    ],
  },
  {
    title: "Facility Address",
    fields: [
      { key: "address", label: "Street Address" },
      { key: "city", label: "City / Town" },
      { key: "province", label: "Province" },
      { key: "district", label: "District" },
      { key: "subdistrict", label: "Subdistrict" },
      { key: "postal_code", label: "Postal Code" },
    ],
  },
];

const editableKeys = groups.flatMap(
  (group) => group.fields.map((field) => field.key)
);

export default function AdminClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !authData.user) {
        setError("Please sign in as an administrator.");
        setLoading(false);
        return;
      }

      const { data, error: loadError } =
        await supabase.rpc("fp_admin_list_clinics");

      if (cancelled) return;

      if (loadError) {
        setError(loadError.message);
      } else {
        const rows = (data ?? []) as Clinic[];
        setClinics(rows);

        if (rows.length > 0) {
          setSelectedId(rows[0].id);
          setForm({ ...rows[0] });
        }
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  function selectClinic(id: string) {
    const clinic = clinics.find((item) => item.id === id);

    setSelectedId(id);
    setForm(clinic ? { ...clinic } : null);
    setError("");
    setSuccess("");
  }

  function updateField(key: FieldKey, value: string) {
    setForm((previous) =>
      previous ? { ...previous, [key]: value } : null
    );
    setSuccess("");
  }

  async function saveClinic(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form || saving) return;

    if (!form.site_name.trim()) {
      setError("Clinic name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const details: Record<string, string | null> = {};

    for (const key of editableKeys) {
      const value = form[key];
      details[key] = value?.trim() || null;
    }

    const { data, error: saveError } = await supabase.rpc(
      "fp_admin_update_clinic",
      {
        p_site_id: form.id,
        p_details: details,
      }
    );

    if (saveError) {
      setError(saveError.message);
    } else {
      const updated = data as Clinic;

      setClinics((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      );

      setForm({ ...updated });
      setSuccess("Clinic information saved successfully.");
    }

    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#fff",
    color: "#0f172a",
    fontSize: 15,
  };

  return (
    <main
      style={{
        maxWidth: 1050,
        margin: "0 auto",
        padding: 24,
        color: "#0f172a",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>
        DoseTrack — Clinic Administration
      </h1>

      <p style={{ marginTop: 8, color: "#475569" }}>
        Update facility identifiers, registration information
        and clinic contact details.
      </p>

      {loading && <p>Loading clinics...</p>}

      {error && (
        <div role="alert" style={{
          marginTop: 20,
          padding: 14,
          background: "#fef2f2",
          color: "#991b1b",
          borderRadius: 8,
        }}>
          {error}
        </div>
      )}

      {success && (
        <div role="status" style={{
          marginTop: 20,
          padding: 14,
          background: "#ecfdf5",
          color: "#065f46",
          borderRadius: 8,
        }}>
          {success}
        </div>
      )}

      {!loading && clinics.length > 0 && (
        <>
          <div style={{ marginTop: 28 }}>
            <label
              htmlFor="clinic-select"
              style={{ fontWeight: 600 }}
            >
              Select Clinic
            </label>

            <select
              id="clinic-select"
              value={selectedId}
              onChange={(event) =>
                selectClinic(event.target.value)
              }
              style={{ ...inputStyle, marginTop: 8 }}
            >
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.site_name}
                  {clinic.is_active ? "" : " (Inactive)"}
                </option>
              ))}
            </select>
          </div>

          {form && (
            <form onSubmit={saveClinic}>
              {groups.map((group) => (
                <section
                  key={group.title}
                  style={{
                    marginTop: 24,
                    padding: 22,
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    background: "#fff",
                  }}
                >
                  <h2 style={{
                    fontSize: 20,
                    fontWeight: 650,
                    marginBottom: 18,
                  }}>
                    {group.title}
                  </h2>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(230px, 1fr))",
                    gap: 18,
                  }}>
                    {group.fields.map((field) => (
                      <div key={field.key}>
                        <label
                          htmlFor={field.key}
                          style={{
                            display: "block",
                            marginBottom: 7,
                            fontWeight: 500,
                          }}
                        >
                          {field.label}
                        </label>

                        <input
                          id={field.key}
                          type={
                            field.key === "email"
                              ? "email"
                              : field.key === "contact_number"
                              ? "tel"
                              : "text"
                          }
                          value={form[field.key] ?? ""}
                          onChange={(event) =>
                            updateField(
                              field.key,
                              event.target.value
                            )
                          }
                          required={field.key === "site_name"}
                          maxLength={250}
                          style={inputStyle}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              <p style={{
                color: "#64748b",
                marginTop: 16,
                fontSize: 14,
              }}>
                Government identifiers are optional when not
                assigned to the facility.
              </p>

              <button
                type="submit"
                disabled={saving}
                style={{
                  marginTop: 20,
                  padding: "13px 24px",
                  background: "#116b61",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.65 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : "Save Clinic Information"}
              </button>
            </form>
          )}
        </>
      )}

      {!loading && !error && clinics.length === 0 && (
        <p>No clinics are registered.</p>
      )}
    </main>
  );
}
