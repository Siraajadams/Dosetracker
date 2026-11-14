
"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";
import { supabase } from "@/lib/supabaseClient";

const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const professions = [
  {
    value: "registered_nurse",
    label: "Registered Nurse",
    council: "SANC",
  },
  {
    value: "enrolled_nurse",
    label: "Enrolled Nurse",
    council: "SANC",
  },
  {
    value: "enrolled_nursing_auxiliary",
    label: "Enrolled Nursing Auxiliary",
    council: "SANC",
  },
  {
    value: "medical_doctor",
    label: "Medical Doctor",
    council: "HPCSA",
  },
  {
    value: "pharmacist",
    label: "Pharmacist",
    council: "SAPC",
  },
] as const;

const input: CSSProperties = {
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  width: "100%",
  boxSizing: "border-box",
  fontSize: 15,
  background: "#ffffff",
  color: "#172d36",
};

const heading: CSSProperties = {
  marginTop: 20,
  marginBottom: 4,
  color: "#172d36",
};

const visibilityButton: CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "#e2e8f0",
  color: "#334155",
  padding: "8px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
};

const siteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function RegisterHealthcareProvider() {
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  const [registrationNumber, setRegistrationNumber] =
    useState("");

  const [category, setCategory] =
    useState("registered_nurse");

  const [healthcareSite, setHealthcareSite] =
    useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [captchaToken, setCaptchaToken] =
    useState("");

  const [captchaError, setCaptchaError] =
    useState("");

  const captchaRef =
    useRef<TurnstileInstance | null>(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const selectedProfession = professions.find(
    (p) => p.value === category
  );

  const council =
    selectedProfession?.council ?? "SANC";

  function resetCaptcha() {
    setCaptchaToken("");
    captchaRef.current?.reset();
  }

  async function submit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (busy || success) return;

    setMessage("");
    setSuccess(false);

    const cleanedFirstName = firstName.trim();
    const cleanedSurname = surname.trim();
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedMobile = mobile.trim();
    const cleanedRegistration =
      registrationNumber.trim();
    const cleanedSite = healthcareSite.trim();
    const cleanedAddress = address.trim();

    if (!cleanedFirstName || !cleanedSurname) {
      setMessage("Please enter your full name.");
      return;
    }

    if (!cleanedEmail) {
      setMessage("Please enter your email address.");
      return;
    }

    if (!cleanedMobile) {
      setMessage("Please enter your mobile number.");
      return;
    }

    if (!cleanedRegistration) {
      setMessage(
        "Please enter your healthcare provider registration number."
      );
      return;
    }

    if (!cleanedSite) {
      setMessage(
        "Please enter your healthcare site name."
      );
      return;
    }

    if (!cleanedAddress) {
      setMessage(
        "Please enter your healthcare site address."
      );
      return;
    }

    if (!province) {
      setMessage("Please select a province.");
      return;
    }

    if (password.length < 12) {
      setMessage(
        "Password must contain at least 12 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    // CAPTCHA must be configured before signup.
    if (!siteKey) {
      setMessage(
        "Registration security is not configured. " +
          "Please contact the administrator."
      );
      return;
    }

    if (!captchaToken) {
      setMessage(
        "Please complete the security verification " +
          "before registering."
      );
      return;
    }

    setBusy(true);

    try {
      const fullName =
        `${cleanedFirstName} ${cleanedSurname}`;

      const { error } = await supabase.auth.signUp({
        email: cleanedEmail,
        password,
        options: {
          // Supabase verifies this token when
          // CAPTCHA protection is enabled.
          captchaToken,

          emailRedirectTo:
            `${window.location.origin}/pending-approval`,

          data: {
            full_name: fullName,
            first_name: cleanedFirstName,
            surname: cleanedSurname,
            mobile_number: cleanedMobile,

            // Existing field retained for
            // compatibility with Supabase triggers.
            sanc_number: cleanedRegistration,

            healthcare_registration_number:
              cleanedRegistration,

            registration_council: council,

            professional_category: category,

            // Existing pharmacy metadata retained
            // for backwards compatibility.
            requested_pharmacy_name: cleanedSite,

            requested_pharmacy_address:
              cleanedAddress,

            // Healthcare site metadata.
            requested_healthcare_site_name:
              cleanedSite,

            requested_healthcare_site_address:
              cleanedAddress,

            requested_province: province,
          },
        },
      });

      if (error) {
        setMessage(error.message);
        resetCaptcha();
        return;
      }

      setSuccess(true);

      setMessage(
        "Healthcare registration submitted. " +
          "Please check your email for verification. " +
          `${council} registration verification and ` +
          "Super Admin approval are required before " +
          "clinical access is enabled."
      );

      setPassword("");
      setConfirmPassword("");
      setCaptchaToken("");
    } catch (err: unknown) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again."
      );

      resetCaptcha();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 16px",
        background: "#eef7ff",
        fontFamily: "Arial, sans-serif",
        color: "#172d36",
      }}
    >
      <section
        style={{
          maxWidth: 600,
          margin: "auto",
          padding: 28,
          background: "white",
          borderRadius: 16,
          boxShadow:
            "0 8px 28px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            color: "#0f766e",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          DOSETRACK | FAMILY PLANNING
        </div>

        <h1
          style={{
            fontSize: 30,
            lineHeight: 1.2,
            marginBottom: 14,
          }}
        >
          Family Planning — Healthcare Registration
        </h1>

        <p
          style={{
            color: "#64748b",
            lineHeight: 1.7,
            marginBottom: 24,
          }}
        >
          Email verification, SANC/HPCSA/SAPC
          professional registration verification
          and Super Admin approval are required.
        </p>

        <form
          onSubmit={submit}
          style={{
            display: "grid",
            gap: 13,
          }}
        >
          <h3 style={heading}>
            Personal details
          </h3>

          <input
            required
            style={input}
            placeholder="First name"
            autoComplete="given-name"
            maxLength={100}
            value={firstName}
            onChange={(e) =>
              setFirstName(e.target.value)
            }
          />

          <input
            required
            style={input}
            placeholder="Surname"
            autoComplete="family-name"
            maxLength={100}
            value={surname}
            onChange={(e) =>
              setSurname(e.target.value)
            }
          />

          <input
            required
            style={input}
            type="email"
            placeholder="Email address"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            required
            style={input}
            type="tel"
            placeholder="Mobile number"
            autoComplete="tel"
            maxLength={30}
            value={mobile}
            onChange={(e) =>
              setMobile(e.target.value)
            }
          />

          <h3 style={heading}>
            Professional registration
          </h3>

          <label
            htmlFor="professional-category"
            style={{ fontWeight: 600 }}
          >
            Healthcare professional category
          </label>

          <select
            id="professional-category"
            required
            style={input}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setRegistrationNumber("");
            }}
          >
            {professions.map((profession) => (
              <option
                key={profession.value}
                value={profession.value}
              >
                {profession.label}
              </option>
            ))}
          </select>

          <label
            htmlFor="registration-number"
            style={{ fontWeight: 600 }}
          >
            Healthcare provider registration number
          </label>

          <input
            id="registration-number"
            required
            style={input}
            maxLength={60}
            placeholder={`${council} registration number`}
            value={registrationNumber}
            onChange={(e) =>
              setRegistrationNumber(e.target.value)
            }
          />

          <div
            style={{
              padding: 13,
              background: "#eaf7f4",
              borderRadius: 8,
              fontSize: 13,
              color: "#0f766e",
              lineHeight: 1.6,
            }}
          >
            <strong>
              Professional registration authority:{" "}
              {council}
            </strong>

            <div>
              Your professional registration
              details must be verified by the
              Super Administrator before
              clinical access is granted.
            </div>
          </div>

          <h3 style={heading}>
            Healthcare site details
          </h3>

          <input
            required
            style={input}
            maxLength={200}
            placeholder="Name of healthcare site"
            value={healthcareSite}
            onChange={(e) =>
              setHealthcareSite(e.target.value)
            }
          />

          <textarea
            required
            style={{
              ...input,
              resize: "vertical",
            }}
            rows={3}
            maxLength={500}
            placeholder={
              "Healthcare site street address, " +
              "suburb, city and postal code"
            }
            value={address}
            onChange={(e) =>
              setAddress(e.target.value)
            }
          />

          <select
            required
            style={input}
            value={province}
            onChange={(e) =>
              setProvince(e.target.value)
            }
          >
            <option value="">
              Select province
            </option>

            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <h3 style={heading}>
            Account security
          </h3>

          <label
            htmlFor="password"
            style={{ fontWeight: 600 }}
          >
            Password
          </label>

          <div style={{ position: "relative" }}>
            <input
              id="password"
              required
              style={{
                ...input,
                paddingRight: 90,
              }}
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              minLength={12}
              placeholder="Password (12+ characters)"
              autoComplete="new-password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
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
              style={visibilityButton}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label
            htmlFor="confirm-password"
            style={{ fontWeight: 600 }}
          >
            Confirm password
          </label>

          <div style={{ position: "relative" }}>
            <input
              id="confirm-password"
              required
              style={{
                ...input,
                paddingRight: 90,
              }}
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              minLength={12}
              placeholder="Confirm password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
            />

            <button
              type="button"
              onClick={() =>
                setShowConfirmPassword(
                  !showConfirmPassword
                )
              }
              aria-label={
                showConfirmPassword
                  ? "Hide confirmation password"
                  : "Show confirmation password"
              }
              style={visibilityButton}
            >
              {showConfirmPassword
                ? "Hide"
                : "Show"}
            </button>
          </div>

          <p
            style={{
              fontSize: 12,
              color: "#64748b",
              margin: "2px 0 8px",
            }}
          >
            Password must contain at least
            12 characters.
          </p>

          <h3 style={heading}>
            Security verification
          </h3>

          <div
            style={{
              border: "1px solid #dbe4ee",
              borderRadius: 10,
              padding: 16,
              background: "#f8fafc",
              overflowX: "auto",
            }}
          >
            <p
              style={{
                marginTop: 0,
                fontSize: 13,
                color: "#475569",
              }}
            >
              Complete the security check
              before submitting your application.
            </p>

            {siteKey ? (
              <Turnstile
                ref={captchaRef}
                siteKey={siteKey}
                options={{
                  theme: "light",
                  size: "normal",
                }}
                onSuccess={(token) => {
                  setCaptchaToken(token);
                  setCaptchaError("");
                }}
                onExpire={() => {
                  setCaptchaToken("");
                  setCaptchaError(
                    "Security verification expired. " +
                      "Please complete it again."
                  );
                }}
                onError={() => {
                  setCaptchaToken("");
                  setCaptchaError(
                    "Security verification failed. " +
                      "Please retry."
                  );
                }}
              />
            ) : (
              <p
                style={{
                  color: "#b91c1c",
                  fontWeight: 600,
                }}
              >
                Security verification is not
                configured. Registration is
                temporarily unavailable.
              </p>
            )}

            {captchaToken && (
              <p
                style={{
                  color: "#047857",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Security verification completed.
              </p>
            )}

            {captchaError && (
              <p
                role="alert"
                style={{
                  color: "#b91c1c",
                  fontSize: 12,
                }}
              >
                {captchaError}
              </p>
            )}
          </div>

          <button
            disabled={
              busy ||
              success ||
              !siteKey ||
              !captchaToken
            }
            type="submit"
            style={{
              ...input,
              background:
                busy ||
                success ||
                !siteKey ||
                !captchaToken
                  ? "#94a3b8"
                  : "#0f766e",
              color: "white",
              cursor:
                busy ||
                success ||
                !siteKey ||
                !captchaToken
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 700,
              fontSize: 16,
              padding: 15,
            }}
          >
            {busy
              ? "Submitting registration..."
              : success
              ? "Registration submitted"
              : "Register Healthcare Provider"}
          </button>
        </form>

        {message && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: 20,
              padding: 15,
              borderRadius: 8,
              background: success
                ? "#eaf7f4"
                : "#fff1f2",
              color: success
                ? "#0f766e"
                : "#be123c",
              lineHeight: 1.6,
            }}
          >
            {message}
          </div>
        )}

        <div style={{ marginTop: 25 }}>
          <Link
            href="/family-planning/login"
            style={{
              color: "#0f766e",
              fontWeight: 600,
            }}
          >
            Return to Family Planning login
          </Link>
        </div>
      </section>
    </main>
  );
}
