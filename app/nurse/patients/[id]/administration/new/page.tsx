
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  quantity: string;
  notes: string;
};

function localToday() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date: string, days: number) {
  if (!date) return "";

  const result = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(result.getTime())) return "";

  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function weekendName(date: string) {
  if (!date) return "";

  const day = new Date(`${date}T12:00:00Z`).getUTCDay();

  if (day === 0) return "Sunday";
  if (day === 6) return "Saturday";

  return "";
}

function newMedicationRow(): MedicationRow {
  return {
    key: crypto.randomUUID(),
    medicationId: "",
    quantity: "1",
    notes: "",
  };
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
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
    newMedicationRow(),
  ]);

  const [administrationDate, setAdministrationDate] =
    useState(localToday());

  const [interval, setInterval] = useState("56");
  const [customDays, setCustomDays] = useState("42");
  const [nextPlannedDate, setNextPlannedDate] = useState("");
  const [dateAdjusted, setDateAdjusted] = useState(false);
  const [followUpRequired, setFollowUpRequired] = useState(true);
  const [clinicalNotes, setClinicalNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const intervalDays =
    interval === "custom" ? Number(customDays) : Number(interval);

  const intervalValid =
    Number.isInteger(intervalDays) &&
    intervalDays >= 1 &&
    intervalDays <= 365;

  const calculatedDate = useMemo(
    () =>
      intervalValid
        ? addDays(administrationDate, intervalDays)
        : "",
    [administrationDate, intervalDays, intervalValid]
  );

  useEffect(() => {
    if (!dateAdjusted) {
      setNextPlannedDate(calculatedDate);
    }
  }, [calculatedDate, dateAdjusted]);

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

        const { data: patientData, error: patientError } =
          await supabase
            .from("patients")
            .select(
              "id,site_id,first_name,surname,id_number,passport_number"
            )
            .eq("id", patientId)
            .single();

        if (patientError) throw patientError;

        if (!patientData?.site_id) {
          throw new Error("Patient has no assigned clinic.");
        }

        const [membership, nurseAssignment] = await Promise.all([
          supabase
            .from("fp_memberships")
            .select("facility_id")
            .eq("user_id", auth.user.id)
            .eq("facility_id", patientData.site_id)
            .eq("active", true)
            .limit(1),

          supabase
            .from("nurse_site_assignments")
            .select("site_id")
            .eq("nurse_id", auth.user.id)
            .eq("site_id", patientData.site_id)
            .limit(1),
        ]);

        if (membership.error) throw membership.error;
        if (nurseAssignment.error) throw nurseAssignment.error;

        if (
          !(membership.data?.length || nurseAssignment.data?.length)
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

        // Catalogue naming may differ between installations.
        const normalized = (catalogue || [])
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
          setPatient(patientData as Patient);
          setMedications(normalized);
        }
      } catch (err) {
        if (!cancelled) setError(messageOf(err));
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
    field: "medicationId" | "quantity" | "notes",
    value: string
  ) {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row
      )
    );
  }

  function addMedication() {
    setRows((current) => [...current, newMedicationRow()]);
  }

  function removeMedication(key: string) {
    setRows((current) =>
      current.length === 1
        ? current
        : current.filter((row) => row.key !== key)
    );
  }

  function chooseInterval(value: string) {
    setInterval(value);
    setDateAdjusted(false);
  }

  function changeAdministrationDate(value: string) {
    setAdministrationDate(value);
    setDateAdjusted(false);
  }

  function changePlannedDate(value: string) {
    setNextPlannedDate(value);
    setDateAdjusted(true);
  }

  const weekend = followUpRequired
    ? weekendName(nextPlannedDate)
    : "";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!patient) {
      setError("Patient record has not loaded.");
      return;
    }

    if (!administrationDate) {
      setError("Enter the administration date.");
      return;
    }

    if (!rows.length || rows.some((row) => !row.medicationId)) {
      setError("Select a medication in every row.");
      return;
    }

    if (
      rows.some(
        (row) =>
          !Number.isFinite(Number(row.quantity)) ||
          Number(row.quantity) <= 0
      )
    ) {
      setError("Enter a valid quantity for every medication.");
      return;
    }

    if (
      followUpRequired &&
      (!intervalValid || !nextPlannedDate)
    ) {
      setError("Select a valid follow-up interval and date.");
      return;
    }

    if (
      followUpRequired &&
      nextPlannedDate < administrationDate
    ) {
      setError(
        "The next planned date cannot precede the administration date."
      );
      return;
    }

    const duplicateIds = rows
      .map((row) => row.medicationId)
      .filter((id, index, all) => all.indexOf(id) !== index);

    if (duplicateIds.length) {
      setError(
        "The same medication is selected more than once. Combine quantities into one row."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Session expired. Please sign in again.");
      }

      /*
       * IMPORTANT:
       * This payload assumes the following columns exist:
       *
       * patient_id, site_id, medication_id, quantity,
       * administered_at, next_dose_date, notes
       *
       * Confirm the actual medication_administrations schema
       * before enabling this insert in production.
       *
       * Each medication becomes a separate administration record.
       * No existing records are updated or deleted.
       */

      const payload = rows.map((row) => {
        const medication = medications.find(
          (item) => item.id === row.medicationId
        );

        return {
          patient_id: patient.id,
          site_id: patient.site_id,
          medication_id: row.medicationId,
          quantity: Number(row.quantity),
          administered_at: `${administrationDate}T12:00:00`,
          next_dose_date: followUpRequired
            ? nextPlannedDate
            : null,
          notes: [
            clinicalNotes.trim(),
            medication?.name
              ? `Medication: ${medication.name}`
              : "",
            row.notes.trim(),
            followUpRequired
              ? `Planned interval: ${intervalDays} days`
              : "No follow-up required",
            dateAdjusted
              ? `Next planned date manually adjusted from ${calculatedDate}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        };
      });

      const { error: insertError } = await supabase
        .from("medication_administrations")
        .insert(payload);

      if (insertError) throw insertError;

      setSuccess(
        `${rows.length} medication administration record(s) saved.`
      );

      setTimeout(() => {
        router.push(`/nurse/patients/${patient.id}`);
        router.refresh();
      }, 900);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="fp-page">
      <div className="fp-container">
        <header className="fp-header">
          <div>
            <p className="fp-eyebrow">DOSETRACK · FAMILY PLANNING</p>
            <h1>Medication Administration</h1>
            <p>
              Record multiple contraceptive products and plan
              the next follow-up.
            </p>
          </div>

          <Link
            href={`/nurse/patients/${patientId}`}
            className="fp-button secondary"
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
            Patient information could not be loaded.
          </section>
        ) : (
          <form onSubmit={save}>
            <section className="fp-card">
              <p className="fp-eyebrow">PATIENT INFORMATION</p>
              <h2>
                {[patient.first_name, patient.surname]
                  .filter(Boolean)
                  .join(" ")}
              </h2>
              <p>
                {patient.id_number ||
                  patient.passport_number ||
                  "No ID/passport recorded"}
              </p>
            </section>

            <section className="fp-card">
              <div className="fp-section-heading">
                <div>
                  <p className="fp-eyebrow">
                    MEDICATIONS ADMINISTERED
                  </p>
                  <h2>Medication Selection</h2>
                  <p>
                    Add all medications and contraceptive supplies
                    provided during this encounter.
                  </p>
                </div>

                <button
                  type="button"
                  className="fp-button secondary"
                  onClick={addMedication}
                >
                  + Add Medication
                </button>
              </div>

              {medications.length === 0 && (
                <div className="fp-alert warning">
                  No medications found in the catalogue.
                  Check the medication table and naming fields.
                </div>
              )}

              {rows.map((row, index) => (
                <div className="fp-medication-row" key={row.key}>
                  <div className="fp-medication-heading">
                    <strong>Medication {index + 1}</strong>

                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="fp-remove"
                        onClick={() => removeMedication(row.key)}
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
                        <option value="">Select medication</option>
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
                      Quantity *
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={row.quantity}
                        onChange={(e) =>
                          updateRow(
                            row.key,
                            "quantity",
                            e.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Medication Notes
                    <input
                      value={row.notes}
                      onChange={(e) =>
                        updateRow(
                          row.key,
                          "notes",
                          e.target.value
                        )
                      }
                      placeholder="Dose, route, batch or other details"
                    />
                  </label>
                </div>
              ))}
            </section>

            <section className="fp-card">
              <p className="fp-eyebrow">ADMINISTRATION DETAILS</p>
              <h2>Administration & Next Planned Date</h2>

              <div className="fp-grid">
                <label>
                  Date Administered *
                  <input
                    type="date"
                    required
                    value={administrationDate}
                    onChange={(e) =>
                      changeAdministrationDate(e.target.value)
                    }
                  />
                </label>

                <label>
                  Follow-up Required
                  <select
                    value={followUpRequired ? "yes" : "no"}
                    onChange={(e) =>
                      setFollowUpRequired(e.target.value === "yes")
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>

              {followUpRequired && (
                <>
                  <div className="fp-scheduler">
                    <label>
                      Next Planned Interval *
                      <select
                        value={interval}
                        onChange={(e) =>
                          chooseInterval(e.target.value)
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
                        Custom Days *
                        <input
                          type="number"
                          min="1"
                          max="365"
                          required
                          value={customDays}
                          onChange={(e) => {
                            setCustomDays(e.target.value);
                            setDateAdjusted(false);
                          }}
                        />
                      </label>
                    )}

                    <label>
                      Next Planned Date *
                      <input
                        type="date"
                        required
                        value={nextPlannedDate}
                        onChange={(e) =>
                          changePlannedDate(e.target.value)
                        }
                      />
                    </label>

                    <p className="fp-help">
                      Forecast: {calculatedDate || "—"}. The nurse
                      can edit the planned date without changing
                      the selected interval.
                    </p>

                    {dateAdjusted && (
                      <div className="fp-alert info">
                        Planned date manually adjusted from{" "}
                        {calculatedDate}.
                        <button
                          type="button"
                          className="fp-inline-button"
                          onClick={() => {
                            setDateAdjusted(false);
                            setNextPlannedDate(calculatedDate);
                          }}
                        >
                          Restore calculated date
                        </button>
                      </div>
                    )}

                    {weekend && (
                      <div className="fp-alert warning">
                        The selected date falls on a {weekend}.
                        Please confirm clinic availability or choose
                        another date.
                      </div>
                    )}

                    <p className="fp-help">
                      Check South African public holidays before
                      confirming. Public holiday validation is not
                      yet connected to a holiday calendar.
                    </p>
                  </div>
                </>
              )}

              <label>
                General Clinical Notes
                <textarea
                  rows={4}
                  value={clinicalNotes}
                  onChange={(e) =>
                    setClinicalNotes(e.target.value)
                  }
                  placeholder="Clinical observations, counselling and follow-up instructions"
                />
              </label>
            </section>

            <div className="fp-footer-actions">
              <Link
                href={`/nurse/patients/${patient.id}`}
                className="fp-button secondary"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="fp-button primary"
                disabled={
                  saving ||
                  medications.length === 0
                }
              >
                {saving
                  ? "Saving Administration..."
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
          max-width: 1120px;
          margin: auto;
        }

        .fp-header,
        .fp-section-heading,
        .fp-medication-heading,
        .fp-footer-actions {
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
          font-size: 31px;
        }

        .fp-header p,
        .fp-section-heading p,
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
          margin: 8px 0 16px;
        }

        .fp-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
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
          padding: 12px;
          border: 1px solid #dbe4e9;
          border-radius: 9px;
          background: white;
          color: #172d36;
          font: inherit;
          box-sizing: border-box;
        }

        .fp-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          padding: 12px 18px;
          border-radius: 9px;
          border: 1px solid #dbe4e9;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        .fp-button.primary {
          background: #0e756d;
          color: white;
          border-color: #0e756d;
        }

        .fp-button.secondary {
          background: white;
          color: #35505a;
        }

        .fp-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .fp-medication-row {
          padding: 19px;
          background: #f7fafb;
          border: 1px solid #e3eaf0;
          border-radius: 12px;
          margin-top: 16px;
        }

        .fp-medication-heading {
          margin-bottom: 15px;
        }

        .fp-remove {
          background: transparent;
          color: #b32626;
          border: none;
          font-weight: 700;
          cursor: pointer;
        }

        .fp-scheduler {
          padding: 20px;
          background: #f2faf8;
          border: 1px solid #d5ebe5;
          border-radius: 12px;
          margin: 12px 0 22px;
        }

        .fp-alert {
          border-radius: 9px;
          padding: 14px;
          margin-bottom: 16px;
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

        .fp-alert.info {
          background: #e9f2fb;
          color: #255f92;
        }

        .fp-inline-button {
          margin-left: 12px;
          border: none;
          background: transparent;
          color: inherit;
          font-weight: 800;
          text-decoration: underline;
          cursor: pointer;
        }

        .fp-help {
          font-size: 12px;
          line-height: 1.6;
        }

        .fp-footer-actions {
          margin: 25px 0;
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
