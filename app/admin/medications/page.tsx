
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Medication = {
  id: string;
  icn_code: string | null;
  medication_name: string;
  generic_name: string | null;
  category: string;
  dosage_form: string | null;
  strength: string | null;
  stock_unit: string;
  administration_route: string | null;
  is_government_stock: boolean;
  is_active: boolean;
};

type FormData = {
  icn_code: string;
  medication_name: string;
  generic_name: string;
  category: string;
  dosage_form: string;
  strength: string;
  stock_unit: string;
  administration_route: string;
  is_government_stock: boolean;
  is_active: boolean;
};

const emptyForm: FormData = {
  icn_code: "",
  medication_name: "",
  generic_name: "",
  category: "Injectable",
  dosage_form: "",
  strength: "",
  stock_unit: "unit",
  administration_route: "",
  is_government_stock: false,
  is_active: true,
};

const categories = [
  "Injectable",
  "Oral contraceptive",
  "Implant",
  "Intrauterine device",
  "Emergency contraception",
  "Barrier method",
  "Other",
];

export default function FamilyPlanningMedicationsPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  
const loadMedications = useCallback(async () => {
  setBusy(true);
  setError("");

  try {
    const { data, error: queryError } = await supabase
      .from("fp_medication_catalogue")
      .select("*")
      .order("medication_name");

    if (queryError) {
      throw new Error(queryError.message);
    }

    const records = (data ?? []) as unknown as Medication[];
    setMedications(records);
  } catch (err) {
    setMedications([]);
    setError(
      err instanceof Error
        ? err.message
        : "Unable to load medications."
    );
  } finally {
    setBusy(false);
  }
}, []);


  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !auth.user) {
        router.replace("/family-planning/login");
        return;
      }

      const { data, error: roleError } =
        await supabase.rpc("dt_is_super_admin");

      if (cancelled) return;

      if (roleError || data !== true) {
        setError("Super Admin access required.");
        setChecking(false);
        return;
      }

      setAuthorized(true);
      setChecking(false);
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authorized) void loadMedications();
  }, [authorized, loadMedications]);

  function updateField<K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function addMedication() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function editMedication(med: Medication) {
    setEditingId(med.id);
    setForm({
      icn_code: med.icn_code || "",
      medication_name: med.medication_name,
      generic_name: med.generic_name || "",
      category: med.category,
      dosage_form: med.dosage_form || "",
      strength: med.strength || "",
      stock_unit: med.stock_unit,
      administration_route: med.administration_route || "",
      is_government_stock: med.is_government_stock,
      is_active: med.is_active,
    });
    setShowForm(true);
    setMessage("");
    setError("");
  }

  async function saveMedication() {
    if (
      !form.medication_name.trim() ||
      !form.category.trim() ||
      !form.stock_unit.trim()
    ) {
      setError("Medication name, category and stock unit are required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      icn_code: form.icn_code.trim() || null,
      medication_name: form.medication_name.trim(),
      generic_name: form.generic_name.trim() || null,
      category: form.category.trim(),
      dosage_form: form.dosage_form.trim() || null,
      strength: form.strength.trim() || null,
      stock_unit: form.stock_unit.trim(),
      administration_route:
        form.administration_route.trim() || null,
      is_government_stock: form.is_government_stock,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase
          .from("fp_medication_catalogue")
          .update(payload)
          .eq("id", editingId)
          .select("id")
          .single()
      : await supabase
          .from("fp_medication_catalogue")
          .insert(payload)
          .select("id")
          .single();

    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage("Medication saved successfully.");
      setShowForm(false);
      setEditingId(null);
      await loadMedications();
    }

    setSaving(false);
  }

  async function toggleMedication(med: Medication) {
    setBusy(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("fp_medication_catalogue")
      .update({
        is_active: !med.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", med.id)
      .select("id")
      .single();

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Medication status updated.");
      await loadMedications();
    }

    setBusy(false);
  }

  const filtered = medications.filter((med) => {
    const searchable = [
      med.medication_name,
      med.generic_name,
      med.icn_code,
      med.category,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(search.trim().toLowerCase());
  });

  if (checking) {
    return <main className="p-6">Checking admin access...</main>;
  }

  if (!authorized) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold">Access restricted</h1>
        <p className="mt-3 text-red-700">{error}</p>
        <Link href="/family-planning/dashboard">
          Return to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">
          Family Planning — Medications
        </h1>
        <p className="mt-2 text-gray-600">
          Search medications and manage the family planning
          medication catalogue.
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
          onClick={() => void loadMedications()}
          disabled={busy}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          {busy ? "Refreshing..." : "Refresh medications"}
        </button>

        <button
          type="button"
          onClick={addMedication}
          className="rounded bg-blue-700 px-4 py-2 text-white"
        >
          + Add Medication
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mb-5 rounded border p-4"
        >
          {message}
        </div>
      )}

      {showForm && (
        <section className="mb-6 rounded border p-5">
          <h2 className="mb-4 text-xl font-semibold">
            {editingId ? "Edit Medication" : "Register Medication"}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["medication_name", "Medication name *"],
                ["generic_name", "Generic name"],
                ["icn_code", "ICN code"],
                ["dosage_form", "Dosage form"],
                ["strength", "Strength"],
                ["stock_unit", "Stock unit *"],
                ["administration_route", "Administration route"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <span className="mb-1 block font-medium">
                  {label}
                </span>
                <input
                  value={form[key]}
                  onChange={(e) =>
                    updateField(key, e.target.value)
                  }
                  className="w-full rounded border p-3"
                />
              </label>
            ))}

            <label>
              <span className="mb-1 block font-medium">
                Category *
              </span>
              <select
                value={form.category}
                onChange={(e) =>
                  updateField("category", e.target.value)
                }
                className="w-full rounded border p-3"
              >
                {Array.from(
                  new Set([
                    ...categories,
                    ...medications.map((m) => m.category),
                  ])
                ).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_government_stock}
                onChange={(e) =>
                  updateField(
                    "is_government_stock",
                    e.target.checked
                  )
                }
              />
              Government stock
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  updateField("is_active", e.target.checked)
                }
              />
              Active medication
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveMedication()}
              className="rounded bg-blue-700 px-5 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Medication"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => setShowForm(false)}
              className="rounded border px-5 py-2"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <div className="mb-5">
        <label
          htmlFor="medication-search"
          className="mb-2 block font-medium"
        >
          Search medication
        </label>

        <input
          id="medication-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, generic name or ICN code"
          className="w-full rounded border p-3"
        />
      </div>

      <div className="mb-4 text-sm text-gray-600">
        Showing {filtered.length} of {medications.length} loaded medications
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full border-collapse text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Medication</th>
              <th className="p-3">ICN</th>
              <th className="p-3">Category</th>
              <th className="p-3">Strength</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((med) => (
              <tr key={med.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">
                    {med.medication_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {med.generic_name || ""}
                  </div>
                </td>

                <td className="p-3">
                  {med.icn_code || "—"}
                </td>

                <td className="p-3">{med.category}</td>

                <td className="p-3">
                  {med.strength || "—"}
                </td>

                <td className="p-3">
                  {med.is_active ? "Active" : "Inactive"}
                </td>

                <td className="p-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => editMedication(med)}
                      className="font-medium text-blue-700 underline"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleMedication(med)}
                      className="text-blue-700 underline disabled:opacity-50"
                    >
                      {med.is_active
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!busy && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-gray-500"
                >
                  No matching medications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
