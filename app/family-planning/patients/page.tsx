
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function formatDate(value: string) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match
    ? `${match[3]}/${match[2]}/${match[1]}`
    : value;
}

export default function FamilyPlanningPatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadPatients = useCallback(async () => {
    if (!facilityId) return;

    setBusy(true);
    setError("");
    setPatients([]);

    const { data, error: queryError } = await supabase
      .from("fp_patients")
      .select("*")
      .eq("facility_id", facilityId)
      .limit(500);

    if (queryError) {
      setError(queryError.message);
    } else {
      setPatients((data || []) as Patient[]);
    }

    setBusy(false);
  }, [facilityId]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const genders = useMemo(
    () =>
      Array.from(
        new Set(
          patients
            .map((p) => field(p, "gender", "sex"))
            .filter(Boolean)
        )
      ).sort(),
    [patients]
  );

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const searchable = [
        field(patient, "first_name", "name"),
        field(patient, "surname", "last_name"),
        field(patient, "id_number", "sa_id_number"),
        field(patient, "passport_number"),
        field(patient, "mobile_number", "contact_number"),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchable.includes(
        search.trim().toLowerCase()
      );

      const gender = field(patient, "gender", "sex");
      const matchesGender =
        genderFilter === "All" || gender === genderFilter;

      return matchesSearch && matchesGender;
    });
  }, [patients, search, genderFilter]);

  const withContact = patients.filter(
    (p) => field(p, "mobile_number", "contact_number")
  ).length;

  const withDOB = patients.filter(
    (p) => field(p, "date_of_birth", "dob")
  ).length;

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <p>Checking clinic access...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">
          Family Planning — Patients
        </h1>
        <p className="mt-2 text-gray-600">
          Manage patient registrations, search records and review
          clinical history.
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
          onClick={() => void loadPatients()}
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
            + Register Patient
          </Link>
        )}
      </div>

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
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded border p-4">
              <p className="text-sm text-gray-500">
                Total patients loaded
              </p>
              <p className="text-2xl font-bold">
                {patients.length}
              </p>
            </div>

            <div className="rounded border p-4">
              <p className="text-sm text-gray-500">
                With contact details
              </p>
              <p className="text-2xl font-bold">
                {withContact}
              </p>
            </div>

            <div className="rounded border p-4">
              <p className="text-sm text-gray-500">
                With date of birth
              </p>
              <p className="text-2xl font-bold">
                {withDOB}
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <div>
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

            <div>
              <label
                htmlFor="gender-filter"
                className="mb-2 block font-medium"
              >
                Gender
              </label>
              <select
                id="gender-filter"
                value={genderFilter}
                onChange={(event) =>
                  setGenderFilter(event.target.value)
                }
                className="w-full rounded border p-3"
              >
                <option value="All">All genders</option>
                {genders.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="facility"
                className="mb-2 block font-medium"
              >
                Assigned clinic
              </label>
              <select
                id="facility"
                value={facilityId}
                disabled={memberships.length <= 1}
                onChange={(event) => {
                  setPatients([]);
                  setFacilityId(event.target.value);
                }}
                className="w-full rounded border p-3 disabled:bg-gray-100"
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
                  <th className="p-3">Gender</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Actions</th>
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
                      <td className="p-3 font-medium">
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
                        {formatDate(
                          field(patient, "date_of_birth", "dob")
                        )}
                      </td>

                      <td className="p-3">
                        {field(patient
