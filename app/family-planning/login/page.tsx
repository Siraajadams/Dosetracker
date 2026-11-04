
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FamilyPlanningLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      // The dashboard must independently verify
      // approved Family Planning membership.
      router.replace("/family-planning/dashboard");
    } catch {
      setErrorMessage("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#e0f2fe,#f0fdfa)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "Arial,sans-serif"
    }}>
      <section style={{
        width: "100%",
        maxWidth: 440,
        background: "#fff",
        borderRadius: 22,
        padding: 32,
        boxShadow: "0 8px 25px rgba(0,0,0,.10)"
      }}>
        <h1 style={{ color: "#0f766e", marginBottom: 6 }}>
          DoseTrack
        </h1>
        <h2>Family Planning</h2>
        <p style={{ color: "#64748b" }}>
          Authorised clinical staff access
        </p>

        <form onSubmit={login}
          style={{ display: "grid", gap: 16, marginTop: 24 }}>
          <input
            type="email"
            placeholder="Email address"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: 14, borderRadius: 10 }}
          />

          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ padding: 14, borderRadius: 10 }}
          />

          {errorMessage && (
            <p role="alert" style={{ color: "#b91c1c" }}>
              {errorMessage}
            </p>
          )}

          <button type="submit" disabled={loading}
            style={{
              padding: 15,
              background: "#0f766e",
              color: "white",
              border: 0,
              borderRadius: 10,
              fontWeight: 700
            }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{
          marginTop: 24,
          fontSize: 13,
          color: "#64748b",
          textAlign: "center"
        }}>
          Clinical access requires administrator approval.
        </p>
      </section>
    </main>
  );
}
