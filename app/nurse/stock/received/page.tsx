
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAssignedPharmacies, getProducts, recordStockBatch } from "@/lib/fpStock";

type Clinic = {
  id: string;
  site_name: string;
};

type Medication = {
  id: string;
  name: string;
};

type ReceiptItem = {
  key: string;
  medicationId: string;
  quantity: string;
  batchNumber: string;
  expiryDate: string;
};

type ReceiptSource = "depot" | "transfer";

function newItem(): ReceiptItem {
  return {
    key: Math.random().toString(36).slice(2),
    medicationId: "",
    quantity: "",
    batchNumber: "",
    expiryDate: "",
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

function errorText(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(error.message);
  }

  return String(error);
}

export default function ReceivedPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);

  const [destinationClinic, setDestinationClinic] =
    useState("");
  const [sourceType, setSourceType] =
    useState<ReceiptSource>("depot");
  const [sourceClinic, setSourceClinic] = useState("");

  const [referenceNumber, setReferenceNumber] =
    useState("");
  const [receivedDate, setReceivedDate] =
    useState(today());
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<ReceiptItem[]>([
    newItem(),
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          throw new Error(
            "Please sign in to access stock receiving."
          );
        }

        const [assignedClinics, stockProducts] = await Promise.all([
          getAssignedPharmacies(),
          getProducts(),
        ]);

        if (!cancelled) {
          setClinics(assignedClinics.map((clinic) => ({
            id: clinic.id,
            site_name: clinic.name,
          })));
          setMedications(stockProducts.map((product) => ({
            id: product.id,
            name: product.name,
          })));

          if (assignedClinics.length === 1) {
            setDestinationClinic(assignedClinics[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorText(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateItem(
    key: string,
    field: keyof Omit<ReceiptItem, "key">,
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

  async function saveReceipt() {
    setError("");
    setSuccess("");

    if (!destinationClinic || !clinics.some((c) => c.id === destinationClinic)) {
      setError("Select an assigned receiving clinic.");
      return;
    }

    // A transfer must debit the source and credit the destination
    // in one server-side database transaction. Do not record it as
    // an ordinary receipt or stock would be created incorrectly.
    if (sourceType === "transfer") {
      setError(
        "Clinic transfers require the atomic transfer workflow. " +
        "Use KES Head Office for ordinary receipts. No stock has been saved."
      );
      return;
    }

    if (!receivedDate) {
      setError("Enter the date stock was received.");
      return;
    }

    if (!items.length || items.some((item) =>
      !item.medicationId ||
      !Number.isSafeInteger(Number(item.quantity)) ||
      Number(item.quantity) <= 0 ||
      !item.batchNumber.trim() ||
      !item.expiryDate ||
      item.expiryDate < receivedDate
    )) {
      setError(
        "Each medication needs a positive whole-number quantity, " +
        "batch number and expiry date on or after the receipt date."
      );
      return;
    }

    if (saving) return;
    setSaving(true);

    let savedCount = 0;
    try {
      const reference = [
        "KES Head Office",
        referenceNumber.trim() || "No delivery reference",
        `Received ${receivedDate}`,
        notes.trim(),
      ].filter(Boolean).join(" | ");

      // Each RPC must update batch inventory and balances together.
      // Multiple lines are not one atomic receipt: on a later failure,
      // earlier lines remain saved. Report this clearly to avoid duplicates.
      for (const item of items) {
        await recordStockBatch(
          destinationClinic,
          item.medicationId,
          "received",
          Number(item.quantity),
          {
            batchNumber: item.batchNumber.trim(),
            expiryDate: item.expiryDate,
            reference,
          }
        );
        savedCount += 1;
      }

      setSuccess(
        `Stock received successfully: ${savedCount} medication line(s) ` +
        "saved to batch inventory. Check Stock Dispensed and stock balances."
      );
      setItems([newItem()]);
      setReferenceNumber("");
      setNotes("");
    } catch (err) {
      setError(
        `${errorText(err)}. ${savedCount} of ${items.length} lines were saved. ` +
        (savedCount > 0
          ? "Do not resubmit the whole receipt: verify saved batches first to avoid double counting."
          : "No lines from this attempt were confirmed saved.")
      );
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
            <h1>Stock Received</h1>
            <p>
              Receive medications from KES Head Office and update clinic inventory by batch.
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
              <h2>Receipt Information</h2>

              <div className="dt-grid">
                <label>
                  Receiving Clinic *
                  <select
                    value={destinationClinic}
                    onChange={(e) =>
                      setDestinationClinic(
                        e.target.value
                      )
                    }
                  >
                    <option value="">
                      Select receiving clinic
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
                  Stock Source *
                  <select
                    value={sourceType}
                    onChange={(e) => {
                      setSourceType(
                        e.target.value as ReceiptSource
                      );
                      setSourceClinic("");
                    }}
                  >
                    <option value="depot">
                      KES Head Office
                    </option>
                    <option value="transfer" disabled>
                      Transfer from Another Clinic (requires transfer workflow)
                    </option>
                  </select>
                </label>

                {sourceType === "transfer" && (
                  <label>
                    Transferring Clinic *
                    <select
                      value={sourceClinic}
                      onChange={(e) =>
                        setSourceClinic(e.target.value)
                      }
                    >
                      <option value="">
                        Select source clinic
                      </option>
                      {clinics
                        .filter(
                          (clinic) =>
                            clinic.id !==
                            destinationClinic
                        )
                        .map((clinic) => (
                          <option
                            key={clinic.id}
                            value={clinic.id}
                          >
                            {clinic.site_name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                <label>
                  Delivery / Transfer Reference
                  <input
                    value={referenceNumber}
                    onChange={(e) =>
                      setReferenceNumber(
                        e.target.value
                      )
                    }
                    placeholder="KES delivery note or transfer reference"
                  />
                </label>

                <label>
                  Date Received *
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) =>
                      setReceivedDate(e.target.value)
                    }
                  />
                </label>
              </div>
            </section>

            <section className="dt-card">
              <div className="dt-heading">
                <div>
                  <h2>Medications Received</h2>
                  <p>
                    Add multiple medications to the
                    same receipt.
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

              {items.map((item, index) => (
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
                      >
                        <option value="">
                          Select medication
                        </option>
                        {medications.map(
                          (medication) => (
                            <option
                              key={medication.id}
                              value={medication.id}
                            >
                              {medication.name}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      Quantity Received *
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
                      />
                    </label>

                    <label>
                      Expiry Date *
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
                  </div>
                </div>
              ))}
            </section>

            <section className="dt-card">
              <h2>Receipt Summary</h2>

              <div className="dt-summary">
                <div>
                  <span>Medication Lines</span>
                  <strong>{items.length}</strong>
                </div>

                <div>
                  <span>Total Units</span>
                  <strong>{totalUnits}</strong>
                </div>
              </div>

              <label>
                Receipt Notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) =>
                    setNotes(e.target.value)
                  }
                  placeholder="Delivery condition, discrepancies or other notes"
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
                onClick={saveReceipt}
                disabled={saving}
              >
                {saving
                  ? "Processing..."
                  : "Save Stock Received"}
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
