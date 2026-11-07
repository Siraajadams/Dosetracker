
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) throw error;
      if (!data.user) {
        throw new Error("Unable to identify your account.");
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("staff_profiles")
          .select("role, approval_status, is_active")
          .eq("id", data.user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        setMessage(
          "No staff profile found. Contact the administrator."
        );
        return;
      }

      const { role, approval_status, is_active } = profile;

      if (role === "super_admin") {
        if (
          approval_status !== "approved" ||
          is_active !== true
        ) {
          setMessage("Super Admin account is not active.");
          return;
        }

        router.replace("/admin/staff-approvals");
        return;
      }

      if (approval_status === "rejected") {
        setMessage(
          "Your registration was not approved. Contact the administrator."
        );
        return;
      }

      if (
        approval_status !== "approved" ||
        is_active !== true
      ) {
        router.replace("/pending-approval");
        return;
      }

      if (role === "nurse") {
        router.replace("/family-planning");
        return;
      }

      if (
        role === "site_admin" ||
        role === "receptionist"
      ) {
        router.replace("/dosetrack");
        return;
      }

      setMessage(
        "Your account role is not configured for access."
      );
    } catch (err: unknown) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #e0f2fe, #f8fafc)",
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
        <p>Clinical Staff / Administrator Access</p>

        <form
          onSubmit={login}
          style={{
            display: "grid",
            gap: 14,
            marginTop: 24,
          }}
        >
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
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
            autoComplete="current-password"
            required
            style={{
              padding: 14,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />

          {message && (
            <p
              role="alert"
              style={{
                color: "#b91c1c",
                fontSize: 14,
              }}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 14,
              background: "#0f766e",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontWeight: "bold",
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
