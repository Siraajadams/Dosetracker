
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

type Nurse = {
  id: string;
  full_name: string | null;
  email: string | null;
  approval_status: string;
  is_active: boolean;
};

type Site = {
  id: string;
  site_name: string;
  province: string | null;
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  fontSize: 15,
};

const buttonStyle: CSSProperties = {
  padding: "14px 20px",
  background: "#0f766e",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 15,
};

function AssignClinicContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedStaffId = searchParams.get("staffId");

  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  const [nurseId, setNurseId] = useState("");

  const [selectedSites, setSelectedSites] =
    useState<string[]>([]);

  const [assignedSites, setAssignedSites] =
    useState<string[]>([]);

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setLoadError("");
    setAuthorized(false);

    try {
      // Step 1: Confirm authentication
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      // Step 2: Verify Super Admin
      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError) {
        throw adminError;
      }

      if (isAdmin !== true) {
        setLoadError("Super Admin access required.");
        return;
      }

      // Step 3: Load approved nurses and active sites
      const [nurseResult, siteResult] =
        await Promise.all([
          supabase
            .from("staff_profiles")
            .select(
              "id,full_name,email,approval_status,is_active"
            )
            .eq("role", "nurse")
            .eq("approval_status", "approved")
            .eq("is_active", true)
            .order("full_name"),

          supabase
            .from("sites")
            .select("id,site_name,province")
            .eq("is_active", true)
            .order("site_name"),
        ]);

      if (nurseResult.error) {
        throw nurseResult.error;
      }

      if (siteResult.error) {
        throw siteResult.error;
      }

      const nurseList: Nurse[] = nurseResult.data || [];
      const siteList: Site[] = siteResult.data || [];

      setNurses(nurseList);
      setSites(siteList);

      // Step 4: Preselect nurse if coming
      // from Staff Approvals
      const requestedNurse = nurseList.find(
        nurse => nurse.id === requestedStaffId
      );

      if (requestedNurse) {
        setNurseId(requestedNurse.id);
      } else if (nurseList.length === 1) {
        setNurseId(nurseList[0].id);
      } else {
        setNurseId("");
      }

      setAuthorized(true);

      if (siteList.length === 0) {
        setMessage(
          "No active clinics found. Add clinics to the sites table in Supabase."
        );
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load clinic assignment page."
      );
    } finally {
      setLoading(false);
    }
  }, [requestedStaffId, router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  // Load the selected nurse's existing assignments
  useEffect(() => {
    if (!authorized || !nurseId) {
      setAssignedSites([]);
      setSelectedSites([]);
      setLoadingAssignments(false);
      return;
    }

    let cancelled = false;

    async function loadAssignments() {
      setLoadingAssignments(true);
      setMessage("");
      setAssignedSites([]);
      setSelectedSites([]);

      try {
        const { data, error } = await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", nurseId);

        if (cancelled) return;

        if (error) throw error;

        const ids = (data || []).map(
          item => item.site_id
        );

        setAssignedSites(ids);
        setSelectedSites(ids);
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load existing assignments."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAssignments(false);
        }
      }
    }

    void loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [authorized, nurseId]);

  function toggleSite(siteId: string) {
    if (saving || loadingAssignments) return;

    setSelectedSites(previous =>
      previous.includes(siteId)
        ? previous.filter(id => id !== siteId)
        : [...previous, siteId]
    );
  }

  async function saveAssignments() {
    if (!authorized || !nurseId) {
      setMessage("Please select an approved nurse.");
      return;
    }

    if (saving || loadingAssignments) return;

    setSaving(true);
    setMessage("");

    try {
      // Reconfirm logged-in user
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      // Recheck Super Admin permission
      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError || isAdmin !== true) {
        throw new Error(
          "Super Admin permission is required."
        );
      }

      // Confirm nurse is still approved and active
      const { data: nurse, error: nurseError } =
        await supabase
          .from("staff_profiles")
          .select("id")
          .eq("id", nurseId)
          .eq("role", "nurse")
          .eq("approval_status", "approved")
          .eq("is_active", true)
          .maybeSingle();

      if (nurseError) throw nurseError;

      if (!nurse) {
        throw new Error(
          "This nurse is not currently approved and active."
        );
      }

      // Re-read current assignments before writing
      const { data: current, error: currentError } =
        await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", nurseId);

      if (currentError) throw currentError;

      const currentIds = (current || []).map(
        item => item.site_id
      );

      const toAdd = selectedSites.filter(
        id => !currentIds.includes(id)
      );

      const toRemove = currentIds.filter(
        id => !selectedSites.includes(id)
      );

      // Validate selected clinics are still active
      if (selectedSites.length > 0) {
        const { data: activeSites, error: siteError } =
          await supabase
            .from("sites")
            .select("id")
            .in("id", selectedSites)
            .eq("is_active", true);

        if (siteError) throw siteError;

        if (
          (activeSites || []).length !==
          selectedSites.length
        ) {
          throw new Error(
            "One or more selected clinics are no longer active. Refresh the page."
          );
        }
      }

      // Add new clinic assignments
      if (toAdd.length > 0) {
        const { error: insertError } =
          await supabase
            .from("nurse_site_assignments")
            .upsert(
              toAdd.map(siteId => ({
                nurse_id: nurseId,
                site_id: siteId,
                assigned_by: auth.user.id,
              })),
              {
                onConflict: "nurse_id,site_id",
              }
            );

        if (insertError) throw insertError;
      }

      // Remove deselected clinics
      if (toRemove.length > 0) {
        const { error: deleteError } =
          await supabase
            .from("nurse_site_assignments")
            .delete()
            .eq("nurse_id", nurseId)
            .in("site_id", toRemove);

        if (deleteError) throw deleteError;
      }

      // Refresh saved assignments
      const { data: refreshed, error: refreshError } =
        await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", nurseId);

      if (refreshError) throw refreshError;

      const savedIds = (refreshed || []).map(
        item => item.site_id
      );

      setAssignedSites(savedIds);
      setSelectedSites(savedIds);

      setMessage(
        `Clinic assignments saved successfully. ${savedIds.length} clinic(s) assigned.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save clinic assignments."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        Loading clinic assignment page...
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 850,
        margin: "32px auto",
        padding: 24,
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ color: "#075c59" }}>
          DoseTrack — Assign Clinic
        </h1>

        <p style={{ color: "#64748b" }}>
          Super Admin | Nurse Clinic Management
        </p>
      </header>

      {loadError && (
        <p
          role="alert"
          style={{
            padding: 14,
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 8,
          }}
        >
          {loadError}
        </p>
      )}

      {message && (
        <p
          role="status"
          style={{
            padding: 14,
            background: "#e0f2fe",
            color: "#075985",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          {message}
        </p>
      )}

      {authorized && (
        <>
          <section
            style={{
              background: "white",
              padding: 22,
              borderRadius: 12,
              marginBottom: 20,
              border: "1px solid #e2e8f0",
            }}
          >
            <h2>Select Approved Nurse</h2>

            <label
              htmlFor="nurse"
              style={{
                display: "block",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Nurse
            </label>

            <select
              id="nurse"
              value={nurseId}
              onChange={e => {
                setNurseId(e.target.value);
                setMessage("");
              }}
              style={inputStyle}
              disabled={saving || loadingAssignments}
            >
              <option value="">
                Select an approved nurse
              </option>

              {nurses.map(nurse => (
                <option
                  key={nurse.id}
                  value={nurse.id}
                >
                  {nurse.full_name || "Unnamed Nurse"}
                  {nurse.email
                    ? ` (${nurse.email})`
                    : ""}
                </option>
              ))}
            </select>

            {nurses.length === 0 && (
              <p style={{ color: "#b45309" }}>
                No approved nurses found.
                Approve a nurse first.
              </p>
            )}
          </section>

          {nurseId && (
            <section
              style={{
                background: "white",
                padding: 22,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
              }}
            >
              <h2>Assign Clinics</h2>

              <p style={{ color: "#64748b" }}>
                Select the clinics where this nurse
                is authorised to provide services.
              </p>

              {loadingAssignments ? (
                <p>Loading assigned clinics...</p>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      marginTop: 20,
                    }}
                  >
                    {sites.map(site => {
                      const checked =
                        selectedSites.includes(site.id);

                      return (
                        <label
                          key={site.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: 15,
                            border: checked
                              ? "1px solid #0f766e"
                              : "1px solid #e2e8f0",
                            background: checked
                              ? "#f0fdfa"
                              : "white",
                            borderRadius: 8,
                            cursor: saving
                              ? "not-allowed"
                              : "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleSite(site.id)
                            }
                            disabled={saving}
                            style={{
                              width: 18,
                              height: 18,
                            }}
                          />

                          <span>
                            <strong>
                              {site.site_name}
                            </strong>

                            {site.province && (
                              <span
                                style={{
                                  color: "#64748b",
                                }}
                              >
                                {" — "}
                                {site.province}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {sites.length === 0 && (
                    <p>
                      No active clinics available.
                    </p>
                  )}

                  <p
                    style={{
                      marginTop: 20,
                      fontWeight: 600,
                    }}
                  >
                    Selected Clinics:{" "}
                    {selectedSites.length}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      void saveAssignments()
                    }
                    disabled={saving}
                    style={{
                      ...buttonStyle,
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving
                      ? "Saving Assignments..."
                      : "Save Clinic Assignments"}
                  </button>
                </>
              )}
            </section>
          )}

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 24,
            }}
          >
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/admin/staff-approvals"
                )
              }
              style={{
                padding: "12px 18px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "white",
                cursor: "pointer",
              }}
            >
              Back to Staff Approvals
            </button>

            <button
              type="button"
              onClick={() => void loadPage()}
              style={{
                padding: "12px 18px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "white",
                cursor: "pointer",
              }}
            >
              Refresh Clinics
            </button>
          </div>
        </>
      )}
    </main>
  );
}

// Suspense fixes the Next.js useSearchParams
// prerendering error during production builds.
export default function AssignClinicPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            padding: 24,
            fontFamily: "Arial, sans-serif",
          }}
        >
          Loading clinic assignment page...
        </main>
      }
    >
      <AssignClinicContent />
    </Suspense>
  );
}
