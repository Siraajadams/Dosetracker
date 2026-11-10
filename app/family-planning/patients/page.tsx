
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = Record<string, unknown> & {
  id: string;
};

type Membership = {
  facility_id: string;
  role: string;
  active: boolean;
};

function field(
  record: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return "";
}

export default function FamilyPlanningPatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Verify authenticated user and clinic membership.
  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      setLoading(true);

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !auth.user) {
        router.replace("/family-planning/login");
        return;
      }

      const { data, error: membershipError } = await supabase
        .from("fp_memberships")
        .select("facility_id, role, active")
        .eq("user_id", auth.user.id)
        .eq("active", true);

      if (cancelled) return;

      if (membershipError) {
        setError(membershipError.message);
        setLoading(false);
        return;
      }

      const activeMemberships = (data || []) as Membership[];

      if (activeMemberships.length === 0) {
        setError(
          "No active clinic assignment found. Contact the administrator."
        );
        setLoading(false);
        return;
      }

      setMemberships(activeMemberships);
      setFacilityId(activeMemberships[0].facility_id);
      setLoading(false);
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Load only patients belonging to the selected facility.
  const loadPatients = useCallback(async () => {
    if (!facilityId) return;

    setBusy(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("fp_patients")
        .select("*")
        .eq("facility_id", facilityId)
        .limit(500);

      if (queryError) throw queryError;

      setPatients((data || []) as Patient[]);
    } catch (err) {
      setPatients([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load patients."
      );
    } finally {
      setBusy(false);
    }
  }, [facilityId]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filteredPatients = patients.filter((patient) => {
    const searchable = [
      field(patient, "first_name", "name"),
      field(patient, "surname", "last_name"),
      field(patient, "id_number", "sa_id_number"),
      field(patient, "passport_number"),
      field(patient, "mobile_number", "contact_number"),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(search.trim().toLowerCase());
  });

  if (loading) {
    return (
      <main className="p-6">
        <p>Checking clinic access...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">
          Family Planning — Patients
        </h1>
        <p className="mt-2 text-gray-600">
          Search patients and review their clinical history.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/family-planning/dashboard"
          className="rounded border px-4 py-2"
        >
          Dashboard
        </Link>

        <button
          type="button"
          onClick={loadPatients}
          disabled={busy || !facilityId}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          {busy ? "Refreshing..." : "Refresh patients"}
        </button>

        {facilityId && (
          <Link
            href="/nurse/patients/new"
            className="rounded bg-blue-700 px-4 py-2 text-white"
          >
            + Register patient
          </Link>
        )}
      </div>

      {memberships.length > 1 && (
        <div className="mb-5">
          <label
            htmlFor="facility"
            className="mb-1 block font-medium"
          >
            Select assigned clinic
          </label>
          <select
            id="facility"
            value={facilityId}
            onChange={(event) =>
              setFacilityId(event.target.value)
            }
            className="w-full rounded border p-3 md:w-96"
          >
            {memberships.map((membership) => (
              <option
                key={membership.facility_id}
                value={membership.facility_id}
              >
                {membership.facility_id}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-5 rounded border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {error}
        </div>
      )}

      {facilityId && (
        <>
          <div className="mb-5">
            <label
              htmlFor="patient-search"
              className="mb-2 block font-medium"
            >
              Search patient
            </label>
            <input
              id="patient-search"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Name, surname, ID or passport"
              className="w-full rounded border p-3"
            />
          </div>

          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredPatients.length} of{" "}
            {patients.length} loaded patients
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="w-full border-collapse text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3">Patient</th>
                  <th className="p-3">ID / Passport</th>
                  <th className="p-3">Date of birth</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredPatients.map((patient) => {
                  const firstName = field(
                    patient,
                    "first_name",
                    "name"
                  );
                  const surname = field(
                    patient,
                    "surname",
                    "last_name"
                  );

                  return (
                    <tr
                      key={patient.id}
                      className="border-t"
                    >
                      <td className="p-3">
                        {`${firstName} ${surname}`.trim() ||
                          "Unnamed patient"}
                      </td>

                      <td className="p-3">
                        {field(
                          patient,
                          "id_number",
                          "sa_id_number",
                          "passport_number"
                        ) || "—"}
                      </td>

                      <td className="p-3">
                        {field(
                          patient,
                          "date_of_birth",
                          "dob"
                        ) || "—"}
                      </td>

                      <td className="p-3">
                        {field(
                          patient,
                          "mobile_number",
                          "contact_number"
                        ) || "—"}
                      </td>

                      <td className="p-3">
                        <Link
                          href={`/nurse/patients/${encodeURIComponent(
                            patient.id
                          )}`}
                          className="font-medium text-blue-700 underline"
                        >
                          View history
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {!busy &&
                  filteredPatients.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-6 text-center text-gray-500"
                      >
                        No matching patients found.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
