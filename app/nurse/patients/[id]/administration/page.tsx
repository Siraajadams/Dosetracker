
import { redirect } from "next/navigation";

export default async function AdministrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(
    `/nurse/patients/${encodeURIComponent(id)}/administration/new`
  );
}
