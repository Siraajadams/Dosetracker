"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
export default function PendingApproval(){const [status,setStatus]=useState("Checking your registration...");
 useEffect(()=>{let alive=true;(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!alive)return;
 if(!user){setStatus("Please confirm your email, then sign in.");return;}
 if(!user.email_confirmed_at){setStatus("Please confirm your email address.");return;}
 const {data,error}=await supabase.from("staff_profiles").select("approval_status,is_active").eq("id",user.id).maybeSingle();
 if(!alive)return;setStatus(error?`Unable to check approval: ${error.message}`:data?.approval_status==="approved"&&data.is_active?"Your account is approved. You can return to login.":`Account status: ${data?.approval_status||"pending"}. Clinical access is not yet enabled.`);
 })();return()=>{alive=false}},[]);
 return <main style={{padding:32,fontFamily:"Arial"}}><h1>DoseTrack staff approval</h1><p>{status}</p><Link href="/login">Back to login</Link></main>}
