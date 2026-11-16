
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAssignedFacilities } from "@/lib/fpStock";

type StockModule = {
  title: string;
  description: string;
  href: string;
  icon: string;
  category: "INVENTORY" | "ORDERING";
};

const modules: StockModule[] = [
  {
    title: "Stock Received",
    description:
      "Record medication deliveries, quantities, batch numbers and expiry dates.",
    href: "/nurse/stock/received",
    icon: "📦",
    category: "INVENTORY",
  },
  {
    title: "Stock Dispensed",
    description:
      "Record medication quantities issued from clinic inventory.",
    href: "/nurse/stock/dispensed",
    icon: "💊",
    category: "INVENTORY",
  },
  {
    title: "Stock Wasted",
    description:
      "Record expired, damaged or wasted medication stock.",
    href: "/nurse/stock/wasted",
    icon: "🗑️",
    category: "INVENTORY",
  },
  {
    title: "Medication Reorder",
    description:
      "Prepare medication replenishment orders for the depot.",
    href: "/nurse/stock/reorder",
    icon: "🛒",
    category: "ORDERING",
  },
  {
    title: "Medication Orders",
    description:
      "View depot orders, submission status, received quantities and outstanding stock.",
    href: "/nurse/stock/orders",
    icon: "📋",
    category: "ORDERING",
  },
  {
    title: "Inter-Clinic Stock Transfers",
    description:
      "Request stock from another clinic, approve transfers, dispatch medications and confirm stock received.",
    href: "/nurse/stock/transfers",
    icon: "🔄",
    category: "ORDERING",
  },
];

export default function StockDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] =
    useState(false);
  const [assignedCount, setAssignedCount] =
    useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const { data, error: authError } =
          await supabase.auth.getUser();

        if (authError || !data.user) {
          throw new Error(
            "Please sign in to access stock management."
          );
        }

        if (cancelled) return;

        setAuthenticated(true);

        const facilities =
          await getAssignedFacilities();

        if (cancelled) return;

        setAssignedCount(facilities.length);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load stock dashboard."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const inventoryModules = modules.filter(
    (module) => module.category === "INVENTORY"
  );

  const orderingModules = modules.filter(
    (module) => module.category === "ORDERING"
  );

  function renderModule(module: StockModule) {
    return (
      <Link
        key={module.href}
        href={module.href}
        className="stock-card"
      >
        <span className="stock-icon">
          {module.icon}
        </span>

        <h3>{module.title}</h3>

        <p>{module.description}</p>

        <span className="stock-open">
          Open Module →
        </span>
      </Link>
    );
  }

  return (
    <main className="stock-page">
      <div className="stock-container">
        <header className="stock-header">
          <div>
            <p className="stock-eyebrow">
              DOSETRACK / FAMILY PLANNING
            </p>

            <h1>Stock Management</h1>

            <p className="stock-subtitle">
              Manage medication inventory,
              stock movements, depot orders and
              inter-clinic stock transfers across
              your assigned clinics.
            </p>
          </div>

          <Link
            href="/family-planning/dashboard"
            className="stock-back"
          >
            ← Back to Dashboard
          </Link>
        </header>

        {loading ? (
          <section className="stock-notice">
            Loading stock management...
          </section>
        ) : error ? (
          <section
            className="stock-notice error"
            role="alert"
          >
            <p>{error}</p>

            {!authenticated && (
              <Link href="/family-planning/login">
                Sign In
              </Link>
            )}
          </section>
        ) : (
          <>
            <section className="stock-overview">
              <div>
                <span>Assigned Clinics</span>
                <strong>{assignedCount}</strong>
              </div>

              <div>
                <span>Inventory Modules</span>
                <strong>
                  {inventoryModules.length}
                </strong>
              </div>

              <div>
                <span>Ordering & Transfer Modules</span>
                <strong>
                  {orderingModules.length}
                </strong>
              </div>
            </section>

            {assignedCount === 0 && (
              <section className="stock-notice">
                No clinics are currently assigned
                to your account. Contact the
                DoseTrack administrator.
              </section>
            )}

            <section>
              <h2 className="stock-section-title">
                Inventory Management
              </h2>

              <div className="stock-grid">
                {inventoryModules.map(renderModule)}
              </div>
            </section>

            <section>
              <h2 className="stock-section-title">
                Depot Ordering & Stock Transfers
              </h2>

              <div className="stock-grid">
                {orderingModules.map(renderModule)}
              </div>
            </section>

            <section className="stock-info">
              <h2>Stock Management Workflow</h2>

              <p>
                DoseTrack supports medication
                stock received, dispensed and wasted,
                as well as depot replenishment
                orders and transfers between clinics.
              </p>

              <p>
                Inter-clinic transfers require
                approval from the sending clinic
                before dispatch. The receiving
                clinic must confirm receipt before
                the transferred stock is added
                to its inventory.
              </p>
            </section>
          </>
        )}
      </div>

      <style jsx global>{`
        .stock-page {
          min-height: 100vh;
          padding: 30px 20px;
          background: #f4f8fa;
          font-family: Arial, sans-serif;
          color: #17333b;
        }

        .stock-container {
          max-width: 1180px;
          margin: 0 auto;
        }

        .stock-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 30px;
        }

        .stock-eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.3px;
          color: #0f766e;
        }

        .stock-header h1 {
          font-size: 32px;
          margin: 8px 0;
        }

        .stock-subtitle {
          max-width: 700px;
          line-height: 1.6;
          color: #64748b;
        }

        .stock-back {
          display: inline-block;
          padding: 12px 16px;
          border-radius: 9px;
          background: white;
          color: #164c7e;
          border: 1px solid #d8e2e8;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }

        .stock-overview {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 30px;
        }

        .stock-overview > div {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .stock-overview span {
          font-size: 13px;
          color: #64748b;
        }

        .stock-overview strong {
          font-size: 30px;
          color: #0f766e;
        }

        .stock-section-title {
          margin: 28px 0 18px;
          font-size: 21px;
        }

        .stock-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .stock-card {
          display: flex;
          flex-direction: column;
          padding: 24px;
          border: 1px solid #e1e8ed;
          border-radius: 14px;
          background: white;
          color: inherit;
          text-decoration: none;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .stock-card:hover {
          transform: translateY(-3px);
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.07);
        }

        .stock-icon {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 50px;
          height: 50px;
          border-radius: 12px;
          background: #edf7f5;
          font-size: 25px;
        }

        .stock-card h3 {
          font-size: 18px;
          margin: 18px 0 8px;
        }

        .stock-card p {
          flex: 1;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
        }

        .stock-open {
          display: inline-block;
          margin-top: 18px;
          font-size: 13px;
          font-weight: 800;
          color: #0f766e;
        }

        .stock-notice {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .stock-notice.error {
          background: #fff0f0;
          color: #a02727;
        }

        .stock-info {
          background: #edf7f5;
          border: 1px solid #d5eae5;
          border-radius: 14px;
          padding: 24px;
          margin-top: 30px;
        }

        .stock-info h2 {
          font-size: 18px;
          margin-top: 0;
        }

        .stock-info p {
          font-size: 14px;
          line-height: 1.7;
          color: #475569;
        }

        @media (max-width: 900px) {
          .stock-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .stock-page {
            padding: 18px 12px;
          }

          .stock-grid,
          .stock-overview {
            grid-template-columns: 1fr;
          }

          .stock-header h1 {
            font-size: 26px;
          }

          .stock-card {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
}
