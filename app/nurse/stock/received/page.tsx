"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAssignedPharmacies, getProducts } from "@/lib/fpStock";

type Clinic = { id: string; site_name: string };
type Medication = { id: string; name: string; unit: string };
type DepotOrder = { id: string; order_number: string; status: string; facility_id: string };
type OrderLine = { id: string; order_id: string; product_id: string; quantity_requested: number; quantity_received: number };
type ReceiptItem = { key: string; medicationId: string; quantity: string; batchNumber: string; expiryDate: string };
type ReceiptResult = { receipt_id: string; saved_lines: number; already_saved: boolean; order_status?: string | null };
const newItem = (medicationId = "", quantity = ""): ReceiptItem => ({
  key: crypto.randomUUID(), medicationId, quantity, batchNumber: "", expiryDate: "",
});
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);

export default function ReceivedPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [destinationClinic, setDestinationClinic] = useState("");
  const [orders, setOrders] = useState<DepotOrder[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [selectedOrder, setSelectedOrder] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReceiptItem[]>([newItem()]);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const receiptId = useRef<string>(crypto.randomUUID());
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    async function load() {
      try {
        const [assigned, products] = await Promise.all([getAssignedPharmacies(), getProducts()]);
        if (!mounted.current) return;
        setClinics(assigned.map(c => ({ id: c.id, site_name: c.name })));
        setMedications(products.map(p => ({ id: p.id, name: p.name, unit: p.unit })));
        if (assigned.length === 1) setDestinationClinic(assigned[0].id);
      } catch (e) { if (mounted.current) setError(errorText(e)); }
      finally { if (mounted.current) setLoading(false); }
    }
    void load();
    return () => { mounted.current = false; };
  }, []);

  const loadOrders = useCallback(async (clinicId: string) => {
    setOrders([]); setOrderLines([]); setLoadingOrders(true);
    try {
      const { data, error: orderError } = await supabase.from("fp_depot_orders")
        .select("id,order_number,status,facility_id")
        .eq("facility_id", clinicId)
        .in("status", ["draft", "ready_to_send", "submitted", "partially_received"])
        .order("created_at", { ascending: false });
      if (orderError) throw orderError;
      const loaded = (data ?? []) as DepotOrder[];
      const ids = loaded.map(o => o.id);
      let lines: OrderLine[] = [];
      if (ids.length) {
        const { data: lineData, error: lineError } = await supabase.from("fp_depot_order_items")
          .select("id,order_id,product_id,quantity_requested,quantity_received").in("order_id", ids);
        if (lineError) throw lineError;
        lines = (lineData ?? []) as OrderLine[];
      }
      if (!mounted.current) return;
      setOrders(loaded); setOrderLines(lines);
    } catch (e) { if (mounted.current) setError(`Unable to load orders: ${errorText(e)}`); }
    finally { if (mounted.current) setLoadingOrders(false); }
  }, []);

  useEffect(() => {
    setSelectedOrder(""); setItems([newItem()]); setError("");
    if (destinationClinic) void loadOrders(destinationClinic);
    else { setOrders([]); setOrderLines([]); }
  }, [destinationClinic, loadOrders]);

  const availableLines = useMemo(() => orderLines.filter(l =>
    l.order_id === selectedOrder && l.quantity_requested > l.quantity_received
  ), [orderLines, selectedOrder]);
  const selectedOrderInfo = orders.find(o => o.id === selectedOrder);
  const medicationMap = useMemo(() => new Map(medications.map(p => [p.id, p])), [medications]);
  const outstandingMap = useMemo(() => new Map(availableLines.map(l => [l.product_id,
    l.quantity_requested - l.quantity_received])), [availableLines]);
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  function changeOrder(orderId: string) {
    setSelectedOrder(orderId); setError(""); setSuccess("");
    if (!orderId) { setItems([newItem()]); return; }
    const lines = orderLines.filter(l => l.order_id === orderId && l.quantity_requested > l.quantity_received);
    setItems(lines.map(l => newItem(l.product_id, "")));
  }
  function updateItem(key: string, field: keyof Omit<ReceiptItem, "key">, value: string) {
    setItems(previous => previous.map(item => item.key === key ? { ...item, [field]: value } : item));
  }
  function addMedication() { setItems(previous => [...previous, newItem()]); }
  function removeMedication(key: string) { setItems(previous => previous.filter(item => item.key !== key)); }

  async function saveReceipt() {
    if (inFlight.current) return;
    setError(""); setSuccess("");
    if (!destinationClinic || !clinics.some(c => c.id === destinationClinic)) {
      setError("Select an assigned receiving clinic."); return;
    }
    if (!receivedDate || receivedDate > today()) {
      setError("Choose a receipt date that is not in the future."); return;
    }
    if (!items.length) { setError("Add at least one medication."); return; }
    const totals = new Map<string, number>();
    for (const item of items) {
      const q = Number(item.quantity);
      if (!item.medicationId || !medicationMap.has(item.medicationId) ||
          !Number.isSafeInteger(q) || q <= 0 || !item.batchNumber.trim() ||
          !item.expiryDate || item.expiryDate < receivedDate) {
        setError("Every line requires a medication, positive whole-number quantity, batch number and valid expiry date."); return;
      }
      totals.set(item.medicationId, (totals.get(item.medicationId) ?? 0) + q);
    }
    if (selectedOrder) {
      for (const [productId, quantity] of totals) {
        const outstanding = outstandingMap.get(productId);
        if (outstanding === undefined || quantity > outstanding) {
          setError(`Quantity exceeds outstanding order quantity for ${medicationMap.get(productId)?.name ?? productId}.`);
          return;
        }
      }
    }
    inFlight.current = true; setSaving(true);
    try {
      const payload = items.map(item => ({
        product_id: item.medicationId,
        quantity: Number(item.quantity),
        batch_number: item.batchNumber.trim(),
        expiry_date: item.expiryDate,
      }));
      const { data, error: rpcError } = await supabase.rpc("fp_receive_stock", {
        p_receipt_id: receiptId.current,
        p_facility_id: destinationClinic,
        p_order_id: selectedOrder || null,
        p_delivery_reference: referenceNumber.trim() || null,
        p_received_date: receivedDate,
        p_notes: notes.trim() || null,
        p_lines: payload,
      });
      if (rpcError) throw rpcError;
      const result = data as ReceiptResult;
      setSuccess(`Receipt saved: ${result.saved_lines} line(s). ${result.already_saved ? "Already processed (no duplicate stock)." : "Inventory updated."}${result.order_status ? ` Order status: ${result.order_status}.` : ""}`);
      receiptId.current = crypto.randomUUID();
      setItems([newItem()]); setReferenceNumber(""); setNotes(""); setSelectedOrder("");
      await loadOrders(destinationClinic);
    } catch (e) {
      // Keep receipt UUID and form intact. Retrying the same receipt is idempotent.
      setError(`${errorText(e)}. No new receipt has been confirmed. You may retry without changing the form; the same receipt ID will be reused.`);
    } finally { inFlight.current = false; setSaving(false); }
  }

  return (
    <main className="dt-page"><div className="dt-container">
      <header className="dt-header"><div>
        <p className="dt-eyebrow">DOSETRACK / STOCK MANAGEMENT</p>
        <h1>Stock Received</h1>
        <p>Receive stock from KESS, with or without an existing medication order.</p>
      </div><Link href="/nurse/dashboard" className="dt-button secondary">Back to Dashboard</Link></header>
      {error && <div className="dt-alert error" role="alert">{error}</div>}
      {success && <div className="dt-alert success" role="status">{success}</div>}
      {loading ? <section className="dt-card">Loading stock information...</section> : <>
        <section className="dt-card"><h2>Receipt Information</h2><div className="dt-grid">
          <label>Receiving Clinic *<select value={destinationClinic} disabled={saving}
            onChange={e => setDestinationClinic(e.target.value)}>
            <option value="">Select receiving clinic</option>
            {clinics.map(c => <option key={c.id} value={c.id}>{c.site_name}</option>)}
          </select></label>
          <label>Stock Source<select disabled value="KESS"><option value="KESS">KESS</option></select></label>
          <label>Link to Existing Order (optional)<select disabled={!destinationClinic || loadingOrders || saving}
            value={selectedOrder} onChange={e => changeOrder(e.target.value)}>
            <option value="">No order — standalone KESS receipt</option>
            {orders.filter(o => orderLines.some(l => l.order_id === o.id && l.quantity_requested > l.quantity_received))
              .map(o => <option key={o.id} value={o.id}>{o.order_number} ({o.status})</option>)}
          </select></label>
          <label>KESS Delivery Note Reference<input value={referenceNumber} disabled={saving}
            onChange={e => setReferenceNumber(e.target.value)} placeholder="Delivery note / invoice number" /></label>
          <label>Date Received *<input type="date" value={receivedDate} max={today()} disabled={saving}
            onChange={e => setReceivedDate(e.target.value)} /></label>
        </div>
          {selectedOrderInfo && <p className="dt-order-note">Linked order: <strong>{selectedOrderInfo.order_number}</strong>. Enter the actual quantities received; leave unreceived medications blank and remove their lines before saving.</p>}
        </section>
        <section className="dt-card"><div className="dt-heading"><div><h2>Medications Received</h2>
          <p>Multiple batches of the same medication can be entered separately.</p></div>
          <button type="button" className="dt-button secondary" disabled={saving}
            onClick={addMedication}>+ Add Medication</button></div>
          {items.map((item, index) => <div key={item.key} className="dt-medication">
            <div className="dt-heading"><h3>Medication {index + 1}</h3>
              <button type="button" className="dt-remove" disabled={saving}
                onClick={() => removeMedication(item.key)}>Remove</button></div>
            <div className="dt-grid">
              <label>Medication *<select value={item.medicationId} disabled={saving}
                onChange={e => updateItem(item.key, "medicationId", e.target.value)}>
                <option value="">Select medication</option>
                {(selectedOrder ? medications.filter(p => outstandingMap.has(p.id)) : medications)
                  .map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit || "units"})</option>)}
              </select></label>
              <label>Quantity Received * {selectedOrder && item.medicationId ? `(Outstanding: ${outstandingMap.get(item.medicationId) ?? 0})` : ""}
                <input type="number" min="1" step="1" value={item.quantity} disabled={saving}
                  onChange={e => updateItem(item.key, "quantity", e.target.value)} /></label>
              <label>Batch Number *<input value={item.batchNumber} disabled={saving}
                onChange={e => updateItem(item.key, "batchNumber", e.target.value)} /></label>
              <label>Expiry Date *<input type="date" value={item.expiryDate} min={receivedDate} disabled={saving}
                onChange={e => updateItem(item.key, "expiryDate", e.target.value)} /></label>
            </div></div>)}
        </section>
        <section className="dt-card"><h2>Receipt Summary</h2><div className="dt-summary">
          <div><span>Medication Lines</span><strong>{items.length}</strong></div>
          <div><span>Total Units</span><strong>{totalUnits}</strong></div></div>
          <label>Receipt Notes<textarea rows={3} value={notes} disabled={saving}
            onChange={e => setNotes(e.target.value)} placeholder="Delivery condition, discrepancies or other notes" /></label>
        </section>
        <div className="dt-actions"><Link href="/nurse/dashboard" className="dt-button secondary">Cancel</Link>
          <button type="button" className="dt-button primary" onClick={() => void saveReceipt()}
            disabled={saving || loadingOrders}>{saving ? "Processing..." : "Save Stock Received"}</button></div>
      </>}
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
