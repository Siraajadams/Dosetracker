"use client";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabaseClient";
type Staff={id:string;full_name:string;email:string;sanc_number:string|null;professional_category:string|null;approval_status:string;is_active:boolean};
export default function StaffApprovals(){const [staff,setStaff]=useState<Staff[]>([]);const [authorized,setAuthorized]=useState(false);const [message,setMessage]=useState("Checking permissions...");const [busy,setBusy]=useState("");
 async function load(){const {data:admin,error:adminError}=await supabase.rpc("dt_is_super_admin");if(adminError||!admin){setAuthorized(false);setMessage("Super Admin access required.");return;}
 setAuthorized(true);const {data,error}=await supabase.from("staff_profiles").select("id,full_name,email,sanc_number,professional_category,approval_status,is_active").order("created_at",{ascending:false});setMessage(error?error.message:"");setStaff((data||[]) as Staff[]);}
 useEffect(()=>{void load()},[]);
 async function change(p:Staff,approval_status:"approved"|"rejected"|"suspended"){if(!confirm(`Set ${p.full_name} to ${approval_status}? Verify SANC status independently before approval.`))return;
 setBusy(p.id);const {error}=await supabase.from("staff_profiles").update({approval_status,is_active:approval_status==="approved",approved_at:approval_status==="approved"?new Date().toISOString():null}).eq("id",p.id);
 setBusy("");if(error){setMessage(error.message);return;}await load();}
 return <main style={{padding:24,fontFamily:"Arial",background:"#f8fafc",minHeight:"100vh"}}><h1>Staff approvals</h1><p>{message}</p>{authorized&&<div style={{display:"grid",gap:12}}>{staff.map(p=><section key={p.id} style={{padding:18,background:"white",border:"1px solid #ddd",borderRadius:12}}><strong>{p.full_name}</strong><p>{p.email} · SANC: {p.sanc_number||"Not supplied"} · {p.professional_category}</p><p>Status: {p.approval_status}</p><button disabled={busy===p.id} onClick={()=>change(p,"approved")}>Approve</button> <button disabled={busy===p.id} onClick={()=>change(p,"rejected")}>Reject</button> <button disabled={busy===p.id} onClick={()=>change(p,"suspended")}>Suspend</button></section>)}</div>}</main>}
