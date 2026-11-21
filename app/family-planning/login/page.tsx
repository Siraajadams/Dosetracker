
"use client";

import {
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type StaffProfile = {
  role: string | null;
  approval_status: string | null;
  is_active: boolean | null;
};

type Membership = {
  facility_id: string | null;
  role: string | null;
  active: boolean | null;
};

const CLINICAL_ROLES = [
  "nurse",
  "healthcare_worker",
];

const MEMBERSHIP_ROLES = [
  "nurse",
  "healthcare_worker",
  "doctor",
  "administrator",
];

export default function FamilyPlanningLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      // STEP 1: Authenticate user
      const {
        data: signIn,
        error: signInError,
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      const user = signIn.user;

      if (!user) {
        throw new Error(
          "Unable to verify your account. Please sign in again."
        );
      }

      // STEP 2: Retrieve staff profile
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("staff_profiles")
        .select("role, approval_status, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(
          `Unable to verify staff approval: ${profileError.message}`
        );
      }

      const profile = profileData as StaffProfile | null;

      const role = profile?.role?.toLowerCase().trim() ?? "";

      const isClinicalWorker = CLINICAL_ROLES.includes(role);

      // STEP 3: Clinical healthcare workers
      // Nurse accounts take priority over admin routing.
      if (isClinicalWorker) {
        if (
          !user.email_confirmed_at ||
          profile?.approval_status !== "approved" ||
          profile?.is_active !== true
        ) {
          router.replace("/pending-approval");
          return;
        }

        // STEP 4: Verify active clinic assignments
        const {
          data: membershipData,
          error: membershipError,
        } = await supabase
          .from("fp_memberships")
          .select("facility_id, role, active")
          .eq("user_id", user.id)
          .eq("active", true);

        if (membershipError) {
          throw new Error(
            `Unable to verify clinic assignment: ${membershipError.message}`
          );
        }

        const memberships =
          (membershipData ?? []) as Membership[];

        const hasClinicalMembership = memberships.some(
          (membership) =>
            Boolean(membership.facility_id) &&
            membership.active === true &&
            MEMBERSHIP_ROLES.includes(
              membership.role?.toLowerCase().trim() ?? ""
            )
        );

        if (!hasClinicalMembership) {
          setErrorMessage(
            "Your account is approved, but no active clinic is assigned. Please contact the administrator."
          );
          return;
        }

        // STEP 5: Always open the Nurse Dashboard
        // for approved clinical healthcare workers.
        router.replace("/nurse/dashboard");
        router.refresh();
        return;
      }

      // STEP 6: Check Super Administrator access
      // Only non-clinical accounts reach this section.
      const {
        data: isSuperAdmin,
        error: adminError,
      } = await supabase.rpc("dt_is_super_admin");

      if (adminError) {
        throw new Error(
          `Unable to verify administrator access: ${adminError.message}`
        );
      }

      if (isSuperAdmin === true) {
        router.replace("/admin");
        router.refresh();
        return;
      }

      // STEP 7: No authorised role
      router.replace("/pending-approval");
      return;

    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: 14,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    fontSize: 15,
    boxSizing: "border-box",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg,#e0f2fe,#f0fdfa)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Arial,sans-serif",
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          borderRadius: 22,
          padding: 32,
          boxShadow: "0 8px 25px rgba(0,0,0,.10)",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            color: "#0f766e",
            marginBottom: 6,
          }}
        >
          DoseTrack
        </h1>

        <h2 style={{ marginBottom: 8 }}>
          Family Planning
        </h2>

        <p style={{ color: "#64748b" }}>
          Healthcare Worker / Administrator Access
        </p>

        <nav
          aria-label="Account access"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            padding: 5,
            background: "#f1f5f9",
            borderRadius: 12,
            marginTop: 26,
          }}
        >
          <div
            aria-current="page"
            style={{
              padding: 13,
              background: "#fff",
              color: "#0f766e",
              borderRadius: 9,
              textAlign: "center",
              fontWeight: 700,
              boxShadow: "0 1px 4px rgba(0,0,0,.08)",
            }}
          >
            Login
          </div>

          <Link
            href="/register-nurse"
            style={{
              padding: "11px 8px",
              color: "#475569",
              textAlign: "center",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 13,
              lineHeight: 1.4,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Register Healthcare Worker
          </Link>
        </nav>

        <form
          onSubmit={login}
          style={{
            display: "grid",
            gap: 16,
            marginTop: 24,
          }}
        >
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: 7,
                fontWeight: 600,
              }}
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: 7,
                fontWeight: 600,
              }}
            >
              Password
            </label>

            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                style={{
                  ...inputStyle,
                  paddingRight: 75,
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
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: 0,
                  color: "#0f766e",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <Link
              href="/family-planning/reset-password"
              style={{
                color: "#0f766e",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Forgot password?
            </Link>
          </div>

          {errorMessage && (
            <p
              role="alert"
              style={{
                color: "#b91c1c",
                background: "#fef2f2",
                padding: 12,
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 15,
              background: "#0f766e",
              color: "white",
              border: 0,
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p
          style={{
            marginTop: 24,
            fontSize: 13,
            color: "#64748b",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          New healthcare workers must register and
          receive administrator approval before
          accessing clinical services.
        </p>

        <footer
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          © {new Date().getFullYear()} DoseTrack

          <div style={{ marginTop: 4 }}>
            Powered by Videomed
          </div>
        </footer>
      </section>
    </main>
  );
}
