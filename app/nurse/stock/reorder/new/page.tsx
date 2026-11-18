
import { Suspense } from "react";
import NewMedicationOrderClient from "./NewMedicationOrderClient";

export default function Page() {
  return (
    <Suspense fallback={<p>Loading medication order...</p>}>
      <NewMedicationOrderClient />
    </Suspense>
  );
}
