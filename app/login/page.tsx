
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resetMode, setResetMode] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Unable to sign in.");
        return;
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError) {
        setMessage(adminError.message);
        return;
      }

      if (isAdmin) {
        router.replace("/admin/staff-approvals");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("staff_profiles")
          .select("approval_status,is_active")
          .eq("id", data.user.id)
          .maybeSingle();

      if (profileError) {
        setMessage(profileError.message);
        return;
      }

      if (
        !data.user.email_confirmed_at ||
        profile?.approval_status !== "approved" ||
        profile?.is_active !== true
      ) {
        router.replace("/pending-approval");
        return;
      }

      router.replace("/dosetrack");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }

    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo:
          window.location.origin + "/reset-password",
      }
    );

    setBusy(false);
    setMessage(
      error
        ? error.message
        : "If the account exists, password reset instructions will be sent."
    );
  }

  async function resendVerification() {
    if (!email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }

    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo:
          window.location.origin + "/pending-approval",
      },
    });

    setBusy(false);
    setMessage(
      error
        ? error.message
        : "If eligible, a verification email will be sent."
    );
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: 14,
    borderRadius: 9,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    fontSize: 16,
  };

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#f0f7f7",
      fontFamily: "Arial",
      padding: 20,
    }}>
      <section style={{
        background: "white",
        padding: 35,
        borderRadius: 18,
        width: "100%",
        maxWidth: 460,
        boxShadow: "0 8px 25px #0001",
      }}>
        <h1>DoseTrack Login</h1>
        <p>Clinical Staff / Administrator Access</p>

        <form onSubmit={login}
          style={{ display: "grid", gap: 16 }}>
          <input
            type="email"
            placeholder="Email address"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={fieldStyle}
          />

          {!resetMode && (
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  ...fieldStyle,
                  paddingRight: 75,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                style={{
                  position: "absolute",
                  right: 10,
                  top: 12,
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          )}

          {message && (
            <p role="status" style={{ color: "#a33" }}>
              {message}
            </p>
          )}

          {!resetMode ? (
            <button
              disabled={busy}
              type="submit"
              style={{
                padding: 15,
                background: "#075c59",
                color: "white",
                border: 0,
                borderRadius: 9,
                cursor: "pointer",
              }}
            >
              {busy ? "Please wait..." : "Login"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={resetPassword}
              style={{
                padding: 15,
                background: "#075c59",
                color: "white",
                border: 0,
                borderRadius: 9,
              }}
            >
              Send Password Reset Email
            </button>
          )}
        </form>

        <div style={{
          display: "grid",
          gap: 14,
          marginTop: 22,
          textAlign: "center",
        }}>
          <button
            type="button"
            onClick={() => {
              setResetMode(!resetMode);
              setMessage("");
            }}
          >
            {resetMode ? "Back to Login" : "Forgot Password?"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={resendVerification}
          >
            Resend Verification Email
          </button>
        </div>
      </section>
    </main>
  );
}
