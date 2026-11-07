
"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function StaffApprovals() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("Checking permissions...");
  const [busy, setBusy] = useState("");
  const [adminId, setAdminId] = useState("");
  const [verified, setVerified] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setMessage("Checking permissions...");

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      setAuthorized(false);
      setMessage("Please log in as Super Admin.");
      return;
    }

    setAdminId(auth.user.id);

    const { data: admin, error: adminError } =
      await supabase
        .from("staff_profiles")
        .select("role, approval_status, is_active")
        .eq("id", auth.user.id)
        .maybeSingle();

    if (adminError || !admin) {
      setAuthorized(false);
      setMessage(adminError?.message || "Admin profile not found.");
      return;
    }

    if (
      admin.role !== "super_admin" ||
      admin.approval_status !== "approved" ||
      admin.is_active !== true
    ) {
      setAuthorized(false);
      setMessage("Super Admin access required.");
      return;
    }

    setAuthorized(true);

    const { data, error } = await supabase
      .from("staff_profiles")
      .select(
        "id,full_name,email,role,sanc_number,professional_category,approval_status,is_active,email_verified_at"
      )
      .eq("role", "nurse")
      .order("created_at", { ascending: false });

    if (error) {
      setStaff([]);
      setMessage(error.message);
      return;
    }

    setStaff((data || []) as Staff[]);
    setMessage("");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(
    person: Staff,
    status: "approved" | "rejected" | "suspended"
  ) {
    if (!authorized || person.role !== "nurse" || person.id === adminId) {
      setMessage("This account cannot be modified here.");
      return;
    }

    if (status === "approved") {
      if (!person.sanc_number) {
        setMessage("SANC number is required.");
        return;
      }

      if (!person.email_verified_at) {
        setMessage("Email verification is outstanding.");
        return;
      }

      if (!verified[person.id]) {
        setMessage("Verify SANC registration before approval.");
        return;
      }
    }

    if (!window.confirm(
      `Change ${person.full_name} to ${status}?`
    )) {
      return;
    }

    setBusy(person.id);
    setMessage("");

    const { data, error } = await supabase
      .from("staff_profiles")
      .update({
        approval_status: status,
        is_active: status === "approved",
        approved_at:
          status === "approved" ? new Date().toISOString() : null,
        approved_by: status === "approved" ? adminId : null,
      })
      .eq("id", person.id)
      .eq("role", "nurse")
      .select("id");

    if (error) {
      setMessage(error.message);
    } else if (!data?.length) {
      setMessage("No record updated. Check database permissions.");
    } else {
      await load();
      setVerified(prev => ({ ...prev, [person.id]: false }));
      setMessage(`${person.full_name}: ${status}`);
    }

    setBusy("");
  }

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <h1>Family Planning — Staff Approvals</h1>

      {message && (
        <p role="status" style={{ color: "#334155" }}>
          {message}
        </p>
      )}

      {authorized && (
        <>
          <p>
            Registered nurses: {staff.length} | Pending:{" "}
            {staff.filter(p => p.approval_status === "pending").length}
          </p>

          <button onClick={() => void load()}>
            Refresh registrations
          </button>

          <div
            style={{
              display: "grid",
              gap: 16,
              marginTop: 20,
            }}
          >
            {staff.length === 0 && (
              <p>No nurse registrations found.</p>
            )}

            {staff.map(person => (
              <section
                key={person.id}
                style={{
                  padding: 20,
                  background: "white",
                  border: "1px solid #cbd5e1",
                  borderRadius: 12,
                }}
              >
                <h2>{person.full_name}</h2>
                <p>Email: {person.email}</p>
                <p>SANC: {person.sanc_number || "Not supplied"}</p>
                <p>
                  Category:{" "}
                  {person.professional_category || "Not supplied"}
                </p>
                <p>Status: {person.approval_status}</p>
                <p>
                  Email verification:{" "}
                  {person.email_verified_at
                    ? "Recorded"
                    : "Not recorded"}
                </p>
                <p>
                  Clinical access:{" "}
                  {person.is_active ? "Active" : "Inactive"}
                </p>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={verified[person.id] || false}
                    onChange={e =>
                      setVerified(prev => ({
                        ...prev,
                        [person.id]: e.target.checked,
                      }))
                    }
                  />
                  I have independently verified this nurse's
                  SANC registration.
                </label>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    disabled={busy !== ""}
                    onClick={() => void change(person, "approved")}
                    style={{
                      padding: 12,
                      background: "#0f766e",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                    }}
                  >
                    {busy === person.id
                      ? "Processing..."
                      : "Approve & Activate"}
                  </button>

                  <button
                    disabled={busy !== ""}
                    onClick={() => void change(person, "rejected")}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    Reject
                  </button>

                  <button
                    disabled={busy !== ""}
                    onClick={() => void change(person, "suspended")}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    Suspend
                  </button>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
