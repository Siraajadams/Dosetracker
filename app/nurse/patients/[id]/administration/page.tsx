
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

const appointmentTypes = [
  "Contraceptive Follow-up",
  "Family Planning",
  "Contraceptive Injection",
  "Contraceptive Implant",
  "Oral Contraceptive",
  "Counselling",
  "Other",
];

const statuses = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "missed",
];

function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(date: string) {
  const start = Date.parse(`${today()}T12:00:00Z`);
  const end = Date.parse(`${date}T12:00:00Z`);
  return Math.round((end - start) / 86400000);
}

function formatDate(date: string) {
  if (!date) return "—";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(
    "en-ZA",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  );
}

function errorText(error: unknown) {
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

function FollowUpBadge({
  appointment,
}: {
  appointment: Appointment;
}) {
  if (
    appointment.status === "completed" ||
    appointment.status === "cancelled"
  ) {
    return (
      <span className="dt-badge neutral">
        {appointment.status}
      </span>
    );
  }

  const days = daysUntil(appointment.appointment_date);
  const reminder = appointment.reminder_days ?? 4;

  if (days < 0) {
    return (
      <span className="dt-badge danger">
        {Math.abs(days)} days overdue
      </span>
    );
  }

  if (days === 0) {
    return <span className="dt-badge danger">Due today</span>;
  }

  if (days <= reminder) {
    return (
      <span className="dt-badge warning">
        Reminder: {days} days left
      </span>
    );
  }

  return (
    <span className="dt-badge good">
      {days} days remaining
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

  const [date, setDate] = useState(today());
  const [referenceDate, setReferenceDate] = useState(today());
  const [bookingTime, setBookingTime] = useState("09:00");
  const [type, setType] = useState(appointmentTypes[0]);

  const [interval, setInterval] = useState("56");
  const [customDays, setCustomDays] = useState("42");
  const [reminderDays, setReminderDays] = useState("4");
  const [manualDate, setManualDate] = useState("");
  const [useManualDate, setUseManualDate] = useState(false);

  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedDays =
    interval === "custom"
      ? Number(customDays)
      : Number(interval);

  const validInterval =
    Number.isInteger(selectedDays) &&
    selectedDays >= 1 &&
    selectedDays <= 365;

  const calculatedDate = validInterval
    ? addDays(referenceDate, selectedDays)
    : "";

  const bookingDate = useManualDate
    ? manualDate
    : calculatedDate;

  const reminderDate = bookingDate
    ? addDays(bookingDate, -Number(reminderDays))
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

      const [nurseResult, membershipResult] =
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

      if (nurseResult.error) throw nurseResult.error;
      if (membershipResult.error) throw membershipResult.error;

      const ids = Array.from(
        new Set(
          [
            ...(nurseResult.data || []).map(
              (r) => r.site_id
            ),
            ...(membershipResult.data || []).map(
              (r) => r.facility_id
            ),
          ].filter((id): id is string => Boolean(id))
        )
      );

      if (!ids.length) {
        setClinics([]);
        setPatients([]);
        setAppointments([]);
        throw new Error(
          "No assigned clinics found. Ask the administrator to assign a clinic."
        );
      }

      const siteResult = await supabase
        .from("sites")
        .select("id,site_name")
        .in("id", ids)
        .eq("is_active", true)
        .order("site_name");

      if (siteResult.error) throw siteResult.error;

      const activeClinics =
        (siteResult.data || []) as Clinic[];
      const activeIds = activeClinics.map((c) => c.id);

      if (!activeIds.length) {
        setClinics([]);
        setPatients([]);
        setAppointments([]);
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
      setPatients(
        (patientResult.data || []) as Patient[]
      );
      setAppointments(
        (appointmentResult.data || []) as Appointment[]
      );

      setClinicId((previous) =>
        activeIds.includes(previous)
          ? previous
          : activeIds[0]
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const clinicPatients = useMemo(
    () => patients.filter((p) => p.site_id === clinicId),
    [patients, clinicId]
  );

  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );

  const clinicMap = useMemo(
    () => new Map(clinics.map((c) => [c.id, c])),
    [clinics]
  );

  const clinicAppointments = useMemo(
    () =>
      appointments.filter(
        (a) => a.facility_id === clinicId
      ),
    [appointments, clinicId]
  );

  const dailyAppointments = useMemo(
    () =>
      clinicAppointments.filter(
        (a) => a.appointment_date === date
      ),
    [clinicAppointments, date]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return dailyAppointments.filter((a) => {
      if (
        statusFilter !== "all" &&
        a.status !== statusFilter
      ) {
        return false;
      }

      const patient = patientMap.get(a.patient_id);

      const text = [
        patient?.first_name,
        patient?.surname,
        patient?.id_number,
        patient?.passport_number,
        a.appointment_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [
    dailyAppointments,
    statusFilter,
    search,
    patientMap,
  ]);

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
        .filter((a) => a.appointment_date >= today())
        .sort((a, b) =>
          (
            a.appointment_date + a.appointment_time
          ).localeCompare(
            b.appointment_date + b.appointment_time
          )
        ),
    [activeAppointments]
  );

  const overdue = useMemo(
    () =>
      activeAppointments.filter(
        (a) => a.appointment_date < today()
      ),
    [activeAppointments]
  );

  const reminders = useMemo(
    () =>
      upcoming.filter(
        (a) =>
          daysUntil(a.appointment_date) <=
          (a.reminder_days ?? 4)
      ),
    [upcoming]
  );

  const stats = {
    total: dailyAppointments.length,
    scheduled: dailyAppointments.filter(
      (a) => a.status === "scheduled"
    ).length,
    confirmed: dailyAppointments.filter(
      (a) => a.status === "confirmed"
    ).length,
    completed: dailyAppointments.filter(
      (a) => a.status === "completed"
    ).length,
  };

  function resetBooking() {
    setPatientId("");
    setReferenceDate(today());
    setInterval("56");
    setCustomDays("42");
    setReminderDays("4");
    setBookingTime("09:00");
    setType(appointmentTypes[0]);
    setNotes("");
    setManualDate("");
    setUseManualDate(false);
    setShowBooking(true);
  }

  async function createAppointment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!clinicId || !patientId) {
      setError("Select a clinic and patient.");
      return;
    }

    if (!validInterval) {
      setError(
        "Choose 28, 56, 84 or a custom interval between 1 and 365 days."
      );
      return;
    }

    if (!bookingDate) {
      setError("Select a valid appointment date.");
      return;
    }

    if (bookingDate < today()) {
      setError(
        "New appointments cannot be booked in the past."
      );
      return;
    }

    const selectedPatient = clinicPatients.find(
      (p) => p.id === patientId
    );

    if (!selectedPatient) {
      setError(
        "Patient is not registered at the selected clinic."
      );
      return;
    }

    const actualInterval = Math.round(
      (
        Date.parse(`${bookingDate}T12:00:00Z`) -
        Date.parse(`${referenceDate}T12:00:00Z`)
      ) / 86400000
    );

    if (
      !Number.isInteger(actualInterval) ||
      actualInterval < 0
    ) {
      setError(
        "The appointment must not precede the reference date."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Your session has expired.");
      }

      const { data: existing, error: existingError } =
        await supabase
          .from("fp_appointments")
          .select("id")
          .eq("patient_id", patientId)
          .eq("facility_id", clinicId)
          .eq("appointment_date", bookingDate)
          .eq("appointment_type", type)
          .in("status", ["scheduled", "confirmed"])
          .limit(1);

      if (existingError) throw existingError;

      if (existing && existing.length > 0) {
        throw new Error(
          "This patient already has an active appointment of the same type on this date."
        );
      }

      const { error: insertError } = await supabase
        .from("fp_appointments")
        .insert({
          patient_id: patientId,
          facility_id: clinicId,
          appointment_date: bookingDate,
          appointment_time: bookingTime,
          appointment_type: type,
          status: "scheduled",
          notes: notes.trim() || null,
          interval_days: actualInterval,
          reminder_days: Number(reminderDays),
        });

      if (insertError) throw insertError;

      setShowBooking(false);
      setPatientId("");
      setNotes("");
      setDate(bookingDate);

      await loadData();
      setSuccess(
        "Follow-up appointment booked successfully."
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    id: string,
    status: string
  ) {
    setError("");
    setSuccess("");
    setUpdatingId(id);

    const appointment = appointments.find(
      (a) => a.id === id
    );

    if (
      !appointment ||
      appointment.facility_id !== clinicId
    ) {
      setError(
        "Appointment is not available at this clinic."
      );
      setUpdatingId("");
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("fp_appointments")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("facility_id", clinicId);

      if (updateError) throw updateError;

      await loadData();
      setSuccess("Appointment status updated.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setUpdatingId("");
    }
  }

  function moveDate(days: number) {
    setDate((current) => addDays(current, days));
  }

  return (
    <main className="dt-page">
      <div className="dt-container">
        <header className="dt-header">
          <div>
            <p className="dt-eyebrow">
              DOSETRACK / FAMILY PLANNING
            </p>
            <h1>Appointments & Follow-ups</h1>
            <p>
              Manage contraceptive follow-ups with
              adjustable 28, 56 and 84-day intervals.
            </p>
          </div>

          <div className="dt-actions">
            <Link
              href="/family-planning/dashboard"
              className="dt-btn outline"
            >
              Dashboard
            </Link>

            <button
              type="button"
              className="dt-btn outline"
              onClick={() => void loadData()}
            >
              Refresh
            </button>

            <button
              type="button"
              className="dt-btn primary"
              disabled={!clinicId}
              onClick={resetBooking}
            >
              + New Follow-up
            </button>
          </div>
        </header>

        {error && (
          <div className="dt-alert error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="dt-alert success" role="status">
            {success}
          </div>
        )}

        <section className="dt-panel">
          <div className="dt-grid">
            <label>
              Assigned Clinic
              <select
                value={clinicId}
                onChange={(e) => {
                  setClinicId(e.target.value);
                  setPatientId("");
                }}
              >
                {clinics.length === 0 && (
                  <option value="">
                    No clinic assigned
                  </option>
                )}

                {clinics.map((clinic) => (
                  <option
                    key={clinic.id}
                    value={clinic.id}
                  >
                    {clinic.site_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Appointment Date
              <input
                type="date"
                value={date}
                onChange={(e) =>
                  setDate(e.target.value)
                }
              />
            </label>

            <label>
              Appointment Status
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
              >
                <option value="all">
                  All statuses
                </option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() +
                      s.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Search Patient
              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Name, ID or passport"
              />
            </label>
          </div>
        </section>

        <section className="dt-stats">
          {[
            ["Upcoming Follow-ups", upcoming.length],
            ["Reminder Window", reminders.length],
            ["Overdue Follow-ups", overdue.length],
            ["Today's Appointments",
              clinicAppointments.filter(
                (a) =>
                  a.appointment_date === today()
              ).length],
          ].map(([label, value]) => (
            <div className="dt-stat" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        {showBooking && (
          <section className="dt-panel">
            <div className="dt-section-heading">
              <div>
                <p className="dt-eyebrow">
                  CONTRACEPTIVE FOLLOW-UP SCHEDULER
                </p>
                <h2>Book New Follow-up</h2>
              </div>

              <button
                type="button"
                className="dt-btn outline"
                onClick={() =>
                  setShowBooking(false)
                }
              >
                Close
              </button>
            </div>

            <form onSubmit={createAppointment}>
              <div className="dt-grid two">
                <label>
                  Patient *
                  <select
                    required
                    value={patientId}
                    onChange={(e) =>
                      setPatientId(e.target.value)
                    }
                  >
                    <option value="">
                      Select patient
                    </option>

                    {clinicPatients.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {patientName(p)} —{" "}
                        {p.id_number ||
                          p.passport_number ||
                          "No ID"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Appointment Type *
                  <select
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value)
                    }
                  >
                    {appointmentTypes.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Administration / Reference Date *
                  <input
                    type="date"
                    required
                    value={referenceDate}
                    onChange={(e) =>
                      setReferenceDate(e.target.value)
                    }
                  />
                </label>

                <label>
                  Appointment Time *
                  <input
                    type="time"
                    required
                    value={bookingTime}
                    onChange={(e) =>
                      setBookingTime(e.target.value)
                    }
                  />
                </label>
              </div>

              <div className="dt-interval-panel">
                <h3>Follow-up Interval</h3>
                <p>
                  Select the appropriate interval or
                  adjust it according to the clinical plan.
                </p>

                <div className="dt-interval-options">
                  {["28", "56", "84", "custom"].map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        className={
                          "dt-interval-btn " +
                          (interval === option
                            ? "selected"
                            : "")
                        }
                        onClick={() => {
                          setInterval(option);
                          setUseManualDate(false);
                        }}
                      >
                        {option === "custom"
                          ? "Custom Days"
                          : `${option} Days`}
                      </button>
                    )
                  )}
                </div>

                {interval === "custom" && (
                  <label className="dt-custom-field">
                    Custom interval (1–365 days)
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

                <label className="dt-checkbox">
                  <input
                    type="checkbox"
                    checked={useManualDate}
                    onChange={(e) => {
                      setUseManualDate(
                        e.target.checked
                      );
                      if (e.target.checked) {
                        setManualDate(
                          calculatedDate
                        );
                      }
                    }}
                  />
                  Manually adjust the next
                  appointment date
                </label>

                {useManualDate && (
                  <label className="dt-custom-field">
                    Adjusted appointment date
                    <input
                      type="date"
                      required
                      value={manualDate}
                      onChange={(e) =>
                        setManualDate(
                          e.target.value
                        )
                      }
                    />
                  </label>
                )}
              </div>

              <div className="dt-grid two">
                <label>
                  Reminder before appointment
                  <select
                    value={reminderDays}
                    onChange={(e) =>
                      setReminderDays(
                        e.target.value
                      )
                    }
                  >
                    {[1, 2, 3, 4, 7, 14].map(
                      (n) => (
                        <option
                          key={n}
                          value={n}
                        >
                          {n} days before
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <div className="dt-date-preview">
                <div>
                  <span>Next Appointment</span>
                  <strong>
                    {formatDate(bookingDate)}
                  </strong>
                  <small>
                    {validInterval
                      ? `${selectedDays} days selected`
                      : "Invalid interval"}
                    {useManualDate &&
                      " · Date manually adjusted"}
                  </small>
                </div>

                <div>
                  <span>Reminder Date</span>
                  <strong>
                    {formatDate(reminderDate)}
                  </strong>
                  <small>
                    {reminderDays} days before
                    appointment
                  </small>
                </div>
              </div>

              <label className="dt-notes">
                Clinical / Appointment Notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) =>
                    setNotes(e.target.value)
                  }
                  placeholder="Reason for follow-up or adjusted interval"
                />
              </label>

              <button
                type="submit"
                className="dt-btn primary"
                disabled={
                  saving ||
                  !clinicId ||
                  !patientId ||
                  !validInterval ||
                  !bookingDate
                }
              >
                {saving
                  ? "Saving..."
                  : "Save Follow-up Appointment"}
              </button>
            </form>
          </section>
        )}

        <section className="dt-panel">
          <div className="dt-section-heading">
            <div>
              <p className="dt-eyebrow">
                FOLLOW-UP MONITORING
              </p>
              <h2>Upcoming Follow-ups</h2>
              <p>
                Countdown to the next scheduled
                appointment.
              </p>
            </div>

            <button
              type="button"
              className="dt-btn outline"
              onClick={() =>
                setShowAllUpcoming(
                  (value) => !value
                )
              }
            >
              {showAllUpcoming
                ? "Show First 10"
                : "Show All"}
            </button>
          </div>

          {loading ? (
            <p>Loading follow-ups...</p>
          ) : upcoming.length === 0 ? (
            <div className="dt-empty">
              No upcoming follow-ups found.
            </div>
          ) : (
            <div className="dt-table-scroll">
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
                        {patientName(
                          patientMap.get(
                            a.patient_id
                          )
                        )}
                      </td>
                      <td>
                        {formatDate(
                          a.appointment_date
                        )}
                      </td>
                      <td>
                        {a.interval_days == null
                          ? "—"
                          : `${a.interval_days} days`}
                      </td>
                      <td>
                        <FollowUpBadge
                          appointment={a}
                        />
                      </td>
                      <td>
                        <Link
                          className="dt-link"
                          href={`/nurse/patients/${a.patient_id}`}
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
            <div className="dt-section-heading">
              <div>
                <p className="dt-eyebrow">
                  ACTION REQUIRED
                </p>
                <h2>Overdue Follow-ups</h2>
              </div>
            </div>

            <div className="dt-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Due Date</th>
                    <th>Days Overdue</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {overdue.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {patientName(
                          patientMap.get(
                            a.patient_id
                          )
                        )}
                      </td>
                      <td>
                        {formatDate(
                          a.appointment_date
                        )}
                      </td>
                      <td>
                        <FollowUpBadge
                          appointment={a}
                        />
                      </td>
                      <td>
                        <select
                          value={a.status}
                          disabled={
                            updatingId === a.id
                          }
                          onChange={(e) =>
                            void changeStatus(
                              a.id,
                              e.target.value
                            )
                          }
                        >
                          {statuses.map((s) => (
                            <option
                              key={s}
                              value={s}
                            >
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
          <div className="dt-section-heading">
            <div>
              <p className="dt-eyebrow">
                CLINICAL SCHEDULE
              </p>
              <h2>Daily Appointments</h2>
              <p>
                {formatDate(date)} ·{" "}
                {stats.total} appointments
              </p>
            </div>

            <div className="dt-actions">
              <button
                type="button"
                className="dt-btn outline"
                onClick={() =>
                  moveDate(-1)
                }
              >
                Previous
              </button>

              <button
                type="button"
                className="dt-btn outline"
                onClick={() =>
                  setDate(today())
                }
              >
                Today
              </button>

              <button
                type="button"
                className="dt-btn outline"
                onClick={() =>
                  moveDate(1)
                }
              >
                Next
              </button>
            </div>
          </div>

          {loading ? (
            <p>Loading appointments...</p>
          ) : filtered.length === 0 ? (
            <div className="dt-empty">
              <h3>No appointments found</h3>
              <p>
                No appointments match this clinic,
                date and filter.
              </p>
            </div>
          ) : (
            <div className="dt-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Appointment</th>
                    <th>Clinic</th>
                    <th>Interval</th>
                    <th>Countdown</th>
                    <th>Status</th>
                    <th>Patient Record</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.appointment_time.slice(
                          0,
                          5
                        )}
                      </td>
                      <td>
                        <strong>
                          {patientName(
                            patientMap.get(
                              a.patient_id
                            )
                          )}
                        </strong>
                      </td>
                      <td>
                        {a.appointment_type}
                      </td>
                      <td>
                        {clinicMap.get(
                          a.facility_id
                        )?.site_name ||
                          "Unknown clinic"}
                      </td>
                      <td>
                        {a.interval_days == null
                          ? "—"
                          : `${a.interval_days} days`}
                      </td>
                      <td>
                        <FollowUpBadge
                          appointment={a}
                        />
                      </td>
                      <td>
                        <select
                          value={a.status}
                          disabled={
                            updatingId === a.id
                          }
                          onChange={(e) =>
                            void changeStatus(
                              a.id,
                              e.target.value
                            )
                          }
                        >
                          {statuses.map((s) => (
                            <option
                              key={s}
                              value={s}
                            >
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <Link
                          className="dt-link"
                          href={`/nurse/patients/${a.patient_id}`}
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

        <footer>
          DoseTrack © 2026 · Family Planning
          Management
        </footer>
      </div>

      <style jsx global>{`
        .dt-page {
          min-height: 100vh;
          background: #f5f8fa;
          color: #172d36;
          font-family: Inter, system-ui, Arial, sans-serif;
          padding: 35px 24px;
        }
        .dt-container {
          max-width: 1350px;
          margin: auto;
        }
        .dt-header,
        .dt-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 25px;
        }
        .dt-header h1 {
          font-size: 34px;
          margin: 8px 0;
        }
        .dt-header p {
          color: #647781;
        }
        .dt-eyebrow {
          font-size: 11px;
          letter-spacing: 1.5px;
          color: #0e756d;
          font-weight: 800;
        }
        .dt-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }
        .dt-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          border: 1px solid #dbe4e9;
          padding: 11px 16px;
          font-weight: 700;
          font-size: 13px;
          text-decoration: none;
          cursor: pointer;
        }
        .dt-btn.primary {
          background: #0e756d;
          border-color: #0e756d;
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
        .dt-panel {
          background: white;
          padding: 25px;
          border-radius: 16px;
          border: 1px solid #e3eaf0;
          margin-bottom: 22px;
        }
        .dt-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 18px;
        }
        .dt-grid.two {
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
        }
        .dt-page label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: #49626c;
        }
        .dt-page input,
        .dt-page select,
        .dt-page textarea {
          width: 100%;
          min-width: 0;
          padding: 11px;
          border: 1px solid #dbe4e9;
          border-radius: 9px;
          background: white;
          color: #172d36;
          font: inherit;
          box-sizing: border-box;
        }
        .dt-stats {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 16px;
          margin-bottom: 22px;
        }
        .dt-stat {
          background: white;
          border: 1px solid #e3eaf0;
          border-radius: 13px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 13px;
        }
        .dt-stat span {
          color: #647781;
          font-size: 13px;
        }
        .dt-stat strong {
          font-size: 31px;
          color: #0e756d;
        }
        .dt-interval-panel {
          background: #f4faf9;
          border: 1px solid #d9eeeb;
          border-radius: 14px;
          padding: 22px;
          margin: 22px 0;
        }
        .dt-interval-panel h3 {
          margin: 0 0 10px;
          font-size: 19px;
        }
        .dt-interval-panel p {
          color: #647781;
          font-size: 12px;
          margin-bottom: 20px;
        }
        .dt-interval-options {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 18px;
        }
        .dt-interval-btn {
          padding: 15px 23px;
          border: 1px solid #cbdedb;
          border-radius: 10px;
          background: white;
          color: #0e756d;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }
        .dt-interval-btn.selected {
          background: #0e756d;
          border-color: #0e756d;
          color: white;
        }
        .dt-custom-field {
          max-width: 330px;
          margin: 14px 0;
        }
        .dt-page label.dt-checkbox {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 10px;
          margin-top: 18px;
          cursor: pointer;
        }
        .dt-checkbox input {
          width: 17px;
          height: 17px;
        }
        .dt-date-preview {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin: 20px 0;
        }
        .dt-date-preview > div {
          background: #e9f8f3;
          border: 1px solid #cde9df;
          border-radius: 12px;
          padding: 23px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .dt-date-preview span {
          font-size: 12px;
          font-weight: 800;
          color: #0e756d;
        }
        .dt-date-preview strong {
          font-size: 23px;
          color: #0b5953;
        }
        .dt-date-preview small {
          color: #547b75;
        }
        .dt-notes {
          margin: 20px 0;
        }
        .dt-section-heading h2 {
          margin: 0;
          font-size: 22px;
        }
        .dt-section-heading p {
          color: #647781;
        }
        .dt-table-scroll {
          overflow-x: auto;
        }
        .dt-page table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .dt-page th {
          background: #f5f8fa;
          padding: 15px;
          text-align: left;
          color: #49626c;
          white-space: nowrap;
        }
        .dt-page td {
          padding: 15px;
          border-bottom: 1px solid #e3eaf0;
          vertical-align: middle;
        }
        .dt-page td strong {
          display: block;
        }
        .dt-link {
          color: #0e756d;
          font-weight: 700;
          text-decoration: none;
        }
        .dt-badge {
          display: inline-block;
          padding: 8px 12px;
          border-radius: 25px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }
        .dt-badge.good {
          background: #e9f8f3;
          color: #08776d;
        }
        .dt-badge.warning {
          background: #fff3d9;
          color: #986000;
        }
        .dt-badge.danger {
          background: #fff0f0;
          color: #a02727;
        }
        .dt-badge.neutral {
          background: #edf1f3;
          color: #647781;
        }
        .dt-empty {
          padding: 35px;
          text-align: center;
          color: #647781;
        }
        .dt-alert {
          padding: 15px;
          border-radius: 9px;
          margin-bottom: 20px;
        }
        .dt-alert.error {
          background: #fff0f0;
          color: #a02727;
        }
        .dt-alert.success {
          background: #e9f8f3;
          color: #08776d;
        }
        .dt-page footer {
          color: #91a1a9;
          font-size: 11px;
          margin-top: 30px;
        }
        @media(max-width: 900px) {
          .dt-grid,
          .dt-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media(max-width: 600px) {
          .dt-grid,
          .dt-grid.two,
          .dt-stats,
          .dt-date-preview {
            grid-template-columns: 1fr;
          }
          .dt-page {
            padding: 18px 12px;
          }
          .dt-panel {
            padding: 16px;
          }
          .dt-header h1 {
            font-size: 27px;
          }
          .dt-interval-btn {
            flex: 1;
          }
        }
      `}</style>
    </main>
  );
}
