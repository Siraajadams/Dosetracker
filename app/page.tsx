
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const requestHeaders = await headers();

  const hostname = (
    requestHeaders.get("host") || ""
  )
    .split(":")[0]
    .toLowerCase();

  // Family Planning website
  if (hostname === "fp.dose-tracker.com") {
    redirect("/family-planning/login");
  }

  // Main DoseTrack GLP-1 website
  redirect("/dosetrack");
}
