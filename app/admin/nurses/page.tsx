
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Nurse = {
  id: string;
  full_name: string | null;
  email: string | null;
  sanc_number: string | null;
  mobile_number: string | null;
  professional_category: string | null;
  approval_status: string | null;
  is_active: boolean | null;
};

export default function NursesPage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadNurses() {
    setLoading(true);
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Please sign in to access Nurse Management.");
      setLoading(false);
      return;
    }

    const { data: isAdmin, error: roleError } =
      await supabase.rpc("dt_is_super_admin");

    if (roleError || isAdmin !== true) {
      setError("Access denied. Super administrator required.");
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("staff_profiles")
      .select(
        "id,full_name,email,sanc_number,mobile_number,professional_category,approval_status,is_active"
      )
      .eq("role", "nurse")
      .order("full_name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setNurses((data ?? []) as Nurse[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadNurses();
  }, []);

  const filtered = nurses.filter((nurse) =>
    [
      nurse.full_name,
      nurse.email,
      nurse.sanc_number,
      nurse.mobile_number,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main style={{ maxWidth: 1200, margin: "auto", padding: 24 }}>
      <h1>Family Planning — Nurse Management</h1>
      <p>View registered nurses and their account status.</p>

      <nav style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/admin">Admin Dashboard</Link>
        <Link href="/admin/staff-approvals">Nurse Approvals</Link>
        <Link href="/admin/assign-clinic">Clinic Assignment</Link>
        <Link href="/admin/clinics">Clinics</Link>
      </nav>

      <hr style={{ margin: "24px 0" }} />

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      {!error && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <input
              aria-label="Search nurses"
              placeholder="Search name, email, SANC or mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: 12, flex: 1 }}
            />
            <button onClick={() => void loadNurses()}>
              Refresh
            </button>
          </div>

          <p>Total registered nurses: {nurses.length}</p>

          {loading ? (
            <p>Loading nurses...</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Name",
                      "Email",
                      "SANC",
                      "Mobile",
                      "Category",
                      "Approval",
                      "Account",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: 12,
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((nurse) => (
                    <tr key={nurse.id}>
                      <td style={{ padding: 12 }}>
                        {nurse.full_name || "—"}
                      </td>
                      <td>{nurse.email || "—"}</td>
                      <td>{nurse.sanc_number || "—"}</td>
                      <td>{nurse.mobile_number || "—"}</td>
                      <td>{nurse.professional_category || "—"}</td>
                      <td>{nurse.approval_status || "Pending"}</td>
                      <td>
                        {nurse.is_active ? "Active" : "Inactive"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <p>No matching nurses found.</p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
