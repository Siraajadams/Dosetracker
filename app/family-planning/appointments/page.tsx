
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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

type Patient = {
  id: string;
  first_name: string;
  surname: string;
  id_number?: string | null;
};

type Facility = {
  id: string;
  name: string;
};

const TYPES = [
  "Family Planning",
  "Contraceptive Injection",
  "Contraceptive Implant",
  "Oral Contraceptive",
  "Follow-up",
  "Counselling",
  "Other",
];

const STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "missed",
];

function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const obj = error as { message?: string };
    return obj.message || "An unexpected error occurred.";
  }
  return String(error);
}

export default function FamilyPlanningAppointmentsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);

  const [selectedFacility, setSelectedFacility] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const [patientId, setPatientId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(todayISO());
  const [appointmentTime, setAppointmentTime] = useState("09:00");
  const [appointmentType, setAppointmentType] = useState(TYPES[0]);
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Please log in to access appointments.");
      }

      // Only facilities assigned to the signed-in user.
      const { data: memberships, error: membershipError } =
        await supabase
          .from("fp_memberships")
          .select("facility_id")
          .eq("user_id", auth.user.id)
          .eq("active", true);

      if (membershipError) throw membershipError;

      const facilityIds = Array.from(
        new Set(
          (memberships || [])
            .map((m) => m.facility_id)
            .filter(Boolean)
        )
      );

      if (facilityIds.length === 0) {
        setFacilities([]);
        setPatients([]);
        setAppointments([]);
        setError(
          "No active clinic assignment found. Contact the administrator."
        );
        return;
      }

      const [facilityResult, patientResult, appointmentResult] =
        await Promise.all([
          supabase
            .from("fp_facilities")
            .select("id, name")
            .in("id", facilityIds),

          supabase
            .from("fp_patients")
            .select("id, first_name, surname, id_number")
            .limit(1000),

          supabase
            .from("fp_appointments")
            .select("*")
            .in("facility_id", facilityIds)
            .order("appointment_date", { ascending: true }),
        ]);

      if (facilityResult.error) throw facilityResult.error;
      if (patientResult.error) throw patientResult.error;
      if (appointmentResult.error) throw appointmentResult.error;

      const clinicRows = (facilityResult.data || []) as Facility[];

      setFacilities(clinicRows);
      setPatients((patientResult.data || []) as Patient[]);
      setAppointments(
        (appointmentResult.data || []) as Appointment[]
      );

      setSelectedFacility((current) =>
        clinicRows.some((f) => f.id === current)
          ? current
          : clinicRows[0]?.id || ""
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const patientMap = useMemo(() => {
    return new Map(patients.map((patient) => [patient.id, patient]));
  }, [patients]);

  const facilityMap = useMemo(() => {
    return new Map(facilities.map((facility) => [facility.id, facility]));
  }, [facilities]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      if (
        selectedFacility &&
        appointment.facility_id !== selectedFacility
      ) {
        return false;
      }

      if (
        selectedDate &&
        appointment.appointment_date !== selectedDate
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        appointment.status !== statusFilter
      ) {
        return false;
      }

      const patient = patientMap.get(appointment.patient_id);

      const searchable = [
        patient?.first_name,
        patient?.surname,
        patient?.id_number,
        appointment.appointment_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(search.toLowerCase());
    });
  }, [
    appointments,
    selectedFacility,
    selectedDate,
    statusFilter,
    search,
    patientMap,
  ]);

  const counts = useMemo(() => {
    const rows = appointments.filter(
      (a) =>
        (!selectedFacility || a.facility_id === selectedFacility) &&
        a.appointment_date === selectedDate
    );

    return {
      total: rows.length,
      scheduled: rows.filter((a) => a.status === "scheduled").length,
      completed: rows.filter((a) => a.status === "completed").length,
      cancelled: rows.filter((a) => a.status === "cancelled").length,
    };
  }, [appointments, selectedFacility, selectedDate]);

  async function createAppointment(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!selectedFacility || !patientId) {
      setError("Please select a clinic and patient.");
      return;
    }

    if (!appointmentDate || !appointmentTime) {
      setError("Please select an appointment date and time.");
      return;
    }

    setSaving(true);

    try {
      const { error: insertError } = await supabase
        .from("fp_appointments")
        .insert({
          facility_id: selectedFacility,
          patient_id: patientId,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          appointment_type: appointmentType,
          status: "scheduled",
          notes: notes.trim() || null,
        });

      if (insertError) throw insertError;

      setMessage("Appointment created successfully.");
      setShowForm(false);
      setPatientId("");
      setNotes("");
      setSelectedDate(appointmentDate);

      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("fp_appointments")
        .update({ status })
        .eq("id", id);

      if (updateError) throw updateError;

      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === id
            ? { ...appointment, status }
            : appointment
        )
      );

      setMessage("Appointment status updated.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <main className="fp-page">
      <div className="fp-container">
        <header className="fp-header">
          <div>
            <p className="fp-eyebrow">DOSETRACK · FAMILY PLANNING</p>
            <h1>Appointments</h1>
            <p className="fp-subtitle">
              Schedule, review and manage patient appointments.
            </p>
          </div>

          <div className="fp-actions">
            <Link
              href="/family-planning/dashboard"
              className="fp-button secondary"
            >
              Dashboard
            </Link>

            <button
              className="fp-button secondary"
              onClick={() => void loadData()}
            >
              Refresh
            </button>

            <button
              className="fp-button primary"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "Close Form" : "+ New Appointment"}
            </button>
          </div>
        </header>

        {error && <div className="fp-alert error">{error}</div>}
        {message && <div className="fp-alert success">{message}</div>}

        <section className="fp-card">
          <div className="fp-filter-grid">
            <label>
              Clinic
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
              >
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Appointment Date
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </label>

            <label>
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Patient name or ID"
              />
            </label>
          </div>
        </section>

        <section className="fp-stats">
          <div className="fp-stat">
            <span>Total Appointments</span>
            <strong>{counts.total}</strong>
          </div>

          <div className="fp-stat">
            <span>Scheduled</span>
            <strong>{counts.scheduled}</strong>
          </div>

          <div className="fp-stat">
            <span>Completed</span>
            <strong>{counts.completed}</strong>
          </div>

          <div className="fp-stat">
            <span>Cancelled</span>
            <strong>{counts.cancelled}</strong>
          </div>
        </section>

        {showForm && (
          <section className="fp-card">
            <h2>Book New Appointment</h2>

            <form onSubmit={createAppointment}>
              <div className="fp-form-grid">
                <label>
                  Patient
                  <select
                    required
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                  >
                    <option value="">Select Patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.surname}
                        {patient.id_number
                          ? ` — ${patient.id_number}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Appointment Type
                  <select
                    value={appointmentType}
                    onChange={(e) =>
                      setAppointmentType(e.target.value)
                    }
                  >
                    {TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Date
                  <input
                    required
                    type="date"
                    value={appointmentDate}
                    onChange={(e) =>
                      setAppointmentDate(e.target.value)
                    }
                  />
                </label>

                <label>
                  Time
                  <input
                    required
                    type="time"
                    value={appointmentTime}
                    onChange={(e) =>
                      setAppointmentTime(e.target.value)
                    }
                  />
                </label>
              </div>

              <label className="fp-notes">
                Notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional appointment notes"
                />
              </label>

              <button
                type="submit"
                className="fp-button primary"
                disabled={saving || !selectedFacility}
              >
                {saving ? "Saving..." : "Save Appointment"}
              </button>
            </form>
          </section>
        )}

        <section className="fp-card">
          <div className="fp-section-heading">
            <h2>Appointment Schedule</h2>
            <span>{filteredAppointments.length} records</span>
          </div>

          {loading ? (
            <p>Loading appointments...</p>
          ) : filteredAppointments.length === 0 ? (
            <div className="fp-empty">
              No appointments found for the selected date and filters.
            </div>
          ) : (
            <div className="fp-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Clinic</th>
                    <th>Appointment Type</th>
                    <th>Status</th>
                    <th>Patient Record</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAppointments.map((appointment) => {
                    const patient = patientMap.get(
                      appointment.patient_id
                    );

                    return (
                      <tr key={appointment.id}>
                        <td>{appointment.appointment_time}</td>

                        <td>
                          {patient
                            ? `${patient.first_name} ${patient.surname}`
                            : "Patient unavailable"}
                        </td>

                        <td>
                          {facilityMap.get(appointment.facility_id)
                            ?.name || "Unknown Clinic"}
                        </td>

                        <td>{appointment.appointment_type}</td>

                        <td>
                          <select
                            value={appointment.status}
                            onChange={(e) =>
                              void updateStatus(
                                appointment.id,
                                e.target.value
                              )
                            }
                          >
                            {STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <Link
                            href={`/nurse/patients/${appointment.patient_id}`}
                            className="fp-link"
                          >
                            Open Patient
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .fp-page {
          min-height: 100vh;
          background: #f4f7fb;
          color: #172b4d;
          padding: 32px 20px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .fp-container {
          max-width: 1350px;
          margin: auto;
        }

        .fp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 28px;
        }

        .fp-eyebrow {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: #087c87;
        }

        h1 {
          font-size: 34px;
          margin: 8px 0;
        }

        h2 {
          font-size: 20px;
          margin: 0 0 20px;
        }

        .fp-subtitle {
          color: #66758c;
        }

        .fp-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .fp-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          padding: 12px 18px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          text-decoration: none;
          border: 1px solid #d9e2ed;
        }

        .primary {
          background: #087c87;
          color: white;
          border-color: #087c87;
        }

        .secondary {
          background: white;
          color: #172b4d;
        }

        .fp-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .fp-card {
          background: white;
          padding: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          margin-bottom: 24px;
          box-shadow: 0 3px 12px rgba(20, 40, 70, 0.03);
        }

        .fp-filter-grid,
        .fp-form-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #44546a;
        }

        input,
        select,
        textarea {
          width: 100%;
          min-width: 0;
          padding: 11px;
          border: 1px solid #d9e2ed;
          border-radius: 8px;
          background: white;
          color: #172b4d;
          font-size: 14px;
          box-sizing: border-box;
        }

        .fp-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .fp-stat {
          background: white;
          padding: 22px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .fp-stat span {
          font-size: 13px;
          color: #66758c;
        }

        .fp-stat strong {
          font-size: 30px;
          color: #087c87;
        }

        .fp-notes {
          margin: 20px 0;
        }

        .fp-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .fp-section-heading h2 {
          margin: 0;
        }

        .fp-section-heading span {
          color: #66758c;
          font-size: 13px;
        }

        .fp-table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        th {
          background: #f4f7fb;
          text-align: left;
          padding: 14px;
          color: #44546a;
        }

        td {
          padding: 14px;
          border-bottom: 1px solid #e2e8f0;
        }

        td select {
          min-width: 120px;
        }

        .fp-link {
          color: #087c87;
          font-weight: 700;
          text-decoration: none;
        }

        .fp-empty {
          padding: 40px 15px;
          text-align: center;
          color: #66758c;
        }

        .fp-alert {
          padding: 15px;
          border-radius: 9px;
          margin-bottom: 20px;
        }

        .error {
          background: #fff1f2;
          color: #9f1239;
        }

        .success {
          background: #ecfdf5;
          color: #047857;
        }

        @media (max-width: 900px) {
          .fp-filter-grid,
          .fp-form-grid,
          .fp-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .fp-filter-grid,
          .fp-form-grid,
          .fp-stats {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 27px;
          }

          .fp-page {
            padding: 16px 10px;
          }

          .fp-card {
            padding: 16px;
          }
        }
      `}</style>
    </main>
  );
}
