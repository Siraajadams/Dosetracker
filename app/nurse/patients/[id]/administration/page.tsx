
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  site_id: string;
  first_name: string | null;
  surname: string | null;
  date_of_birth: string | null;
};

type CatalogueItem = {
  id: string;
  icn_code: string | null;
  medication_name: string;
  category: string;
  stock_unit: string;
  administration_route: string | null;
};

type Administration = {
  id: string;
  medication_name: string;
  clinical_action: string | null;
  dose: string;
  route: string;
  administered_at: string;
  injection_site: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  adverse_events: string | null;
  clinical_notes: string | null;
  next_dose_date: string | null;
  administered_by: string;
};

type MedicationEntry = {
  key: number;
  medication: string;
  action: string;
  dose: string;
  route: string;
  injectionSite: string;
  batch: string;
  expiry: string;
  nextDoseDate: string;
};

type ClinicalForm = {
  administeredAt: string;
  allergiesReviewed: boolean;
  contraindicationsReviewed: boolean;
  consentConfirmed: boolean;
  notes: string;
  adverseEvents: string;
};

const actions: Record<string, string> = {
  administered: "Administered",
  dispensed: "Dispensed",
  inserted: "Inserted",
  removed: "Removed",
  supplied: "Supplied",
};

function allowedActions(category: string): string[] {
  switch (category) {
    case "Injectable Contraceptive":
      return ["administered"];
    case "Oral Contraceptive":
      return ["dispensed"];
    case "Contraceptive Implant":
      return ["inserted", "removed"];
    case "Barrier Contraceptive":
      return ["supplied"];
    case "Procedure Consumable":
      return ["administered"];
    default:
      return ["administered", "dispensed", "supplied"];
  }
}

function isInjection(category: string): boolean {
  return category === "Injectable Contraceptive";
}

function needsBatch(category: string): boolean {
  return (
    category !== "Barrier Contraceptive" &&
    category !== "Procedure Consumable"
  );
}

function localDateTime(): string {
  const now = new Date();
  return new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);
}

function newEntry(key: number): MedicationEntry {
  return {
    key,
    medication: "",
    action: "",
    dose: "",
    route: "",
    injectionSite: "",
    batch: "",
    expiry: "",
    nextDoseDate: "",
  };
}

function initialClinicalForm(): ClinicalForm {
  return {
    administeredAt: localDateTime(),
    allergiesReviewed: false,
    contraindicationsReviewed: false,
    consentConfirmed: false,
    notes: "",
    adverseEvents: "",
  };
}

function errorText(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string;
      code?: string;
      details?: string;
    };

    if (e.code === "42501") {
      return "Database access denied. Check nurse approval, clinic assignment and RLS policies.";
    }

    return [e.message, e.code, e.details]
      .filter(Boolean)
      .join(" — ");
  }

  return "An unexpected error occurred.";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const navigation = [
  {
    label: "Dashboard",
    href: "/family-planning/dashboard",
    icon: "▦",
  },
  {
    label: "Patient Management",
    href: "/family-planning/patients",
    icon: "♧",
  },
  {
    label: "Register Patient",
    href: "/nurse/patients/new",
    icon: "+",
  },
];

export default function MedicationAdministrationPage() {
  const router = useRouter();
  const params = useParams();

  const patientId =
    typeof params.id === "string" ? params.id : "";

  const [patient, setPatient] = useState<Patient | null>(null);
  const [nurseId, setNurseId] = useState("");
  const [email, setEmail] = useState("");
  const [clinicName, setClinicName] = useState("");

  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [history, setHistory] = useState<Administration[]>([]);

  const [entries, setEntries] = useState<MedicationEntry[]>([
    newEntry(1),
  ]);
  const [nextKey, setNextKey] = useState(2);

  const [clinical, setClinical] = useState<ClinicalForm>({
    administeredAt: "",
    allergiesReviewed: false,
    contraindicationsReviewed: false,
    consentConfirmed: false,
    notes: "",
    adverseEvents: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setClinical(initialClinicalForm());
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          patientId
        )
      ) {
        throw new Error("Invalid patient reference.");
      }

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/family-planning/login");
        return;
      }

      const userId = auth.user.id;

      const { data: profile, error: profileError } =
        await supabase
          .from("staff_profiles")
          .select("role,approval_status,is_active")
          .eq("id", userId)
          .maybeSingle();

      if (profileError) throw profileError;

      if (
        !auth.user.email_confirmed_at ||
        profile?.role !== "nurse" ||
        profile?.approval_status !== "approved" ||
        profile?.is_active !== true
      ) {
        router.replace("/pending-approval");
        return;
      }

      const { data: assignments, error: assignmentError } =
        await supabase
          .from("nurse_site_assignments")
          .select("site_id")
          .eq("nurse_id", userId);

      if (assignmentError) throw assignmentError;

      const siteIds = Array.from(
        new Set(
          (assignments ?? [])
            .map((item) => item.site_id as string)
            .filter(Boolean)
        )
      );

      if (siteIds.length === 0) {
        throw new Error("No authorised clinic is assigned to this nurse.");
      }

      const { data: patientData, error: patientError } =
        await supabase
          .from("patients")
          .select("id,site_id,first_name,surname,date_of_birth")
          .eq("id", patientId)
          .in("site_id", siteIds)
          .maybeSingle();

      if (patientError) throw patientError;

      if (!patientData) {
        throw new Error(
          "Patient not found or clinic access denied."
        );
      }

      const record = patientData as Patient;

      const { data: site, error: siteError } =
        await supabase
          .from("sites")
          .select("site_name,is_active")
          .eq("id", record.site_id)
          .maybeSingle();

      if (siteError) throw siteError;

      if (!site?.is_active) {
        throw new Error("The patient's clinic is inactive.");
      }

      const { data: catalogueData, error: catalogueError } =
        await supabase
          .from("fp_medication_catalogue")
          .select(
            "id,icn_code,medication_name,category,stock_unit,administration_route"
          )
          .eq("is_active", true)
          .order("category")
          .order("medication_name");

      if (catalogueError) throw catalogueError;

      const { data: records, error: historyError } =
        await supabase
          .from("medication_administrations")
          .select(
            "id,medication_name,clinical_action,dose,route,administered_at,injection_site,batch_number,expiry_date,adverse_events,clinical_notes,next_dose_date,administered_by"
          )
          .eq("patient_id", record.id)
          .eq("site_id", record.site_id)
          .eq("service_type", "family_planning")
          .order("administered_at", { ascending: false });

      if (historyError) throw historyError;

      setPatient(record);
      setNurseId(userId);
      setEmail(auth.user.email ?? "");
      setClinicName(site.site_name ?? "Unknown clinic");
      setCatalogue(
        (catalogueData ?? []) as unknown as CatalogueItem[]
      );
      setHistory(
        (records ?? []) as unknown as Administration[]
      );
    } catch (err) {
      setPatient(null);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateEntry(
    key: number,
    field: keyof MedicationEntry,
    value: string
  ) {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.key === key ? { ...entry, [field]: value } : entry
      )
    );
  }

  function selectMedication(key: number, medicationId: string) {
    const selected = catalogue.find(
      (item) => item.id === medicationId
    );

    setEntries((previous) =>
      previous.map((entry) => {
        if (entry.key !== key) return entry;

        return {
          ...entry,
          medication: medicationId,
          action: selected
            ? allowedActions(selected.category)[0]
            : "",
          dose: "",
          route:
            selected?.administration_route ||
            (selected?.category === "Barrier Contraceptive"
              ? "Not applicable"
              : ""),
          injectionSite: "",
          batch: "",
          expiry: "",
          nextDoseDate: "",
        };
      })
    );
  }

  function addItem() {
    setEntries((previous) => [...previous, newEntry(nextKey)]);
    setNextKey((previous) => previous + 1);
    setError("");
  }

  function removeItem(key: number) {
    setEntries((previous) =>
      previous.length > 1
        ? previous.filter((entry) => entry.key !== key)
        : previous
    );
  }

  function updateClinical<K extends keyof ClinicalForm>(
    key: K,
    value: ClinicalForm[K]
  ) {
    setClinical((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function saveConsultation(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!patient || !nurseId || saving) return;

    setError("");
    setMessage("");

    if (entries.length === 0) {
      setError("Add at least one medication or commodity.");
      return;
    }

    if (
      !clinical.allergiesReviewed ||
      !clinical.contraindicationsReviewed ||
      !clinical.consentConfirmed
    ) {
      setError("Complete all clinical safety confirmations.");
      return;
    }

    if (!clinical.administeredAt) {
      setError("Enter the clinical event date and time.");
      return;
    }

    const eventDate = new Date(clinical.administeredAt);

    if (
      Number.isNaN(eventDate.getTime()) ||
      eventDate.getTime() > Date.now()
    ) {
      setError("The clinical event date cannot be in the future.");
      return;
    }

    const eventDay = clinical.administeredAt.slice(0, 10);

    const rows = [];

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      const item = catalogue.find(
        (medication) => medication.id === entry.medication
      );

      const itemNumber = index + 1;

      if (!item) {
        setError(`Item ${itemNumber}: Select a catalogue medication.`);
        return;
      }

      if (!allowedActions(item.category).includes(entry.action)) {
        setError(`Item ${itemNumber}: Select a valid clinical action.`);
        return;
      }

      if (!entry.dose.trim()) {
        setError(`Item ${itemNumber}: Enter quantity and units.`);
        return;
      }

      if (!entry.route.trim()) {
        setError(`Item ${itemNumber}: Select the route.`);
        return;
      }

      if (isInjection(item.category) && !entry.injectionSite.trim()) {
        setError(`Item ${itemNumber}: Enter the injection site.`);
        return;
      }

      if (needsBatch(item.category) && (!entry.batch.trim() || !entry.expiry)) {
        setError(
          `Item ${itemNumber}: Batch number and expiry date are required.`
        );
        return;
      }

      if (entry.expiry && entry.expiry < eventDay) {
        setError(`Item ${itemNumber}: The product was expired.`);
        return;
      }

      if (entry.nextDoseDate && entry.nextDoseDate < eventDay) {
        setError(
          `Item ${itemNumber}: Next dose date cannot precede the event.`
        );
        return;
      }

      rows.push({
        patient_id: patient.id,
        site_id: patient.site_id,
        administered_by: nurseId,
        service_type: "family_planning",
        catalogue_item_id: item.id,
        clinical_action: entry.action,
        medication_name: item.medication_name,
        dose: entry.dose.trim(),
        route: entry.route.trim(),
        injection_site: entry.injectionSite.trim() || null,
        batch_number: entry.batch.trim() || null,
        expiry_date: entry.expiry || null,
        administered_at: eventDate.toISOString(),
        allergies_reviewed: clinical.allergiesReviewed,
        contraindications_reviewed:
          clinical.contraindicationsReviewed,
        consent_confirmed: clinical.consentConfirmed,
        clinical_notes: clinical.notes.trim() || null,
        adverse_events: clinical.adverseEvents.trim() || null,
        next_dose_date: entry.nextDoseDate || null,
      });
    }

    setSaving(true);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || auth.user?.id !== nurseId) {
        throw new Error(
          "Your session has changed. Please sign in again."
        );
      }

      // One bulk insert: do not save items individually.
      // Supabase/PostgREST processes this as one SQL statement.
      const { error: insertError } = await supabase
        .from("medication_administrations")
        .insert(rows);

      if (insertError) throw insertError;

      setEntries([newEntry(1)]);
      setNextKey(2);
      setClinical(initialClinicalForm());

      setMessage(
        `${rows.length} medication / commodity item(s) saved successfully.`
      );

      // Refresh history without resetting the form again.
      const { data: updatedHistory, error: refreshError } =
        await supabase
          .from("medication_administrations")
          .select(
            "id,medication_name,clinical_action,dose,route,administered_at,injection_site,batch_number,expiry_date,adverse_events,clinical_notes,next_dose_date,administered_by"
          )
          .eq("patient_id", patient.id)
          .eq("site_id", patient.site_id)
          .eq("service_type", "family_planning")
          .order("administered_at", { ascending: false });

      if (!refreshError) {
        setHistory(
          (updatedHistory ?? []) as unknown as Administration[]
        );
      } else {
        setMessage(
          `${rows.length} item(s) saved. Refresh the page to update history.`
        );
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/family-planning/login");
  }

  const categories = Array.from(
    new Set(catalogue.map((item) => item.category))
  );

  return (
    <div className="dt-app">
      <style>{styles}</style>

      <aside
        className={`dt-sidebar ${
          sidebarOpen ? "dt-sidebar-open" : ""
        }`}
      >
        <div className="dt-brand">
          <div className="dt-brand-mark">✳</div>
          <div>
            <strong>DoseTrack</strong>
            <small>FAMILY PLANNING</small>
          </div>
        </div>

        <div className="dt-side-label">CLINICAL WORKSPACE</div>

        <nav className="dt-nav">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="dt-nav-link"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="dt-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <Link
            href={`/nurse/patients/${patientId}`}
            className="dt-nav-link"
          >
            <span className="dt-nav-icon">▤</span>
            Patient Record
          </Link>

          <div className="dt-nav-link dt-nav-active">
            <span className="dt-nav-icon">✚</span>
            Medication Administration
          </div>
        </nav>

        <div className="dt-sidebar-footer">
          <div className="dt-sidebar-avatar">
            {email.slice(0, 1).toUpperCase() || "N"}
          </div>
          <div className="dt-sidebar-user">
            <strong>Clinical Staff</strong>
            <small>{email}</small>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="dt-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      <main className="dt-main">
        <header className="dt-topbar">
          <div className="dt-top-left">
            <button
              type="button"
              className="dt-menu"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <span>Family Planning</span>
            <span>/</span>
            <strong>Medication Administration</strong>
          </div>

          <div className="dt-top-actions">
            <span className="dt-role-pill">● Clinical Access</span>
            <button
              type="button"
              className="dt-signout"
              onClick={() => void signOut()}
            >
              Sign out ↗
            </button>
          </div>
        </header>

        <div className="dt-content">
          <div className="dt-eyebrow">
            CLINICAL WORKSPACE / PATIENT CARE
          </div>

          <section className="dt-hero">
            <span className="dt-hero-chip">
              FAMILY PLANNING CLINICAL RECORD
            </span>
            <h1>Medication Administration</h1>
            <p>
              Record multiple contraceptives and commodities
              during one patient consultation.
            </p>
          </section>

          {error && (
            <div className="dt-error" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="dt-success" role="status">
              {message}
            </div>
          )}

          {loading && (
            <section className="dt-panel">
              Loading clinical record...
            </section>
          )}

          {!loading && !patient && (
            <section className="dt-panel">
              <p>Unable to open the clinical record.</p>
              <button
                className="dt-button dt-primary"
                onClick={() => void loadData()}
              >
                Retry
              </button>
            </section>
          )}

          {!loading && patient && (
            <>
              <section className="dt-panel dt-patient-panel">
                <div>
                  <span className="dt-eyebrow">PATIENT</span>
                  <h2>
                    {patient.first_name} {patient.surname}
                  </h2>
                  <p>Clinic: {clinicName}</p>
                  <p>
                    Date of birth:{" "}
                    {patient.date_of_birth || "Not recorded"}
                  </p>
                </div>

                <Link
                  className="dt-button dt-outline"
                  href={`/nurse/patients/${patient.id}`}
                >
                  Back to Patient Record
                </Link>
              </section>

              <form onSubmit={saveConsultation}>
                <section className="dt-panel">
                  <div className="dt-panel-heading">
                    <div>
                      <span className="dt-eyebrow">
                        MEDICATION / COMMODITY DETAILS
                      </span>
                      <h2>Items for this Consultation</h2>
                      <p>
                        Add each medication or commodity separately.
                      </p>
                    </div>

                    <span className="dt-count">
                      {entries.length} item(s)
                    </span>
                  </div>

                  {entries.map((entry, index) => {
                    const selected = catalogue.find(
                      (item) => item.id === entry.medication
                    );

                    const injectable = selected
                      ? isInjection(selected.category)
                      : false;

                    const traceabilityRequired = selected
                      ? needsBatch(selected.category)
                      : true;

                    return (
                      <div className="dt-item" key={entry.key}>
                        <div className="dt-item-heading">
                          <h3>Item {index + 1}</h3>

                          {entries.length > 1 && (
                            <button
                              type="button"
                              className="dt-remove"
                              disabled={saving}
                              onClick={() => removeItem(entry.key)}
                            >
                              Remove item
                            </button>
                          )}
                        </div>

                        <div className="dt-form-grid">
                          <label className="dt-field dt-wide">
                            <span>Medication / Commodity *</span>
                            <select
                              required
                              value={entry.medication}
                              onChange={(event) =>
                                selectMedication(
                                  entry.key,
                                  event.target.value
                                )
                              }
                            >
                              <option value="">
                                Select catalogue item
                              </option>

                              {categories.map((category) => (
                                <optgroup
                                  key={category}
                                  label={category}
                                >
                                  {catalogue
                                    .filter(
                                      (item) =>
                                        item.category === category
                                    )
                                    .map((item) => (
                                      <option
                                        key={item.id}
                                        value={item.id}
                                      >
                                        {item.medication_name}
                                        {item.icn_code
                                          ? ` (ICN ${item.icn_code})`
                                          : ""}
                                      </option>
                                    ))}
                                </optgroup>
                              ))}
                            </select>
                          </label>

                          {selected && (
                            <div className="dt-info dt-wide">
                              <strong>{selected.category}</strong>
                              <span>
                                Stock unit: {selected.stock_unit}
                              </span>
                              <span>
                                ICN: {selected.icn_code || "Not assigned"}
                              </span>
                            </div>
                          )}

                          <label className="dt-field">
                            <span>Clinical Action *</span>
                            <select
                              required
                              disabled={!selected}
                              value={entry.action}
                              onChange={(event) =>
                                updateEntry(
                                  entry.key,
                                  "action",
                                  event.target.value
                                )
                              }
                            >
                              <option value="">Select action</option>
                              {allowedActions(
                                selected?.category || ""
                              ).map((action) => (
                                <option key={action} value={action}>
                                  {actions[action]}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="dt-field">
                            <span>Quantity / Dose and Units *</span>
                            <input
                              required
                              value={entry.dose}
                              placeholder="e.g. 1 ampoule or 10 condoms"
                              onChange={(event) =>
                                updateEntry(
                                  entry.key,
                                  "dose",
                                  event.target.value
                                )
                              }
                            />
                          </label>

                          <label className="dt-field">
                            <span>Route *</span>
                            <select
                              required
                              value={entry.route}
                              onChange={(event) =>
                                updateEntry(
                                  entry.key,
                                  "route",
                                  event.target.value
                                )
                              }
                            >
                              <option value="">Select route</option>
                              {[
                                "Intramuscular",
                                "Subcutaneous",
                                "Oral",
                                "Intradermal",
                                "Subdermal",
                                "Local infiltration",
                                "External",
                                "Internal",
                                "Not applicable",
                                "Other",
                              ].map((route) => (
                                <option key={route} value={route}>
                                  {route}
                                </option>
                              ))}
                            </select>
                          </label>

                          {injectable && (
                            <label className="dt-field">
                              <span>Injection Site *</span>
                              <input
                                required
                                placeholder="e.g. Left deltoid"
                                value={entry.injectionSite}
                                onChange={(event) =>
                                  updateEntry(
                                    entry.key,
                                    "injectionSite",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                          )}

                          <label className="dt-field">
                            <span>
                              Batch / Lot Number
                              {traceabilityRequired ? " *" : ""}
                            </span>
                            <input
                              required={traceabilityRequired}
                              value={entry.batch}
                              onChange={(event) =>
                                updateEntry(
                                  entry.key,
                                  "batch",
                                  event.target.value
                                )
                              }
                            />
                          </label>

                          <label className="dt-field">
                            <span>
                              Expiry Date
                              {traceabilityRequired ? " *" : ""}
                            </span>
                            <input
                              type="date"
                              required={traceabilityRequired}
                              value={entry.expiry}
                              onChange={(event) =>
                                updateEntry(
                                  entry.key,
                                  "expiry",
                                  event.target.value
                                )
                              }
                            />
                          </label>

                          <label className="dt-field">
                            <span>Next Planned Dose Date</span>
                            <input
                              type="date"
                              value={entry.nextDoseDate}
                              onChange={(event) =>
                                updateEntry(
                                  entry.key,
                                  "nextDoseDate",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className="dt-button dt-add"
                    disabled={saving}
                    onClick={addItem}
                  >
                    + Add Another Medication / Commodity
                  </button>

                  {catalogue.length === 0 && (
                    <p className="dt-error">
                      No active medication catalogue items found.
                    </p>
                  )}
                </section>

                <section className="dt-panel">
                  <div className="dt-panel-heading">
                    <div>
                      <span className="dt-eyebrow">
                        CLINICAL DOCUMENTATION
                      </span>
                      <h2>Consultation & Safety Checks</h2>
                      <p>
                        These details apply to all items recorded
                        in this consultation.
                      </p>
                    </div>
                  </div>

                  <div className="dt-form-grid">
                    <label className="dt-field dt-wide">
                      <span>Clinical Event Date and Time *</span>
                      <input
                        type="datetime-local"
                        required
                        value={clinical.administeredAt}
                        onChange={(event) =>
                          updateClinical(
                            "administeredAt",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="dt-checks">
                    {(
                      [
                        [
                          "allergiesReviewed",
                          "Allergies and relevant history reviewed",
                        ],
                        [
                          "contraindicationsReviewed",
                          "Contraindications and clinical eligibility reviewed",
                        ],
                        [
                          "consentConfirmed",
                          "Patient consent confirmed",
                        ],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="dt-check">
                        <input
                          type="checkbox"
                          checked={clinical[key]}
                          onChange={(event) =>
                            updateClinical(
                              key,
                              event.target.checked
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div className="dt-form-grid">
                    <label className="dt-field dt-wide">
                      <span>Clinical Assessment / Notes</span>
                      <textarea
                        rows={4}
                        value={clinical.notes}
                        onChange={(event) =>
                          updateClinical(
                            "notes",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className="dt-field dt-wide">
                      <span>Adverse Events / Observation</span>
                      <textarea
                        rows={3}
                        value={clinical.adverseEvents}
                        onChange={(event) =>
                          updateClinical(
                            "adverseEvents",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="dt-save-area">
                    <div>
                      <strong>
                        {entries.length} item(s) ready for review
                      </strong>
                      <p>
                        All items will be submitted together.
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="dt-button dt-primary"
                      disabled={saving || catalogue.length === 0}
                    >
                      {saving
                        ? "Saving consultation..."
                        : `Save ${entries.length} Item(s)`}
                    </button>
                  </div>
                </section>
              </form>

              <section className="dt-panel">
                <div className="dt-panel-heading">
                  <div>
                    <span className="dt-eyebrow">
                      PATIENT HISTORY
                    </span>
                    <h2>Family Planning Event History</h2>
                    <p>
                      Previous medications and commodities recorded.
                    </p>
                  </div>

                  <span className="dt-count">
                    {history.length} records
                  </span>
                </div>

                {history.length === 0 ? (
                  <p>No clinical events recorded yet.</p>
                ) : (
                  <div className="dt-history">
                    {history.map((item) => (
                      <article
                        key={item.id}
                        className="dt-history-item"
                      >
                        <div className="dt-history-head">
                          <h3>{item.medication_name}</h3>
                          <span className="dt-status">
                            {actions[item.clinical_action || ""] ||
                              item.clinical_action ||
                              "Recorded"}
                          </span>
                        </div>

                        <p>
                          <strong>Date:</strong>{" "}
                          {formatDate(item.administered_at)}
                        </p>
                        <p>
                          <strong>Quantity:</strong> {item.dose}
                        </p>
                        <p>
                          <strong>Route:</strong> {item.route}
                        </p>
                        <p>
                          <strong>Batch:</strong>{" "}
                          {item.batch_number || "Not recorded"}
                        </p>
                        <p>
                          <strong>Next due:</strong>{" "}
                          {item.next_dose_date || "Not set"}
                        </p>
                        <p>
                          <strong>Clinical notes:</strong>{" "}
                          {item.clinical_notes || "None"}
                        </p>
                        <p>
                          <strong>Adverse events:</strong>{" "}
                          {item.adverse_events || "None documented"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          <footer className="dt-footer">
            DoseTrack © 2026 · Family Planning Management
          </footer>
        </div>
      </main>
    </div>
  );
}

const styles = `
.dt-app{--ink:#172d36;--muted:#647781;--line:#e3eaf0;display:flex;min-height:100vh;background:#f5f8fa;color:var(--ink);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px}
.dt-app *{box-sizing:border-box}
.dt-app button,.dt-app input,.dt-app select,.dt-app textarea{font:inherit}
.dt-app button{cursor:pointer}
.dt-app button:disabled{opacity:.55;cursor:not-allowed}
.dt-sidebar{width:266px;flex-shrink:0;background:#10383f;color:#d8eaeb;display:flex;flex-direction:column;min-height:100vh;position:sticky;top:0;height:100vh;z-index:30}
.dt-brand{display:flex;align-items:center;gap:12px;padding:31px 24px 34px;border-bottom:1px solid #ffffff18}
.dt-brand-mark{height:42px;width:42px;display:grid;place-items:center;background:#1b6c69;color:#fff;font-size:27px;border-radius:13px}
.dt-brand strong{font-size:23px;letter-spacing:-.8px;color:#fff;display:block;line-height:1.1}
.dt-brand small{display:block;letter-spacing:2px;font-size:9px;color:#8fbabc;margin-top:7px;font-weight:700}
.dt-side-label{font-size:10px;font-weight:800;letter-spacing:1.7px;color:#80a8ad;margin:31px 26px 12px}
.dt-nav{padding:0 13px;overflow-y:auto;flex:1}
.dt-nav-link{display:flex;gap:12px;align-items:center;padding:12px 13px;border-radius:10px;text-decoration:none;color:#c8dadd;font-size:13px;font-weight:550;margin:3px 0}
.dt-nav-link:hover{background:#ffffff13;color:#fff}
.dt-nav-active{background:#22656b;color:#fff;font-weight:700}
.dt-nav-icon{width:22px;text-align:center;font-size:17px}
.dt-sidebar-footer{border-top:1px solid #ffffff20;padding:20px 17px;display:flex;gap:11px;align-items:center}
.dt-sidebar-avatar{width:36px;height:36px;border-radius:50%;background:#2d777a;display:grid;place-items:center;font-weight:800;color:#fff}
.dt-sidebar-user{min-width:0}
.dt-sidebar-user strong{display:block;font-size:12px;color:#fff}
.dt-sidebar-user small{display:block;max-width:168px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#a4c5c7;margin-top:3px}
.dt-main{flex:1;min-width:0}
.dt-topbar{height:77px;background:#fff;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:0 37px;gap:15px}
.dt-top-left,.dt-top-actions{display:flex;align-items:center;gap:12px;font-size:13px}
.dt-top-left{color:#6b7e87}
.dt-top-left strong{color:#203b43}
.dt-role-pill{color:#0b756b;background:#e9f8f3;padding:8px 12px;border-radius:30px;font-size:11px;font-weight:800}
.dt-signout{background:#fff;border:1px solid #dbe4e9;border-radius:9px;padding:9px 13px;font-weight:700;color:#35505a}
.dt-menu{display:none;border:0;background:transparent;font-size:23px;color:#123b40}
.dt-content{max-width:1400px;margin:auto;padding:38px 38px 20px}
.dt-eyebrow{font-size:10px;letter-spacing:1.9px;color:#6b858b;font-weight:850;margin-bottom:15px}
.dt-hero{background:linear-gradient(112deg,#0d444a 0%,#126e70 70%,#22898a 100%);border-radius:21px;min-height:200px;padding:40px 43px;position:relative;overflow:hidden;color:#fff;box-shadow:0 12px 30px #0a45451a;margin-bottom:24px}
.dt-hero-chip{display:inline-block;background:#ffffff20;border:1px solid #ffffff35;border-radius:30px;padding:8px 12px;font-size:10px;letter-spacing:1.2px;font-weight:800}
.dt-hero h1{font-size:clamp(27px,3vw,39px);letter-spacing:-1.3px;line-height:1.14;margin:21px 0 13px;font-weight:800}
.dt-hero p{font-size:14px;color:#d2eeeb;line-height:1.75;max-width:650px;margin:0}
.dt-panel{background:#fff;border:1px solid var(--line);border-radius:17px;padding:25px;margin-bottom:22px;box-shadow:0 3px 12px #1b435005}
.dt-patient-panel{display:flex;align-items:center;justify-content:space-between;gap:20px}
.dt-patient-panel h2{font-size:23px;margin:0 0 10px}
.dt-patient-panel p{font-size:12px;color:#647781;margin:5px 0}
.dt-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:23px}
.dt-panel-heading h2{font-size:22px;margin:0 0 8px}
.dt-panel-heading p{font-size:12px;color:#647781;margin:0}
.dt-count{border-radius:30px;background:#e9f8f3;color:#08776d;padding:9px 13px;font-size:12px;font-weight:800;white-space:nowrap}
.dt-item{border:1px solid #e1e9ed;background:#fbfcfd;border-radius:14px;padding:23px;margin-bottom:18px}
.dt-item-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.dt-item-heading h3{margin:0;font-size:18px}
.dt-remove{border:0;background:#fff0f0;color:#a02727;border-radius:8px;padding:9px 12px;font-size:12px;font-weight:750}
.dt-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.dt-field{display:flex;flex-direction:column;gap:8px;font-size:12px;font-weight:750;color:#49626c}
.dt-wide{grid-column:1/-1}
.dt-field input,.dt-field select,.dt-field textarea{width:100%;min-height:44px;border:1px solid #dbe4e9;border-radius:9px;padding:11px 12px;background:#fff;color:#172d36;outline:none}
.dt-field input:focus,.dt-field select:focus,.dt-field textarea:focus{border-color:#0e756d;box-shadow:0 0 0 3px #0e756d15}
.dt-info{display:flex;gap:15px;flex-wrap:wrap;background:#e9f8f3;color:#0e665e;padding:13px;border-radius:9px;font-size:12px}
.dt-button{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:9px;padding:12px 17px;font-size:12px;font-weight:800;border:1px solid #dbe4e9}
.dt-primary{background:#0e756d;border-color:#0e756d;color:#fff}
.dt-outline{background:#fff;color:#35505a}
.dt-add{background:#e9f8f3;border:1px dashed #0e756d;color:#08776d;width:100%;margin-top:8px}
.dt-checks{display:grid;gap:13px;background:#f8fbfc;border-radius:12px;padding:20px;margin:22px 0}
.dt-check{display:flex;gap:11px;align-items:center;font-size:13px;font-weight:600;color:#35505a}
.dt-check input{width:17px;height:17px;accent-color:#0e756d}
.dt-save-area{display:flex;justify-content:space-between;align-items:center;gap:20px;border-top:1px solid #e3eaf0;margin-top:25px;padding-top:24px}
.dt-save-area strong{font-size:14px}
.dt-save-area p{font-size:12px;color:#647781;margin:7px 0 0}
.dt-error,.dt-success{padding:14px 16px;border-radius:9px;margin-bottom:20px;font-size:13px}
.dt-error{background:#fff0f0;color:#a02727;border:1px solid #f0c9c9}
.dt-success{background:#e9f8f3;color:#08776d;border:1px solid #bfe7dd}
.dt-history{display:grid;gap:14px}
.dt-history-item{border:1px solid #e3eaf0;border-radius:12px;padding:20px}
.dt-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dt-history-head h3{margin:0 0 10px;font-size:17px}
.dt-history-item p{font-size:12px;color:#49626c;margin:9px 0}
.dt-status{background:#e9f8f3;color:#08776d;border-radius:30px;padding:6px 11px;font-size:11px;font-weight:800}
.dt-footer{border-top:1px solid #dfe7eb;padding:20px 0;margin-top:30px;color:#91a1a9;font-size:10px}
.dt-backdrop{display:none}
@media(max-width:800px){.dt-sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .2s}.dt-sidebar-open{transform:translateX(0)}.dt-backdrop{display:block;position:fixed;inset:0;background:#0b263a70;z-index:20;border:0}.dt-menu{display:block}.dt-topbar{padding:0 20px}.dt-content{padding:24px 18px}.dt-hero{padding:30px 25px}.dt-patient-panel,.dt-save-area{flex-direction:column;align-items:flex-start}}
@media(max-width:560px){.dt-role-pill{display:none}.dt-form-grid{grid-template-columns:1fr}.dt-wide{grid-column:auto}.dt-panel{padding:16px}.dt-panel-heading{flex-direction:column;align-items:flex-start}.dt-hero h1{font-size:28px}}
`;
