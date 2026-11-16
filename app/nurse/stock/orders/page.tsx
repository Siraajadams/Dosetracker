
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

type Product = {
  id: string;
  name: string;
  unit: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity_requested: number;
  quantity_received: number;
};

type DepotOrder = {
  id: string;
  facility_id: string;
  order_number: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready_to_send: "Ready to Send",
  submitted: "Submitted",
  partially_received: "Partially Received",
  received: "Received",
  cancelled: "Cancelled",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
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

export default function MedicationOrdersPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [orders, setOrders] = useState<DepotOrder[]>([]);
  const [orderItems, setOrderItems] =
    useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedClinic, setSelectedClinic] =
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

      const assignmentsResult = await supabase
        .from("nurse_site_assignments")
        .select("site_id")
        .eq("nurse_id", auth.user.id);

      if (assignmentsResult.error) {
        throw assignmentsResult.error;
      }

      const siteIds = [
        ...new Set(
          (assignmentsResult.data || []).map(
            (item) => item.site_id
          )
        ),
      ];

      if (siteIds.length === 0) {
        setClinics([]);
        setOrders([]);
        setOrderItems([]);
        setProducts([]);
        return;
      }

      const [
        clinicsResult,
        ordersResult,
        productsResult,
      ] = await Promise.all([
        supabase
          .from("sites")
          .select("id,site_name")
          .in("id", siteIds)
          .order("site_name"),

        supabase
          .from("fp_depot_orders")
          .select(
            "id,facility_id,order_number,status,created_at,submitted_at"
          )
          .in("facility_id", siteIds)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("fp_stock_products")
          .select("id,name,unit")
          .order("name"),
      ]);

      if (clinicsResult.error) {
        throw clinicsResult.error;
      }

      if (ordersResult.error) {
        throw ordersResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      const loadedOrders = ordersResult.data || [];
      const orderIds = loadedOrders.map(
        (order) => order.id
      );

      let loadedItems: OrderItem[] = [];

      if (orderIds.length > 0) {
        const itemsResult = await supabase
          .from("fp_depot_order_items")
          .select(
            "id,order_id,product_id,quantity_requested,quantity_received"
          )
          .in("order_id", orderIds);

        if (itemsResult.error) {
          throw itemsResult.error;
        }

        loadedItems = itemsResult.data || [];
      }

      setClinics(clinicsResult.data || []);
      setOrders(loadedOrders);
      setOrderItems(loadedItems);
      setProducts(productsResult.data || []);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const clinicNames = useMemo(
    () =>
      new Map(
        clinics.map((clinic) => [
          clinic.id,
          clinic.site_name,
        ])
      ),
    [clinics]
  );

  const productNames = useMemo(
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

    for (const item of orderItems) {
      const existing =
        grouped.get(item.order_id) || [];

      existing.push(item);
      grouped.set(item.order_id, existing);
    }

    return grouped;
  }, [orderItems]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (
        selectedClinic !== "all" &&
        order.facility_id !== selectedClinic
      ) {
        return false;
      }

      if (
        selectedStatus !== "all" &&
        order.status !== selectedStatus
      ) {
        return false;
      }

      if (!term) return true;

      const clinicName =
        clinicNames.get(order.facility_id) || "";

      const matchingProduct = (
        itemsByOrder.get(order.id) || []
      ).some((item) =>
        (
          productNames.get(item.product_id)?.name ||
          ""
        )
          .toLowerCase()
          .includes(term)
      );

      return (
        order.order_number
          .toLowerCase()
          .includes(term) ||
        clinicName.toLowerCase().includes(term) ||
        matchingProduct
      );
    });
  }, [
    orders,
    search,
    selectedClinic,
    selectedStatus,
    clinicNames,
    itemsByOrder,
    productNames,
  ]);

  const summary = useMemo(() => {
    return {
      total: orders.length,
      submitted: orders.filter(
        (order) => order.status === "submitted"
      ).length,
      partial: orders.filter(
        (order) =>
          order.status === "partially_received"
      ).length,
      received: orders.filter(
        (order) => order.status === "received"
      ).length,
    };
  }, [orders]);

  function refresh() {
    setRefreshing(true);
    void loadOrders();
  }

  return (
    <main className="orders-page">
      <div className="orders-container">
        <header className="orders-header">
          <div>
            <p className="orders-eyebrow">
              DOSETRACK / STOCK MANAGEMENT
            </p>

            <h1>Medication Orders</h1>

            <p className="orders-subtitle">
              View medication orders submitted by
              your assigned pharmacies and clinics.
            </p>
          </div>

          <div className="orders-actions">
            <button
              type="button"
              className="orders-button secondary"
              onClick={refresh}
              disabled={loading || refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh Orders"}
            </button>

            <Link
              href="/nurse/stock/reorder"
              className="orders-button primary"
            >
              + New Order
            </Link>

            <Link
              href="/nurse/dashboard"
              className="orders-button secondary"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div className="orders-alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="orders-card">
            Loading medication orders...
          </div>
        ) : (
          <>
            <section className="orders-stats">
              <div className="orders-stat">
                <span>Total Orders</span>
                <strong>{summary.total}</strong>
              </div>

              <div className="orders-stat">
                <span>Submitted</span>
                <strong>{summary.submitted}</strong>
              </div>

              <div className="orders-stat">
                <span>Partially Received</span>
                <strong>{summary.partial}</strong>
              </div>

              <div className="orders-stat">
                <span>Received</span>
                <strong>{summary.received}</strong>
              </div>
            </section>

            <section className="orders-card">
              <h2>Search Medication Orders</h2>

              <div className="orders-filters">
                <label>
                  Search
                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Order number, clinic or medication"
                  />
                </label>

                <label>
                  Clinic / Pharmacy
                  <select
                    value={selectedClinic}
                    onChange={(e) =>
                      setSelectedClinic(
                        e.target.value
                      )
                    }
                  >
                    <option value="all">
                      All assigned clinics
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

                    {Object.entries(
                      STATUS_LABELS
                    ).map(([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="orders-card">
              <div className="orders-section-header">
                <h2>Order History</h2>

                <span>
                  {filteredOrders.length} orders
                </span>
              </div>

              {clinics.length === 0 ? (
                <div className="orders-empty">
                  No clinics are assigned to your
                  nurse account.
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="orders-empty">
                  No medication orders found.
                </div>
              ) : (
                <div className="orders-list">
                  {filteredOrders.map((order) => {
                    const details =
                      itemsByOrder.get(order.id) ||
                      [];

                    const requested =
                      details.reduce(
                        (sum, item) =>
                          sum +
                          item.quantity_requested,
                        0
                      );

                    const received =
                      details.reduce(
                        (sum, item) =>
                          sum +
                          item.quantity_received,
                        0
                      );

                    const expanded =
                      expandedOrder === order.id;

                    return (
                      <article
                        key={order.id}
                        className="orders-order"
                      >
                        <div className="orders-order-top">
                          <div>
                            <h3>
                              {order.order_number}
                            </h3>

                            <p>
                              {clinicNames.get(
                                order.facility_id
                              ) || "Unknown clinic"}
                            </p>
                          </div>

                          <span
                            className={`orders-status ${
                              order.status
                            }`}
                          >
                            {STATUS_LABELS[
                              order.status
                            ] || order.status}
                          </span>
                        </div>

                        <div className="orders-meta">
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
                              {details.length}
                            </strong>
                          </div>

                          <div>
                            <span>Units Requested</span>
                            <strong>
                              {requested}
                            </strong>
                          </div>

                          <div>
                            <span>Units Received</span>
                            <strong>
                              {received}
                            </strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="orders-expand"
                          onClick={() =>
                            setExpandedOrder(
                              expanded
                                ? null
                                : order.id
                            )
                          }
                        >
                          {expanded
                            ? "Hide medication details −"
                            : "View medication details +"}
                        </button>

                        {expanded && (
                          <div className="orders-detail">
                            <div className="orders-table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Medication</th>
                                    <th>Unit</th>
                                    <th>Requested</th>
                                    <th>Received</th>
                                    <th>Outstanding</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {details.map((item) => {
                                    const product =
                                      productNames.get(
                                        item.product_id
                                      );

                                    return (
                                      <tr key={item.id}>
                                        <td>
                                          {product?.name ||
                                            "Unknown medication"}
                                        </td>

                                        <td>
                                          {product?.unit ||
                                            "units"}
                                        </td>

                                        <td>
                                          {
                                            item.quantity_requested
                                          }
                                        </td>

                                        <td>
                                          {
                                            item.quantity_received
                                          }
                                        </td>

                                        <td>
                                          {Math.max(
                                            0,
                                            item.quantity_requested -
                                              item.quantity_received
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
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
        .orders-page {
          min-height: 100vh;
          background: #f4f8fa;
          color: #17333b;
          font-family: Arial, sans-serif;
          padding: 28px 18px;
        }

        .orders-container {
          max-width: 1200px;
          margin: auto;
        }

        .orders-header,
        .orders-actions,
        .orders-section-header,
        .orders-order-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .orders-header {
          margin-bottom: 24px;
        }

        .orders-header h1 {
          font-size: 30px;
          margin: 6px 0;
        }

        .orders-eyebrow {
          font-size: 11px;
          letter-spacing: 1.3px;
          font-weight: 800;
          color: #0f766e;
        }

        .orders-subtitle {
          color: #64748b;
        }

        .orders-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 16px;
          border-radius: 9px;
          border: 1px solid #d8e2e8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .orders-button.primary {
          background: #0f766e;
          border-color: #0f766e;
          color: white;
        }

        .orders-button.secondary {
          background: white;
          color: #35505a;
        }

        .orders-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .orders-stats {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .orders-stat,
        .orders-card {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 14px;
          padding: 22px;
        }

        .orders-stat {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .orders-stat span {
          color: #64748b;
          font-size: 13px;
        }

        .orders-stat strong {
          font-size: 28px;
          color: #0f766e;
        }

        .orders-card {
          margin-bottom: 20px;
        }

        .orders-card h2 {
          margin-top: 0;
          font-size: 19px;
        }

        .orders-filters {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .orders-filters label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
        }

        .orders-filters input,
        .orders-filters select {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #d8e2e8;
          border-radius: 8px;
          background: white;
          color: #17333b;
        }

        .orders-section-header {
          margin-bottom: 18px;
        }

        .orders-section-header span {
          color: #64748b;
          font-size: 13px;
        }

        .orders-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .orders-order {
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 20px;
          background: #fff;
        }

        .orders-order-top h3 {
          margin: 0 0 6px;
          font-size: 17px;
        }

        .orders-order-top p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        .orders-status {
          padding: 7px 11px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          background: #f1f5f9;
          color: #475569;
        }

        .orders-status.submitted {
          background: #e8f1ff;
          color: #1d4ed8;
        }

        .orders-status.received {
          background: #e6f7ef;
          color: #087f5b;
        }

        .orders-status.partially_received {
          background: #fff4df;
          color: #a16207;
        }

        .orders-status.cancelled {
          background: #fff0f0;
          color: #b42318;
        }

        .orders-meta {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin: 20px 0;
        }

        .orders-meta > div {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .orders-meta span {
          font-size: 12px;
          color: #64748b;
        }

        .orders-meta strong {
          font-size: 14px;
        }

        .orders-expand {
          background: none;
          border: none;
          padding: 0;
          font-size: 13px;
          font-weight: 800;
          color: #0f766e;
          cursor: pointer;
        }

        .orders-detail {
          margin-top: 18px;
          border-top: 1px solid #e1e8ed;
          padding-top: 18px;
        }

        .orders-table-wrap {
          overflow-x: auto;
        }

        .orders-detail table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .orders-detail th,
        .orders-detail td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e1e8ed;
        }

        .orders-detail th {
          background: #f7fafb;
          color: #475569;
        }

        .orders-empty {
          padding: 40px 20px;
          text-align: center;
          color: #64748b;
        }

        .orders-alert {
          background: #fff0f0;
          color: #a02727;
          padding: 14px;
          border-radius: 9px;
          margin-bottom: 18px;
        }

        @media (max-width: 800px) {
          .orders-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .orders-filters {
            grid-template-columns: 1fr;
          }

          .orders-meta {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 500px) {
          .orders-page {
            padding: 16px 12px;
          }

          .orders-stat,
          .orders-card {
            padding: 16px;
          }
        }
      `}</style>
    </main>
  );
}
