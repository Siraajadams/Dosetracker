
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Clinic = {
  id: string;
  site_name: string;
};

type Medication = {
  id: string;
  name: string;
  unit: string;
};

type WasteItem = {
  key: string;
  medicationId: string;
  quantity: string;
  batchNumber: string;
  expiryDate: string;
  reason: string;
  notes: string;
};

const WASTE_REASONS = [
  "Expired medication",
  "Damaged stock",
  "Broken vial or ampoule",
  "Cold chain failure",
  "Contaminated medication",
  "Spillage",
  "Incorrect storage",
  "Other",
];

function newItem(): WasteItem {
  return {
    key: crypto.randomUUID(),
    medicationId: "",
    quantity: "",
    batchNumber: "",
    expiryDate: "",
    reason: "",
    notes: "",
  };
}

function today() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function errorText(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(error.message);
  }

  return String(error);
}

export default function WastedPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [medications, setMedications] =
    useState<Medication[]>([]);

  const [clinicId, setClinicId] = useState("");
  const [wasteDate, setWasteDate] = useState(today());
  const [referenceNumber, setReferenceNumber] =
    useState("");
  const [generalNotes, setGeneralNotes] =
    useState("");

  const [items, setItems] = useState<WasteItem[]>([
    newItem(),
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          throw new Error(
            "Please log in to access stock management."
          );
        }

        const [
          assignmentsResult,
          clinicsResult,
          medicationsResult,
        ] = await Promise.all([
          supabase
            .from("nurse_site_assignments")
            .select("site_id")
            .eq("nurse_id", auth.user.id),

          supabase
            .from("sites")
            .select("id,site_name")
            .eq("is_active", true)
            .order("site_name"),

          supabase
            .from("fp_stock_products")
            .select("id,name,unit,active")
            .eq("active", true)
            .order("name"),
        ]);

        if (assignmentsResult.error) {
          throw assignmentsResult.error;
        }

        if (clinicsResult.error) {
          throw clinicsResult.error;
        }

        if (medicationsResult.error) {
          throw medicationsResult.error;
        }

        const assignedIds = new Set(
          (assignmentsResult.data || []).map(
            (item) => item.site_id
          )
        );

        const authorisedClinics = (
          clinicsResult.data || []
        ).filter((clinic) =>
          assignedIds.has(clinic.id)
        );

        if (!cancelled) {
          setClinics(authorisedClinics);

          setMedications(
            (medicationsResult.data || []).map(
              (item) => ({
                id: item.id,
                name: item.name,
                unit: item.unit || "units",
              })
            )
          );

          if (authorisedClinics.length === 1) {
            setClinicId(authorisedClinics[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorText(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateItem(
    key: string,
    field: keyof Omit<WasteItem, "key">,
    value: string
  ) {
    setItems((previous) =>
      previous.map((item) =>
        item.key === key
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function addMedication() {
    setItems((previous) => [
      ...previous,
      newItem(),
    ]);
  }

  function removeMedication(key: string) {
    setItems((previous) =>
      previous.length > 1
        ? previous.filter(
            (item) => item.key !== key
          )
        : previous
    );
  }

  const totalUnits = items.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0),
    0
  );

  async function validateWastage() {
    setError("");
    setSuccess("");

    if (!clinicId) {
      setError("Select the clinic.");
      return;
    }

    if (!wasteDate) {
      setError("Select the wastage date.");
      return;
    }

    if (
      items.some(
        (item) =>
          !item.medicationId ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) <= 0 ||
          !item.batchNumber.trim() ||
          !item.reason
      )
    ) {
      setError(
        "Every item requires a medication, valid quantity, batch number and wastage reason."
      );
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error(
          "Your session has expired."
        );
      }

      if (!clinics.some((clinic) => clinic.id === clinicId)) {
        throw new Error(
          "You are not authorised to record wastage for this clinic."
        );
      }

      const wasteRecord = {
        clinicId,
        wasteDate,
        referenceNumber,
        generalNotes,
        recordedBy: auth.user.id,
        items: items.map((item) => ({
          medicationId: item.medicationId,
          quantity: Number(item.quantity),
          batchNumber: item.batchNumber.trim(),
          expiryDate: item.expiryDate || null,
          reason: item.reason,
          notes: item.notes.trim(),
        })),
      };

      /*
       * Database integration pending:
       *
       * The final save operation should use
       * a secure Supabase RPC transaction.
       *
       * It must:
       * - Check available stock per batch.
       * - Prevent negative stock.
       * - Decrease quantity_on_hand.
       * - Insert wastage audit movements.
       * - Verify nurse clinic access.
       * - Roll back all items if any fail.
       *
       * Do not update batch balances directly
       * from the browser.
       */

      console.info(
        "Validated stock wastage:",
        wasteRecord
      );

      setSuccess(
        "Wastage details validated. Database saving is not yet enabled."
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dt-page">
      <div className="dt-container">
        <header className="dt-header">
          <div>
            <p className="dt-eyebrow">
              DOSETRACK / STOCK MANAGEMENT
            </p>

            <h1>Stock Wasted</h1>

            <p>
              Record medication wastage and
              maintain batch-level accountability.
            </p>
          </div>

          <Link
            href="/nurse/dashboard"
            className="dt-button secondary"
          >
            Back to Dashboard
          </Link>
        </header>

        {error && (
          <div className="dt-alert error">
            {error}
          </div>
        )}

        {success && (
          <div className="dt-alert success">
            {success}
          </div>
        )}

        {loading ? (
          <section className="dt-card">
            Loading stock information...
          </section>
        ) : (
          <>
            <section className="dt-card">
              <h2>Wastage Information</h2>

              <div className="dt-grid">
                <label>
                  Clinic *
                  <select
                    value={clinicId}
                    onChange={(e) =>
                      setClinicId(e.target.value)
                    }
                  >
                    <option value="">
                      Select clinic
                    </option>

                    {clinics.map((clinic) => (
                      <option
                        key={clinic.id}
                        value={clinic.id}
                      >
                        {clinic.site_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Wastage Date *
                  <input
                    type="date"
                    value={wasteDate}
                    onChange={(e) =>
                      setWasteDate(e.target.value)
                    }
                  />
                </label>

                <label>
                  Reference Number
                  <input
                    value={referenceNumber}
                    onChange={(e) =>
                      setReferenceNumber(
                        e.target.value
                      )
                    }
                    placeholder="Incident or wastage reference"
                  />
                </label>
              </div>
            </section>

            <section className="dt-card">
              <div className="dt-heading">
                <div>
                  <h2>Medications Wasted</h2>
                  <p>
                    Record multiple medications
                    in one wastage report.
                  </p>
                </div>

                <button
                  type="button"
                  className="dt-button secondary"
                  onClick={addMedication}
                >
                  + Add Medication
                </button>
              </div>

              {items.map((item, index) => {
                const medication =
                  medications.find(
                    (m) =>
                      m.id === item.medicationId
                  );

                return (
                  <div
                    key={item.key}
                    className="dt-medication"
                  >
                    <div className="dt-heading">
                      <h3>
                        Medication {index + 1}
                      </h3>

                      {items.length > 1 && (
                        <button
                          type="button"
                          className="dt-remove"
                          onClick={() =>
                            removeMedication(item.key)
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="dt-grid">
                      <label>
                        Medication *
                        <select
                          value={item.medicationId}
                          onChange={(e) =>
                            updateItem(
                              item.key,
                              "medicationId",
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            Select medication
                          </option>

                          {medications.map((med) => (
                            <option
                              key={med.id}
                              value={med.id}
                            >
                              {med.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Quantity Wasted *
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              item.key,
                              "quantity",
                              e.target.value
                            )
                          }
                        />
                        {medication && (
                          <small>
                            Unit: {medication.unit}
                          </small>
                        )}
                      </label>

                      <label>
                        Batch Number *
                        <input
                          value={item.batchNumber}
                          onChange={(e) =>
                            updateItem(
                              item.key,
                              "batchNumber",
                              e.target.value
                            )
                          }
                          placeholder="Enter batch number"
                        />
                      </label>

                      <label>
                        Expiry Date
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) =>
                            updateItem(
                              item.key,
                              "expiryDate",
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        Reason for Wastage *
                        <select
                          value={item.reason}
                          onChange={(e) =>
                            updateItem(
                              item.key,
                              "reason",
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            Select reason
                          </option>

                          {WASTE_REASONS.map(
                            (reason) => (
                              <option
                                key={reason}
                                value={reason}
                              >
                                {reason}
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      <label>
                        Additional Notes
                        <textarea
                          rows={2}
                          value={item.notes}
                          onChange={(e) =>
                            updateItem(
                              item.key,
                              "notes",
                              e.target.value
                            )
                          }
                          placeholder="Additional details"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="dt-card">
              <h2>Wastage Summary</h2>

              <div className="dt-summary">
                <div>
                  <span>Medication Lines</span>
                  <strong>{items.length}</strong>
                </div>

                <div>
                  <span>Total Units Wasted</span>
                  <strong>{totalUnits}</strong>
                </div>
              </div>

              <label>
                General Notes
                <textarea
                  rows={3}
                  value={generalNotes}
                  onChange={(e) =>
                    setGeneralNotes(e.target.value)
                  }
                  placeholder="Incident details, corrective actions or other observations"
                />
              </label>
            </section>

            <div className="dt-actions">
              <Link
                href="/nurse/dashboard"
                className="dt-button secondary"
              >
                Cancel
              </Link>

              <button
                type="button"
                className="dt-button primary"
                onClick={validateWastage}
                disabled={saving}
              >
                {saving
                  ? "Processing..."
                  : "Validate Wastage"}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .dt-page {
          min-height: 100vh;
          background: #f4f8fa;
          color: #17333b;
          font-family: Arial, sans-serif;
          padding: 28px 18px;
        }

        .dt-container {
          max-width: 1120px;
          margin: auto;
        }

        .dt-header,
        .dt-heading,
        .dt-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .dt-header {
          margin-bottom: 24px;
        }

        .dt-header h1 {
          margin: 6px 0;
          font-size: 30px;
        }

        .dt-eyebrow {
          font-size: 11px;
          letter-spacing: 1.3px;
          color: #0f766e;
          font-weight: 800;
        }

        .dt-card {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 14px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .dt-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .dt-page label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 700;
        }

        .dt-page input,
        .dt-page select,
        .dt-page textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #d8e2e8;
          border-radius: 8px;
          font: inherit;
          background: white;
          color: #17333b;
        }

        .dt-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 18px;
          border-radius: 9px;
          border: 1px solid #d8e2e8;
          font-weight: 700;
          font-size: 13px;
          text-decoration: none;
          cursor: pointer;
        }

        .dt-button.primary {
          background: #0f766e;
          color: white;
          border-color: #0f766e;
        }

        .dt-button.secondary {
          background: white;
          color: #35505a;
        }

        .dt-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dt-medication {
          background: #f7fafb;
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 18px;
          margin-top: 16px;
        }

        .dt-remove {
          color: #b42318;
          background: none;
          border: none;
          font-weight: 700;
          cursor: pointer;
        }

        .dt-summary {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin: 18px 0;
        }

        .dt-summary > div {
          background: #f1f8f7;
          border-radius: 10px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .dt-summary strong {
          font-size: 25px;
          color: #0f766e;
        }

        .dt-alert {
          padding: 14px;
          border-radius: 9px;
          margin-bottom: 16px;
        }

        .dt-alert.error {
          background: #fff0f0;
          color: #a02727;
        }

        .dt-alert.success {
          background: #e9f8f3;
          color: #08776d;
        }

        .dt-actions {
          margin: 24px 0;
        }

        @media (max-width: 650px) {
          .dt-grid {
            grid-template-columns: 1fr;
          }

          .dt-page {
            padding: 16px 12px;
          }

          .dt-card {
            padding: 17px;
          }
        }
      `}</style>
    </main>
  );
}
