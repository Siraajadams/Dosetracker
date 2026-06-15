"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/dosetrack");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #e0f2fe, #f8fafc)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          background: "white",
          padding: 32,
          borderRadius: 22,
          boxShadow: "0 8px 25px rgba(0,0,0,0.12)",
        }}
      >
        <h1>DoseTrack Login</h1>
        <p>Receptionist / Administrator access</p>

        <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
          <input
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: 14,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: 14,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />

          <button
            onClick={login}
            disabled={loading}
            style={{
              padding: 14,
              background: "#0f766e",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </div>
      </section>
    </main>
  );
}
