
"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type StaffProfile = {
  role: string;
  approval_status: string;
  is_active: boolean;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resetMode, setResetMode] = useState(false);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      // Step 1: Authenticate user
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

      // Step 2: Check Super Admin permissions
      const { data: isAdmin, error: adminError } =
        await supabase.rpc("dt_is_super_admin");

      if (adminError) {
        setMessage(adminError.message);
        return;
      }

      if (isAdmin === true) {
        router.replace("/admin/staff-approvals");
        return;
      }

      // Step 3: Retrieve staff profile
      const { data: profile, error: profileError } =
        await supabase
          .from("staff_profiles")
          .select("role,approval_status,is_active")
          .eq("id", data.user.id)
          .maybeSingle<StaffProfile>();

      if (profileError) {
        setMessage(profileError.message);
        return;
      }

      if (!profile) {
        setMessage(
          "Staff profile not found. Contact your administrator."
        );
        return;
      }

      // Step 4: Check email verification
      if (!data.user.email_confirmed_at) {
        router.replace("/pending-approval");
        return;
      }

      // Step 5: Check staff approval
      if (
        profile.approval_status !== "approved" ||
        profile.is_active !== true
      ) {
        router.replace("/pending-approval");
        return;
      }

      // Step 6: Redirect approved nurses
      if (profile.role === "nurse") {
        router.replace("/nurse/dashboard");
        return;
      }

      // Step 7: Prevent unsupported roles
      setMessage(
        "Your account is active, but no dashboard is configured for your role. Contact your administrator."
      );

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "An unexpected login error occurred."
      );
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

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo:
              window.location.origin + "/reset-password",
          }
        );

      setMessage(
        error
          ? error.message
          : "If the account exists, password reset instructions will be sent."
      );
    } catch {
      setMessage("Unable to request password reset.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo:
            window.location.origin + "/pending-approval",
        },
      });

      setMessage(
        error
          ? error.message
          : "If eligible, a verification email will be sent."
      );
    } catch {
      setMessage("Unable to resend verification email.");
    } finally {
      setBusy(false);
    }
  }

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: 14,
    borderRadius: 9,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    fontSize: 16,
  };

  const primaryButton: CSSProperties = {
    padding: 15,
    background: "#075c59",
    color: "white",
    border: 0,
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 15,
  };

  const linkButton: CSSProperties = {
    background: "transparent",
    border: "none",
    color: "#0f766e",
    cursor: "pointer",
    fontSize: 14,
    textDecoration: "underline",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f0f7f7",
        fontFamily: "Arial, sans-serif",
        padding: 20,
      }}
    >
      <section
        style={{
          background: "white",
          padding: 35,
          borderRadius: 18,
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 8px 25px #0001",
        }}
      >
        <h1 style={{ color: "#075c59" }}>
          DoseTrack
        </h1>

        <h2 style={{ fontSize: 19 }}>
          Family Planning Login
        </h2>

        <p style={{ color: "#64748b" }}>
          Nurse / Clinical Staff / Administrator Access
        </p>

        <form
          onSubmit={login}
          style={{
            display: "grid",
            gap: 16,
            marginTop: 24,
          }}
        >
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
                  paddingRight: 85,
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
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
                  color: "#0f766e",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          )}

          {message && (
            <p
              role="status"
              style={{
                color: "#9f1239",
                background: "#fff1f2",
                padding: 12,
                borderRadius: 8,
              }}
            >
              {message}
            </p>
          )}

          {!resetMode ? (
            <button
              disabled={busy}
              type="submit"
              style={primaryButton}
            >
              {busy ? "Signing in..." : "Login"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void resetPassword()}
              style={primaryButton}
            >
              {busy
                ? "Sending..."
                : "Send Password Reset Email"}
            </button>
          )}
        </form>

        <div
          style={{
            display: "grid",
            gap: 14,
            marginTop: 22,
            textAlign: "center",
          }}
        >
          <button
            type="button"
            style={linkButton}
            onClick={() => {
              setResetMode(!resetMode);
              setMessage("");
            }}
          >
            {resetMode
              ? "Back to Login"
              : "Forgot Password?"}
          </button>

          <button
            type="button"
            disabled={busy}
            style={linkButton}
            onClick={() => void resendVerification()}
          >
            Resend Verification Email
          </button>
        </div>
      </section>
    </main>
  );
}
