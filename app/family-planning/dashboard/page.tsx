"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Membership = { facility_id: string; role: string; active: boolean };
type StaffProfile = { approval_status: string | null; is_active: boolean | null };
type Module = { title: string; description: string; href: string; icon: string; category: string; accent: string };

const adminModules: Module[] = [
  { title: "Patient Management", description: "Review patient records and treatment history across facilities.", href: "/family-planning/patients", icon: "👥", category: "Clinical oversight", accent: "#D9F3EC" },
  { title: "Contraceptive Analytics", description: "Monitor administrations, top medications and adverse events.", href: "/family-planning/medications/usage", icon: "💉", category: "Clinical oversight", accent: "#E8E6FF" },
  { title: "Follow-up Appointments", description: "Track appointment calendars, attendance and adherence.", href: "/family-planning/appointments", icon: "📅", category: "Clinical oversight", accent: "#E5F1FF" },
  { title: "Inventory Management", description: "View stock on hand, consumption and reorders by site.", href: "/family-planning/inventory", icon: "📦", category: "Operations", accent: "#FFF0D8" },
  { title: "Clinical Reports", description: "Access monthly facility, medication and stock reports.", href: "/family-planning/reports", icon: "📊", category: "Operations", accent: "#E7EFF7" },
  { title: "Nurse Administration", description: "Review nurse registrations, approvals and clinic assignments.", href: "/admin/nurses", icon: "👩‍⚕️", category: "Administration", accent: "#FBE5EC" },
  { title: "Manage Clinics", description: "Maintain facility profiles, MHFL, CFS and Demander numbers.", href: "/admin/clinics", icon: "🏥", category: "Administration", accent: "#DDF3F0" },
  { title: "Medication Management", description: "Maintain the contraceptive medication master catalogue.", href: "/admin/medications", icon: "💊", category: "Administration", accent: "#F1E7FF" },
];
const nurseModules: Module[] = [
  { title: "Patient Registration", description: "Register patients and maintain clinical profiles.", href: "/nurse/patients/new", icon: "👤", category: "Clinical workspace", accent: "#D9F3EC" },
  { title: "Contraceptive Administration", description: "Find patients and record contraceptive administrations.", href: "/nurse/patients", icon: "💉", category: "Clinical workspace", accent: "#E8E6FF" },
];

export default function FamilyPlanningDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error || !data.user) { router.replace("/family-planning/login"); return; }
        setUserEmail(data.user.email ?? "");
        const adminResult = await supabase.rpc("dt_is_super_admin");
        if (cancelled) return;
        if (adminResult.error) { setMessage("Unable to verify administrator permissions."); return; }
        if (adminResult.data === true) { setIsSuperAdmin(true); return; }
        const profileResult = await supabase.from("staff_profiles").select("approval_status, is_active").eq("id", data.user.id).maybeSingle();
        if (cancelled) return;
        if (profileResult.error) { setMessage("Unable to verify your staff profile."); return; }
        const profile = profileResult.data as StaffProfile | null;
        if (!profile || profile.approval_status !== "approved" || profile.is_active !== true) {
          setMessage("Your account is awaiting administrator approval and activation."); return;
        }
        const membershipResult = await supabase.from("fp_memberships").select("facility_id, role, active").eq("user_id", data.user.id).eq("active", true);
        if (cancelled) return;
        if (membershipResult.error) { setMessage("Unable to verify Family Planning clinic permissions."); return; }
        const approved = ((membershipResult.data ?? []) as Membership[]).find(m => ["administrator", "nurse", "doctor"].includes(m.role));
        if (approved) setMembership(approved);
        else setMessage("Your account is approved but no active clinic has been assigned. Contact the administrator.");
      } catch {
        if (!cancelled) setMessage("Unable to verify your account permissions. Please try again.");
      } finally { if (!cancelled) setChecking(false); }
    }
    void checkAccess();
    return () => { cancelled = true; };
  }, [router]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { setMessage(error.message); return; }
    router.replace("/family-planning/login");
  }

  const hasAccess = isSuperAdmin || !!membership;
  const visibleModules = isSuperAdmin ? adminModules : nurseModules;
  const sections = isSuperAdmin ? ["Clinical oversight", "Operations", "Administration"] : ["Clinical workspace"];
  const sidebarLinks = [{ label: "Dashboard overview", href: "/family-planning/dashboard", icon: "▦" }, ...visibleModules.map(m => ({ label: m.title, href: m.href, icon: m.icon }))];

  if (checking) return <main className="dt-loading">Checking Family Planning permissions…<style>{styles}</style></main>;

  return (
    <div className="dt-app">
      <style>{styles}</style>
      <aside className={`dt-sidebar ${sidebarOpen ? "dt-sidebar-open" : ""}`}>
        <div className="dt-brand"><div className="dt-brand-mark">✳</div><div><strong>DoseTrack</strong><small>FAMILY PLANNING</small></div></div>
        <div className="dt-side-label">WORKSPACE</div>
        <nav className="dt-nav" aria-label="Main navigation">
          {sidebarLinks.map((item, index) => (
            <Link key={item.href} href={item.href} className={`dt-nav-link ${index === 0 ? "dt-nav-active" : ""}`} onClick={() => setSidebarOpen(false)}>
              <span className="dt-nav-icon">{item.icon}</span><span>{item.label}</span>{index !== 0 && <span className="dt-nav-arrow">›</span>}
            </Link>
          ))}
        </nav>
        <div className="dt-sidebar-footer"><div className="dt-sidebar-avatar">{userEmail.slice(0, 1).toUpperCase() || "U"}</div><div className="dt-sidebar-user"><strong>{isSuperAdmin ? "Super Administrator" : "Clinical Staff"}</strong><small title={userEmail}>{userEmail || "Signed in"}</small></div></div>
      </aside>
      {sidebarOpen && <button className="dt-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <main className="dt-main">
        <header className="dt-topbar"><div className="dt-top-left"><button className="dt-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>☰</button><span>Family Planning</span><span className="dt-crumb">/</span><strong>Dashboard</strong></div><div className="dt-top-actions"><span className="dt-role-pill">● {isSuperAdmin ? "Super Admin" : "Clinical Access"}</span><button onClick={() => void signOut()} className="dt-signout">Sign out ↗</button></div></header>
        <div className="dt-content">
          {!hasAccess ? <div className="dt-denied"><span>🔒</span><h2>Clinical access not yet enabled</h2><p>{message}</p><Link href="/pending-approval" className="dt-primary-link">View account status →</Link></div> : <>
            <div className="dt-eyebrow">DOSETRACK / FAMILY PLANNING</div>
            <section className="dt-hero"><div className="dt-hero-copy"><span className="dt-hero-chip">✦ {isSuperAdmin ? "ADMINISTRATION CONSOLE" : "CLINICAL WORKSPACE"}</span><h1>{isSuperAdmin ? "Your network, at a glance." : "Welcome to your clinical workspace."}</h1><p>{isSuperAdmin ? "Manage facilities, clinical programmes, staff and medication operations from one connected platform." : "Access patient registration and contraceptive administration for your assigned facility."}</p><div className="dt-hero-meta"><span>✓ {isSuperAdmin ? "Super Administrator" : membership?.role}</span><span>•</span><span>{isSuperAdmin ? "Network-wide access" : `Facility ${membership?.facility_id}`}</span></div></div><div className="dt-hero-art" aria-hidden="true"><div className="dt-orbit dt-orbit-one"/><div className="dt-orbit dt-orbit-two"/><div className="dt-art-core">✳</div></div></section>
            <section className="dt-overview"><div className="dt-stat"><span className="dt-stat-icon">◫</span><span className="dt-stat-label">Workspace</span><strong>{isSuperAdmin ? "Network" : "Clinic"}</strong><small>{isSuperAdmin ? "All authorised facilities" : "Assigned facility"}</small></div><div className="dt-stat"><span className="dt-stat-icon">▦</span><span className="dt-stat-label">Available modules</span><strong>{visibleModules.length}</strong><small>Navigation shortcuts</small></div><div className="dt-stat"><span className="dt-stat-icon">✓</span><span className="dt-stat-label">Access status</span><strong>Verified</strong><small>Permissions checked</small></div></section>
            <div className="dt-section-intro"><div><span className="dt-eyebrow">PLATFORM CAPABILITIES</span><h2>{isSuperAdmin ? "Management workspace" : "Clinical modules"}</h2><p>Choose an area to open its dedicated workspace.</p></div><span className="dt-module-count">{visibleModules.length} modules</span></div>
            {sections.map(section => <section key={section} className="dt-module-section"><div className="dt-section-heading"><h3>{section}</h3><div className="dt-section-rule"/></div><div className="dt-module-grid">{visibleModules.filter(m => m.category === section).map(m => <Link key={m.href} href={m.href} className="dt-module-card"><div className="dt-module-top"><div className="dt-module-icon" style={{ background: m.accent }}>{m.icon}</div><span className="dt-module-corner">↗</span></div><h4>{m.title}</h4><p>{m.description}</p><span className="dt-module-cta">Open workspace <span>→</span></span></Link>)}</div></section>)}
            <footer className="dt-footer"><span>DoseTrack © 2026 · Family Planning Management</span><span>Secure clinical administration platform</span></footer>
          </>}
        </div>
      </main>
    </div>
  );
}

const styles = `
.dt-app{--navy:#113a40;--teal:#0e756d;--ink:#172d36;--muted:#647781;--line:#e3eaf0;display:flex;min-height:100vh;background:#f5f8fa;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.dt-app *{box-sizing:border-box}.dt-sidebar{width:266px;flex-shrink:0;background:#10383f;color:#d8eaeb;display:flex;flex-direction:column;min-height:100vh;position:sticky;top:0;height:100vh;z-index:30}.dt-brand{display:flex;align-items:center;gap:12px;padding:31px 24px 34px;border-bottom:1px solid #ffffff18}.dt-brand-mark{height:42px;width:42px;display:grid;place-items:center;background:#1b6c69;color:#fff;font-size:27px;border-radius:13px}.dt-brand strong{font-size:23px;letter-spacing:-.8px;color:white;display:block;line-height:1.1}.dt-brand small{display:block;letter-spacing:2px;font-size:9px;color:#8fbabc;margin-top:7px;font-weight:700}.dt-side-label{font-size:10px;font-weight:800;letter-spacing:1.7px;color:#80a8ad;margin:31px 26px 12px}.dt-nav{padding:0 13px;overflow-y:auto;flex:1}.dt-nav-link{display:flex;gap:12px;align-items:center;padding:12px 13px;border-radius:10px;text-decoration:none;color:#c8dadd;font-size:13px;font-weight:550;margin:3px 0;transition:background .15s}.dt-nav-link:hover{background:#ffffff13;color:white}.dt-nav-active{background:#22656b;color:white;font-weight:700}.dt-nav-icon{width:22px;text-align:center;font-size:17px}.dt-nav-arrow{margin-left:auto;color:#86b4b7;font-size:19px}.dt-sidebar-footer{border-top:1px solid #ffffff20;padding:20px 17px;display:flex;gap:11px;align-items:center}.dt-sidebar-avatar{width:36px;height:36px;border-radius:50%;background:#2d777a;display:grid;place-items:center;font-weight:800;color:white}.dt-sidebar-user{min-width:0}.dt-sidebar-user strong{display:block;font-size:12px;color:#fff}.dt-sidebar-user small{display:block;max-width:168px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#a4c5c7;margin-top:3px}.dt-main{flex:1;min-width:0}.dt-topbar{height:77px;background:white;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:0 37px;gap:15px}.dt-top-left,.dt-top-actions{display:flex;align-items:center;gap:12px;font-size:13px}.dt-top-left{color:#6b7e87}.dt-top-left strong{color:#203b43}.dt-crumb{color:#b6c3c9}.dt-role-pill{color:#0b756b;background:#e9f8f3;padding:8px 12px;border-radius:30px;font-size:11px;font-weight:800}.dt-signout{background:#fff;border:1px solid #dbe4e9;border-radius:9px;padding:9px 13px;font-weight:700;color:#35505a;cursor:pointer}.dt-menu{display:none;border:0;background:transparent;font-size:23px;color:#123b40;cursor:pointer}.dt-content{max-width:1400px;margin:auto;padding:38px 38px 20px}.dt-eyebrow{font-size:10px;letter-spacing:1.9px;color:#6b858b;font-weight:850;margin-bottom:15px}.dt-hero{background:linear-gradient(112deg,#0d444a 0%,#126e70 70%,#22898a 100%);border-radius:21px;min-height:262px;padding:40px 43px;display:flex;position:relative;overflow:hidden;color:#fff;box-shadow:0 12px 30px #0a45451a}.dt-hero-copy{position:relative;z-index:2;max-width:690px}.dt-hero-chip{display:inline-block;background:#ffffff20;border:1px solid #ffffff35;border-radius:30px;padding:8px 12px;font-size:10px;letter-spacing:1.2px;font-weight:800}.dt-hero h1{font-size:clamp(27px,3vw,39px);letter-spacing:-1.3px;line-height:1.14;margin:21px 0 13px;font-weight:800}.dt-hero p{font-size:14px;color:#d2eeeb;line-height:1.75;max-width:610px;margin:0}.dt-hero-meta{display:flex;gap:12px;align-items:center;font-size:11px;color:#d4f0ec;margin-top:23px;font-weight:700}.dt-hero-art{position:absolute;right:5%;top:50%;transform:translateY(-50%);width:240px;height:240px;display:grid;place-items:center;opacity:.65}.dt-orbit{position:absolute;border:1px solid #ffffff48;border-radius:50%}.dt-orbit-one{width:210px;height:210px}.dt-orbit-two{width:160px;height:160px}.dt-art-core{font-size:86px;color:#b2e8dd;opacity:.65}.dt-overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px;margin-top:21px}.dt-stat{background:#fff;border:1px solid var(--line);border-radius:15px;padding:21px 23px;display:flex;flex-direction:column;min-height:149px;box-shadow:0 3px 14px #1b435006}.dt-stat-icon{color:#0c8579;font-size:22px;line-height:1}.dt-stat-label{font-size:11px;color:#758791;margin-top:13px}.dt-stat strong{font-size:23px;letter-spacing:-.5px;margin-top:3px}.dt-stat small{font-size:10px;color:#83949b;margin-top:5px}.dt-section-intro{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-top:45px;margin-bottom:25px}.dt-section-intro h2{font-size:27px;letter-spacing:-.8px;margin:0 0 7px}.dt-section-intro p{font-size:13px;color:var(--muted);margin:0}.dt-module-count{font-size:11px;color:#56747c;background:#eaf0f2;border-radius:30px;padding:8px 13px;font-weight:800}.dt-module-section{margin-bottom:32px}.dt-section-heading{display:flex;align-items:center;gap:16px;margin-bottom:15px}.dt-section-heading h3{white-space:nowrap;font-size:12px;letter-spacing:.4px;color:#49626c;margin:0}.dt-section-rule{height:1px;background:#dfe7ec;flex:1}.dt-module-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}.dt-module-card{background:#fff;border:1px solid var(--line);border-radius:17px;padding:23px;text-decoration:none;color:inherit;display:flex;flex-direction:column;min-height:229px;transition:transform .16s,border-color .16s,box-shadow .16s;box-shadow:0 3px 12px #1b435005}.dt-module-card:hover{transform:translateY(-3px);border-color:#9dc9c5;box-shadow:0 13px 28px #174c5016}.dt-module-top{display:flex;justify-content:space-between;align-items:flex-start}.dt-module-icon{width:49px;height:49px;border-radius:13px;display:grid;place-items:center;font-size:25px}.dt-module-corner{color:#7e9da2;font-size:19px}.dt-module-card h4{font-size:16px;letter-spacing:-.25px;margin:19px 0 8px}.dt-module-card p{font-size:12px;color:#6c8088;line-height:1.65;margin:0 0 18px;flex:1}.dt-module-cta{border-top:1px solid #edf1f4;padding-top:14px;font-size:12px;font-weight:800;color:#08766e;display:flex;justify-content:space-between}.dt-footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #dfe7eb;padding:20px 0;margin-top:30px;color:#91a1a9;font-size:10px}.dt-denied{background:white;border:1px solid #e0e8ed;border-radius:18px;max-width:580px;padding:36px;margin:35px auto}.dt-denied>span{font-size:32px}.dt-denied h2{font-size:24px}.dt-denied p{color:#647781;line-height:1.6}.dt-primary-link{display:inline-block;background:#0e756d;color:white;padding:12px 18px;border-radius:9px;text-decoration:none;font-weight:700}.dt-loading{padding:45px;font-family:system-ui;color:#17464b}.dt-backdrop{display:none}@media(max-width:1150px){.dt-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dt-hero-art{right:-45px;opacity:.3}}@media(max-width:800px){.dt-sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .2s}.dt-sidebar-open{transform:translateX(0)}.dt-backdrop{display:block;position:fixed;inset:0;background:#0b263a70;z-index:20;border:0}.dt-menu{display:block}.dt-topbar{padding:0 20px}.dt-content{padding:24px 18px}.dt-hero{padding:30px 25px;min-height:245px}.dt-hero-art{display:none}.dt-overview{gap:10px}.dt-stat{padding:15px}.dt-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.dt-top-left{gap:6px}.dt-role-pill{display:none}.dt-overview{grid-template-columns:1fr}.dt-stat{min-height:100px}.dt-module-grid{grid-template-columns:1fr}.dt-hero h1{font-size:28px}.dt-hero-meta{flex-wrap:wrap}.dt-section-intro h2{font-size:24px}.dt-footer{flex-direction:column}}
`;
