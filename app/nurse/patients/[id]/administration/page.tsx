"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  site_id: string;
  first_name: string | null;
  surname: string | null;
  date_of_birth: string | null;
};

type Administration = {
  id: string;
  service_type: string;
  clinical_action: string | null;
  medication_name: string;
  dose: string;
  route: string;
  administered_at: string;
  injection_site: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  adverse_events: string | null;
  clinical_notes: string | null;
  next_dose_date: string | null;
  administered_by: string;
};

type CatalogueItem = {
  id: string;
  icn_code: string | null;
  medication_name: string;
  category: string;
  stock_unit: string;
  administration_route: string | null;
};

function allowedActions(category: string): string[] {
  switch (category) {
    case "Injectable Contraceptive": return ["administered"];
    case "Oral Contraceptive": return ["dispensed"];
    case "Contraceptive Implant": return ["inserted", "removed"];
    case "Barrier Contraceptive": return ["supplied"];
    case "Procedure Consumable": return ["administered"];
    default: return ["administered", "dispensed", "supplied"];
  }
}

const actionLabels: Record<string, string> = {
  administered: "Administered",
  dispensed: "Dispensed",
  inserted: "Inserted",
  removed: "Removed",
  supplied: "Supplied",
};

const initialForm = {
  medication: "",
  action: "",
  dose: "",
  route: "",
  injectionSite: "",
  batch: "",
  expiry: "",
  administeredAt: "",
  allergiesReviewed: false,
  contraindicationsReviewed: false,
  consentConfirmed: false,
  notes: "",
  adverseEvents: "",
  nextDoseDate: "",
};

type FormState = typeof initialForm;

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 16,
  background: "#fff",
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 22,
  marginBottom: 20,
};

const buttonStyle: CSSProperties = {
  background: "#0f766e",
  color: "white",
  padding: "13px 20px",
  border: 0,
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 15,
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function localDateTime() {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 16);
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const value = err as {
      message?: string;
      code?: string;
      details?: string;
    };

    if (value.code === "PGRST205") {
      return "The medication administration table was not found. Check the Supabase SQL migration and reload the schema.";
    }

    if (value.code === "42501") {
      return "Database access denied. Check nurse approval, clinic assignment and RLS policies.";
    }

    return [
      value.message,
      value.code ? `Code: ${value.code}` : "",
      value.details,
    ]
      .filter(Boolean)
      .join(" — ");
  }

  return "An unexpected error occurred.";
}

export default function MedicationAdministrationPage() {
  const router = useRouter();
  const params = useParams();

  const patientId =
    typeof params.id === "string" ? params.id : "";

  const [patient, setPatient] = useState<Patient | null>(null);
  const [nurseId, setNurseId] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [history, setHistory] = useState<Administration[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [form, setForm] = useState<FormState>({
    ...initialForm,
    administeredAt: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!patientId) {
        throw new Error("Invalid patient reference.");
      }

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const userId = auth.user.id;

      const { data: profile, error: profileError } =
        await supabase
          .from("staff_profiles")
          .select("role,approval_status,is_active")
          .eq("id", userId)
          .maybeSingle();

      if (profileError) throw profileError;

      if (
        !auth.user.email_confirmed_at ||
        profile?.role !== "nurse" ||
        profile?.approval_status !== "approved" ||
        profile?.is_active !== true
      ) {
        router.replace("/pending-approval");
        return;
      }

      const { data: assignments, error: assignmentError } =
        await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", userId);

      if (assignmentError) throw assignmentError;

      const siteIds = (assignments || [])
        .map((item) => item.site_id as string)
        .filter(Boolean);

      if (!siteIds.length) {
        throw new Error(
          "No clinic is assigned to this nurse."
        );
      }

      const { data: patientData, error: patientError } =
        await supabase
          .from("patients")
          .select(
            "id,site_id,first_name,surname,date_of_birth"
          )
          .eq("id", patientId)
          .in("site_id", siteIds)
          .maybeSingle();

      if (patientError) throw patientError;

      if (!patientData) {
        throw new Error(
          "Patient not found or clinic access denied."
        );
      }

      const record = patientData as Patient;

      const { data: site, error: siteError } =
        await supabase
          .from("sites")
          .select("site_name,is_active")
          .eq("id", record.site_id)
          .maybeSingle();

      if (siteError) throw siteError;

      if (!site?.is_active) {
        throw new Error(
          "The patient's clinic is inactive."
        );
      }

      const { data: records, error: historyError } =
        await supabase
          .from("medication_administrations")
          .select(
            "id,service_type,medication_name,dose,route,administered_at,injection_site,batch_number,expiry_date,adverse_events,clinical_notes,next_dose_date,administered_by,clinical_action"
          )
          .eq("patient_id", record.id)
          .eq("site_id", record.site_id)
          .order("administered_at", {
            ascending: false,
          });

      if (historyError) throw historyError;

      const { data: catalogueData, error: catalogueError } = await supabase
        .from("fp_medication_catalogue")
        .select("id,icn_code,medication_name,category,stock_unit,administration_route")
        .eq("is_active", true)
        .order("category")
        .order("medication_name");
      if (catalogueError) throw catalogueError;
      setCatalogue((catalogueData || []) as CatalogueItem[]);

      setPatient(record);
      setNurseId(userId);
      setClinicName(site.site_name || "Unknown clinic");
      setHistory((records || []) as Administration[]);
    } catch (err) {
      setPatient(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      administeredAt: localDateTime(),
    }));
  }, []);

  async function saveAdministration(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!patient || !nurseId || saving) return;

    setError("");
    setMessage("");

    const selectedMedication = catalogue.find((item) => item.id === form.medication);
    if (!selectedMedication) {
      setError("Select a medication from the approved Family Planning catalogue.");
      return;
    }
    if (!allowedActions(selectedMedication.category).includes(form.action)) {
      setError("Select the appropriate clinical action for this item.");
      return;
    }
    const medicationName = selectedMedication.medication_name;

    if (!form.dose.trim()) {
      setError("Enter the quantity and units recorded for this event.");
      return;
    }

    if (!form.batch.trim() || !form.expiry) {
      setError("Batch number and expiry date are required for traceability.");
      return;
    }

    if (
      !form.allergiesReviewed ||
      !form.contraindicationsReviewed ||
      !form.consentConfirmed
    ) {
      setError(
        "Complete all pre-administration safety confirmations."
      );
      return;
    }

    if (!form.administeredAt) {
      setError("Enter the administration date and time.");
      return;
    }

    const administeredDate = new Date(form.administeredAt);

    if (
      Number.isNaN(administeredDate.getTime()) ||
      administeredDate.getTime() > Date.now()
    ) {
      setError("Administration time cannot be in the future.");
      return;
    }

    const administrationDay = form.administeredAt.slice(0, 10);

    if (form.expiry && form.expiry < administrationDay) {
      setError(
        "The medication expired before the administration date."
      );
      return;
    }

    if (
      form.nextDoseDate &&
      form.nextDoseDate < administrationDay
    ) {
      setError(
        "The next dose date cannot precede administration."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || auth.user?.id !== nurseId) {
        throw new Error(
          "Your session has changed. Please sign in again."
        );
      }

      const { error: insertError } =
        await supabase
          .from("medication_administrations")
          .insert({
            patient_id: patient.id,
            site_id: patient.site_id,
            administered_by: nurseId,
            service_type: "family_planning",
            catalogue_item_id: selectedMedication.id,
            clinical_action: form.action,
            medication_name: medicationName,
            dose: form.dose.trim(),
            route: form.route,
            injection_site:
              form.injectionSite.trim() || null,
            batch_number: form.batch.trim(),
            expiry_date: form.expiry,
            administered_at:
              administeredDate.toISOString(),
            allergies_reviewed: form.allergiesReviewed,
            contraindications_reviewed:
              form.contraindicationsReviewed,
            consent_confirmed: form.consentConfirmed,
            clinical_notes: form.notes.trim() || null,
            adverse_events:
              form.adverseEvents.trim() || null,
            next_dose_date: form.nextDoseDate || null,
          });

      if (insertError) throw insertError;

      setForm({
        ...initialForm,
        administeredAt: localDateTime(),
      });

      await loadData();

      setMessage(
        "Family Planning clinical event saved successfully."
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        background: "#f0f7f7",
        minHeight: "100vh",
        padding: "24px 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <h1 style={{ color: "#075c59" }}>
          DoseTrack — Family Planning Clinical Record
        </h1>

        <button
          type="button"
          style={{
            ...buttonStyle,
            marginBottom: 20,
          }}
          onClick={() =>
            router.push(`/nurse/patients/${patientId}`)
          }
        >
          Back to Patient Record
        </button>

        {error && (
          <div
            role="alert"
            style={{
              ...cardStyle,
              color: "#b91c1c",
              borderColor: "#fecaca",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <p role="status" style={{ color: "#047857" }}>
            {message}
          </p>
        )}

        {loading && <p>Loading clinical record...</p>}

        {!loading && !patient && (
          <button
            type="button"
            style={buttonStyle}
            onClick={() => void loadData()}
          >
            Retry
          </button>
        )}

        {!loading && patient && (
          <>
            <section style={cardStyle}>
              <h2>
                {patient.first_name} {patient.surname}
              </h2>

              <p>
                <strong>Clinic:</strong> {clinicName}
              </p>

              <p>
                <strong>Date of Birth:</strong>{" "}
                {patient.date_of_birth || "Not recorded"}
              </p>
            </section>

            <form onSubmit={saveAdministration}>
              <section
                style={{
                  ...cardStyle,
                  display: "grid",
                  gap: 18,
                }}
              >
                <h2>Medication Details</h2>

                <p><strong>Service:</strong> Family Planning</p>
                <Field label="Medication / Commodity *">
                  <select
                    required
                    style={inputStyle}
                    value={form.medication}
                    onChange={(e) => {
                      const selected = catalogue.find((item) => item.id === e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        medication: e.target.value,
                        action: selected ? allowedActions(selected.category)[0] : "",
                        route: selected?.administration_route || "Not applicable",
                        dose: "",
                        injectionSite: "",
                      }));
                    }}
                  >
                    <option value="">Select catalogue item</option>
                    {Array.from(new Set(catalogue.map((item) => item.category))).map((category) => (
                      <optgroup key={category} label={category}>
                        {catalogue.filter((item) => item.category === category).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.medication_name} {item.icn_code ? `(ICN ${item.icn_code})` : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                {catalogue.length === 0 && (
                  <p role="alert">No active catalogue items are available to this account.</p>
                )}
                {form.medication && (() => {
                  const selected = catalogue.find((item) => item.id === form.medication);
                  if (!selected) return null;
                  return <p>Category: {selected.category} | Stock unit: {selected.stock_unit} | ICN: {selected.icn_code || "Not assigned"}</p>;
                })()}
                <Field label="Clinical Action *">
                  <select
                    required
                    style={inputStyle}
                    value={form.action}
                    onChange={(e) => update("action", e.target.value)}
                    disabled={!form.medication}
                  >
                    <option value="">Select action</option>
                    {allowedActions(catalogue.find((item) => item.id === form.medication)?.category || "").map((action) => (
                      <option key={action} value={action}>{actionLabels[action]}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Actual Quantity / Dose and Units *">
                  <input
                    required
                    style={inputStyle}
                    placeholder="e.g. 1 ampoule, 1 pack, or documented dose"
                    value={form.dose}
                    onChange={(e) =>
                      update("dose", e.target.value)
                    }
                  />
                </Field>

                <Field label="Route *">
                  <select
                    required
                    style={inputStyle}
                    value={form.route}
                    onChange={(e) =>
                      update("route", e.target.value)
                    }
                  >
                    <option>Intramuscular</option>
                    <option>Subcutaneous</option>
                    <option>Oral</option>
                    <option>Intradermal</option>
                    <option>Subdermal</option>
                    <option>Local infiltration</option>
                    <option>External</option>
                    <option>Internal</option>
                    <option>Not applicable</option>
                    <option>Other</option>
                  </select>
                </Field>

                <Field label="Injection / Administration Site">
                  <input
                    style={inputStyle}
                    placeholder="e.g. Left deltoid"
                    value={form.injectionSite}
                    onChange={(e) =>
                      update(
                        "injectionSite",
                        e.target.value
                      )
                    }
                  />
                </Field>

                <Field label="Batch / Lot Number *">
                  <input
                    required
                    style={inputStyle}
                    value={form.batch}
                    onChange={(e) =>
                      update("batch", e.target.value)
                    }
                  />
                </Field>

                <Field label="Medication Expiry Date *">
                  <input
                    type="date"
                    required
                    style={inputStyle}
                    value={form.expiry}
                    onChange={(e) =>
                      update("expiry", e.target.value)
                    }
                  />
                </Field>

                <Field label="Clinical Event Date and Time *">
                  <input
                    type="datetime-local"
                    required
                    style={inputStyle}
                    value={form.administeredAt}
                    onChange={(e) =>
                      update(
                        "administeredAt",
                        e.target.value
                      )
                    }
                  />
                </Field>
              </section>

              <section
                style={{
                  ...cardStyle,
                  display: "grid",
                  gap: 16,
                }}
              >
                <h2>Clinical Safety Checks</h2>

                <p>
                  Confirm the clinical checks were completed
                  before recording administration.
                </p>

                {(
                  [
                    [
                      "allergiesReviewed",
                      "Allergies and relevant history reviewed",
                    ],
                    [
                      "contraindicationsReviewed",
                      "Contraindications and clinical eligibility reviewed",
                    ],
                    [
                      "consentConfirmed",
                      "Patient consent confirmed",
                    ],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) =>
                        update(key, e.target.checked)
                      }
                    />
                    {label}
                  </label>
                ))}

                <Field label="Clinical Assessment / Notes">
                  <textarea
                    rows={4}
                    style={inputStyle}
                    value={form.notes}
                    onChange={(e) =>
                      update("notes", e.target.value)
                    }
                  />
                </Field>

                <Field label="Adverse Events / Observation">
                  <textarea
                    rows={3}
                    style={inputStyle}
                    value={form.adverseEvents}
                    onChange={(e) =>
                      update(
                        "adverseEvents",
                        e.target.value
                      )
                    }
                  />
                </Field>

                <Field label="Next Planned Administration Date">
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.nextDoseDate}
                    onChange={(e) =>
                      update(
                        "nextDoseDate",
                        e.target.value
                      )
                    }
                  />
                </Field>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...buttonStyle,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Save Family Planning Event"}
                </button>
              </section>
            </form>

            <section style={cardStyle}>
              <h2>Family Planning Event History</h2>

              {history.length === 0 ? (
                <p>No administrations recorded yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {history.map((item) => (
                    <article
                      key={item.id}
                      style={{
                        borderBottom:
                          "1px solid #e2e8f0",
                        paddingBottom: 14,
                      }}
                    >
                      <h3>{item.medication_name}</h3>

                      <p>
                        <strong>Event date:</strong>{" "}
                        {formatDateTime(
                          item.administered_at
                        )}
                      </p>

                      <p>
                        <strong>Dose:</strong> {item.dose}
                      </p>

                      <p>
                        <strong>Route:</strong> {item.route}
                      </p>

                      <p>
                        <strong>Batch:</strong>{" "}
                        {item.batch_number || "Not recorded"}
                      </p>

                      <p>
                        <strong>Next Due:</strong>{" "}
                        {item.next_dose_date || "Not set"}
                      </p>

                      <p>
                        <strong>Adverse Events:</strong>{" "}
                        {item.adverse_events || "None documented"}
                      </p>

                      <p>
                        <strong>Clinical Notes:</strong>{" "}
                        {item.clinical_notes || "None"}
                      </p>

                      <small>
                        Recorded by staff ID:{" "}
                        {item.administered_by}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
