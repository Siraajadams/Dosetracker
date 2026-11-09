
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FamilyPlanningLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      // The destination must independently verify
      // the user's role and clinic membership.
      router.replace("/family-planning/dashboard");
    } catch {
      setErrorMessage("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
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
        background: "linear-gradient(135deg,#e0f2fe,#f0fdfa)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Arial,sans-serif",
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
        }}
      >
        <h1 style={{ color: "#0f766e", marginBottom: 6 }}>
          DoseTrack
        </h1>

        <h2 style={{ marginBottom: 8 }}>
          Family Planning
        </h2>

        <p style={{ color: "#64748b" }}>
          Authorised clinical staff access
        </p>

        {/* Login and Registration Tabs */}
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
              padding: 13,
              color: "#475569",
              textAlign: "center",
              textDecoration: "none",
              fontWeight: 600,
              borderRadius: 9,
            }}
          >
            Register Nurse
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
              onChange={e => setEmail(e.target.value)}
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
                onChange={e => setPassword(e.target.value)}
                style={{
                  ...inputStyle,
                  paddingRight: 75,
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
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
          New nurses must register and receive
          administrator approval before accessing
          clinical services.
        </p>
      </section>
    </main>
  );
}
