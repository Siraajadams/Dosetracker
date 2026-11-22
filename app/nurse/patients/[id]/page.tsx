
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  patient_clinic_id: string | null;
  site_id: string | null;
  first_name: string | null;
  surname: string | null;
  id_number: string | null;
  passport_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  mobile_number: string | null;
  email: string | null;
  address: string | null;
  suburb: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
};

type Site = {
  id: string;
  site_name: string;
};

type StaffProfile = {
  role: string | null;
  approval_status: string | null;
  is_active: boolean | null;
};

type Membership = {
  facility_id: string | null;
  role: string | null;
  active: boolean | null;
};

type MedicationHistory = {
  id: string;
  medication_name: string | null;
  dose: string | null;
  route: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  administered_at: string | null;
  injection_site: string | null;
  adverse_events: string | null;
  clinical_notes: string | null;
  next_dose_date: string | null;
  administered_by: string | null;
  healthcare_worker_name: string | null;
  service_type: string | null;
};

const CLINICAL_ROLES = [
  "nurse",
  "healthcare_worker",
];

const MEMBERSHIP_ROLES = [
  "nurse",
  "healthcare_worker",
  "doctor",
  "administrator",
];

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 22,
  marginBottom: 18,
};

const button: CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 9,
  border: "none",
  background: "#0f766e",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  fontSize: 14,
};

const secondaryButton: CSSProperties = {
  ...button,
  background: "#fff",
  color: "#0f766e",
  border: "1px solid #0f766e",
};

function display(value: string | null | undefined) {
  return value?.trim() || "Not recorded";
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  const parts = value.split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{ marginBottom: 15 }}>
      <div
        style={{
          color: "#64748b",
          fontSize: 13,
          marginBottom: 5,
        }}
      >
        {label}
      </div>

      <div style={{ fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

export default function PatientRecordPage() {
  const router = useRouter();
  const params = useParams();

  const patientId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [patient, setPatient] =
    useState<Patient | null>(null);

  const [site, setSite] =
    useState<Site | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [treatmentHistory, setTreatmentHistory] =
    useState<MedicationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [isSuperAdmin, setIsSuperAdmin] =
    useState(false);

  const [isClinicalWorker, setIsClinicalWorker] =
    useState(false);

  const loadPatient = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    setPatient(null);
    setSite(null);
    setTreatmentHistory([]);
    setHistoryError("");

    try {
      // STEP 1: Validate patient identifier

      const validUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!validUuid.test(patientId)) {
        throw new Error("Invalid patient record.");
      }

      // STEP 2: Authenticate current user

      const {
        data: auth,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/family-planning/login");
        return;
      }

      const user = auth.user;
      const userId = user.id;

      // STEP 3: Retrieve staff profile

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("staff_profiles")
        .select("role, approval_status, is_active")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const profile =
        profileData as StaffProfile | null;

      const role =
        profile?.role?.toLowerCase().trim() ?? "";

      const clinicalWorker =
        CLINICAL_ROLES.includes(role);

      setIsClinicalWorker(clinicalWorker);

      // STEP 4: Verify Super Administrator status

      // Clinical workers remain in the clinical workflow,
      // even if they also have administrator permissions.

      let superAdmin = false;

      if (!clinicalWorker) {
        const {
          data: isAdmin,
          error: adminError,
        } = await supabase.rpc("dt_is_super_admin");

        if (adminError) {
          throw adminError;
        }

        superAdmin = isAdmin === true;
      }

      setIsSuperAdmin(superAdmin);

      // STEP 5: Verify healthcare worker approval
      // and active clinic assignments

      let authorisedClinicIds: string[] = [];

      if (!superAdmin) {
        if (
          !clinicalWorker ||
          !user.email_confirmed_at ||
          profile?.approval_status !== "approved" ||
          profile?.is_active !== true
        ) {
          router.replace("/pending-approval");
          return;
        }

        const {
          data: membershipData,
          error: membershipError,
        } = await supabase
          .from("fp_memberships")
          .select("facility_id, role, active")
          .eq("user_id", userId)
          .eq("active", true);

        if (membershipError) {
          throw membershipError;
        }

        const memberships =
          (membershipData ?? []) as Membership[];

        authorisedClinicIds = Array.from(
          new Set(
            memberships
              .filter(
                (membership) =>
                  membership.active === true &&
                  MEMBERSHIP_ROLES.includes(
                    membership.role?.toLowerCase().trim() ?? ""
                  )
              )
              .map((membership) => membership.facility_id)
              .filter(
                (id): id is string =>
                  typeof id === "string" && id.length > 0
              )
          )
        );

        if (authorisedClinicIds.length === 0) {
          throw new Error(
            "No active clinic is assigned to your account."
          );
        }
      }

      // STEP 6: Retrieve patient
      // Clinical workers can only access assigned clinics.
      // Supabase RLS must enforce the same restriction.

      let patientQuery = supabase
        .from("patients")
        .select(`
          id,
          patient_clinic_id,
          site_id,
          first_name,
          surname,
          id_number,
          passport_number,
          date_of_birth,
          gender,
          mobile_number,
          email,
          address,
          suburb,
          city,
          province,
          postal_code
        `)
        .eq("id", patientId);

      if (!superAdmin) {
        patientQuery = patientQuery.in(
          "site_id",
          authorisedClinicIds
        );
      }

      const {
        data: record,
        error: patientError,
      } = await patientQuery.maybeSingle();

      if (patientError) {
        throw patientError;
      }

      if (!record) {
        throw new Error(
          "Patient not found or access is not authorised."
        );
      }

      // STEP 7: Retrieve original clinic name

      let clinic: Site | null = null;

      if (record.site_id) {
        const {
          data: clinicData,
          error: siteError,
        } = await supabase
          .from("sites")
          .select("id, site_name")
          .eq("id", record.site_id)
          .maybeSingle();

        if (siteError) {
          console.warn(
            "Unable to retrieve original clinic name:",
            siteError.message
          );
        }

        if (clinicData) {
          clinic = clinicData as Site;
        }
      }

      // STEP 8: Fall back to Family Planning
      // facility name if necessary

      if (!clinic && record.site_id) {
        const {
          data: facilityData,
          error: facilityError,
        } = await supabase
          .from("fp_facilities")
          .select("id, name")
          .eq("id", record.site_id)
          .maybeSingle();

        if (facilityError) {
          console.warn(
            "Unable to retrieve Family Planning clinic:",
            facilityError.message
          );
        }

        if (facilityData) {
          clinic = {
            id: facilityData.id,
            site_name: facilityData.name,
          };
        }
      }

      setPatient(record as Patient);
      setSite(clinic);

    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load patient record."
      );
    } finally {
      setLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    void loadPatient();
  }, [loadPatient]);

  // Treatment history is loaded only after the patient record has passed
  // the existing authentication and clinic-access checks above.
  useEffect(() => {
    if (!patient?.id) return;
    let cancelled = false;

    async function loadTreatmentHistory() {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        // healthcare_worker_name is not a column in medication_administrations.
        // Resolve names separately from staff_profiles using administered_by.
        const { data, error } = await supabase
          .from("medication_administrations")
          .select(`
            id, medication_name, dose, route, batch_number,
            expiry_date, administered_at, injection_site,
            adverse_events, clinical_notes, next_dose_date,
            administered_by, service_type
          `)
          .eq("patient_id", patient!.id)
          .order("administered_at", { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        const records = (data ?? []) as Omit<MedicationHistory, "healthcare_worker_name">[];
        const workerIds = Array.from(
          new Set(
            records
              .map((record) => record.administered_by)
              .filter((id): id is string => typeof id === "string" && id.length > 0)
          )
        );

        const workerNames = new Map<string, string>();
        if (workerIds.length > 0) {
          const { data: workers, error: workersError } = await supabase
            .from("staff_profiles")
            .select("id, full_name")
            .in("id", workerIds);

          if (workersError) {
            // A profile visibility restriction must not hide clinical history.
            console.warn("Unable to load healthcare worker names:", workersError.message);
          } else {
            for (const worker of workers ?? []) {
              if (worker.id && worker.full_name) {
                workerNames.set(worker.id, worker.full_name);
              }
            }
          }
        }

        if (cancelled) return;
        setTreatmentHistory(
          records.map((record) => ({
            ...record,
            healthcare_worker_name: record.administered_by
              ? workerNames.get(record.administered_by) ?? null
              : null,
          }))
        );
      } catch (error: unknown) {
        if (cancelled) return;
        setTreatmentHistory([]);
        setHistoryError(
          `Unable to load treatment history: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    void loadTreatmentHistory();
    return () => { cancelled = true; };
  }, [patient?.id]);

  const dashboardPath =
    isClinicalWorker
      ? "/nurse/dashboard"
      : isSuperAdmin
        ? "/admin"
        : "/nurse/dashboard";

  const administrationPath = patient
    ? `/nurse/patients/${encodeURIComponent(
        patient.id
      )}/administration/new`
    : "";

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 30,
          background: "#f0f7f7",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading patient record...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f0f7f7",
        padding: "28px 16px",
        fontFamily: "Arial, sans-serif",
        color: "#173b40",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ color: "#075c59" }}>
              DoseTrack — Patient Record
            </h1>

            <p style={{ color: "#64748b" }}>
              Family Planning | Clinical Records
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/nurse/patients"
              style={secondaryButton}
            >
              ← Find Patients
            </Link>

            <button
              type="button"
              style={button}
              onClick={() =>
                router.push(dashboardPath)
              }
            >
              Back to Dashboard
            </button>
          </div>
        </header>

        {errorMessage && (
          <section style={card}>
            <p
              role="alert"
              style={{ color: "#991b1b" }}
            >
              {errorMessage}
            </p>

            <button
              type="button"
              style={button}
              onClick={() => void loadPatient()}
            >
              Retry
            </button>
          </section>
        )}

        {patient && (
          <>
            {/* PATIENT OVERVIEW */}

            <section style={card}>
              <h2 style={{ marginTop: 0 }}>
                Patient Overview
              </h2>

              <h3 style={{ color: "#0f766e" }}>
                {display(patient.first_name)}{" "}
                {display(patient.surname)}
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(200px,1fr))",
                  gap: 12,
                }}
              >
                <Detail
                  label="Patient Reference"
                  value={display(
                    patient.patient_clinic_id
                  )}
                />

                <Detail
                  label="Clinic"
                  value={display(
                    site?.site_name
                  )}
                />

                <Detail
                  label="Date of Birth"
                  value={formatDate(
                    patient.date_of_birth
                  )}
                />

                <Detail
                  label="Gender"
                  value={display(
                    patient.gender
                  )}
                />
              </div>
            </section>

            {/* IDENTIFICATION */}

            <section style={card}>
              <h2>Identification</h2>

              <Detail
                label="South African ID"
                value={display(
                  patient.id_number
                )}
              />

              <Detail
                label="Passport Number"
                value={display(
                  patient.passport_number
                )}
              />
            </section>

            {/* CONTACT DETAILS */}

            <section style={card}>
              <h2>Contact Details</h2>

              <Detail
                label="Contact Number"
                value={display(
                  patient.mobile_number
                )}
              />

              <Detail
                label="Email Address"
                value={display(
                  patient.email
                )}
              />
            </section>

            {/* RESIDENTIAL ADDRESS */}

            <section style={card}>
              <h2>Residential Address</h2>

              <Detail
                label="Street Address"
                value={display(
                  patient.address
                )}
              />

              <Detail
                label="Suburb"
                value={display(
                  patient.suburb
                )}
              />

              <Detail
                label="City / Town"
                value={display(
                  patient.city
                )}
              />

              <Detail
                label="Province"
                value={display(
                  patient.province
                )}
              />

              <Detail
                label="Postal Code"
                value={display(
                  patient.postal_code
                )}
              />
            </section>

            {/* PREVIOUS TREATMENT HISTORY */}
            <section style={card}>
              <h2>Previous Treatment History</h2>
              <p style={{ color: "#64748b" }}>
                Recorded medication administrations for this patient,
                newest first.
              </p>
              {historyLoading ? (
                <p role="status">Loading treatment history...</p>
              ) : historyError ? (
                <p role="alert" style={{ color: "#991b1b" }}>
                  {historyError}
                </p>
              ) : treatmentHistory.length === 0 ? (
                <p>No previous medication administrations recorded.</p>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {treatmentHistory.map((entry) => (
                    <article key={entry.id} style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      padding: 16,
                      background: "#f8fafc",
                    }}>
                      <h3 style={{ marginTop: 0, color: "#0f766e" }}>
                        {display(entry.medication_name)}
                      </h3>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                        gap: 8,
                      }}>
                        <Detail label="Administered on" value={
                          entry.administered_at
                            ? new Date(entry.administered_at).toLocaleString("en-ZA")
                            : "Not recorded"
                        } />
                        <Detail label="Quantity" value={display(entry.dose)} />
                        <Detail label="Route" value={display(entry.route)} />
                        <Detail label="Batch number" value={display(entry.batch_number)} />
                        <Detail label="Batch expiry" value={formatDate(entry.expiry_date)} />
                        <Detail label="Injection site" value={display(entry.injection_site)} />
                        <Detail label="Next planned dose" value={formatDate(entry.next_dose_date)} />
                        <Detail label="Service type" value={display(entry.service_type)} />
                        <Detail label="Administered by" value={display(entry.healthcare_worker_name)} />
                      </div>
                      {entry.adverse_events && (
                        <Detail label="Adverse events" value={entry.adverse_events} />
                      )}
                      {entry.clinical_notes && (
                        <Detail label="Clinical notes" value={entry.clinical_notes} />
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* CLINICAL SERVICES */}

            <section style={card}>
              <h2>Clinical Services</h2>

              <p style={{ color: "#64748b" }}>
                Record contraceptive medication
                administration, review previous
                treatments and manage follow-up
                appointments.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 18,
                  marginBottom: 14,
                }}
              >
                <Link
                  href={administrationPath}
                  style={button}
                >
                  + Record Medication Administration
                </Link>

                <Link
                  href="/nurse/patients"
                  style={secondaryButton}
                >
                  Find Another Patient
                </Link>
              </div>

              <p
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                Record multiple contraceptive
                products, including injections,
                oral contraceptives, implants
                and condoms, with quantity,
                route, batch number, expiry
                date and follow-up scheduling.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
