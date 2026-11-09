
import Link from "next/link";
import type { CSSProperties } from "react";

export default function HomePage() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>

        {/* Platform Branding */}
        <p style={styles.label}>
          Videomed Digital Health Platform
        </p>

        <h1 style={styles.title}>
          DoseTrack Family Planning
        </h1>

        <p style={styles.subtitle}>
          A secure digital family planning platform
          for nurses, clinics and healthcare facilities.
          Manage patient registration, contraceptive
          administrations, clinical records and
          facility-based services.
        </p>

        {/* Secure Access */}
        <div style={styles.secureFeature}>
          <div style={styles.secureIcon}>
            🔒
          </div>

          <div>
            <h2 style={styles.secureTitle}>
              Secure Clinical Access
            </h2>

            <p style={styles.secureText}>
              Patient records, contraceptive
              administrations and clinical information
              are accessible only to authenticated,
              approved healthcare professionals with
              authorised facility access.
            </p>
          </div>
        </div>

        {/* Login and Registration */}
        <div style={styles.buttons}>
          <Link
            href="/family-planning/login"
            style={styles.primary}
          >
            Nurse / Administrator Login
          </Link>

          <Link
            href="/register-nurse"
            style={styles.secondary}
          >
            Register as Nurse
          </Link>
        </div>

        {/* Clinical Workflow */}
        <div style={styles.workflowNotice}>
          <strong>
            After approval, nurses can:
          </strong>

          <ol style={styles.workflowList}>
            <li>
              Access their assigned healthcare facility.
            </li>

            <li>
              Search for existing patients using
              ID or passport numbers.
            </li>

            <li>
              Register new family planning patients.
            </li>

            <li>
              Record contraceptive medication
              administrations.
            </li>

            <li>
              Review patient clinical histories.
            </li>

            <li>
              Maintain facility-based family
              planning records.
            </li>
          </ol>
        </div>

        {/* Administrator Information */}
        <div style={styles.adminNotice}>
          <h3 style={styles.noticeTitle}>
            Super Administrator
          </h3>

          <p style={styles.noticeText}>
            Administrators can verify and approve
            nurse registrations, manage clinic
            master data and assign nurses to
            healthcare facilities.
          </p>

          <p style={styles.noticeText}>
            Administrator access requires an
            authorised Super Admin account.
          </p>
        </div>

        {/* Restricted Access */}
        <div style={styles.notice}>
          <strong>Restricted clinical access:</strong>
          {" "}
          All patient information, medication
          administrations and facility records
          require secure authentication and
          appropriate access permissions.
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <p>
            © {new Date().getFullYear()} DoseTrack
          </p>

          <p>
            Powered by Videomed
          </p>
        </footer>

      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #e0f2fe 0%, #f0fdfa 55%, #ecfeff 100%)",
    padding: "24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },

  card: {
    width: "100%",
    maxWidth: "760px",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "36px",
    boxShadow:
      "0 20px 45px rgba(15, 23, 42, 0.14)",
    boxSizing: "border-box",
  },

  label: {
    color: "#0f766e",
    fontWeight: 700,
    fontSize: "16px",
    margin: 0,
  },

  title: {
    fontSize: "clamp(30px, 5vw, 48px)",
    lineHeight: 1.15,
    color: "#0f172a",
    marginTop: "16px",
    marginBottom: "18px",
  },

  subtitle: {
    color: "#475569",
    fontSize: "19px",
    lineHeight: "30px",
    marginBottom: "26px",
  },

  secureFeature: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
    background: "#f0fdfa",
    border: "2px solid #99f6e4",
    borderRadius: "20px",
    padding: "20px",
  },

  secureIcon: {
    width: "52px",
    height: "52px",
    flexShrink: 0,
    borderRadius: "16px",
    background: "#0f766e",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "26px",
  },

  secureTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "22px",
    lineHeight: "28px",
  },

  secureText: {
    marginTop: "8px",
    marginBottom: 0,
    color: "#475569",
    fontSize: "16px",
    lineHeight: "24px",
  },

  buttons: {
    display: "grid",
    gap: "16px",
    marginTop: "28px",
  },

  primary: {
    background: "#0f766e",
    color: "#ffffff",
    padding: "18px",
    borderRadius: "16px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: "18px",
    textDecoration: "none",
    display: "block",
  },

  secondary: {
    background: "#ffffff",
    color: "#0f766e",
    padding: "18px",
    borderRadius: "16px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: "18px",
    textDecoration: "none",
    border: "2px solid #0f766e",
    display: "block",
  },

  workflowNotice: {
    marginTop: "28px",
    background: "#ecfdf5",
    color: "#065f46",
    padding: "18px",
    borderRadius: "16px",
    fontSize: "15px",
    lineHeight: "24px",
    border: "1px solid #a7f3d0",
  },

  workflowList: {
    marginTop: "12px",
    marginBottom: 0,
    paddingLeft: "22px",
  },

  adminNotice: {
    marginTop: "20px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "16px",
    padding: "18px",
  },

  noticeTitle: {
    margin: 0,
    fontSize: "19px",
    color: "#0f172a",
  },

  noticeText: {
    marginTop: "10px",
    marginBottom: 0,
    color: "#475569",
    fontSize: "15px",
    lineHeight: "23px",
  },

  notice: {
    marginTop: "20px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "18px",
    borderRadius: "16px",
    fontSize: "15px",
    lineHeight: "24px",
  },

  footer: {
    marginTop: "28px",
    paddingTop: "18px",
    borderTop: "1px solid #e2e8f0",
    textAlign: "center",
    fontSize: "13px",
    color: "#64748b",
  },
};
