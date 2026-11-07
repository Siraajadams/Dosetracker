
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
          "Your email address has not been verified. Please check your inbox or resend the verification email."
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
          "Your staff registration profile was not found. Please contact the administrator."
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
          "Your account is approved and active. You can now sign in to Dose
