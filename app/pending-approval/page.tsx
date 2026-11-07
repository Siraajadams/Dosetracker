
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type StaffProfile = {
  approval_status: string;
  is_active: boolean;
};

export default function PendingApproval() {
  const [status, setStatus] = useState(
    "Checking your registration..."
  );
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function checkStatus() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setVerified(false);
        setApproved(false);
        setStatus(
          "Please sign in to check your registration."
        );
        return;
      }

      setEmail(user.email || "");

      const emailConfirmed = !!user.email_confirmed_at;
      setVerified(emailConfirmed);

      if (!emailConfirmed) {
        setApproved(false);
        setStatus(
          "Your email is not verified. Please check your inbox or resend the verification email."
        );
        return;
      }

      const { data, error } = await supabase
        .from("staff_profiles")
        .select("approval_status,is_active")
        .eq("id", user.id)
        .maybeSingle<StaffProfile>();

      if (error) {
        setApproved(false);
        setStatus(
          `Unable to check approval: ${error.message}`
        );
        return;
      }

      if (!data) {
        setApproved(false);
        setStatus(
          "Staff profile not found. Contact the administrator."
        );
        return;
      }

      const isApproved =
        data.approval_status === "approved" &&
        data.is_active === true &&
        emailConfirmed;

      setApproved(isApproved);

      if (isApproved) {
        setStatus(
          "Your account is approved and active. You can now sign in to DoseTrack."
        );
      } else if (data.approval_status === "rejected") {
        setStatus(
          "Your registration was rejected. Contact the administrator."
        );
      } else if (data.approval_status === "suspended") {
        setStatus(
          "Your account is suspended. Contact the administrator."
        );
      } else {
        setStatus(
          "Your email is verified. Your registration is awaiting Super Admin approval. Clinical access is not yet enabled."
        );
      }
    } catch {
      setApproved(false);
      setStatus(
        "Unable to check registration. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void checkStatus();
  }, []);

  async function resendVerification() {
    if (!email) {
      setMessage(
        "Please sign in before requesting verification."
      );
      return;
    }

    setSending(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo:
            "https://fp.dose-tracker.com/login",
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Verification request submitted. Check your inbox and spam folder."
        );
      }
    } catch {
      setMessage(
        "Unable to resend verification email."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f0fdfa",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          background: "white",
          padding: 32,
          borderRadius: 16,
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <h1>Family Planning — DoseTrack</h1>
        <h2>Staff Registration Status</h2>

        {email && (
          <p>
            <strong>Email:</strong> {email}
          </p>
        )}

        <p>{status}</p>

        {!loading && !verified && email && (
          <button
            type="button"
            onClick={resendVerification}
            disabled={sending}
            style={{
              padding: 14,
              background: "#0f766e",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              width: "100%",
              marginBottom: 12,
            }}
          >
            {sending
              ? "Sending..."
              : "Resend Verification Email"}
          </button>
        )}

        {!loading && verified && !approved && (
          <p>
            Your administrator must verify your
            professional registration and approve
            your account before clinical access
            is enabled.
          </p>
        )}

        <button
          type="button"
          onClick={() => void checkStatus()}
          disabled={loading}
          style={{
            padding: 12,
            width: "100%",
            marginBottom: 12,
            cursor: "pointer",
          }}
        >
          {loading
            ? "Checking..."
            : "Refresh Registration Status"}
        </button>

        {message && (
          <p role="status">{message}</p>
        )}

        <Link href="/login">
          Back to login
        </Link>
      </section>
    </main>
  );
}
