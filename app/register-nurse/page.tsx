"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
export default function RegisterNurse() {
 const [fullName,setFullName]=useState(""); const [email,setEmail]=useState("");
 const [password,setPassword]=useState(""); const [mobile,setMobile]=useState("");
 const [sanc,setSanc]=useState(""); const [category,setCategory]=useState("registered_nurse");
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setMessage("");setBusy(true);
  const {error}=await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{emailRedirectTo:`${window.location.origin}/pending-approval`,data:{full_name:fullName.trim(),sanc_number:sanc.trim(),mobile_number:mobile.trim(),professional_category:category}}});
  setBusy(false);setMessage(error?error.message:"Registration submitted. Check your email to confirm your address. Your account remains pending Super Admin approval.");
 }
 const input:React.CSSProperties={padding:12,border:"1px solid #cbd5e1",borderRadius:8,width:"100%"};
 return <main style={{minHeight:"100vh",padding:24,background:"#eef7ff",fontFamily:"Arial"}}><section style={{maxWidth:520,margin:"auto",padding:24,background:"white",borderRadius:16}}>
 <h1>Nurse registration</h1><p>Email verification and Super Admin approval are required before clinical access.</p>
 <form onSubmit={submit} style={{display:"grid",gap:12}}>
 <input required style={input} placeholder="Full name" value={fullName} onChange={e=>setFullName(e.target.value)}/>
 <input required style={input} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
 <input required style={input} type="tel" placeholder="Mobile" value={mobile} onChange={e=>setMobile(e.target.value)}/>
 <input required style={input} placeholder="SANC registration number" value={sanc} onChange={e=>setSanc(e.target.value)}/>
 <select style={input} value={category} onChange={e=>setCategory(e.target.value)}><option value="registered_nurse">Registered nurse</option><option value="enrolled_nurse">Enrolled nurse</option><option value="enrolled_nursing_auxiliary">Enrolled nursing auxiliary</option></select>
 <input required style={input} type="password" minLength={12} placeholder="Password (12+ characters)" value={password} onChange={e=>setPassword(e.target.value)}/>
 <button disabled={busy} style={{...input,background:"#0f766e",color:"white"}}>{busy?"Submitting...":"Register"}</button>
 </form><p role="status">{message}</p><Link href="/login">Return to login</Link></section></main>;
}
