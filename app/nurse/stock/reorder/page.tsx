
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAssignedFacilities } from "@/lib/fpStock";

type Facility = {
  id: string;
  site_name: string;
};

type Product = {
  id: string;
  name: string;
  unit: string | null;
  icn_number: string | null;
};

type DepotOrder = {
  id: string;
  facility_id: string;
  order_number: string | null;
  order_month: string | null;
  status: string | null;
  depot_name: string | null;
  submission_reference: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity_requested: number;
  quantity_received: number | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready_to_send: "Ready to Send",
  prepared: "Prepared",
  submitted: "Submitted",
  partially_received: "Partially Received",
  received: "Received",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function errorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(error.message);
  }

  return "An unexpected error occurred.";
}

function csvCell(value: string | number | null): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  rows: (string | number | null)[][]
) {
  const csv = rows
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MedicationOrdersPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [orders, setOrders] = useState<DepotOrder[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedFacility, setSelectedFacility] =
    useState("all");

  const [selectedStatus, setSelectedStatus] =
    useState("all");

  const [search, setSearch] = useState("");
  const [expandedOrder, setExpandedOrder] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error(
          "Please sign in to view medication orders."
        );
      }

      // Use the same facility-assignment helper
      // as the existing reorder page.
      const facilityIds = [
        ...new Set(await getAssignedFacilities()),
      ];

      if (facilityIds.length === 0) {
        setFacilities([]);
        setOrders([]);
        setItems([]);
        setProducts([]);
        return;
      }

      const [
        facilitiesResult,
        ordersResult,
        productsResult,
      ] = await Promise.all([
        supabase
          .from("sites")
          .select("id,site_name")
          .in("id", facilityIds)
          .order("site_name"),

        supabase
          .from("fp_depot_orders")
          .select(`
            id,
            facility_id,
            order_number,
            order_month,
            status,
            depot_name,
            submission_reference,
            submitted_at,
            submitted_by,
            created_by,
            created_at,
            updated_at
          `)
          .in("facility_id", facilityIds)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("fp_stock_products")
          .select("id,name,unit,icn_number")
          .order("name"),
      ]);

      if (facilitiesResult.error) {
        throw facilitiesResult.error;
      }

      if (ordersResult.error) {
        throw ordersResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      const loadedOrders =
        (ordersResult.data || []) as DepotOrder[];

      const orderIds = loadedOrders.map(
        (order) => order.id
      );

      let loadedItems: OrderItem[] = [];

      // Batch order IDs to avoid oversized filters.
      for (let index = 0; index < orderIds.length; index += 100) {
        const batchIds = orderIds.slice(
          index,
          index + 100
        );

        const { data, error: itemsError } =
          await supabase
            .from("fp_depot_order_items")
            .select(`
              id,
              order_id,
              product_id,
              quantity_requested,
              quantity_received
            `)
            .in("order_id", batchIds);

        if (itemsError) throw itemsError;

        loadedItems.push(
          ...((data || []) as OrderItem[])
        );
      }

      setFacilities(
        (facilitiesResult.data || []) as Facility[]
      );

      setOrders(loadedOrders);
      setItems(loadedItems);

      setProducts(
        (productsResult.data || []) as Product[]
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const facilityMap = useMemo(
    () =>
      new Map(
        facilities.map((facility) => [
          facility.id,
          facility.site_name,
        ])
      ),
    [facilities]
  );

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product,
        ])
      ),
    [products]
  );

  const itemsByOrder = useMemo(() => {
    const grouped = new Map<string, OrderItem[]>();

    for (const item of items) {
      const existing =
        grouped.get(item.order_id) || [];

      existing.push(item);
      grouped.set(item.order_id, existing);
    }

    return grouped;
  }, [items]);

  const availableStatuses = useMemo(() => {
    return [
      ...new Set(
        orders.map((order) =>
          order.status || "draft"
        )
      ),
    ].sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (
        selectedFacility !== "all" &&
        order.facility_id !== selectedFacility
      ) {
        return false;
      }

      if (
        selectedStatus !== "all" &&
        (order.status || "draft") !==
          selectedStatus
      ) {
        return false;
      }

      if (!query) return true;

      const facilityName =
        facilityMap.get(order.facility_id) || "";

      const orderItems =
        itemsByOrder.get(order.id) || [];

      const medicationMatch = orderItems.some(
        (item) => {
          const product = productMap.get(
            item.product_id
          );

          return (
            (product?.name || "")
              .toLowerCase()
              .includes(query) ||
            (product?.icn_number || "")
              .toLowerCase()
              .includes(query)
          );
        }
      );

      return (
        (order.order_number || order.id)
          .toLowerCase()
          .includes(query) ||
        facilityName.toLowerCase().includes(query) ||
        (order.submission_reference || "")
          .toLowerCase()
          .includes(query) ||
        (order.depot_name || "")
          .toLowerCase()
          .includes(query) ||
        medicationMatch
      );
    });
  }, [
    orders,
    search,
    selectedFacility,
    selectedStatus,
    facilityMap,
    productMap,
    itemsByOrder,
  ]);

  const summary = useMemo(() => {
    const totalRequested = items.reduce(
      (sum, item) =>
        sum + Number(item.quantity_requested || 0),
      0
    );

    const totalReceived = items.reduce(
      (sum, item) =>
        sum + Number(item.quantity_received || 0),
      0
    );

    return {
      totalOrders: orders.length,
      submitted: orders.filter(
        (order) => order.status === "submitted"
      ).length,
      received: orders.filter(
        (order) =>
          order.status === "received" ||
          order.status === "completed"
      ).length,
      outstanding: Math.max(
        0,
        totalRequested - totalReceived
      ),
    };
  }, [orders, items]);

  function refreshOrders() {
    setRefreshing(true);
    void loadOrders();
  }

  function exportOrder(order: DepotOrder) {
    const orderItems =
      itemsByOrder.get(order.id) || [];

    const rows: (string | number | null)[][] = [
      ["DoseTrack Family Planning Medication Order"],
      [
        "Order Number",
        order.order_number || order.id,
      ],
      [
        "Pharmacy",
        facilityMap.get(order.facility_id) ||
          order.facility_id,
      ],
      ["Order Month", order.order_month],
      ["Depot", order.depot_name],
      ["Status", order.status],
      [
        "Submission Reference",
        order.submission_reference,
      ],
      ["Submitted", formatDate(order.submitted_at)],
      [],
      [
        "ICN Number",
        "Medication",
        "Unit",
        "Quantity Requested",
        "Quantity Received",
        "Outstanding",
      ],
      ...orderItems.map((item) => {
        const product = productMap.get(
          item.product_id
        );

        const requested = Number(
          item.quantity_requested || 0
        );

        const received = Number(
          item.quantity_received || 0
        );

        return [
          product?.icn_number || "",
          product?.name || item.product_id,
          product?.unit || "",
          requested,
          received,
          Math.max(0, requested - received),
        ];
      }),
    ];

    downloadCsv(
      `DoseTrack-Order-${order.order_number || order.id}.csv`,
      rows
    );
  }

  return (
    <main className="dt-orders-page">
      <div className="dt-orders-container">
        <Link
          href="/nurse/stock"
          className="dt-orders-back"
        >
          ← Stock Dashboard
        </Link>

        <header className="dt-orders-header">
          <div>
            <p className="dt-orders-eyebrow">
              DOSETRACK / FAMILY PLANNING
            </p>

            <h1>Medication Orders</h1>

            <p className="dt-orders-subtitle">
              View depot medication orders submitted
              by your assigned pharmacies.
            </p>
          </div>

          <div className="dt-orders-actions">
            <button
              type="button"
              onClick={refreshOrders}
              disabled={loading || refreshing}
              className="dt-orders-button secondary"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh Orders"}
            </button>

            <Link
              href="/nurse/stock/reorder"
              className="dt-orders-button primary"
            >
              + New Medication Order
            </Link>
          </div>
        </header>

        {error && (
          <div
            className="dt-orders-alert"
            role="alert"
          >
            {error}
          </div>
        )}

        {loading ? (
          <section className="dt-orders-card">
            Loading medication orders...
          </section>
        ) : (
          <>
            <section className="dt-orders-stats">
              <div className="dt-orders-stat">
                <span>Total Orders</span>
                <strong>
                  {summary.totalOrders}
                </strong>
              </div>

              <div className="dt-orders-stat">
                <span>Submitted</span>
                <strong>
                  {summary.submitted}
                </strong>
              </div>

              <div className="dt-orders-stat">
                <span>Received</span>
                <strong>
                  {summary.received}
                </strong>
              </div>

              <div className="dt-orders-stat">
                <span>Outstanding Units</span>
                <strong>
                  {summary.outstanding}
                </strong>
              </div>
            </section>

            <section className="dt-orders-card">
              <h2>Search & Filter Orders</h2>

              <div className="dt-orders-filters">
                <label>
                  Search Orders
                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Order, medication, ICN or depot"
                  />
                </label>

                <label>
                  Pharmacy / Clinic
                  <select
                    value={selectedFacility}
                    onChange={(e) =>
                      setSelectedFacility(
                        e.target.value
                      )
                    }
                  >
                    <option value="all">
                      All assigned pharmacies
                    </option>

                    {facilities.map((facility) => (
                      <option
                        key={facility.id}
                        value={facility.id}
                      >
                        {facility.site_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Order Status
                  <select
                    value={selectedStatus}
                    onChange={(e) =>
                      setSelectedStatus(
                        e.target.value
                      )
                    }
                  >
                    <option value="all">
                      All statuses
                    </option>

                    {availableStatuses.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {STATUS_LABELS[status] ||
                            status}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>
            </section>

            <section className="dt-orders-card">
              <div className="dt-orders-section-heading">
                <h2>Medication Order History</h2>

                <span>
                  {filteredOrders.length} orders
                </span>
              </div>

              {facilities.length === 0 ? (
                <div className="dt-orders-empty">
                  <h3>No Assigned Pharmacies</h3>
                  <p>
                    Your account is not currently
                    assigned to any pharmacy.
                  </p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="dt-orders-empty">
                  <h3>No Medication Orders Found</h3>
                  <p>
                    There are no orders matching
                    your selected filters.
                  </p>

                  <Link
                    href="/nurse/stock/reorder"
                    className="dt-orders-button primary"
                  >
                    Create Medication Order
                  </Link>
                </div>
              ) : (
                <div className="dt-orders-list">
                  {filteredOrders.map((order) => {
                    const orderItems =
                      itemsByOrder.get(order.id) ||
                      [];

                    const requested =
                      orderItems.reduce(
                        (sum, item) =>
                          sum +
                          Number(
                            item.quantity_requested ||
                              0
                          ),
                        0
                      );

                    const received =
                      orderItems.reduce(
                        (sum, item) =>
                          sum +
                          Number(
                            item.quantity_received ||
                              0
                          ),
                        0
                      );

                    const outstanding =
                      Math.max(
                        0,
                        requested - received
                      );

                    const expanded =
                      expandedOrder === order.id;

                    const status =
                      order.status || "draft";

                    return (
                      <article
                        key={order.id}
                        className="dt-orders-order"
                      >
                        <div className="dt-orders-order-top">
                          <div>
                            <h3>
                              {order.order_number ||
                                order.id}
                            </h3>

                            <p>
                              {facilityMap.get(
                                order.facility_id
                              ) ||
                                "Unknown Pharmacy"}
                            </p>
                          </div>

                          <span
                            className={`dt-orders-status ${status}`}
                          >
                            {STATUS_LABELS[
                              status
                            ] || status}
                          </span>
                        </div>

                        <div className="dt-orders-meta">
                          <div>
                            <span>Order Month</span>
                            <strong>
                              {order.order_month ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span>Created</span>
                            <strong>
                              {formatDate(
                                order.created_at
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Submitted</span>
                            <strong>
                              {formatDate(
                                order.submitted_at
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Medications</span>
                            <strong>
                              {orderItems.length}
                            </strong>
                          </div>

                          <div>
                            <span>Requested</span>
                            <strong>
                              {requested}
                            </strong>
                          </div>

                          <div>
                            <span>Received</span>
                            <strong>
                              {received}
                            </strong>
                          </div>

                          <div>
                            <span>Outstanding</span>
                            <strong>
                              {outstanding}
                            </strong>
                          </div>
                        </div>

                        <div className="dt-orders-order-actions">
                          <button
                            type="button"
                            className="dt-orders-expand"
                            onClick={() =>
                              setExpandedOrder(
                                expanded
                                  ? null
                                  : order.id
                              )
                            }
                          >
                            {expanded
                              ? "Hide Medication Details −"
                              : "View Medication Details +"}
                          </button>

                          <button
                            type="button"
                            className="dt-orders-button secondary"
                            onClick={() =>
                              exportOrder(order)
                            }
                          >
                            Download CSV
                          </button>
                        </div>

                        {expanded && (
                          <div className="dt-orders-details">
                            <div className="dt-orders-extra">
                              <p>
                                <strong>Depot:</strong>{" "}
                                {order.depot_name ||
                                  "Not recorded"}
                              </p>

                              <p>
                                <strong>
                                  Submission Reference:
                                </strong>{" "}
                                {order.submission_reference ||
                                  "Not recorded"}
                              </p>
                            </div>

                            <div className="dt-orders-table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>ICN</th>
                                    <th>Medication</th>
                                    <th>Unit</th>
                                    <th>Requested</th>
                                    <th>Received</th>
                                    <th>Outstanding</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {orderItems.map(
                                    (item) => {
                                      const product =
                                        productMap.get(
                                          item.product_id
                                        );

                                      const qtyRequested =
                                        Number(
                                          item.quantity_requested ||
                                            0
                                        );

                                      const qtyReceived =
                                        Number(
                                          item.quantity_received ||
                                            0
                                        );

                                      return (
                                        <tr
                                          key={
                                            item.id
                                          }
                                        >
                                          <td>
                                            {product?.icn_number ||
                                              "—"}
                                          </td>

                                          <td>
                                            <strong>
                                              {product?.name ||
                                                "Unknown Medication"}
                                            </strong>
                                          </td>

                                          <td>
                                            {product?.unit ||
                                              "units"}
                                          </td>

                                          <td>
                                            {
                                              qtyRequested
                                            }
                                          </td>

                                          <td>
                                            {
                                              qtyReceived
                                            }
                                          </td>

                                          <td>
                                            {Math.max(
                                              0,
                                              qtyRequested -
                                                qtyReceived
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    }
                                  )}

                                  {orderItems.length ===
                                    0 && (
                                    <tr>
                                      <td
                                        colSpan={6}
                                      >
                                        No medication
                                        lines recorded.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <style jsx global>{`
        .dt-orders-page {
          min-height: 100vh;
          background: #f4f8fa;
          color: #17333b;
          font-family: Arial, sans-serif;
          padding: 28px 18px;
        }

        .dt-orders-container {
          max-width: 1200px;
          margin: auto;
        }

        .dt-orders-back {
          display: inline-block;
          color: #164c7e;
          font-weight: 700;
          text-decoration: none;
          margin-bottom: 16px;
        }

        .dt-orders-header,
        .dt-orders-actions,
        .dt-orders-section-heading,
        .dt-orders-order-top,
        .dt-orders-order-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .dt-orders-header {
          margin-bottom: 24px;
        }

        .dt-orders-header h1 {
          font-size: 30px;
          margin: 6px 0;
        }

        .dt-orders-eyebrow {
          color: #0f766e;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }

        .dt-orders-subtitle {
          color: #64748b;
        }

        .dt-orders-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          padding: 12px 16px;
          border-radius: 9px;
          border: 1px solid #d8e2e8;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        .dt-orders-button.primary {
          background: #164c7e;
          border-color: #164c7e;
          color: white;
        }

        .dt-orders-button.secondary {
          background: white;
          color: #164c7e;
        }

        .dt-orders-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dt-orders-stats {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .dt-orders-stat,
        .dt-orders-card {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 14px;
          padding: 22px;
        }

        .dt-orders-stat {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .dt-orders-stat span {
          color: #64748b;
          font-size: 13px;
        }

        .dt-orders-stat strong {
          color: #0f766e;
          font-size: 28px;
        }

        .dt-orders-card {
          margin-bottom: 20px;
        }

        .dt-orders-card h2 {
          font-size: 19px;
          margin-top: 0;
        }

        .dt-orders-filters {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .dt-orders-filters label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
        }

        .dt-orders-filters input,
        .dt-orders-filters select {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #d8e2e8;
          border-radius: 8px;
          background: white;
          color: #17333b;
        }

        .dt-orders-section-heading {
          margin-bottom: 18px;
        }

        .dt-orders-section-heading span {
          color: #64748b;
          font-size: 13px;
        }

        .dt-orders-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .dt-orders-order {
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 20px;
          background: white;
        }

        .dt-orders-order-top h3 {
          margin: 0 0 6px;
          font-size: 17px;
          overflow-wrap: anywhere;
        }

        .dt-orders-order-top p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        .dt-orders-status {
          padding: 7px 11px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          background: #f1f5f9;
          color: #475569;
        }

        .dt-orders-status.submitted {
          background: #e8f1ff;
          color: #1d4ed8;
        }

        .dt-orders-status.received,
        .dt-orders-status.completed {
          background: #e6f7ef;
          color: #087f5b;
        }

        .dt-orders-status.partially_received {
          background: #fff4df;
          color: #a16207;
        }

        .dt-orders-status.cancelled {
          background: #fff0f0;
          color: #b42318;
        }

        .dt-orders-status.prepared,
        .dt-orders-status.ready_to_send {
          background: #eef2ff;
          color: #4338ca;
        }

        .dt-orders-meta {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin: 20px 0;
        }

        .dt-orders-meta > div {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .dt-orders-meta span {
          color: #64748b;
          font-size: 12px;
        }

        .dt-orders-meta strong {
          font-size: 14px;
        }

        .dt-orders-expand {
          background: none;
          border: none;
          padding: 0;
          font-size: 13px;
          font-weight: 800;
          color: #0f766e;
          cursor: pointer;
        }

        .dt-orders-details {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid #e1e8ed;
        }

        .dt-orders-extra {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          font-size: 13px;
        }

        .dt-orders-table-wrap {
          overflow-x: auto;
        }

        .dt-orders-details table {
          width: 100%;
          min-width: 650px;
          border-collapse: collapse;
          font-size: 13px;
        }

        .dt-orders-details th,
        .dt-orders-details td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e1e8ed;
        }

        .dt-orders-details th {
          background: #f7fafb;
          color: #475569;
        }

        .dt-orders-empty {
          padding: 40px 20px;
          text-align: center;
          color: #64748b;
        }

        .dt-orders-empty h3 {
          color: #17333b;
        }

        .dt-orders-alert {
          background: #fff0f0;
          color: #a02727;
          padding: 14px;
          border-radius: 9px;
          margin-bottom: 18px;
        }

        @media (max-width: 850px) {
          .dt-orders-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .dt-orders-filters {
            grid-template-columns: 1fr;
          }

          .dt-orders-meta {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 500px) {
          .dt-orders-page {
            padding: 16px 12px;
          }

          .dt-orders-stat,
          .dt-orders-card,
          .dt-orders-order {
            padding: 16px;
          }
        }
      `}</style>
    </main>
  );
}
