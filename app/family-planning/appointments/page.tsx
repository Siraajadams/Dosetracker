
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Clinic = {
  id: string;
  site_name: string;
};

type Patient = {
  id: string;
  site_id: string;
  first_name: string | null;
  surname: string | null;
  id_number: string | null;
  passport_number: string | null;
};

type Appointment = {
  id: string;
  patient_id: string;
  facility_id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  status: string;
  notes: string | null;
  interval_days: number | null;
  reminder_days: number | null;
  administration_id: string | null;
};

const statusOptions = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "missed",
];

function localToday() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date: string, days: number) {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(
    "en-ZA",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  );
}

function getError(error: unknown) {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string;
      code?: string;
      details?: string;
    };
    return [e.message, e.code, e.details]
      .filter(Boolean)
      .join(" — ");
  }
  return String(error);
}

function patientName(patient?: Patient) {
  if (!patient) return "Patient unavailable";
  return (
    [patient.first_name, patient.surname]
      .filter(Boolean)
      .join(" ") || "Unnamed patient"
  );
}

function Countdown({
  appointment,
}: {
  appointment: Appointment;
}) {
  if (
    appointment.status === "completed" ||
    appointment.status === "cancelled"
  ) {
    return (
      <span className="dt-pill neutral">
        {appointment.status}
      </span>
    );
  }

  const remaining = daysBetween(
    localToday(),
    appointment.appointment_date
  );
  const reminderDays = appointment.reminder_days ?? 4;

  if (remaining < 0) {
    return (
      <span className="dt-pill danger">
        {Math.abs(remaining)} days overdue
      </span>
    );
  }

  if (remaining === 0) {
    return <span className="dt-pill danger">Due today</span>;
  }

  if (remaining <= reminderDays) {
    return (
      <span className="dt-pill warning">
        Reminder · {remaining} days left
      </span>
    );
  }

  return (
    <span className="dt-pill good">
      {remaining} days remaining
    </span>
  );
}

export default function AppointmentsPage() {
  const router = useRouter();

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] =
    useState<Appointment[]>([]);

  const [clinicId, setClinicId] = useState("");
  const [patientId, setPatientId] = useState("");

  const [viewDate, setViewDate] = useState(localToday());
  const [administrationDate, setAdministrationDate] =
    useState(localToday());

  const [interval, setInterval] = useState("56");
  const [customDays, setCustomDays] = useState("42");
  const [reminderDays, setReminderDays] = useState("4");
  const [bookingTime, setBookingTime] = useState("09:00");
  const [appointmentType, setAppointmentType] =
    useState("Contraceptive Follow-up");
  const [notes, setNotes] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedInterval =
    interval === "custom"
      ? Number(customDays)
      : Number(interval);

  const validInterval =
    Number.isInteger(selectedInterval) &&
    selectedInterval >= 1 &&
    selectedInterval <= 365;

  const nextDate = validInterval
    ? addDays(administrationDate, selectedInterval)
    : "";

  const reminderDate = nextDate
    ? addDays(nextDate, -Number(reminderDays || 0))
    : "";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/family-planning/login");
        return;
      }

      const userId = auth.user.id;

      const [nurseAssignments, memberships] =
        await Promise.all([
          supabase
            .from("nurse_site_assignments")
            .select("site_id")
            .eq("nurse_id", userId),

          supabase
            .from("fp_memberships")
            .select("facility_id")
            .eq("user_id", userId)
            .eq("active", true),
        ]);

      if (nurseAssignments.error) {
        throw nurseAssignments.error;
      }
      if (memberships.error) {
        throw memberships.error;
      }

      const assignedIds = Array.from(
        new Set(
          [
            ...(nurseAssignments.data || []).map(
              (a) => a.site_id
            ),
            ...(memberships.data || []).map(
              (m) => m.facility_id
            ),
          ].filter((id): id is string => Boolean(id))
        )
      );

      if (assignedIds.length === 0) {
        setClinics([]);
        setPatients([]);
        setAppointments([]);
        throw new Error(
          "No assigned clinic found for your account."
        );
      }

      const siteResult = await supabase
        .from("sites")
        .select("id,site_name")
        .in("id", assignedIds)
        .eq("is_active", true)
        .order("site_name");

      if (siteResult.error) throw siteResult.error;

      const activeClinics =
        (siteResult.data || []) as Clinic[];
      const activeIds = activeClinics.map((c) => c.id);

      if (activeIds.length === 0) {
        throw new Error("No active assigned clinics found.");
      }

      const [patientResult, appointmentResult] =
        await Promise.all([
          supabase
            .from("patients")
            .select(
              "id,site_id,first_name,surname,id_number,passport_number"
            )
            .in("site_id", activeIds)
            .order("surname")
            .limit(1000),

          supabase
            .from("fp_appointments")
            .select(
              "id,patient_id,facility_id,appointment_date,appointment_time,appointment_type,status,notes,interval_days,reminder_days,administration_id"
            )
            .in("facility_id", activeIds)
            .order("appointment_date")
            .order("appointment_time")
            .limit(1000),
        ]);

      if (patientResult.error) throw patientResult.error;
      if (appointmentResult.error) {
        throw appointmentResult.error;
      }

      setClinics(activeClinics);
      setPatients((patientResult.data || []) as Patient[]);
      setAppointments(
        (appointmentResult.data || []) as Appointment[]
      );

      setClinicId((current) =>
        activeIds.includes(current)
          ? current
          : activeIds[0]
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );

  const clinicPatients = useMemo(
    () => patients.filter((p) => p.site_id === clinicId),
    [patients, clinicId]
  );

  const clinicAppointments = useMemo(
    () =>
      appointments.filter(
        (a) => a.facility_id === clinicId
      ),
    [appointments, clinicId]
  );

  const today = localToday();

  const activeAppointments = useMemo(
    () =>
      clinicAppointments.filter(
        (a) =>
          a.status !== "completed" &&
          a.status !== "cancelled"
      ),
    [clinicAppointments]
  );

  const upcoming = useMemo(
    () =>
      activeAppointments
        .filter((a) => a.appointment_date >= today)
        .sort((a, b) =>
          (
            a.appointment_date + a.appointment_time
          ).localeCompare(
            b.appointment_date + b.appointment_time
          )
        ),
    [activeAppointments, today]
  );

  const overdue = useMemo(
    () =>
      activeAppointments.filter(
        (a) => a.appointment_date < today
      ),
    [activeAppointments, today]
  );

  const reminders = useMemo(
    () =>
      upcoming.filter((a) => {
        const days = daysBetween(
          today,
          a.appointment_date
        );
        return days <= (a.reminder_days ?? 4);
      }),
    [upcoming, today]
  );

  const daily = useMemo(() => {
    const q = search.trim().toLowerCase();

    return clinicAppointments.filter((a) => {
      if (a.appointment_date !== viewDate) return false;

      if (
        statusFilter !== "all" &&
        a.status !== statusFilter
      ) {
        return false;
      }

      const patient = patientMap.get(a.patient_id);

      const searchable = [
        patientName(patient),
        patient?.id_number,
        patient?.passport_number,
        a.appointment_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [
    clinicAppointments,
    viewDate,
    statusFilter,
    search,
    patientMap,
  ]);

  async function saveAppointment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!validInterval || !nextDate) {
      setError("Enter a valid interval between 1 and 365 days.");
      return;
    }

    if (nextDate < today) {
      setError("The follow-up date cannot be in the past.");
      return;
    }

    const patient = clinicPatients.find(
      (p) => p.id === patientId
    );

    if (!patient) {
      setError("Select a patient at the assigned clinic.");
      return;
    }

    setSaving(true);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Your session has expired.");
      }

      const { error: insertError } = await supabase
        .from("fp_appointments")
        .insert({
          patient_id: patientId,
          facility_id: clinicId,
          appointment_date: nextDate,
          appointment_time: bookingTime,
          appointment_type: appointmentType,
          status: "scheduled",
          notes: notes.trim() || null,
          interval_days: selectedInterval,
          reminder_days: Number(reminderDays),
        });

      if (insertError) throw insertError;

      setShowForm(false);
      setPatientId("");
      setNotes("");
      setViewDate(nextDate);

      await loadData();
      setMessage("Follow-up appointment saved successfully.");
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    appointment: Appointment,
    status: string
  ) {
    setUpdatingId(appointment.id);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("fp_appointments")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment.id)
        .eq("facility_id", clinicId);

      if (updateError) throw updateError;

      await loadData();
      setMessage("Appointment status updated.");
    } catch (err) {
      setError(getError(err));
    } finally {
      setUpdatingId("");
    }
  }

  function changeViewDate(days: number) {
    setViewDate((current) => addDays(current, days));
  }

  return (
    <div className="dt-app">
      <aside className="dt-sidebar">
        <div className="dt-brand">
          <span className="dt-brand-icon">✳</span>
          <div>
            <strong>DoseTrack</strong>
            <small>FAMILY PLANNING</small>
          </div>
        </div>

        <p className="dt-side-heading">CLINICAL WORKSPACE</p>

        <nav>
          <Link href="/family-planning/dashboard">
            ▦ Dashboard
          </Link>
          <Link href="/family-planning/patients">
            ♧ Patient Management
          </Link>
          <Link href="/nurse/patients/new">
            + Register Patient
          </Link>
          <Link
            href="/family-planning/appointments"
            className="active"
          >
            ▣ Appointments & Follow-ups
          </Link>
          <Link href="/family-planning/medications/usage">
            ◫ Contraceptive Analytics
          </Link>
        </nav>
      </aside>

      <main className="dt-main">
        <header className="dt-topbar">
          <span>Family Planning / Appointments</span>
          <Link href="/family-planning/dashboard">
            Back to Dashboard
          </Link>
        </header>

        <div className="dt-content">
          <section className="dt-hero">
            <span className="dt-chip">
              FAMILY PLANNING SCHEDULING
            </span>
            <h1>Appointments & Follow-ups</h1>
            <p>
              Schedule 28, 56 or 84-day follow-ups, customise
              intervals, and monitor patients approaching
              their next appointment.
            </p>
          </section>

          {error && (
            <div className="dt-alert error" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="dt-alert success" role="status">
              {message}
            </div>
          )}

          <section className="dt-panel">
            <div className="dt-heading">
              <div>
                <span className="dt-eyebrow">CLINIC SELECTION</span>
                <h2>Appointment Workspace</h2>
              </div>
              <button
                type="button"
                className="dt-btn outline"
                onClick={() => void loadData()}
              >
                Refresh
              </button>
            </div>

            <label className="dt-field">
              Assigned clinic
              <select
                value={clinicId}
                onChange={(e) => {
                  setClinicId(e.target.value);
                  setPatientId("");
                }}
              >
                {clinics.length === 0 && (
                  <option value="">No assigned clinic</option>
                )}
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.site_name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="dt-stats">
            <div className="dt-stat">
              <span>Upcoming</span>
              <strong>{upcoming.length}</strong>
              <small>Scheduled or confirmed</small>
            </div>
            <div className="dt-stat">
              <span>Reminder Window</span>
              <strong>{reminders.length}</strong>
              <small>Within reminder period</small>
            </div>
            <div className="dt-stat">
              <span>Overdue</span>
              <strong>{overdue.length}</strong>
              <small>Not marked completed</small>
            </div>
            <div className="dt-stat">
              <span>Today's Appointments</span>
              <strong>
                {
                  clinicAppointments.filter(
                    (a) => a.appointment_date === today
                  ).length
                }
              </strong>
              <small>{formatDate(today)}</small>
            </div>
          </section>

          <section className="dt-panel">
            <div className="dt-heading">
              <div>
                <span className="dt-eyebrow">
                  FOLLOW-UP SCHEDULER
                </span>
                <h2>Schedule Next Appointment</h2>
                <p>
                  Choose an interval or adjust it for the
                  individual patient.
                </p>
              </div>
              <button
                type="button"
                className="dt-btn primary"
                disabled={!clinicId}
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Close Scheduler" : "+ New Follow-up"}
              </button>
            </div>

            {showForm && (
              <form onSubmit={saveAppointment}>
                <div className="dt-grid">
                  <label className="dt-field">
                    Patient *
                    <select
                      required
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                    >
                      <option value="">Select patient</option>
                      {clinicPatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {patientName(p)}
                          {" — "}
                          {p.id_number ||
                            p.passport_number ||
                            "No ID"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="dt-field">
                    Administration / Reference Date *
                    <input
                      type="date"
                      required
                      value={administrationDate}
                      onChange={(e) =>
                        setAdministrationDate(e.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="dt-interval-section">
                  <h3>Follow-up interval</h3>
                  <div className="dt-intervals">
                    {["28", "56", "84", "custom"].map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={
                          "dt-interval " +
                          (interval === option ? "selected" : "")
                        }
                        onClick={() => setInterval(option)}
                      >
                        {option === "custom"
                          ? "Custom"
                          : `${option} Days`}
                      </button>
                    ))}
                  </div>

                  {interval === "custom" && (
                    <label className="dt-field">
                      Custom number of days (1–365)
                      <input
                        type="number"
                        min="1"
                        max="365"
                        required
                        value={customDays}
                        onChange={(e) =>
                          setCustomDays(e.target.value)
                        }
                      />
                    </label>
                  )}
                </div>

                <div className="dt-grid">
                  <label className="dt-field">
                    Reminder before appointment
                    <select
                      value={reminderDays}
                      onChange={(e) =>
                        setReminderDays(e.target.value)
                      }
                    >
                      {[1, 2, 3, 4, 7, 14].map((n) => (
                        <option key={n} value={n}>
                          {n} days before
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="dt-field">
                    Appointment Time
                    <input
                      type="time"
                      required
                      value={bookingTime}
                      onChange={(e) =>
                        setBookingTime(e.target.value)
                      }
                    />
                  </label>

                  <label className="dt-field">
                    Appointment Type
                    <select
                      value={appointmentType}
                      onChange={(e) =>
                        setAppointmentType(e.target.value)
                      }
                    >
                      <option>Contraceptive Follow-up</option>
                      <option>Contraceptive Injection</option>
                      <option>Contraceptive Implant</option>
                      <option>Oral Contraceptive</option>
                      <option>Family Planning</option>
                      <option>Counselling</option>
                      <option>Other</option>
                    </select>
                  </label>
                </div>

                <div className="dt-preview">
                  <div>
                    <span>Next Appointment</span>
                    <strong>
                      {nextDate ? formatDate(nextDate) : "—"}
                    </strong>
                    <small>
                      {validInterval
                        ? `${selectedInterval} days after reference date`
                        : "Enter a valid interval"}
                    </small>
                  </div>
                  <div>
                    <span>Reminder Date</span>
                    <strong>
                      {reminderDate
                        ? formatDate(reminderDate)
                        : "—"}
                    </strong>
                    <small>
                      {reminderDays} days before appointment
                    </small>
                  </div>
                </div>

                <label className="dt-field">
                  Clinical / Appointment Notes
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for follow-up or clinically adjusted interval"
                  />
                </label>

                <div className="dt-form-actions">
                  <button
                    type="submit"
                    className="dt-btn primary"
                    disabled={
                      saving ||
                      !patientId ||
                      !validInterval ||
                      !nextDate
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save Follow-up Appointment"}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="dt-panel">
            <div className="dt-heading">
              <div>
                <span className="dt-eyebrow">
                  FOLLOW-UP MONITORING
                </span>
                <h2>Upcoming Follow-ups</h2>
                <p>
                  Days remaining and alerts for patients
                  approaching their due date.
                </p>
              </div>
              <button
                className="dt-btn outline"
                type="button"
                onClick={() => setShowAllUpcoming((v) => !v)}
              >
                {showAllUpcoming
                  ? "Show First 10"
                  : "Show All"}
              </button>
            </div>

            {loading ? (
              <p>Loading follow-ups...</p>
            ) : upcoming.length === 0 ? (
              <p>No upcoming follow-ups at this clinic.</p>
            ) : (
              <div className="dt-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Next Appointment</th>
                      <th>Interval</th>
                      <th>Countdown</th>
                      <th>Patient Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllUpcoming
                      ? upcoming
                      : upcoming.slice(0, 10)
                    ).map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>
                            {patientName(
                              patientMap.get(a.patient_id)
                            )}
                          </strong>
                          <small>{a.appointment_type}</small>
                        </td>
                        <td>
                          {formatDate(a.appointment_date)}
                        </td>
                        <td>
                          {a.interval_days == null
                            ? "—"
                            : `${a.interval_days} days`}
                        </td>
                        <td>
                          <Countdown appointment={a} />
                        </td>
                        <td>
                          <Link
                            href={`/nurse/patients/${a.patient_id}`}
                            className="dt-link"
                          >
                            Open Record
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {overdue.length > 0 && (
            <section className="dt-panel">
              <div className="dt-heading">
                <div>
                  <span className="dt-eyebrow">
                    ACTION REQUIRED
                  </span>
                  <h2>Overdue Follow-ups</h2>
                </div>
              </div>

              <div className="dt-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Due Date</th>
                      <th>Overdue</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {patientName(
                            patientMap.get(a.patient_id)
                          )}
                        </td>
                        <td>{formatDate(a.appointment_date)}</td>
                        <td>
                          <Countdown appointment={a} />
                        </td>
                        <td>
                          <select
                            value={a.status}
                            disabled={updatingId === a.id}
                            onChange={(e) =>
                              void changeStatus(
                                a,
                                e.target.value
                              )
                            }
                          >
                            {statusOptions.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="dt-panel">
            <div className="dt-heading">
              <div>
                <span className="dt-eyebrow">
                  DAILY CLINICAL SCHEDULE
                </span>
                <h2>Appointments for {formatDate(viewDate)}</h2>
              </div>
              <div className="dt-actions">
                <button
                  className="dt-btn outline"
                  onClick={() => changeViewDate(-1)}
                >
                  Previous
                </button>
                <button
                  className="dt-btn outline"
                  onClick={() => setViewDate(today)}
                >
                  Today
                </button>
                <button
                  className="dt-btn outline"
                  onClick={() => changeViewDate(1)}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="dt-grid">
              <label className="dt-field">
                Date
                <input
                  type="date"
                  value={viewDate}
                  onChange={(e) => setViewDate(e.target.value)}
                />
              </label>

              <label className="dt-field">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="dt-field">
                Search
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Patient name or ID"
                />
              </label>
            </div>

            {daily.length === 0 ? (
              <div className="dt-empty">
                No appointments found for this date.
              </div>
            ) : (
              <div className="dt-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Patient</th>
                      <th>Appointment</th>
                      <th>Countdown</th>
                      <th>Status</th>
                      <th>Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {a.appointment_time.slice(0, 5)}
                        </td>
                        <td>
                          {patientName(
                            patientMap.get(a.patient_id)
                          )}
                        </td>
                        <td>{a.appointment_type}</td>
                        <td>
                          <Countdown appointment={a} />
                        </td>
                        <td>
                          <select
                            value={a.status}
                            disabled={updatingId === a.id}
                            onChange={(e) =>
                              void changeStatus(
                                a,
                                e.target.value
                              )
                            }
                          >
                            {statusOptions.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Link
                            href={`/nurse/patients/${a.patient_id}`}
                            className="dt-link"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer>
            DoseTrack © 2026 · Family Planning Management
          </footer>
        </div>
      </main>

      <style jsx global>{`
        .dt-app {
          --teal: #0e756d;
          --ink: #172d36;
          --line: #e3eaf0;
          display: flex;
          min-height: 100vh;
          background: #f5f8fa;
          color: var(--ink);
          font-family: Inter, system-ui, Arial, sans-serif;
          font-size: 14px;
        }
        .dt-app * { box-sizing: border-box; }
        .dt-sidebar {
          width: 266px;
          flex-shrink: 0;
          background: #10383f;
          color: #d8eaeb;
          min-height: 100vh;
          padding: 25px 14px;
        }
        .dt-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 5px 10px 30px;
          border-bottom: 1px solid #ffffff20;
        }
        .dt-brand-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          background: #1b6c69;
          border-radius: 12px;
          font-size: 25px;
        }
        .dt-brand strong {
          display: block;
          color: white;
          font-size: 23px;
        }
        .dt-brand small {
          display: block;
          margin-top: 5px;
          letter-spacing: 2px;
          font-size: 9px;
        }
        .dt-side-heading {
          margin: 30px 12px 14px;
          color: #80a8ad;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }
        .dt-sidebar nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .dt-sidebar nav a {
          color: #c8dadd;
          padding: 13px;
          text-decoration: none;
          border-radius: 9px;
        }
        .dt-sidebar nav a:hover,
        .dt-sidebar nav a.active {
          background: #22656b;
          color: white;
        }
        .dt-main {
          flex: 1;
          min-width: 0;
        }
        .dt-topbar {
          background: white;
          border-bottom: 1px solid var(--line);
          padding: 24px 35px;
          display: flex;
          justify-content: space-between;
          gap: 15px;
        }
        .dt-topbar a, .dt-link {
          color: var(--teal);
          text-decoration: none;
          font-weight: 750;
        }
        .dt-content {
          max-width: 1450px;
          margin: auto;
          padding: 35px;
        }
        .dt-hero {
          padding: 38px;
          margin-bottom: 25px;
          border-radius: 20px;
          background: linear-gradient(
            110deg,
            #0d444a,
            #126e70 70%,
            #22898a
          );
          color: white;
        }
        .dt-chip {
          display: inline-block;
          background: #ffffff20;
          padding: 8px 13px;
          border-radius: 30px;
          font-size: 10px;
          letter-spacing: 1.3px;
          font-weight: 800;
        }
        .dt-hero h1 {
          margin: 20px 0 12px;
          font-size: clamp(27px, 3vw, 38px);
        }
        .dt-hero p {
          max-width: 720px;
          color: #d2eeeb;
          line-height: 1.7;
        }
        .dt-panel {
          padding: 25px;
          margin-bottom: 23px;
          background: white;
          border: 1px solid var(--line);
          border-radius: 16px;
        }
        .dt-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 24px;
        }
        .dt-heading h2 {
          font-size: 22px;
          margin: 7px 0;
        }
        .dt-heading p {
          color: #647781;
          font-size: 12px;
        }
        .dt-eyebrow {
          color: #6b858b;
          letter-spacing: 1.6px;
          font-size: 10px;
          font-weight: 850;
        }
        .dt-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 20px;
        }
        .dt-field {
          display: flex;
          flex-direction: column;
          gap: 9px;
          margin-bottom: 17px;
          color: #49626c;
          font-size: 12px;
          font-weight: 750;
        }
        .dt-field input,
        .dt-field select,
        .dt-field textarea,
        .dt-app td select {
          width: 100%;
          min-height: 43px;
          border: 1px solid #dbe4e9;
          border-radius: 9px;
          padding: 10px;
          background: white;
          color: var(--ink);
          font: inherit;
        }
        .dt-btn {
          border: 1px solid #dbe4e9;
          border-radius: 9px;
          padding: 11px 16px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }
        .dt-btn.primary {
          background: var(--teal);
          border-color: var(--teal);
          color: white;
        }
        .dt-btn.outline {
          background: white;
          color: #35505a;
        }
        .dt-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }
        .dt-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }
        .dt-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 23px;
        }
        .dt-stat {
          display: flex;
          flex-direction: column;
          gap: 9px;
          background: white;
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 22px;
        }
        .dt-stat span {
          font-size: 12px;
          color: #647781;
        }
        .dt-stat strong {
          font-size: 32px;
          color: var(--teal);
        }
        .dt-stat small {
          color: #91a1a9;
        }
        .dt-interval-section {
          background: #f8fbfc;
          border: 1px solid var(--line);
          border-radius: 13px;
          padding: 20px;
          margin-bottom: 22px;
        }
        .dt-interval-section h3 {
          margin: 0 0 17px;
        }
        .dt-intervals {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 15px;
        }
        .dt-interval {
          background: white;
          border: 1px solid #dbe4e9;
          border-radius: 10px;
          padding: 14px 22px;
          font-weight: 800;
          color: #49626c;
          cursor: pointer;
        }
        .dt-interval.selected {
          background: var(--teal);
          border-color: var(--teal);
          color: white;
        }
        .dt-preview {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        .dt-preview > div {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: #e9f8f3;
          border-radius: 12px;
          padding: 22px;
        }
        .dt-preview span {
          color: #0e665e;
          font-size: 12px;
          font-weight: 750;
        }
        .dt-preview strong {
          font-size: 23px;
          color: #0b5953;
        }
        .dt-preview small {
          color: #0e756d;
        }
        .dt-form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .dt-table-wrap {
          overflow-x: auto;
        }
        .dt-app table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .dt-app th {
          background: #f5f8fa;
          color: #49626c;
          text-align: left;
          padding: 14px;
          white-space: nowrap;
        }
        .dt-app td {
          border-bottom: 1px solid var(--line);
          padding: 14px;
          vertical-align: middle;
        }
        .dt-app td strong,
        .dt-app td small {
          display: block;
        }
        .dt-app td small {
          color: #647781;
          margin-top: 5px;
        }
        .dt-pill {
          display: inline-block;
          padding: 8px 11px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }
        .dt-pill.good {
          background: #e9f8f3;
          color: #08776d;
        }
        .dt-pill.warning {
          background: #fff3d9;
          color: #986000;
        }
        .dt-pill.danger {
          background: #fff0f0;
          color: #a02727;
        }
        .dt-pill.neutral {
          background: #edf1f3;
          color: #647781;
        }
        .dt-alert {
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 9px;
        }
        .dt-alert.error {
          background: #fff0f0;
          color: #a02727;
        }
        .dt-alert.success {
          background: #e9f8f3;
          color: #08776d;
        }
        .dt-empty {
          text-align: center;
          padding: 35px;
          color: #647781;
        }
        .dt-app footer {
          color: #91a1a9;
          font-size: 11px;
          padding: 25px 0;
        }
        @media(max-width: 1100px) {
          .dt-sidebar { width: 215px; }
          .dt-stats { grid-template-columns: repeat(2, 1fr); }
        }
        @media(max-width: 800px) {
          .dt-app { display: block; }
          .dt-sidebar {
            width: 100%;
            min-height: auto;
          }
          .dt-sidebar nav {
            flex-direction: row;
            overflow-x: auto;
          }
          .dt-sidebar nav a { white-space: nowrap; }
          .dt-content { padding: 20px; }
          .dt-topbar { padding: 18px; }
          .dt-hero { padding: 25px; }
        }
        @media(max-width: 560px) {
          .dt-grid,
          .dt-preview,
          .dt-stats {
            grid-template-columns: 1fr;
          }
          .dt-panel { padding: 16px; }
          .dt-interval { flex: 1; }
        }
      `}</style>
    </div>
  );
}
