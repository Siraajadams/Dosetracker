
"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const input: CSSProperties = {
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  width: "100%",
  boxSizing: "border-box",
};

export default function RegisterNurse() {
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [sanc, setSanc] = useState("");
  const [category, setCategory] = useState("registered_nurse");
  const [pharmacy, setPharmacy] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!province) {
      setMessage("Please select a province.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo:
            `${window.location.origin}/pending-approval`,
          data: {
            full_name: `${firstName.trim()} ${surname.trim()}`,
            first_name: firstName.trim(),
            surname: surname.trim(),
            mobile_number: mobile.trim(),
            sanc_number: sanc.trim(),
            professional_category: category,
            requested_pharmacy_name: pharmacy.trim(),
            requested_pharmacy_address: address.trim(),
            requested_province: province,
          },
        },
      });

      setMessage(
        error
          ? error.message
          : "Registration submitted. Please check your email. " +
            "Clinical access remains pending Super Admin approval."
      );
    } catch {
      setMessage("Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      padding: 24,
      background: "#eef7ff",
      fontFamily: "Arial, sans-serif",
    }}>
      <section style={{
        maxWidth: 560,
        margin: "auto",
        padding: 24,
        background: "white",
        borderRadius: 16,
      }}>
        <h1>Family Planning — Nurse Registration</h1>
        <p>
          Email verification, SANC verification and
          Super Admin approval are required.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <h3>Personal details</h3>

          <input required style={input}
            placeholder="First name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)} />

          <input required style={input}
            placeholder="Surname"
            value={surname}
            onChange={e => setSurname(e.target.value)} />

          <input required style={input} type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)} />

          <input required style={input} type="tel"
            placeholder="Mobile number"
            value={mobile}
            onChange={e => setMobile(e.target.value)} />

          <h3>Professional registration</h3>

          <input required style={input}
            placeholder="SANC registration number"
            value={sanc}
            onChange={e => setSanc(e.target.value)} />

          <select style={input} value={category}
            onChange={e => setCategory(e.target.value)}>
            <option value="registered_nurse">Registered nurse</option>
            <option value="enrolled_nurse">Enrolled nurse</option>
            <option value="enrolled_nursing_auxiliary">
              Enrolled nursing auxiliary
            </option>
          </select>

          <h3>Pharmacy details</h3>

          <input required style={input}
            placeholder="Name of pharmacy"
            value={pharmacy}
            onChange={e => setPharmacy(e.target.value)} />

          <textarea required style={input} rows={3}
            placeholder="Pharmacy street address, suburb, city and postal code"
            value={address}
            onChange={e => setAddress(e.target.value)} />

          <select required style={input} value={province}
            onChange={e => setProvince(e.target.value)}>
            <option value="">Select province</option>
            {provinces.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <h3>Account security</h3>

          <input required style={input} type="password"
            minLength={12} placeholder="Password (12+ characters)"
            value={password}
            onChange={e => setPassword(e.target.value)} />

          <input required style={input} type="password"
            minLength={12} placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} />

          <button disabled={busy} type="submit"
            style={{
              ...input,
              background: "#0f766e",
              color: "white",
              cursor: busy ? "wait" : "pointer",
            }}>
            {busy ? "Submitting..." : "Register Nurse"}
          </button>
        </form>

        <p role="status" aria-live="polite">{message}</p>
        <Link href="/family-planning/login">
          Return to Family Planning login
        </Link>
      </section>
    </main>
  );
}
