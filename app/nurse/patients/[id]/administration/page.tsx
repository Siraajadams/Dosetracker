
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
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
  medication_name: string;
  dose: string;
  route: string;
  administered_at: string;
  batch_number: string;
  administered_by: string;
  next_due_date: string | null;
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 16,
};

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 22,
  marginBottom: 20,
};

const primaryButton: CSSProperties = {
  background: "#0f766e",
  color: "white",
  padding: "13px 20px",
  border: 0,
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const categories = [
  { value: "family_planning", label: "Family Planning" },
  { value: "glp1", label: "GLP-1 Treatment" },
  { value: "vaccine", label: "Vaccination" },
  { value: "prep_lai", label: "Long-acting PrEP" },
  { value: "other", label: "Other Medication" },
];

const medications: Record<string, string[]> = {
  family_planning: [
    "Nur-Isterate",
    "Depo-Provera",
    "Other contraceptive",
  ],
  glp1: [
    "Semaglutide",
    "Tirzepatide",
    "Liraglutide",
    "Other GLP-1",
  ],
  vaccine: [
    "HPV vaccine",
    "Influenza vaccine",
    "Hepatitis B vaccine",
    "Other vaccine",
  ],
  prep_lai: [
    "Cabotegravir LA",
    "Lenacapavir",
    "Other PrEP medication",
  ],
  other: ["Other medication"],
};

const initialForm = {
  category: "family_planning",
  medication: "",
  customMedication: "",
  dose: "",
  route: "Intramuscular",
  administrationSite: "",
  batch: "",
  expiry: "",
  administeredAt: "",
  allergiesReviewed: false,
  contraindicationsReviewed: false,
  consentConfirmed: false,
  notes: "",
  adverseReaction: "",
  nextDueDate: "",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update<K extends keyof typeof initialForm>(
    key: K,
    value: (typeof initialForm)[K]
  ) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
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
        profile.approval_status !== "approved" ||
        profile.is_active !== true
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
        .map(item => item.site_id)
        .filter(Boolean);

      if (siteIds.length === 0) {
        throw new Error("No clinic is assigned to this nurse.");
      }

      const { data: record, error: patientError } =
        await supabase
          .from("patients")
          .select(
            "id,site_id,first_name,surname,date_of_birth"
          )
          .eq("id", patientId)
          .in("site_id", siteIds)
          .maybeSingle();

      if (patientError) throw patientError;

      if (!record) {
        throw new Error(
          "Patient not found or clinic access denied."
        );
      }

      const { data: site, error: siteError } =
        await supabase
          .from("sites")
          .select("site_name,is_active")
          .eq("id", record.site_id)
          .maybeSingle();

      if (siteError) throw siteError;

      if (!site?.is_active) {
        throw new Error("The patient's clinic is inactive.");
      }

      const { data: records, error: historyError } =
        await supabase
          .from("medication_administrations")
          .select(
            "id,medication_name,dose,route,administered_at,batch_number,administered_by,next_due_date"
          )
          .eq("patient_id", patientId)
          .eq("site_id", record.site_id)
          .order("administered_at", { ascending: false });

      if (historyError) throw historyError;

      setNurseId(userId);
      setPatient(record as Patient);
      setClinicName(site.site_name);
      setHistory((records || []) as Administration[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load clinical record."
      );
    } finally {
      setLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveAdministration(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!patient || !nurseId || saving) return;

    const medicationName =
      form.medication.startsWith("Other")
        ? form.customMedication.trim()
        : form.medication;

    if (!medicationName) {
      setError("Select or enter the medication.");
      return;
    }

    if (
      !form.allergiesReviewed ||
      !form.contraindicationsReviewed ||
      !form.consentConfirmed
    ) {
      setError(
        "Complete all clinical safety confirmations."
      );
      return;
    }

    if (!form.administeredAt) {
      setError("Enter the actual administration date and time.");
      return;
    }

    const administeredDate = new Date(form.administeredAt);

    if (
      Number.isNaN(administeredDate.getTime()) ||
      administeredDate.getTime() > Date.now()
    ) {
      setError("Enter a valid administration time, not in the future.");
      return;
    }

    const administrationDay =
      administeredDate.toISOString().slice(0, 10);

    if (form.expiry < administrationDay) {
      setError(
        "Medication expiry must not precede administration."
      );
      return;
    }

    if (
      form.nextDueDate &&
      form.nextDueDate < administrationDay
    ) {
      setError(
        "The next due date cannot precede administration."
      );
      return;
    }

    setSaving(true);

    try {
      // Recheck current authentication and clinic assignment.
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || auth.user?.id !== nurseId) {
        throw new Error("Your session has changed. Sign in again.");
      }

      const { error: insertError } = await supabase
        .from("medication_administrations")
        .insert({
          patient_id: patient.id,
          site_id: patient.site_id,
          administered_by: nurseId,
          medication_category: form.category,
          medication_name: medicationName,
          dose: form.dose.trim(),
          route: form.route,
          administration_site:
            form.administrationSite.trim() || null,
          batch_number: form.batch.trim(),
          expiry_date: form.expiry,
          administered_at: administeredDate.toISOString(),
          allergies_reviewed: form.allergiesReviewed,
          contraindications_reviewed:
            form.contraindicationsReviewed,
          consent_confirmed: form.consentConfirmed,
          clinical_notes: form.notes.trim() || null,
          adverse_reaction:
            form.adverseReaction.trim() || null,
          next_due_date: form.nextDueDate || null,
        });

      if (insertError) throw insertError;

      setForm(initialForm);
      setMessage("Medication administration saved successfully.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Medication administration could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={{ padding: 30 }}>Loading clinical record...</main>;
  }

  return (
    <main style={{
      background: "#f0f7f7",
      minHeight: "100vh",
      padding: "24px 16px",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <h1 style={{ color: "#075c59" }}>
          DoseTrack — Medication Administration
        </h1>

        <button
          type="button"
          onClick={() => router.push(
            `/nurse/patients/${patientId}`
          )}
          style={{ ...primaryButton, marginBottom: 20 }}
        >
          Back to Patient Record
        </button>

        {error && (
          <p role="alert" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}

        {message && (
          <p role="status" style={{ color: "#047857" }}>
            {message}
          </p>
        )}

        {patient && (
          <>
            <section style={cardStyle}>
              <h2>
                {patient.first_name} {patient.surname}
              </h2>
              <p><strong>Clinic:</strong> {clinicName}</p>
              <p>
                <strong>Date of Birth:</strong>{" "}
                {patient.date_of_birth || "Not recorded"}
              </p>
            </section>

            <form onSubmit={saveAdministration}>
              <section style={{
                ...cardStyle,
                display: "grid",
                gap: 18,
              }}>
                <h2>Medication Details</h2>

                <Field label="Service Category *">
                  <select
                    style={inputStyle}
                    value={form.category}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      category: e.target.value,
                      medication: "",
                      customMedication: "",
                    }))}
                  >
                    {categories.map(item => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Medication *">
                  <select
                    required
                    style={inputStyle}
                    value={form.medication}
                    onChange={e =>
                      update("medication", e.target.value)
                    }
                  >
                    <option value="">Select Medication</option>
                    {medications[form.category].map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>

                {form.medication.startsWith("Other") && (
                  <Field label="Medication Name *">
                    <input
                      required
                      style={inputStyle}
                      value={form.customMedication}
                      onChange={e => update(
                        "customMedication", e.target.value
                      )}
                    />
                  </Field>
                )}

                <Field label="Dose and Units *">
                  <input
                    required
                    style={inputStyle}
                    placeholder="Enter actual administered dose and units"
                    value={form.dose}
                    onChange={e =>
                      update("dose", e.target.value)
                    }
                  />
                </Field>

                <Field label="Route *">
                  <select
                    required
                    style={inputStyle}
                    value={form.route}
                    onChange={e =>
                      update("route", e.target.value)
                    }
                  >
                    <option>Intramuscular</option>
                    <option>Subcutaneous</option>
                    <option>Oral</option>
                    <option>Intradermal</option>
                    <option>Other</option>
                  </select>
                </Field>

                <Field label="Administration Site">
                  <input
                    style={inputStyle}
                    placeholder="e.g. Left deltoid"
                    value={form.administrationSite}
                    onChange={e => update(
                      "administrationSite", e.target.value
                    )}
                  />
                </Field>

                <Field label="Batch / Lot Number *">
                  <input
                    required
                    style={inputStyle}
                    value={form.batch}
                    onChange={e =>
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
                    onChange={e =>
                      update("expiry", e.target.value)
                    }
                  />
                </Field>

                <Field label="Actual Administration Date and Time *">
                  <input
                    type="datetime-local"
                    required
                    style={inputStyle}
                    value={form.administeredAt}
                    onChange={e => update(
                      "administeredAt", e.target.value
                    )}
                  />
                </Field>
              </section>

              <section style={{
                ...cardStyle,
                display: "grid",
                gap: 16,
              }}>
                <h2>Pre-administration Safety Checks</h2>
                <p>
                  Confirm the relevant checks have been
                  completed and documented before recording
                  an administration.
                </p>

                {([
                  ["allergiesReviewed", "Allergies and relevant history reviewed"],
                  ["contraindicationsReviewed", "Contraindications and clinical eligibility reviewed"],
                  ["consentConfirmed", "Patient consent confirmed"],
                ] as const).map(([key, label]) => (
                  <label
                    key={key}
                    style={{ display: "flex", gap: 10 }}
                  >
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e =>
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
                    onChange={e =>
                      update("notes", e.target.value)
                    }
                  />
                </Field>

                <Field label="Adverse Reaction / Observation">
                  <textarea
                    rows={3}
                    style={inputStyle}
                    value={form.adverseReaction}
                    onChange={e => update(
                      "adverseReaction", e.target.value
                    )}
                  />
                </Field>

                <Field label="Next Planned Administration Date">
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.nextDueDate}
                    onChange={e => update(
                      "nextDueDate", e.target.value
                    )}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...primaryButton,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Save Medication Administration"}
                </button>
              </section>
            </form>

            <section style={cardStyle}>
              <h2>Medication Administration History</h2>

              {history.length === 0 ? (
                <p>No administrations recorded yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {history.map(item => (
                    <article
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        paddingBottom: 14,
                      }}
                    >
                      <strong>{item.medication_name}</strong>
                      <p>
                        {formatDateTime(item.administered_at)}
                      </p>
                      <p>
                        Dose: {item.dose} | Route: {item.route}
                      </p>
                      <p>Batch: {item.batch_number}</p>
                      <p>
                        Next due: {item.next_due_date || "Not set"}
                      </p>
                      <small>
                        Recorded by staff ID: {item.administered_by}
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
