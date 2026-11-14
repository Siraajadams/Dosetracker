
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
};

const appointmentTypes = [
  "Family Planning",
  "Contraceptive Injection",
  "Contraceptive Implant",
  "Oral Contraceptive",
  "Contraceptive Follow-up",
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

export default function AppointmentsPage() {
  const router = useRouter();

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [clinicId, setClinicId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(today());
  const [bookingDate, setBookingDate] = useState(today());
  const [bookingTime, setBookingTime] = useState("09:00");
  const [type, setType] = useState(appointmentTypes[0]);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

      // Read clinic assignments from both existing systems.
      const [nurseResult, membershipResult] = await Promise.all([
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
        new Set([
          ...(nurseResult.data || []).map((r) => r.site_id),
          ...(membershipResult.data || []).map(
            (r) => r.facility_id
          ),
        ].filter((id): id is string => Boolean(id)))
      );

      if (!ids.length) {
        setClinics([]);
        setPatients([]);
        setAppointments([]);
        throw new Error(
          "No assigned clinics found. Ask the administrator to assign a clinic."
        );
      }

      const [siteResult, patientResult, appointmentResult] =
        await Promise.all([
          supabase
            .from("sites")
            .select("id,site_name")
            .in("id", ids)
            .eq("is_active", true)
            .order("site_name"),

          supabase
            .from("patients")
            .select(
              "id,site_id,first_name,surname,id_number,passport_number"
            )
            .in("site_id", ids)
            .order("surname")
            .limit(1000),

          supabase
            .from("fp_appointments")
            .select(
              "id,patient_id,facility_id,appointment_date,appointment_time,appointment_type,status,notes"
            )
            .in("facility_id", ids)
            .order("appointment_date")
            .order("appointment_time")
            .limit(1000),
        ]);

      if (siteResult.error) throw siteResult.error;
      if (patientResult.error) throw patientResult.error;
      if (appointmentResult.error) throw appointmentResult.error;

      const activeClinics = (siteResult.data || []) as Clinic[];
      const activeIds = new Set(activeClinics.map((c) => c.id));

      setClinics(activeClinics);
      setPatients(
        ((patientResult.data || []) as Patient[]).filter(
          (p) => activeIds.has(p.site_id)
        )
      );
      setAppointments(
        ((appointmentResult.data || []) as Appointment[]).filter(
          (a) => activeIds.has(a.facility_id)
        )
      );

      setClinicId((previous) =>
        activeIds.has(previous)
          ? previous
          : activeClinics[0]?.id || ""
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

  const dailyAppointments = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.facility_id === clinicId &&
          a.appointment_date === date
      ),
    [appointments, clinicId, date]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return dailyAppointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) {
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
  }, [dailyAppointments, statusFilter, search, patientMap]);

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

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!clinicId || !patientId) {
      setError("Select a clinic and patient.");
      return;
    }

    const selectedPatient = clinicPatients.find(
      (p) => p.id === patientId
    );

    if (!selectedPatient) {
      setError("Patient is not registered at the selected clinic.");
      return;
    }

    if (bookingDate < today()) {
      setError("New appointments cannot be booked in the past.");
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
          appointment_date: bookingDate,
          appointment_time: bookingTime,
          appointment_type: type,
          status: "scheduled",
          notes: notes.trim() || null,
        });

      if (insertError) throw insertError;

      setShowBooking(false);
      setPatientId("");
      setNotes("");
      setDate(bookingDate);

      await loadData();
      setSuccess("Appointment booked successfully.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: string) {
    setError("");
    setSuccess("");

    const appointment = appointments.find((a) => a.id === id);

    if (!appointment || appointment.facility_id !== clinicId) {
      setError("Appointment is not available at this clinic.");
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("fp_appointments")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("facility_id", clinicId);

      if (updateError) throw updateError;

      await loadData();
      setSuccess("Appointment status updated.");
    } catch (err) {
      setError(errorText(err));
    }
  }

  function moveDate(days: number) {
    const [year, month, day] = date.split("-").map(Number);
    const d = new Date(year, month - 1, day + days);

    setDate([
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-"));
  }

  return (
    <main className="dt-page">
      <div className="dt-container">
        <header className="dt-header">
          <div>
            <p className="dt-eyebrow">
              DOSETRACK / FAMILY PLANNING
            </p>
            <h1>Appointment Management</h1>
            <p>
              Manage contraceptive appointments and patient follow-ups.
            </p>
          </div>

          <div className="dt-actions">
            <Link href="/family-planning/dashboard" className="dt-btn outline">
              Dashboard
            </Link>
            <button className="dt-btn outline" onClick={() => void loadData()}>
              Refresh
            </button>
            <button
              className="dt-btn primary"
              disabled={!clinicId}
              onClick={() => {
                setPatientId("");
                setBookingDate(date < today() ? today() : date);
                setShowBooking(true);
              }}
            >
              + Book Appointment
            </button>
          </div>
        </header>

        {error && <div className="dt-alert error">{error}</div>}
        {success && <div className="dt-alert success">{success}</div>}

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
                  <option value="">No clinic assigned</option>
                )}
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
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
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label>
              Appointment Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Search Patient
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, ID or passport"
              />
            </label>
          </div>
        </section>

        <section className="dt-stats">
          {[
            ["Total Appointments", stats.total],
            ["Scheduled", stats.scheduled],
            ["Confirmed", stats.confirmed],
            ["Completed", stats.completed],
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
              <h2>Book New Appointment</h2>
              <button
                className="dt-btn outline"
                onClick={() => setShowBooking(false)}
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
                    onChange={(e) => setPatientId(e.target.value)}
                  >
                    <option value="">Select patient</option>
                    {clinicPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.surname} —{" "}
                        {p.id_number || p.passport_number || "No ID"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Appointment Type *
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {appointmentTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Appointment Date *
                  <input
                    type="date"
                    required
                    min={today()}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </label>

                <label>
                  Appointment Time *
                  <input
                    type="time"
                    required
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                  />
                </label>
              </div>

              <label className="dt-notes">
                Appointment Notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for appointment or follow-up"
                />
              </label>

              <button
                type="submit"
                className="dt-btn primary"
                disabled={saving || !clinicId || !patientId}
              >
                {saving ? "Saving..." : "Save Appointment"}
              </button>
            </form>
          </section>
        )}

        <section className="dt-panel">
          <div className="dt-section-heading">
            <div>
              <p className="dt-eyebrow">CLINICAL SCHEDULE</p>
              <h2>Daily Appointments</h2>
            </div>
            <div className="dt-actions">
              <button className="dt-btn outline" onClick={() => moveDate(-1)}>
                Previous
              </button>
              <button className="dt-btn outline" onClick={() => setDate(today())}>
                Today
              </button>
              <button className="dt-btn outline" onClick={() => moveDate(1)}>
                Next
              </button>
            </div>
          </div>

          {loading ? (
            <p>Loading appointments...</p>
          ) : filtered.length === 0 ? (
            <div className="dt-empty">
              <h3>No appointments found</h3>
              <p>No appointments match this clinic, date and filter.</p>
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
                    <th>Status</th>
                    <th>Patient Record</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const patient = patientMap.get(a.patient_id);

                    return (
                      <tr key={a.id}>
                        <td>{a.appointment_time.slice(0, 5)}</td>
                        <td>
                          <strong>
                            {patient
                              ? `${patient.first_name || ""} ${patient.surname || ""}`
                              : "Patient unavailable"}
                          </strong>
                        </td>
                        <td>{a.appointment_type}</td>
                        <td>
                          {clinicMap.get(a.facility_id)?.site_name ||
                            "Unknown clinic"}
                        </td>
                        <td>
                          <select
                            value={a.status}
                            onChange={(e) =>
                              void changeStatus(a.id, e.target.value)
                            }
                          >
                            {statuses.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {patient && (
                            <Link
                              className="dt-link"
                              href={`/nurse/patients/${patient.id}`}
                            >
                              Open Record
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer>
          DoseTrack © 2026 · Family Planning Management
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
        .dt-header, .dt-section-heading {
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }
        .dt-grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
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
          grid-template-columns: repeat(4, 1fr);
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
        .dt-notes {
          margin: 20px 0;
        }
        .dt-section-heading h2 {
          margin: 0;
          font-size: 22px;
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
        }
        .dt-page td {
          padding: 15px;
          border-bottom: 1px solid #e3eaf0;
        }
        .dt-link {
          color: #0e756d;
          font-weight: 700;
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
          .dt-grid, .dt-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media(max-width: 600px) {
          .dt-grid, .dt-grid.two, .dt-stats {
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
        }
      `}</style>
    </main>
  );
}
