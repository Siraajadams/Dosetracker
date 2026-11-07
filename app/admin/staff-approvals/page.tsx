
"use client";

import { useEffect, useState, useCallback } from "react";
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
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      setAuthorized(false);
      setMessage("Please log in as Super Admin.");
      return;
    }

    const user = userData.user;
    setAdminId(user.id);

    const { data: admin, error: adminError } =
      await supabase
        .from("staff_profiles")
        .select("role, approval_status, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (adminError) {
      setAuthorized(false);
      setMessage(adminError.message);
      return;
    }

    if (
      !admin ||
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
      .order("created_at", { ascending: false });

    if (error) {
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
    if (person.id === adminId || person.role === "super_admin") {
      setMessage("Super Admin accounts cannot be changed here.");
      return;
    }

    if (status === "approved") {
      if (!person.sanc_number) {
        setMessage("SANC number is required before approval.");
        return;
      }

      if (!verified[person.id]) {
        setMessage("Confirm independent SANC verification first.");
        return;
      }

      if (!person.email_verified_at) {
        setMessage("Email verification is still outstanding.");
        return;
      }
    }

    if (!window.confirm(
      `Change ${person.full_name} to ${status}?`
    )) return;

    setBusy(person.id);
    setMessage("");

    try {
      const { error } = await supabase
        .from("staff_profiles")
        .update({
          approval_status: status,
          is_active: status === "approved",
          approved_at:
            status === "approved"
              ? new Date().toISOString()
              : null,
          approved_by:
            status === "approved" ? adminId : null,
        })
        .eq("id", person.id)
        .neq("role", "super_admin");

      if (error) throw error;

      await load();
      setVerified(prev => ({ ...prev, [person.id]: false }));
      setMessage(`${person.full_name}: ${status}`);
    } catch (err: unknown) {
      setMessage(
        err instanceof Error ? err.message : "Update failed."
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <main style={{
      padding: 24,
      fontFamily: "Arial, sans-serif",
      background: "#f8fafc",
      minHeight: "100vh"
    }}>
      <h1>Family Planning — Staff Approvals</h1>
      <p>{message}</p>

      {authorized && (
        <div style={{ display: "grid", gap: 14
