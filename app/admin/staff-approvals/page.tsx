
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Staff = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  sanc_number: string | null;
  professional_category: string | null;
  approval_status: string;
  is_active: boolean;
  email_verified_at: string | null;
};

type Tab = "pending" | "approved" | "rejected";

const styles = `
.staff-page {
  min-height: 100vh;
  background: #f3f7fa;
  color: #18323e;
  font-family: Arial, sans-serif;
}
.staff-page * { box-sizing: border-box; }
.staff-header {
  background: linear-gradient(110deg,#123e47,#087f80);
  color: white;
  padding: 32px;
}
.staff-container {
  max-width: 1200px;
  margin: auto;
  padding: 26px;
}
.staff-header-inner {
  max-width: 1200px;
  margin: auto;
}
.staff-brand {
  font-size: 24px;
  font-weight: 800;
}
.staff-brand span { color: #70e4d2; }
.staff-header h1 {
  margin: 30px 0 8px;
  font-size: 32px;
}
.staff-header p { color: #d5f0ed; }
.staff-back {
  color: #c6f4ef;
  text-decoration: none;
  font-size: 13px;
}
.staff-metrics {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 16px;
  margin-bottom: 25px;
}
.staff-metric {
  background: white;
  border: 1px solid #e1e9ee;
  border-radius: 15px;
  padding: 22px;
}
.staff-metric label {
  color: #6b7f8c;
  font-size: 12px;
}
.staff-metric strong {
  display: block;
  font-size: 31px;
  margin-top: 9px;
  color: #123e47;
}
.staff-panel {
  background: white;
  border: 1px solid #e1e9ee;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
}
.staff-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
}
.staff-tabs {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  margin: 20px 0;
}
.staff-tab {
  padding: 11px 17px;
  background: #f0f5f7;
  color: #47616c;
  border: 1px solid #e0e9ed;
  border-radius: 9px;
  cursor: pointer;
  font-weight: 700;
}
.staff-tab.active {
  background: #087f80;
  color: white;
}
.staff-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 16px;
}
.staff-card {
  border: 1px solid #dfe8ed;
  border-radius: 14px;
  padding: 22px;
  background: white;
}
.staff-card h3 {
  margin: 0 0 16px;
  font-size: 19px;
}
.staff-detail {
  margin: 10px 0;
  color: #506773;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.staff-detail strong { color: #234450; }
.staff-status {
  display: inline-block;
  border-radius: 20px;
  padding: 6px 11px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}
.staff-status.pending {
  background: #fff4dc;
  color: #946200;
}
.staff-status.approved {
  background: #dcfce7;
  color: #166534;
}
.staff-status.rejected,
.staff-status.suspended {
  background: #fee2e2;
  color: #991b1b;
}
.staff-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
.staff-button {
  padding: 11px 15px;
  border: 1px solid #d6e1e7;
  border-radius: 9px;
  background: white;
  color: #294b58;
  font-weight: 700;
  cursor: pointer;
}
.staff-button.primary {
  background: #087f80;
  border-color: #087f80;
  color: white;
}
.staff-button.danger {
  color: #b42318;
  border-color: #fecaca;
}
.staff-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.staff-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  margin-top: 17px;
  background: #f0f8f8;
  border-radius: 10px;
  font-size: 13px;
}
.staff-check input {
  width: 18px;
  height: 18px;
  accent-color: #087f80;
}
.staff-message {
  padding: 16px;
  background: #eef6f7;
  border-radius: 10px;
  margin-bottom: 18px;
}
.staff-empty {
  text-align: center;
  padding: 45px;
  color: #708392;
}
@media(max-width:850px) {
  .staff-grid { grid-template-columns: 1fr; }
  .staff-metrics {
    grid-template-columns: repeat(2,1fr);
  }
}
@media(max-width:500px) {
  .staff-metrics { grid-template-columns: 1fr 1fr; }
  .staff-header { padding: 22px; }
  .staff-header h1 { font-size: 25px; }
  .staff-container { padding: 14px; }
  .staff-panel { padding: 15px; }
}
`;

export default function StaffApprovals() {
  const router = useRouter();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [adminId, setAdminId] = useState("");
  const [tab, setTab] = useState<Tab>("pending");

  const [verified, setVerified] =
    useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setAuthorized(false);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/family-planning/login");
        return;
      }

      setAdminId(auth.user.id);

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError) throw adminError;

      if (isAdmin !== true) {
        throw new Error("Super Admin access required.");
      }

      setAuthorized(true);

      const { data, error } = await supabase
        .from("staff_profiles")
        .select(
          "id,full_name,email,role,sanc_number,professional_category,approval_status,is_active,email_verified_at"
        )
.eq("role", "nurse")
.neq("approval_status", "rejected")
.order("created_at", { ascending: false });

      if (error) throw error;

      setStaff((data ?? []) as Staff[]);
    } catch (e) {
      setStaff([]);
      setMessage(
        e instanceof Error
          ? e.message
          : "Unable to load registrations."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => ({
    total: staff.length,
    pending: staff.filter(
      p => p.approval_status === "pending"
    ).length,
    approved: staff.filter(
      p =>
        p.approval_status === "approved" &&
        p.is_active
    ).length,
    
rejected: staff.filter(
  p => p.approval_status === "suspended"
).length,

  }), [staff]);

  const visible = useMemo(() => {
    return staff.filter(person => {
      if (tab === "pending") {
        return person.approval_status === "pending";
      }

      if (tab === "approved") {
        return (
          person.approval_status === "approved" &&
          person.is_active
        );
      }

      return (
        person.approval_status === "rejected" ||
        person.approval_status === "suspended"
      );
    });
  }, [staff, tab]);

  function selectClinic(person: Staff) {
    if (
      !authorized ||
      person.approval_status !== "approved" ||
      !person.is_active
    ) {
      setMessage("Approve the nurse before assigning a clinic.");
      return;
    }

    router.push(
      `/admin/assign-clinic?staffId=${encodeURIComponent(person.id)}`
    );
  }

  async function change(
    person: Staff,
    status: "approved" | "rejected" | "suspended"
  ) {
    if (
      !authorized ||
      person.role !== "nurse" ||
      person.id === adminId ||
      busy
    ) {
      setMessage("This account cannot be modified here.");
      return;
    }

    if (status === "approved") {
      if (person.approval_status !== "pending") {
        setMessage(
          "Only pending applications can be approved here."
        );
        return;
      }

      if (!person.sanc_number?.trim()) {
        setMessage("SANC number is required.");
        return;
      }

      if (!person.email_verified_at) {
        setMessage("Email verification is outstanding.");
        return;
      }

      if (!verified[person.id]) {
        setMessage(
          "Independently verify SANC registration before approval."
        );
        return;
      }
    }

    if (
      !window.confirm(
        `Change ${person.full_name} to ${status}?`
      )
    ) {
      return;
    }

    setBusy(person.id);
    setMessage("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Session expired. Please sign in again.");
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError || isAdmin !== true) {
        throw new Error("Super Admin access required.");
      }

      const { data, error } = await supabase
        .from("staff_profiles")
        .update({
          approval_status: status,
          is_active: status === "approved",
          approved_at:
            status === "approved"
              ? new Date().toISOString()
              : null,
          approved_by:
            status === "approved"
              ? auth.user.id
              : null,
        })
        .eq("id", person.id)
        .eq("role", "nurse")
        .eq("approval_status", person.approval_status)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          "No record updated. Check RLS permissions or refresh the page."
        );
      }

      setVerified(previous => ({
        ...previous,
        [person.id]: false,
      }));

      setStaff(previous =>
        previous.map(nurse =>
          nurse.id === person.id
            ? {
                ...nurse,
                approval_status: status,
                is_active: status === "approved",
              }
            : nurse
        )
      );

      if (status === "approved") {
        router.push(
          `/admin/assign-clinic?staffId=${encodeURIComponent(person.id)}`
        );
        return;
      }

      setMessage(
        `${person.full_name} was ${status}.`
      );

      await load();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Unable to update nurse."
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="staff-page">
      <style>{styles}</style>

      <header className="staff-header">
        <div className="staff-header-inner">
          <div className="staff-brand">
            Dose<span>Track</span>
          </div>

          <p>FAMILY PLANNING ADMINISTRATION</p>

          <Link
            href="/family-planning/dashboard"
            className="staff-back"
          >
            ← Back to Dashboard
          </Link>

          <h1>Staff Approvals</h1>

          <p>
            Review nurse registrations, verify credentials
            and manage clinical access.
          </p>
        </div>
      </header>

      <div className="staff-container">
        {message && (
          <div className="staff-message" role="status">
            {message}
          </div>
        )}

        {loading ? (
          <section className="staff-panel">
            Loading nurse registrations...
          </section>
        ) : authorized ? (
          <>
            <div className="staff-metrics">
              <div className="staff-metric">
                <label>Total Nurses</label>
                <strong>{counts.total}</strong>
              </div>

              <div className="staff-metric">
                <label>Pending Approval</label>
                <strong>{counts.pending}</strong>
              </div>

              <div className="staff-metric">
                <label>Approved & Active</label>
                <strong>{counts.approved}</strong>
              </div>

              <div className="staff-metric">
                <label>Suspended Accounts</label>
                <strong>{counts.rejected}</strong>
              </div>
            </div>

            <section className="staff-panel">
              <div className="staff-toolbar">
                <div>
                  <h2>Nurse Registration Directory</h2>
                  <p>
                    Review applications by approval status.
                  </p>
                </div>

                <button
                  className="staff-button"
                  type="button"
                  disabled={busy !== ""}
                  onClick={() => void load()}
                >
                  Refresh Registrations
                </button>
              </div>

              <div className="staff-tabs">
                <button
                  type="button"
                  className={
                    tab === "pending"
                      ? "staff-tab active"
                      : "staff-tab"
                  }
                  onClick={() => setTab("pending")}
                >
                  Pending ({counts.pending})
                </button>

                <button
                  type="button"
                  className={
                    tab === "approved"
                      ? "staff-tab active"
                      : "staff-tab"
                  }
                  onClick={() => setTab("approved")}
                >
                  Approved ({counts.approved})
                </button>

                <button
                  type="button"
                  className={
                    tab === "rejected"
                      ? "staff-tab active"
                      : "staff-tab"
                  }
                  onClick={() => setTab("rejected")}
                >
                  Rejected / Suspended ({counts.rejected})
                </button>
              </div>

              {visible.length === 0 ? (
                <div className="staff-empty">
                  {tab === "pending"
                    ? "No pending nurse applications."
                    : tab === "approved"
                    ? "No approved active nurses found."
                    : "No rejected or suspended nurses found."}
                </div>
              ) : (
                <div className="staff-grid">
                  {visible.map(person => {
                    const approved =
                      person.approval_status === "approved" &&
                      person.is_active;

                    const pending =
                      person.approval_status === "pending";

                    return (
                      <section
                        key={person.id}
                        className="staff-card"
                      >
                        <h3>{person.full_name}</h3>

                        <span
                          className={
                            "staff-status " +
                            person.approval_status
                          }
                        >
                          {person.approval_status}
                        </span>

                        <p className="staff-detail">
                          <strong>Email:</strong>{" "}
                          {person.email}
                        </p>

                        <p className="staff-detail">
                          <strong>SANC:</strong>{" "}
                          {person.sanc_number || "Not supplied"}
                        </p>

                        <p className="staff-detail">
                          <strong>Category:</strong>{" "}
                          {person.professional_category ||
                            "Not supplied"}
                        </p>

                        <p className="staff-detail">
                          <strong>Email verification:</strong>{" "}
                          {person.email_verified_at
                            ? "Recorded"
                            : "Not recorded"}
                        </p>

                        <p className="staff-detail">
                          <strong>Account:</strong>{" "}
                          {person.is_active
                            ? "Active"
                            : "Inactive"}
                        </p>

                        {pending && (
                          <label className="staff-check">
                            <input
                              type="checkbox"
                              checked={
                                verified[person.id] || false
                              }
                              disabled={busy !== ""}
                              onChange={e =>
                                setVerified(previous => ({
                                  ...previous,
                                  [person.id]:
                                    e.target.checked,
                                }))
                              }
                            />

                            I have independently verified this
                            nurse&apos;s SANC registration.
                          </label>
                        )}

                        <div className="staff-actions">
                          {pending && (
                            <>
                              <button
                                type="button"
                                className="staff-button primary"
                                disabled={busy !== ""}
                                onClick={() =>
                                  void change(
                                    person,
                                    "approved"
                                  )
                                }
                              >
                                {busy === person.id
                                  ? "Processing..."
                                  : "Approve & Activate"}
                              </button>

                              <button
                                type="button"
                                className="staff-button danger"
                                disabled={busy !== ""}
                                onClick={() =>
                                  void change(
                                    person,
                                    "rejected"
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {approved && (
                            <>
                              <button
                                type="button"
                                className="staff-button primary"
                                disabled={busy !== ""}
                                onClick={() =>
                                  selectClinic(person)
                                }
                              >
                                Assign Clinic
                              </button>

                              <button
                                type="button"
                                className="staff-button danger"
                                disabled={busy !== ""}
                                onClick={() =>
                                  void change(
                                    person,
                                    "suspended"
                                  )
                                }
                              >
                                Suspend
                              </button>
                            </>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="staff-panel">
            Super Admin access is required.
          </section>
        )}
      </div>
    </main>
  );
}
