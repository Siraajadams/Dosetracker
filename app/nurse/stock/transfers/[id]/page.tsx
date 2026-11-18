
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAssignedFacilities } from "@/lib/fpStock";

type Transfer = {
  id: string;
  source_facility_id: string;
  destination_facility_id: string;
  status: string;
  reason: string;
  created_at: string;
};

type TransferItem = {
  id: string;
  product_id: string;
  quantity_requested: number;
  quantity_dispatched: number;
  quantity_received: number;
};

type Product = {
  id: string;
  name: string;
};

type Site = {
  id: string;
  site_name: string;
};

type Batch = {
  id: string;
  product_id: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity_on_hand: number;
};

export default function TransferDetailPage() {
  const params = useParams();
  const transferId = String(params.id || "");

  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] =
    useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadTransfer() {
    setLoading(true);
    setError("");

    try {
      const facilities = await getAssignedFacilities();
      setAssigned(facilities);

      const { data: transferData, error: transferError } =
        await supabase
          .from("fp_stock_transfers")
          .select("*")
          .eq("id", transferId)
          .single();

      if (transferError) throw transferError;
      if (!transferData) throw new Error("Transfer not found");

      const current = transferData as Transfer;

      if (
        !facilities.includes(current.source_facility_id) &&
        !facilities.includes(current.destination_facility_id)
      ) {
        throw new Error("You are not authorised for this transfer.");
      }

      const [itemResult, productResult, siteResult, batchResult] =
        await Promise.all([
          supabase
            .from("fp_stock_transfer_items")
            .select("*")
            .eq("transfer_id", transferId),

          supabase
            .from("fp_stock_products")
            .select("id,name"),

          supabase
            .from("sites")
            .select("id,site_name")
            .in("id", [
              current.source_facility_id,
              current.destination_facility_id,
            ]),

          supabase
            .from("fp_stock_batches")
            .select(
              "id,product_id,batch_number,expiry_date,quantity_on_hand"
            )
            .eq("facility_id", current.source_facility_id),
        ]);

      if (itemResult.error) throw itemResult.error;
      if (productResult.error) throw productResult.error;
      if (siteResult.error) throw siteResult.error;

      setTransfer(current);
      setItems((itemResult.data || []) as TransferItem[]);
      setProducts((productResult.data || []) as Product[]);
      setSites((siteResult.data || []) as Site[]);

      if (!batchResult.error) {
        setBatches((batchResult.data || []) as Batch[]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load transfer"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (transferId) {
      void loadTransfer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferId]);

  function siteName(id: string) {
    return sites.find((site) => site.id === id)?.site_name || id;
  }

  function productName(id: string) {
    return products.find((product) => product.id === id)?.name || id;
  }

  async function performAction(
    functionName: string,
    args: Record<string, unknown>,
    successMessage: string
  ) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { error: rpcError } = await supabase.rpc(
        functionName,
        args
      );

      if (rpcError) throw rpcError;

      setMessage(successMessage);
      await loadTransfer();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Action failed"
      );
    } finally {
      setBusy(false);
    }
  }

  function approveTransfer() {
    if (!window.confirm("Approve this stock transfer?")) return;

    void performAction(
      "fp_approve_stock_transfer",
      { p_transfer_id: transferId },
      "Stock transfer approved."
    );
  }

  function dispatchTransfer() {
    const mapping: Record<string, string> = {};

    for (const item of items) {
      const batchId = selectedBatches[item.id];

      if (!batchId) {
        setError(
          `Select a batch for ${productName(item.product_id)}.`
        );
        return;
      }

      mapping[item.id] = batchId;
    }

    if (
      !window.confirm(
        "Dispatch stock and deduct quantities from the sending clinic?"
      )
    ) {
      return;
    }

    void performAction(
      "fp_dispatch_stock_transfer",
      {
        p_transfer_id: transferId,
        p_batches: mapping,
      },
      "Stock dispatched successfully."
    );
  }

  function receiveTransfer() {
    if (
      !window.confirm(
        "Confirm that all dispatched stock has been physically received?"
      )
    ) {
      return;
    }

    void performAction(
      "fp_receive_stock_transfer",
      { p_transfer_id: transferId },
      "Receipt confirmed by the transfer function. Verify stock balances before closing the workflow."
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <p>Loading stock transfer...</p>
      </main>
    );
  }

  if (!transfer) {
    return (
      <main style={styles.page}>
        <Link href="/nurse/stock/transfers">
          ← Back to Transfers
        </Link>
        <p style={styles.error}>
          {error || "Transfer not found"}
        </p>
      </main>
    );
  }

  const canSend = assigned.includes(
    transfer.source_facility_id
  );

  const canReceive = assigned.includes(
    transfer.destination_facility_id
  );

  // Never grant approval/dispatch rights merely because a user can view a transfer.
  // The corresponding Supabase RPC must independently enforce clinic authorisation.
  const currentStatus = (transfer.status || "").trim().toLowerCase();
  const sendingClinic = siteName(transfer.source_facility_id);
  const receivingClinic = siteName(transfer.destination_facility_id);

  const actionGuidance = (() => {
    if (currentStatus === "requested") {
      return canSend
        ? "Review the requested medications below, then approve the transfer on behalf of the sending clinic."
        : `Awaiting approval from ${sendingClinic}. Only authorised staff assigned to the sending clinic can approve this request. You are ${canReceive ? "signed in with receiving-clinic access" : "not assigned to the sending clinic"}.`;
    }
    if (currentStatus === "approved") {
      return canSend
        ? "Select an eligible stock batch for each medication, then dispatch the stock."
        : `Awaiting dispatch by ${sendingClinic}. Only authorised sending-clinic staff can dispatch stock.`;
    }
    if (currentStatus === "dispatched") {
      return canReceive
        ? "Check the physical stock, quantities, batch numbers and expiry dates before confirming full receipt."
        : `Awaiting confirmation of receipt by ${receivingClinic}. Only authorised receiving-clinic staff can confirm receipt.`;
    }
    if (currentStatus === "received") return "This transfer has been completed. No further action is required.";
    if (currentStatus === "rejected" || currentStatus === "cancelled") return "This transfer is closed. No further stock action is available.";
    return `No action is configured for transfer status: ${transfer.status || "unknown"}. Contact the DoseTrack administrator.`;
  })();

  return (
    <main style={styles.page}>
      <Link href="/nurse/stock/transfers">
        ← Back to Transfers
      </Link>

      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>
            DOSETRACK / STOCK MANAGEMENT
          </p>
          <h1>Inter-Clinic Stock Transfer</h1>
          <p style={styles.muted}>
            Transfer reference: {transfer.id}
          </p>
        </div>
        <span style={styles.status}>
          {currentStatus.toUpperCase()}
        </span>
      </header>

      {error && (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      )}

      {message && (
        <p role="status" style={styles.success}>
          {message}
        </p>
      )}

      <section style={styles.card}>
        <h2>Transfer Information</h2>

        <p>
          <strong>Sending Clinic:</strong>{" "}
          {siteName(transfer.source_facility_id)}
        </p>

        <p>
          <strong>Receiving Clinic:</strong>{" "}
          {siteName(transfer.destination_facility_id)}
        </p>

        <p>
          <strong>Reason:</strong> {transfer.reason}
        </p>

        <p>
          <strong>Requested:</strong>{" "}
          {new Date(transfer.created_at).toLocaleString("en-ZA")}
        </p>
      </section>

      <section style={styles.card}>
        <h2>Medication Details</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Medication</th>
                <th style={styles.th}>Requested</th>
                <th style={styles.th}>Dispatched</th>
                <th style={styles.th}>Received</th>
                <th style={styles.th}>Batch</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5} style={styles.td}>No transfer medications were returned. Check transfer item permissions and records.</td></tr>
              )}
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>
                    {productName(item.product_id)}
                  </td>

                  <td style={styles.td}>
                    {item.quantity_requested}
                  </td>

                  <td style={styles.td}>
                    {item.quantity_dispatched}
                  </td>

                  <td style={styles.td}>
                    {item.quantity_received}
                  </td>

                  <td style={styles.td}>
                    {transfer.status === "approved" &&
                    canSend ? (
                      <select
                        style={styles.select}
                        value={selectedBatches[item.id] || ""}
                        onChange={(event) =>
                          setSelectedBatches((previous) => ({
                            ...previous,
                            [item.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">
                          Select Batch
                        </option>

                        {batches
                          .filter(
                            (batch) =>
                              batch.product_id ===
                                item.product_id &&
                              batch.quantity_on_hand >=
                                item.quantity_requested &&
                              (!batch.expiry_date ||
                                batch.expiry_date >=
                                  new Date()
                                    .toISOString()
                                    .slice(0, 10))
                          )
                          .map((batch) => (
                            <option
                              key={batch.id}
                              value={batch.id}
                            >
                              {batch.batch_number || "No batch"} |
                              Stock: {batch.quantity_on_hand} |
                              Exp: {batch.expiry_date || "N/A"}
                            </option>
                          ))}
                      </select>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.card}>
        <h2>Transfer Actions</h2>

        <p style={styles.muted} role="status">{actionGuidance}</p>
        <div style={styles.accessInfo}>
          <strong>Clinic access:</strong>{" "}
          Sending clinic: {canSend ? "Authorised" : "Not assigned"} |{" "}
          Receiving clinic: {canReceive ? "Authorised" : "Not assigned"}
        </div>

        {currentStatus === "requested" &&
          canSend && (
            <button
              disabled={busy}
              style={styles.button}
              onClick={approveTransfer}
            >
              Approve Transfer
            </button>
          )}

        {transfer.status === "approved" &&
          canSend && (
            <button
              disabled={busy}
              style={styles.button}
              onClick={dispatchTransfer}
            >
              Dispatch Stock
            </button>
          )}

        {transfer.status === "dispatched" &&
          canReceive && (
            <>
              <p style={styles.muted}>
                Verify quantities, batch numbers and
                expiry dates before confirming receipt.
                Do not confirm if any stock is missing
                or damaged.
              </p>

              <button
                disabled={busy}
                style={styles.button}
                onClick={receiveTransfer}
              >
                Confirm Full Stock Receipt
              </button>
            </>
          )}

        {currentStatus === "received" && (
          <p style={styles.success}>
            Transfer completed successfully.
          </p>
        )}

        {(currentStatus === "requested" || currentStatus === "approved") && !canSend && (
          <p style={styles.muted}>
            To proceed, an authorised staff member at {sendingClinic} must sign in to DoseTrack
            and open this transfer. If you should have access to that clinic, ask an administrator
            to check your clinic assignment. Do not share login credentials.
          </p>
        )}
        {currentStatus === "dispatched" && !canReceive && (
          <p style={styles.muted}>
            An authorised staff member at {receivingClinic} must sign in and confirm receipt.
          </p>
        )}
        <button type="button" disabled={busy} style={styles.refreshButton}
          onClick={() => void loadTransfer()}>
          Refresh Transfer Status
        </button>
        {busy && <p>Processing...</p>}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1150,
    margin: "30px auto",
    padding: 20,
    fontFamily: "Arial, sans-serif",
    color: "#17333b",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 20,
    margin: "25px 0",
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: 800,
  },
  muted: {
    color: "#64748b",
    lineHeight: 1.6,
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 24,
    marginBottom: 22,
  },
  table: {
    width: "100%",
    minWidth: 700,
    borderCollapse: "collapse",
  },
  th: {
    padding: 12,
    background: "#164c7e",
    color: "#fff",
    textAlign: "left",
  },
  td: {
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
  },
  select: {
    padding: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
  },
  accessInfo: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    background: "#f1f5f9",
    color: "#334155",
    fontSize: 14,
  },
  refreshButton: {
    display: "inline-block",
    marginTop: 14,
    marginLeft: 10,
    padding: "12px 18px",
    background: "#fff",
    border: "1px solid #0f766e",
    borderRadius: 8,
    color: "#0f766e",
    fontWeight: 700,
    cursor: "pointer",
  },
  button: {
    background: "#164c7e",
    color: "#fff",
    border: 0,
    padding: "13px 20px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  },
  status: {
    background: "#e6f7ef",
    color: "#087f5b",
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 800,
  },
  error: {
    background: "#fff0f0",
    color: "#a02727",
    padding: 14,
    borderRadius: 8,
  },
  success: {
    background: "#e6f7ef",
    color: "#087f5b",
    padding: 14,
    borderRadius: 8,
  },
};
