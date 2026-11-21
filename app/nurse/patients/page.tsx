
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = Record<string, unknown> & {
  id: string;
  site_id?: string | null;
};

type Membership = {
  facility_id: string;
  active: boolean;
  role: string;
};

type Facility = {
  id: string;
  name: string;
};

function field(p: Patient, ...keys: string[]) {
  for (const key of keys) {
    const value = p[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

export default function NursePatientsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [facilityNames, setFacilityNames] = useState<
    Record<string, string>
  >({});

  const [facility, setFacility] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        // STEP 1: Authenticate healthcare worker

        const {
          data: auth,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !auth.user) {
          router.replace("/family-planning/login");
          return;
        }

        const user = auth.user;

        // STEP 2: Check staff approval

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("staff_profiles")
          .select("role, approval_status, is_active")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const clinical =
          profile?.role === "nurse" ||
          profile?.role === "healthcare_worker";

        if (
          !clinical ||
          profile?.approval_status !== "approved" ||
          profile?.is_active !== true ||
          !user.email_confirmed_at
        ) {
          router.replace("/pending-approval");
          return;
        }

        // STEP 3: Retrieve assigned clinics

        const {
          data: memberships,
          error: membershipError,
        } = await supabase
          .from("fp_memberships")
          .select("facility_id, active, role")
          .eq("user_id", user.id)
          .eq("active", true);

        if (membershipError) {
          throw membershipError;
        }

        const ids = [
          ...new Set(
            ((memberships ?? []) as Membership[])
              .filter((m) =>
                [
                  "nurse",
                  "healthcare_worker",
                  "doctor",
                  "administrator",
                ].includes(m.role)
              )
              .map((m) => m.facility_id)
              .filter(Boolean)
          ),
        ];

        if (!ids.length) {
          throw new Error(
            "No active clinic is assigned to your account."
          );
        }

        // STEP 4: Retrieve clinic names

        const {
          data: clinicRecords,
          error: clinicError,
        } = await supabase
          .from("fp_facilities")
          .select("id, name")
          .in("id", ids);

        if (clinicError) {
          console.warn(
            "Unable to load clinic names:",
            clinicError.message
          );
        }

        const names: Record<string, string> = {};

        ((clinicRecords ?? []) as Facility[]).forEach(
          (clinic) => {
            names[clinic.id] = clinic.name;
          }
        );

        // STEP 5: Retrieve patients from assigned clinics

        const {
          data: records,
          error: patientsError,
        } = await supabase
          .from("patients")
          .select("*")
          .in("site_id", ids)
          .order("id", { ascending: false })
          .limit(1000);

        if (patientsError) {
          throw patientsError;
        }

        if (!cancelled) {
          setFacilities(ids);
          setFacilityNames(names);

          setFacility((current) =>
            current && ids.includes(current)
              ? current
              : ids[0]
          );

          setPatients((records ?? []) as Patient[]);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load patients."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // STEP 6: Filter patients by clinic and search

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return patients.filter(
      (p) =>
        p.site_id === facility &&
        (!q ||
          [
            field(p, "first_name", "firstname", "name"),
            field(p, "surname", "last_name", "lastname"),
            field(
              p,
              "id_number",
              "id_passport",
              "passport_number",
              "national_id"
            ),
            field(
              p,
              "contact_number",
              "phone",
              "mobile_number"
            ),
          ].some((value) =>
            value.toLowerCase().includes(q)
          ))
    );
  }, [patients, facility, search]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f8fa",
        padding: "32px 20px",
        fontFamily: "Arial, sans-serif",
        color: "#173b40",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "auto",
        }}
      >
        <Link
          href="/family-planning/dashboard"
          style={{ color: "#08766e" }}
        >
          ← Clinical Dashboard
        </Link>

        <header
          style={{
            background:
              "linear-gradient(110deg,#0d444a,#22898a)",
            color: "white",
            borderRadius: 18,
            padding: 30,
            marginTop: 20,
          }}
        >
          <p
            style={{
              letterSpacing: 2,
              fontSize: 11,
            }}
          >
            DOSETRACK / FAMILY PLANNING
          </p>

          <h1 style={{ marginBottom: 8 }}>
            Contraceptive Administration
          </h1>

          <p>
            Find a patient, open their clinical record,
            and record contraceptive medication
            administration.
          </p>
        </header>

        <section
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            marginTop: 20,
            border: "1px solid #dce7e9",
          }}
        >
          <h2>Find patient</h2>

          {loading && (
            <p>
              Checking clinic membership and loading
              patients…
            </p>
          )}

          {error && (
            <p
              role="alert"
              style={{ color: "#b91c1c" }}
            >
              {error}
            </p>
          )}

          {!loading && !error && (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  marginBottom: 20,
                }}
              >
                <label
                  style={{ flex: "1 1 260px" }}
                >
                  Assigned clinic

                  <select
                    value={facility}
                    onChange={(e) =>
                      setFacility(e.target.value)
                    }
                    style={inputStyle}
                  >
                    {facilities.map((id) => (
                      <option key={id} value={id}>
                        {facilityNames[id] || id}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  style={{ flex: "2 1 300px" }}
                >
                  Search by name, ID/passport or phone

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Search patient…"
                    style={inputStyle}
                  />
                </label>
              </div>

              <p>
                {filtered.length} matching patient(s)
              </p>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {filtered.map((p) => (
                  <article
                    key={p.id}
                    style={{
                      padding: 17,
                      border: "1px solid #dce7e9",
                      borderRadius: 12,
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong>
                        {[
                          field(
                            p,
                            "first_name",
                            "firstname",
                            "name"
                          ),
                          field(
                            p,
                            "surname",
                            "last_name",
                            "lastname"
                          ),
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                          "Patient record"}
                      </strong>

                      <div
                        style={{
                          color: "#637b80",
                          fontSize: 13,
                          marginTop: 5,
                        }}
                      >
                        {field(
                          p,
                          "id_number",
                          "id_passport",
                          "passport_number",
                          "national_id"
                        ) || "No ID displayed"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <Link
                        href={`/nurse/patients/${encodeURIComponent(
                          p.id
                        )}`}
                        style={{
                          color: "#08766e",
                          padding: 10,
                        }}
                      >
                        Clinical history
                      </Link>

                      <Link
                        href={`/nurse/patients/${encodeURIComponent(
                          p.id
                        )}/administration`}
                        style={{
                          background: "#0e756d",
                          color: "white",
                          padding: "11px 15px",
                          borderRadius: 9,
                          textDecoration: "none",
                        }}
                      >
                        Record administration →
                      </Link>
                    </div>
                  </article>
                ))}

                {!filtered.length && (
                  <p>
                    No patients were returned for this
                    clinic. Check the clinic assignment,
                    patient site_id values and Supabase
                    row-level security policies.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 8,
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  boxSizing: "border-box",
};
