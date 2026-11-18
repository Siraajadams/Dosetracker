
"use client";

import Link from "next/link";

export default function NewMedicationOrderPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>New Medication Order</h1>
      <p>DoseTrack Family Planning</p>

      <p>
        Medication ordering form will be
        connected to the existing stock system.
      </p>

      <Link href="/nurse/stock/reorder">
        Back to Medication Orders
      </Link>
    </main>
  );
}
