
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Site = {
  id: string;
  site_name: string;
  province: string | null;
};

type Nurse = {
  id: string;
  full_name: string;
  email: string;
  approval_status: string;
  is_active: boolean;
};

export default function AssignClinicPage() {
  const router = useRouter();
  const params = useSearchParams();

  const staffId = params.get("staffId") || "";

  const [nurse, setNurse] = useState<Nurse | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [original, setOriginal] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setAuthorized(false);
    setMessage("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError) throw adminError;

      if (isAdmin !== true) {
        setMessage("Super Admin access required.");
        return;
      }

      setAuthorized(true);

      if (!staffId) {
        setMessage(
          "No nurse selected. Return to Staff Approvals."
        );
        return;
      }

      const { data: nurseData, error: nurseError } =
        await supabase
          .from("staff_profiles")
          .select(
            "id,full_name,email,approval_status,is_active"
          )
          .eq("id", staffId)
          .eq("role", "nurse")
          .maybeSingle();

      if (nurseError) throw nurseError;

      if (!nurseData) {
        setMessage("Nurse not found.");
        return;
      }

      setNurse(nurseData);

      const { data: siteData, error: siteError } =
        await supabase
          .from("sites")
          .select("id,site_name,province")
          .eq("is_active", true)
          .order("site_name");

      if (siteError) throw siteError;

      setSites(siteData || []);

      const { data: assignments, error: assignError } =
        await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", staffId);

      if (assignError) throw assignError;

      const ids = (assignments || []).map(
        item => item.site_id
      );

      setSelected(ids);
      setOriginal(ids);

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load clinic assignments."
      );
    } finally {
      setLoading(false);
    }
  }, [router, staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSite(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  }

  async function saveAssignments() {
    if (!authorized || !nurse) return;

    if (
      nurse.approval_status !== "approved" ||
      nurse.is_active !== true
    ) {
      setMessage(
        "Only approved, active nurses can be assigned."
      );
      return;
    }

    if (selected.length === 0) {
      setMessage("Select at least one clinic.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const toAdd = selected.filter(
        id => !original.includes(id)
      );

      const toRemove = original.filter(
        id => !selected.includes(id)
      );

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("nurse_site_assignments")
          .insert(
            toAdd.map(siteId => ({
              nurse_id: nurse.id,
              site_id: siteId,
            }))
          );

        if (error) throw error;
      }

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("nurse_site_assignments")
          .delete()
          .eq("nurse_id", nurse.id)
          .in("site_id", toRemove);

        if (error) throw error;
      }

      await load();
      setMessage("Clinic assignments saved successfully.");

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save assignments."
      );
    } finally {
      setSaving(false);
    }
  }

  const buttonStyle: React.CSSProperties = {
    padding: "12px 18px",
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid #cbd5e1",
  };

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "32px auto",
        padding: 24,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <h1>DoseTrack — Assign Clinic</h1>
      <p>Super Admin | Nurse Clinic Management</p>

      <button
        style={buttonStyle}
        onClick={() =>
          router.push("/admin/staff-approvals")
        }
      >
        Back to Staff Approvals
      </button>

      {message && (
        <p
          role="status"
          style={{
            padding: 12,
            background: "#e2e8f0",
            borderRadius: 8,
            marginTop: 20,
          }}
        >
          {message}
        </p>
      )}

      {loading && <p>Loading clinics...</p>}

      {!loading && authorized && nurse && (
        <section
          style={{
            marginTop: 24,
            background: "white",
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2>{nurse.full_name}</h2>
          <p>Email: {nurse.email}</p>
          <p>Status: {nurse.approval_status}</p>

          <h3>Select Authorised Clinics</h3>

          <p>
            Selected: {selected.length} of {sites.length}
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 20,
              marginBottom: 24,
            }}
          >
            {sites.length === 0 && (
              <p>No active clinics found in Supabase.</p>
            )}

            {sites.map(site => (
              <label
                key={site.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(site.id)}
                  onChange={() => toggleSite(site.id)}
                  disabled={saving}
                />

                <span>
                  <strong>{site.site_name}</strong>
                  {site.province && (
                    <small
                      style={{
                        display: "block",
                        color: "#64748b",
                      }}
                    >
                      {site.province}
                    </small>
                  )}
                </span>
              </label>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => void saveAssignments()}
              disabled={
                saving ||
                sites.length === 0 ||
                selected.length === 0
              }
              style={{
                ...buttonStyle,
                background: "#0f766e",
                color: "white",
                border: "none",
              }}
            >
              {saving
                ? "Saving..."
                : "Save Clinic Assignments"}
            </button>

            <button
              onClick={() =>
                router.push("/admin/staff-approvals")
              }
              style={buttonStyle}
            >
              Return to Staff Approvals
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
