
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  site_id: string;
  first_name: string | null;
  surname: string | null;
  id_number: string | null;
  passport_number: string | null;
};

type Medication = {
  id: string;
  name: string;
};

type MedicationRow = {
  key: string;
  medicationId: string;
  dose: string;
  route: string;
  batchNumber: string;
  expiryDate: string;
  injectionSite: string;
  notes: string;
};

const routes = [
  "Oral",
  "Intramuscular",
  "Subcutaneous",
  "Implant",
  "Topical",
  "Vaginal",
  "Barrier",
  "Dispensed / Supplied",
  "Other",
];

const services = [
  "Family Planning",
  "Contraceptive Injection",
  "Contraceptive Implant",
  "Oral Contraceptive",
  "Condom Supply",
  "Other",
];

function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(value: string, days: number) {
  if (!value) return "";
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k + 7) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function saHoliday(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";

  const year = Number(value.slice(0, 4));
  const holidays = new Map<string, string>();

  const fixed: Array<[string, string]> = [
    ["01-01", "New Year's Day"],
    ["03-21", "Human Rights Day"],
    ["04-27", "Freedom Day"],
    ["05-01", "Workers' Day"],
    ["06-16", "Youth Day"],
    ["08-09", "National Women's Day"],
    ["09-24", "Heritage Day"],
    ["12-16", "Day of Reconciliation"],
    ["12-25", "Christmas Day"],
    ["12-26", "Day of Goodwill"],
  ];

  for (const [day, name] of fixed) {
    const date = `${year}-${day}`;
    holidays.set(date, name);

    if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) {
      const observed = addDays(date, 1);
      holidays.set(observed, `${name} (observed)`);
    }
  }

  const easter = easterSunday(year);
  holidays.set(addDays(easter, -2), "Good Friday");
  holidays.set(addDays(easter, 1), "Family Day");

  return holidays.get(value) || "";
}

function dateWarning(value: string) {
  if (!value) return "";

  const holiday = saHoliday(value);
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();

  const issues: string[] = [];
  if (day === 0) issues.push("Sunday");
  if (day === 6) issues.push("Saturday");
  if (holiday) issues.push(holiday);

  return issues.join(" · ");
}

function createRow(): MedicationRow {
  return {
    key: Math.random().toString(36).slice(2),
    medicationId: "",
    dose: "",
    route: "",
    batchNumber: "",
    expiryDate: "",
    injectionSite: "",
    notes: "",
  };
}

function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(error.message);
  }
  return String(error);
}

export default function NewMedicationAdministrationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const patientId = params.id;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [rows, setRows] = useState<MedicationRow[]>([
    createRow(),
  ]);

  const [serviceType, setServiceType] =
    useState("Family Planning");
  const [administrationDate, setAdministrationDate] =
    useState(today());

  const [followUpRequired, setFollowUpRequired] =
    useState(true);
  const [interval, setInterval] = useState("56");
  const [customDays, setCustomDays] = useState("42");
  const [manualAdjustment, setManualAdjustment] =
    useState(false);
  const [manualDate, setManualDate] = useState("");

  const [allergiesReviewed, setAllergiesReviewed] =
    useState(false);
  const [
    contraindicationsReviewed,
    setContraindicationsReviewed,
  ] = useState(false);
  const [consentConfirmed, setConsentConfirmed] =
    useState(false);

  const [adverseEvents, setAdverseEvents] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [clinicalAction, setClinicalAction] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const days =
    interval === "custom"
      ? Number(customDays)
      : Number(interval);

  const validInterval =
    Number.isInteger(days) && days >= 1 && days <= 365;

  const forecastDate = useMemo(
    () =>
      validInterval
        ? addDays(administrationDate, days)
        : "",
    [administrationDate, days, validInterval]
  );

  const plannedDate = manualAdjustment
    ? manualDate
    : forecastDate;

  const warning = followUpRequired
    ? dateWarning(plannedDate)
    : "";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          router.replace("/family-planning/login");
          return;
        }

        const { data: person, error: patientError } =
          await supabase
            .from("patients")
            .select(
              "id,site_id,first_name,surname,id_number,passport_number"
            )
            .eq("id", patientId)
            .single();

        if (patientError) throw patientError;
        if (!person?.site_id) {
          throw new Error("Patient has no assigned clinic.");
        }

        const [membership, assignment] = await Promise.all([
          supabase
            .from("fp_memberships")
            .select("facility_id")
            .eq("user_id", auth.user.id)
            .eq("facility_id", person.site_id)
            .eq("active", true)
            .limit(1),

          supabase
            .from("nurse_site_assignments")
            .select("site_id")
            .eq("nurse_id", auth.user.id)
            .eq("site_id", person.site_id)
            .limit(1),
        ]);

        // Either active membership or assignment permits access.
        if (
          !membership.data?.length &&
          !assignment.data?.length
        ) {
          throw new Error(
            "You are not assigned to this patient's clinic."
          );
        }

        const { data: catalogue, error: catalogueError } =
          await supabase
            .from("fp_medication_catalogue")
            .select("*");

        if (catalogueError) throw catalogueError;

        const items = (catalogue || [])
          .map((item: Record<string, unknown>) => ({
            id: String(item.id || ""),
            name: String(
              item.medication_name ||
              item.name ||
              item.product_name ||
              ""
            ),
          }))
          .filter((item) => item.id && item.name)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!cancelled) {
          setPatient(person as Patient);
          setMedications(items);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (patientId) void load();

    return () => {
      cancelled = true;
    };
  }, [patientId, router]);

  function updateRow(
    key: string,
    field: keyof Omit<MedicationRow, "key">,
    value: string
  ) {
    setRows((previous) =>
      previous.map((row) =>
        row.key === key
          ? { ...row, [field]: value }
          : row
      )
    );
  }

  function addMedication() {
    setRows((previous) => [...previous, createRow()]);
  }

  function removeMedication(key: string) {
    setRows((previous) =>
      previous.length > 1
        ? previous.filter((row) => row.key !== key)
        : previous
    );
  }

  function updateInterval(value: string) {
    setInterval(value);
    setManualAdjustment(false);
    setManualDate("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!patient || saving) return;

    if (!administrationDate) {
      setError("Administration date is required.");
      return;
    }

    if (
      rows.some(
        (row) =>
          !row.medicationId ||
          !row.dose.trim() ||
          !row.route
      )
    ) {
      setError(
        "Every medication requires a selection, dose/quantity and route."
      );
      return;
    }

    if (
      !allergiesReviewed ||
      !contraindicationsReviewed ||
      !consentConfirmed
    ) {
      setError(
        "Complete the clinical safety confirmations before saving."
      );
      return;
    }

    if (
      followUpRequired &&
      (!validInterval ||
        !plannedDate ||
        plannedDate < administrationDate)
    ) {
      setError(
        "Choose a valid follow-up interval and planned date."
      );
      return;
    }

    const medicationIds = rows.map(
      (row) => row.medicationId
    );

    if (new Set(medicationIds).size !== medicationIds.length) {
      setError(
        "A medication has been selected twice. Combine its quantity into one row."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Your session has expired.");
      }

      const payload = rows.map((row) => {
        const medication = medications.find(
          (item) => item.id === row.medicationId
        );

        if (!medication) {
          throw new Error(
            "One selected medication is not in the catalogue."
          );
        }

        return {
          patient_id: patient.id,
          site_id: patient.site_id,
          administered_by: auth.user.id,
          service_type: serviceType,
          medication_name: medication.name,
          dose: row.dose.trim(),
          route: row.route,
          batch_number: row.batchNumber.trim() || null,
          expiry_date: row.expiryDate || null,
          administered_at: `${administrationDate}T12:00:00+02:00`,
          injection_site: row.injectionSite.trim() || null,
          adverse_events: adverseEvents.trim() || null,
          clinical_notes: [
            clinicalNotes.trim(),
            row.notes.trim(),
            followUpRequired
              ? `Selected follow-up interval: ${days} days`
              : "No follow-up planned",
            manualAdjustment
              ? `Forecast date ${forecastDate}; nurse-adjusted date ${plannedDate}`
              : "",
          ]
            .filter(Boolean)
            .join("\n") || null,
          next_dose_date: followUpRequired
            ? plannedDate
            : null,
          allergies_reviewed: allergiesReviewed,
          contraindications_reviewed:
            contraindicationsReviewed,
          consent_confirmed: consentConfirmed,
          clinical_action: clinicalAction.trim() || null,
          catalogue_item_id: medication.id,
        };
      });

      // One insert for the entire encounter.
      // A failed insert will not leave half the rows saved.
      const { error: insertError } = await supabase
        .from("medication_administrations")
        .insert(payload);

      if (insertError) throw insertError;

      setSuccess(
        `${rows.length} medication administration record(s) saved successfully.`
      );

      router.push(`/nurse/patients/${patient.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="fp-page">
      <div className="fp-container">
        <header className="fp-header">
          <div>
            <p className="fp-eyebrow">
              DOSETRACK / FAMILY PLANNING
            </p>
            <h1>Medication Administration</h1>
            <p>
              Record multiple medications in a single encounter.
            </p>
          </div>

          <Link
            href={`/nurse/patients/${patientId}`}
            className="fp-btn outline"
          >
            Back to Patient
          </Link>
        </header>

        {error && (
          <div className="fp-alert error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="fp-alert success" role="status">
            {success}
          </div>
        )}

        {loading ? (
          <section className="fp-card">
            Loading patient and medication catalogue...
          </section>
        ) : !patient ? (
          <section className="fp-card">
            Unable to load patient information.
          </section>
        ) : (
          <form onSubmit={save}>
            <section className="fp-card">
              <p className="fp-eyebrow">PATIENT</p>
              <h2>
                {[patient.first_name, patient.surname]
                  .filter(Boolean)
                  .join(" ")}
              </h2>
              <p>
                {patient.id_number ||
                  patient.passport_number ||
                  "No ID or passport recorded"}
              </p>
            </section>

            <section className="fp-card">
              <h2>Administration Details</h2>

              <div className="fp-grid">
                <label>
                  Service Type *
                  <select
                    value={serviceType}
                    onChange={(e) =>
                      setServiceType(e.target.value)
                    }
                  >
                    {services.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Date Administered *
                  <input
                    type="date"
                    required
                    value={administrationDate}
                    onChange={(e) => {
                      setAdministrationDate(e.target.value);
                      setManualAdjustment(false);
                    }}
                  />
                </label>
              </div>
            </section>

            <section className="fp-card">
              <div className="fp-heading">
                <div>
                  <p className="fp-eyebrow">
                    MEDICATION CATALOGUE
                  </p>
                  <h2>Medications Administered</h2>
                  <p>
                    Add injections, tablets, implants, condoms
                    and other contraceptive products.
                  </p>
                </div>

                <button
                  type="button"
                  className="fp-btn outline"
                  onClick={addMedication}
                >
                  + Add Medication
                </button>
              </div>

              {medications.length === 0 && (
                <div className="fp-alert warning">
                  No catalogue medications were loaded.
                  Check the medication catalogue table.
                </div>
              )}

              {rows.map((row, index) => (
                <div className="fp-med-row" key={row.key}>
                  <div className="fp-heading">
                    <h3>Medication {index + 1}</h3>

                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="fp-remove"
                        onClick={() =>
                          removeMedication(row.key)
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="fp-grid">
                    <label>
                      Medication *
                      <select
                        required
                        value={row.medicationId}
                        onChange={(e) =>
                          updateRow(
                            row.key,
                            "medicationId",
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Select medication
                        </option>
                        {medications.map((medication) => (
                          <option
                            key={medication.id}
                            value={medication.id}
                          >
                            {medication.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Dose / Quantity *
                      <input
                        required
                        value={row.dose}
                        onChange={(e) =>
                          updateRow(
                            row.key,
                            "dose",
                            e.target.value
                          )
                        }
                        placeholder="e.g. 150 mg, 1 tablet, 10 condoms"
                      />
                    </label>

                    <label>
                      Route *
                      <select
                        required
                        value={row.route}
                        onChange={(e) =>
                          updateRow(
                            row.key,
                            "route",
                            e.target.value
                          )
                        }
                      >
                        <option value="">Select route</option>
                        {routes.map((route) => (
                          <option key={route} value={route}>
                            {route}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Injection Site
                      <input
                        value={row.injectionSite}
                        onChange={(e) =>
                          updateRow(
                            row.key,
                            "injectionSite",
                            e.target.value
                          )
                        }
                        placeholder="If applicable"
                      />
                    </label>

                    <label>
                      Batch Number
                      <input
                        value={row.batchNumber}
                        onChange={(e) =>
                          updateRow(
                            row.key,
                            "batchNumber",
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Expiry Date
                      <input
                        type="date"
                        value={row.expiryDate}
                        onChange={(e) =>
                          updateRow(
                            row.key,
                            "expiryDate",
                            e.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Medication Notes
                    <textarea
                      rows={2}
                      value={row.notes}
                      onChange={(e) =>
                        updateRow(
                          row.key,
                          "notes",
                          e.target.value
                        )
                      }
                      placeholder="Additional medication details"
                    />
                  </label>
                </div>
              ))}
            </section>

            <section className="fp-card">
              <p className="fp-eyebrow">
                DEPARTMENT OF HEALTH FOLLOW-UP
              </p>
              <h2>Next Planned Date</h2>

              <label>
                Follow-up Required
                <select
                  value={followUpRequired ? "yes" : "no"}
                  onChange={(e) =>
                    setFollowUpRequired(
                      e.target.value === "yes"
                    )
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>

              {followUpRequired && (
                <div className="fp-scheduler">
                  <div className="fp-grid">
                    <label>
                      Follow-up Interval *
                      <select
                        value={interval}
                        onChange={(e) =>
                          updateInterval(e.target.value)
                        }
                      >
                        <option value="28">28 days</option>
                        <option value="56">56 days</option>
                        <option value="84">84 days</option>
                        <option value="custom">
                          Custom interval
                        </option>
                      </select>
                    </label>

                    {interval === "custom" && (
                      <label>
                        Custom Days
                        <input
                          type="number"
                          min="1"
                          max="365"
                          required
                          value={customDays}
                          onChange={(e) => {
                            setCustomDays(e.target.value);
                            setManualAdjustment(false);
                          }}
                        />
                      </label>
                    )}

                    <label>
                      Next Planned Date *
                      <input
                        type="date"
                        required
                        value={plannedDate}
                        onChange={(e) => {
                          setManualDate(e.target.value);
                          setManualAdjustment(true);
                        }}
                      />
                    </label>
                  </div>

                  <div className="fp-preview">
                    <strong>
                      Calculated date: {forecastDate || "—"}
                    </strong>
                    <p>
                      Selected interval: {days} days
                    </p>
                    {manualAdjustment && (
                      <p>
                        Nurse-adjusted date: {plannedDate}
                      </p>
                    )}
                  </div>

                  {warning && (
                    <div className="fp-alert warning">
                      <strong>Scheduling warning:</strong>{" "}
                      {warning}. Check clinic availability
                      and adjust the date if necessary.
                    </div>
                  )}

                  {manualAdjustment && (
                    <button
                      type="button"
                      className="fp-btn outline"
                      onClick={() => {
                        setManualAdjustment(false);
                        setManualDate("");
                      }}
                    >
                      Restore Calculated Date
                    </button>
                  )}

                  <p className="fp-help">
                    The date is editable for weekends and
                    South African public holidays. Standard
                    statutory holidays are checked; special
                    proclaimed holidays require confirmation.
                  </p>
                </div>
              )}
            </section>

            <section className="fp-card">
              <p className="fp-eyebrow">
                CLINICAL SAFETY
              </p>
              <h2>Clinical Review & Consent</h2>

              <label className="fp-check">
                <input
                  type="checkbox"
                  checked={allergiesReviewed}
                  onChange={(e) =>
                    setAllergiesReviewed(e.target.checked)
                  }
                />
                Allergies reviewed
              </label>

              <label className="fp-check">
                <input
                  type="checkbox"
                  checked={contraindicationsReviewed}
                  onChange={(e) =>
                    setContraindicationsReviewed(
                      e.target.checked
                    )
                  }
                />
                Contraindications reviewed
              </label>

              <label className="fp-check">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(e) =>
                    setConsentConfirmed(e.target.checked)
                  }
                />
                Patient consent confirmed
              </label>

              <label>
                Adverse Events
                <textarea
                  rows={2}
                  value={adverseEvents}
                  onChange={(e) =>
                    setAdverseEvents(e.target.value)
                  }
                  placeholder="Record findings, or 'None reported'"
                />
              </label>

              <label>
                Clinical Action
                <input
                  value={clinicalAction}
                  onChange={(e) =>
                    setClinicalAction(e.target.value)
                  }
                  placeholder="e.g. Administered, supplied, referred"
                />
              </label>

              <label>
                Clinical Notes
                <textarea
                  rows={4}
                  value={clinicalNotes}
                  onChange={(e) =>
                    setClinicalNotes(e.target.value)
                  }
                  placeholder="Counselling, observations and clinical plan"
                />
              </label>
            </section>

            <div className="fp-actions">
              <Link
                href={`/nurse/patients/${patient.id}`}
                className="fp-btn outline"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="fp-btn primary"
                disabled={
                  saving ||
                  medications.length === 0
                }
              >
                {saving
                  ? "Saving..."
                  : `Save ${rows.length} Medication${
                      rows.length === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </form>
        )}
      </div>

      <style jsx global>{`
        .fp-page {
          min-height: 100vh;
          background: #f5f8fa;
          color: #172d36;
          font-family: Inter, system-ui, Arial, sans-serif;
          padding: 30px 20px;
        }

        .fp-container {
          max-width: 1150px;
          margin: auto;
        }

        .fp-header,
        .fp-heading,
        .fp-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .fp-header {
          margin-bottom: 24px;
        }

        .fp-header h1 {
          margin: 7px 0;
          font-size: 32px;
        }

        .fp-header p,
        .fp-heading p,
        .fp-help {
          color: #647781;
        }

        .fp-eyebrow {
          color: #0e756d;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .fp-card {
          background: white;
          border: 1px solid #e3eaf0;
          border-radius: 15px;
          padding: 25px;
          margin-bottom: 20px;
        }

        .fp-card h2 {
          margin: 8px 0 17px;
          font-size: 22px;
        }

        .fp-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 17px;
        }

        .fp-page label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 700;
          color: #49626c;
        }

        .fp-page input,
        .fp-page select,
        .fp-page textarea {
          width: 100%;
          min-width: 0;
          padding: 12px;
          border: 1px solid #dbe4e9;
          border-radius: 9px;
          background: white;
          color: #172d36;
          font: inherit;
          box-sizing: border-box;
        }

        .fp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dbe4e9;
          border-radius: 9px;
          padding: 12px 18px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        .fp-btn.primary {
          background: #0e756d;
          border-color: #0e756d;
          color: white;
        }

        .fp-btn.outline {
          background: white;
          color: #35505a;
        }

        .fp-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .fp-med-row {
          padding: 20px;
          margin-top: 18px;
          background: #f7fafb;
          border: 1px solid #e3eaf0;
          border-radius: 12px;
        }

        .fp-med-row h3 {
          margin: 0 0 15px;
        }

        .fp-remove {
          background: transparent;
          border: none;
          color: #b32626;
          font-weight: 700;
          cursor: pointer;
        }

        .fp-scheduler {
          background: #f2faf8;
          border: 1px solid #d5ebe5;
          border-radius: 12px;
          padding: 20px;
          margin-top: 14px;
        }

        .fp-preview {
          background: white;
          border-radius: 10px;
          padding: 17px;
          margin-bottom: 16px;
          color: #0e756d;
        }

        .fp-preview p {
          margin-bottom: 0;
          font-size: 13px;
        }

        .fp-page label.fp-check {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 12px;
        }

        .fp-check input {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .fp-alert {
          padding: 15px;
          border-radius: 9px;
          margin-bottom: 17px;
          font-size: 13px;
        }

        .fp-alert.error {
          background: #fff0f0;
          color: #a02727;
        }

        .fp-alert.success {
          background: #e9f8f3;
          color: #08776d;
        }

        .fp-alert.warning {
          background: #fff4dc;
          color: #8b6100;
        }

        .fp-actions {
          margin: 25px 0;
        }

        .fp-help {
          font-size: 12px;
          line-height: 1.6;
        }

        @media (max-width: 650px) {
          .fp-grid {
            grid-template-columns: 1fr;
          }

          .fp-page {
            padding: 18px 12px;
          }

          .fp-card {
            padding: 17px;
          }

          .fp-header h1 {
            font-size: 26px;
          }
        }
      `}</style>
    </main>
  );
}
