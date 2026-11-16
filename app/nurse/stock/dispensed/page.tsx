
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Clinic = {
  id: string;
  site_name: string;
};

type Medication = {
  id: string;
  name: string;
  unit: string | null;
};

type StockBatch = {
  id: string;
  facility_id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string;
  quantity_on_hand: number;
};

type DispenseItem = {
  key: string;
  medicationId: string;
  batchId: string;
  quantity: string;
  notes: string;
};

function createItem(): DispenseItem {
  return {
    key: crypto.randomUUID(),
    medicationId: "",
    batchId: "",
    quantity: "",
    notes: "",
  };
}

function today(): string {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";

  const parts = value.split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

export default function DispensedPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [medications, setMedications] =
    useState<Medication[]>([]);
  const [batches, setBatches] =
    useState<StockBatch[]>([]);

  const [clinicId, setClinicId] = useState("");
  const [dispensedDate, setDispensedDate] =
    useState(today());

  const [referenceNumber, setReferenceNumber] =
    useState("");
  const [patientReference, setPatientReference] =
    useState("");
  const [generalNotes, setGeneralNotes] =
    useState("");

  const [items, setItems] = useState<DispenseItem[]>([
    createItem(),
  ]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error(
          "Please sign in to access stock dispensing."
        );
      }

      const [
        assignmentsResult,
        clinicsResult,
        medicationsResult,
        batchesResult,
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
          .select("id,name,unit")
          .eq("active", true)
          .order("name"),

        supabase
          .from("fp_stock_batches")
          .select(`
            id,
            facility_id,
            product_id,
            batch_number,
            expiry_date,
            quantity_on_hand
          `)
          .gt("quantity_on_hand", 0)
          .order("expiry_date", {
            ascending: true,
          }),
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

      if (batchesResult.error) {
        throw batchesResult.error;
      }

      const assignedIds = new Set(
        (assignmentsResult.data || []).map(
          (assignment) => assignment.site_id
        )
      );

      const authorisedClinics = (
        clinicsResult.data || []
      ).filter((clinic) =>
        assignedIds.has(clinic.id)
      );

      setClinics(authorisedClinics);

      // FIX:
      // Load all active medications independently
      // of clinic stock quantities.
      setMedications(medicationsResult.data || []);

      const allowedClinicIds = new Set(
        authorisedClinics.map((clinic) => clinic.id)
      );

      setBatches(
        (batchesResult.data || []).filter(
          (batch) =>
            allowedClinicIds.has(batch.facility_id)
        )
      );

      setClinicId((previous) => {
        if (
          previous &&
          allowedClinicIds.has(previous)
        ) {
          return previous;
        }

        return authorisedClinics.length === 1
          ? authorisedClinics[0].id
          : "";
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const clinicBatches = useMemo(
    () =>
      batches.filter(
        (batch) =>
          batch.facility_id === clinicId &&
          batch.quantity_on_hand > 0
      ),
    [batches, clinicId]
  );

  // UPDATED:
  // Show all active medications, not only
  // medications with positive stock.
  const availableMedications = useMemo(() => {
    return [...medications].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [medications]);

  const totalUnits = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (Number(item.quantity) || 0),
        0
      ),
    [items]
  );

  function updateItem(
    key: string,
    field: keyof Omit<DispenseItem, "key">,
    value: string
  ) {
    setItems((previous) =>
      previous.map((item) => {
        if (item.key !== key) return item;

        if (field === "medicationId") {
          return {
            ...item,
            medicationId: value,
            batchId: "",
            quantity: "",
          };
        }

        if (field === "batchId") {
          return {
            ...item,
            batchId: value,
            quantity: "",
          };
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  function addMedication() {
    setItems((previous) => [
      ...previous,
      createItem(),
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

  function changeClinic(value: string) {
    setClinicId(value);
    setItems([createItem()]);
    setError("");
    setSuccess("");
  }

  function refreshStock() {
    setRefreshing(true);
    void loadData();
  }

  async function validateDispensing() {
    setError("");
    setSuccess("");

    if (!clinicId) {
      setError("Please select your clinic.");
      return;
    }

    if (
      !clinics.some(
        (clinic) => clinic.id === clinicId
      )
    ) {
      setError(
        "You are not authorised for this clinic."
      );
      return;
    }

    if (!dispensedDate) {
      setError("Select the dispensing date.");
      return;
    }

    if (dispensedDate > today()) {
      setError(
        "Dispensing date cannot be in the future."
      );
      return;
    }

    const requestedByBatch = new Map<
      string,
      number
    >();

    for (const item of items) {
      if (
        !item.medicationId ||
        !item.batchId
      ) {
        setError(
          "Select a medication and stock batch for every item."
        );
        return;
      }

      const quantity = Number(item.quantity);

      if (
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        setError(
          "Enter a valid whole-number quantity for every item."
        );
        return;
      }

      const batch = clinicBatches.find(
        (candidate) =>
          candidate.id === item.batchId &&
          candidate.product_id ===
            item.medicationId
      );

      if (!batch) {
        setError(
          "A selected batch is unavailable or does not match the medication."
        );
        return;
      }

      if (batch.expiry_date < dispensedDate) {
        setError(
          `Batch ${batch.batch_number} is expired on the selected dispensing date.`
        );
        return;
      }

      requestedByBatch.set(
        batch.id,
        (requestedByBatch.get(batch.id) || 0) +
          quantity
      );
    }

    for (const [
      batchId,
      requestedQuantity,
    ] of requestedByBatch) {
      const batch = clinicBatches.find(
        (candidate) => candidate.id === batchId
      );

      if (
        !batch ||
        requestedQuantity >
          batch.quantity_on_hand
      ) {
        setError(
          `Insufficient stock for batch ${
            batch?.batch_number || batchId
          }. Available: ${
            batch?.quantity_on_hand || 0
          }, requested: ${requestedQuantity}.`
        );
        return;
      }
    }

    setSaving(true);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error(
          "Your session has expired."
        );
      }

      const dispensingRecord = {
        clinicId,
        dispensedDate,
        referenceNumber,
        patientReference,
        generalNotes,
        dispensedBy: auth.user.id,
        items: items.map((item) => ({
          productId: item.medicationId,
          batchId: item.batchId,
          quantity: Number(item.quantity),
          notes: item.notes.trim(),
        })),
      };

      /*
       * DATABASE INTEGRATION
       *
       * Actual dispensing must be performed
       * by a secure Supabase RPC function.
       *
       * The function must:
       *
       * 1. Verify nurse clinic access.
       * 2. Lock selected stock batches.
       * 3. Prevent expired stock dispensing.
       * 4. Prevent negative stock balances.
       * 5. Deduct stock from each batch.
       * 6. Write fp_stock_batch_movements.
       * 7. Roll back all items on failure.
       *
       * Do not directly update stock
       * balances from the browser.
       */

      console.info(
        "Validated dispensing record:",
        dispensingRecord
      );

      setSuccess(
        "Dispensing details validated. Database saving is not yet enabled."
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

            <h1>Stock Dispensed</h1>

            <p>
              Record medications issued from
              clinic stock using existing
              inventory batches.
            </p>
          </div>

          <div className="dt-header-actions">
            <button
              type="button"
              className="dt-button secondary"
              onClick={refreshStock}
              disabled={refreshing || loading}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh Stock"}
            </button>

            <Link
              href="/nurse/dashboard"
              className="dt-button secondary"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div
            className="dt-alert error"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="dt-alert success"
            role="status"
          >
            {success}
          </div>
        )}

        {loading ? (
          <section className="dt-card">
            Loading available clinic stock...
          </section>
        ) : (
          <>
            <section className="dt-card">
              <h2>Dispensing Information</h2>

              <div className="dt-grid">
                <label>
                  Clinic *
                  <select
                    value={clinicId}
                    onChange={(e) =>
                      changeClinic(e.target.value)
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
                  Date Dispensed *
                  <input
                    type="date"
                    value={dispensedDate}
                    max={today()}
                    onChange={(e) =>
                      setDispensedDate(
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Dispensing Reference
                  <input
                    value={referenceNumber}
                    onChange={(e) =>
                      setReferenceNumber(
                        e.target.value
                      )
                    }
                    placeholder="Dispensing reference"
                  />
                </label>

                <label>
                  Patient Reference
                  <input
                    value={patientReference}
                    onChange={(e) =>
                      setPatientReference(
                        e.target.value
                      )
                    }
                    placeholder="Patient or clinical record reference"
                  />
                </label>
              </div>
            </section>

            <section className="dt-card">
              <div className="dt-heading">
                <div>
                  <h2>Medications Dispensed</h2>
                  <p>
                    Select one or more medications
                    and their existing stock batches.
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
                    (candidate) =>
                      candidate.id ===
                      item.medicationId
                  );

                const medicationBatches =
                  clinicBatches.filter(
                    (batch) =>
                      batch.product_id ===
                      item.medicationId
                  );

                const selectedBatch =
                  medicationBatches.find(
                    (batch) =>
                      batch.id === item.batchId
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
                            removeMedication(
                              item.key
                            )
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
                          disabled={!clinicId}
                        >
                          <option value="">
                            {!clinicId
                              ? "Select clinic first"
                              : availableMedications.length === 0
                              ? "No medications available"
                              : "Select medication"}
                          </option>

                          {availableMedications.map(
                            (med) => (
                              <option
                                key={med.id}
                                value={med.id}
                              >
                                {med.name}
                                {med.unit
                                  ? ` (${med.unit})`
                                  : ""}
                              </option>
                            )
                          )}
                        </select>

                        {clinicId &&
                          availableMedications.length === 0 && (
                            <small
                              style={{
                                color: "#b42318",
                              }}
                            >
                              No medications returned
                              from the stock catalogue.
                              Check Supabase access.
                            </small>
                          )}
                      </label>

                      <label>
                        Stock Batch *
                        <select
                          value={item.batchId}
                          disabled={
                            !item.medicationId
                          }
                          onChange={(e) =>
                            updateItem(
                              item.key,
                              "batchId",
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            {!item.medicationId
                              ? "Select medication first"
                              : medicationBatches.length === 0
                              ? "No stock available at this clinic"
                              : "Select available batch"}
                          </option>

                          {medicationBatches.map(
                            (batch) => (
                              <option
                                key={batch.id}
                                value={batch.id}
                              >
                                {batch.batch_number}
                                {" | Exp: "}
                                {formatDate(
                                  batch.expiry_date
                                )}
                                {" | Available: "}
                                {
                                  batch.quantity_on_hand
                                }
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      <label>
                        Quantity Dispensed *
                        <input
                          type="number"
                          min="1"
                          step="1"
                          max={
                            selectedBatch
                              ?.quantity_on_hand
                          }
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              item.key,
                              "quantity",
                              e.target.value
                            )
                          }
                          placeholder="Enter quantity"
                        />

                        {medication && (
                          <small>
                            Unit:{" "}
                            {medication.unit ||
                              "units"}
                          </small>
                        )}
                      </label>

                      <label>
                        Available Stock
                        <input
                          readOnly
                          value={
                            selectedBatch
                              ? `${selectedBatch.quantity_on_hand} ${
                                  medication?.unit ||
                                  "units"
                                }`
                              : ""
                          }
                          placeholder="Select a batch"
                        />
                      </label>

                      <label>
                        Batch Number
                        <input
                          readOnly
                          value={
                            selectedBatch
                              ?.batch_number || ""
                          }
                        />
                      </label>

                      <label>
                        Expiry Date
                        <input
                          readOnly
                          value={
                            selectedBatch
                              ? formatDate(
                                  selectedBatch.expiry_date
                                )
                              : ""
                          }
                        />
                      </label>

                      <label className="dt-full">
                        Item Notes
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
                          placeholder="Optional dispensing notes"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="dt-card">
              <h2>Dispensing Summary</h2>

              <div className="dt-summary">
                <div>
                  <span>Medication Lines</span>
                  <strong>{items.length}</strong>
                </div>

                <div>
                  <span>Total Units Dispensed</span>
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
                  placeholder="Additional clinical or stock notes"
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
                onClick={validateDispensing}
                disabled={
                  saving ||
                  !clinicId ||
                  items.length === 0
                }
              >
                {saving
                  ? "Processing..."
                  : "Validate Dispensing"}
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
        .dt-header-actions,
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

        .dt-full {
          grid-column: 1 / -1;
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

        .dt-page input[readonly] {
          background: #f1f5f9;
          color: #475569;
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

          .dt-full {
            grid-column: auto;
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
