
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
  created_at: string;
  updated_at: string;
};

type MedicationForm = {
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

const categories = [
  "Injectable",
  "Oral contraceptive",
  "Implant",
  "Intrauterine device",
  "Emergency contraception",
  "Barrier method",
  "Other",
];

const emptyForm: MedicationForm = {
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

const inputClass = "w-full rounded-lg border p-3";

export default function AdminMedicationsPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MedicationForm>(emptyForm);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadMedications = useCallback(async () => {
    setError("");

    const { data, error: queryError } = await supabase
      .from("fp_medication_catalogue")
      .select("*")
      .order("medication_name");

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setMedications((data || []) as Medication[]);
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
        setError("Access denied. Super Admin required.");
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

  function updateForm<K extends keyof MedicationForm>(
    key: K,
    value: MedicationForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function startAdd() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function startEdit(med: Medication) {
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
    setError("");
    setMessage("");
  }

  function buildPayload(values: MedicationForm) {
    return {
      icn_code: values.icn_code.trim() || null,
      medication_name: values.medication_name.trim(),
      generic_name: values.generic_name.trim() || null,
      category: values.category.trim(),
      dosage_form: values.dosage_form.trim() || null,
      strength: values.strength.trim() || null,
      stock_unit: values.stock_unit.trim(),
      administration_route:
        values.administration_route.trim() || null,
      is_government_stock: values.is_government_stock,
      is_active: values.is_active,
      updated_at: new Date().toISOString(),
    };
  }

  async function saveMedication() {
    if (
      !form.medication_name.trim() ||
      !form.category.trim() ||
      !form.stock_unit.trim()
    ) {
      setError("Name, category and stock unit are required.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    const payload = buildPayload(form);

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

    setBusy(false);
  }

  async function toggleActive(med: Medication) {
    setBusy(true);
    setError("");
    setMessage("");

    const { data, error: updateError } = await supabase
      .from("fp_medication_catalogue")
      .update({
        is_active: !med.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", med.id)
      .select("id")
      .single();

    if (updateError || !data) {
      setError(
        updateError?.message || "Unable to update medication."
      );
    } else {
      setMessage("Medication status updated.");
      await loadMedications();
    }

    setBusy(false);
  }

  const existingCategories = Array.from(
    new Set([
      ...categories,
      ...medications.map((m) => m.category),
    ])
  ).sort();

  const filtered = medications.filter((med) => {
    const query = search.trim().toLowerCase();

    const matchesSearch = [
      med.medication_name,
      med.generic_name,
      med.icn_code,
      med.category,
      med.strength,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);

    const matchesCategory =
      categoryFilter === "All" ||
      med.category === categoryFilter;

    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && med.is_active) ||
      (statusFilter === "Inactive" && !med.is_active);

    return matchesSearch && matchesCategory && matchesStatus;
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
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">
          Family Planning — Medication Catalogue
        </h1>
        <p className="mt-2 text-gray-600">
          Manage contraceptives, stock classifications and
          medication availability.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/admin" className="rounded border px-4 py-2">
          Admin Dashboard
        </Link>

        <button
          onClick={startAdd}
          className="rounded bg-blue-700 px-4 py-2 text-white"
        >
          + Add Medication
        </button>

        <button
          disabled={busy}
          onClick={() => void loadMedications()}
          className="rounded border px-4 py-2"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded border p-4">
          <p className="text-sm text-gray-500">Total medications</p>
          <p className="text-2xl font-bold">{medications.length}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold">
            {medications.filter((m) => m.is_active).length}
          </p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-500">
            Government stock
          </p>
          <p className="text-2xl font-bold">
            {medications.filter((m) => m.is_government_stock).length}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div role="status" className="mb-4 rounded bg-green-50 p-4 text-green-800">
          {message}
        </div>
      )}

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medication, generic name or ICN..."
          className={inputClass}
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={inputClass}
        >
          <option value="All">All categories</option>
          {existingCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={inputClass}
        >
          <option value="All">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {showForm && (
        <section className="mb-6 rounded-lg border p-5">
          <h2 className="mb-4 text-xl font-semibold">
            {editingId ? "Edit Medication" : "Add Medication"}
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
                    updateForm(key, e.target.value)
                  }
                  className={inputClass}
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
                  updateForm("category", e.target.value)
                }
                className={inputClass}
              >
                {existingCategories.map((category) => (
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
                  updateForm(
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
                  updateForm("is_active", e.target.checked)
                }
              />
              Active medication
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              disabled={busy}
              onClick={() => void saveMedication()}
              className="rounded bg-blue-700 px-5 py-2 text-white disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save Medication"}
            </button>

            <button
              disabled={busy}
              onClick={() => setShowForm(false)}
              className="rounded border px-5 py-2"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <p className="mb-3 text-sm text-gray-600">
        Showing {filtered.length} medication records
      </p>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">ICN</th>
              <th className="p-3">Medication</th>
              <th className="p-3">Generic</th>
              <th className="p-3">Category</th>
              <th className="p-3">Strength</th>
              <th className="p-3">Stock unit</th>
              <th className="p-3">Government</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((med) => (
              <tr key={med.id} className="border-t">
                <td className="p-3">{med.icn_code || "—"}</td>
                <td className="p-3 font-medium">
                  {med.medication_name}
                </td>
                <td className="p-3">
                  {med.generic_name || "—"}
                </td>
                <td className="p-3">{med.category}</td>
                <td className="p-3">{med.strength || "—"}</td>
                <td className="p-3">{med.stock_unit}</td>
                <td className="p-3">
                  {med.is_government_stock ? "Yes" : "No"}
                </td>
                <td className="p-3">
                  {med.is_active ? "Active" : "Inactive"}
                </td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => startEdit(med)}
                      className="text-blue-700 underline"
                    >
                      Edit
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void toggleActive(med)}
                      className="underline disabled:opacity-50"
                    >
                      {med.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center">
                  No medications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
