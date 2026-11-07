
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Checking your password reset link..."
  );

  useEffect(() => {
    let active = true;

    async function checkRecovery() {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(
        window.location.hash.substring(1)
      );

      const error = params.get("error_code") ||
        hash.get("error_code");

      if (error) {
        setMessage(
          "This reset link has expired or is invalid. " +
          "Please request a new password reset email."
        );
        return;
      }

      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (tokenHash && type === "recovery") {
        const { error: verifyError } =
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

        if (!active) return;

        if (verifyError) {
          setMessage(verifyError.message);
          return;
        }

        window.history.replaceState(
          {},
          "",
          "/reset-password"
        );
      }

      const { data, error: sessionError } =
        await supabase.auth.getSession();

      if (!active) return;

      if (sessionError || !data.session) {
        setMessage(
          "No valid recovery session. " +
          "Please request a new reset email."
        );
        return;
      }

      setReady(true);
      setMessage("Enter your new password below.");
    }

    checkRecovery();

    return () => {
      active = false;
    };
  }, []);

  async function updatePassword(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setReady(false);
    setMessage(
      "Password updated successfully. You can now log in."
    );

    await supabase.auth.signOut();
  }

  return (
    <main style={{
      maxWidth: 460,
      margin: "80px auto",
      padding: 32,
      fontFamily: "Arial",
    }}>
      <h1>DoseTrack</h1>
      <h2>Reset Password</h2>
      <p>{message}</p>

      {ready && (
        <form onSubmit={updatePassword}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            style={{ width: "100%", padding: 12, marginBottom: 12 }}
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={{ width: "100%", padding: 12, marginBottom: 12 }}
          />

          <button type="submit" disabled={busy}>
            {busy ? "Updating..." : "Update Password"}
          </button>
        </form>
      )}

      <p>
        <Link href="/login">Back to Login</Link>
      </p>
    </main>
  );
}
