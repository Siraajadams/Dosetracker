
import { supabase } from "@/lib/supabaseClient";

export type StockProduct = {
  id: string;
  name: string;
  unit: string;
  icn_number: string | null;
  barcode: string | null;
};

export type StockFacility = {
  id: string;
  name: string;
};

export type StockBatch = {
  id: string;
  facility_id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string;
  quantity_on_hand: number;
};

export type StockMovement =
  | "received"
  | "dispensed"
  | "wasted";

function stockError(
  operation: string,
  error: { message: string; code?: string }
): Error {
  return new Error(
    `${operation}: ${error.message}` +
      (error.code ? ` (${error.code})` : "")
  );
}

export async function getAssignedFacilities(): Promise<string[]> {
  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError) {
    throw stockError("Authentication failed", authError);
  }

  if (!auth.user) {
    throw new Error("Please log in.");
  }

  const userId = auth.user.id;

  const { data: profile, error: profileError } =
    await supabase
      .from("staff_profiles")
      .select("role,approval_status,is_active")
      .eq("id", userId)
      .maybeSingle();

  if (profileError) {
    throw stockError(
      "Unable to load nurse profile",
      profileError
    );
  }

  if (!profile) {
    throw new Error(
      "No staff profile was found for this account."
    );
  }

  if (
    profile.role !== "nurse" ||
    profile.approval_status !== "approved" ||
    profile.is_active !== true
  ) {
    throw new Error(
      "Nurse account is not approved or active."
    );
  }

  const { data: assignments, error: assignmentError } =
    await supabase
      .from("nurse_site_assignments")
      .select("site_id")
      .eq("nurse_id", userId);

  if (assignmentError) {
    throw stockError(
      "Unable to load clinic assignments",
      assignmentError
    );
  }

  const ids = [
    ...new Set(
      (assignments || [])
        .map((row) => String(row.site_id || ""))
        .filter(Boolean)
    ),
  ];

  if (!ids.length) return [];

  const { data: sites, error: sitesError } =
    await supabase
      .from("sites")
      .select("id")
      .in("id", ids)
      .eq("is_active", true);

  if (sitesError) {
    throw stockError(
      "Unable to load active clinics",
      sitesError
    );
  }

  return (sites || []).map((site) => String(site.id));
}

export async function getAssignedPharmacies():
  Promise<StockFacility[]> {

  const ids = await getAssignedFacilities();

  if (!ids.length) return [];

  // Corrected: sites uses site_name, not name.
  const { data, error } = await supabase
    .from("sites")
    .select("id,site_name")
    .in("id", ids)
    .eq("is_active", true)
    .order("site_name");

  if (error) {
    throw stockError(
      "Unable to load assigned clinic names",
      error
    );
  }

  return (data || []).map((site) => ({
    id: String(site.id),
    name: String(site.site_name || ""),
  }));
}

export async function getProducts():
  Promise<StockProduct[]> {

  const { data, error } = await supabase
    .from("fp_stock_products")
    .select("id,name,unit,icn_number,barcode")
    .eq("active", true)
    .order("name");

  if (error) {
    throw stockError(
      "Unable to load stock medication catalogue",
      error
    );
  }

  return (data || []).map((p) => ({
    id: String(p.id),
    name: String(p.name || ""),
    unit: String(p.unit || ""),
    icn_number: p.icn_number ?? null,
    barcode: p.barcode ?? null,
  }));
}

export async function findProductByBarcode(
  barcode: string
): Promise<StockProduct | null> {

  const cleaned = barcode.trim();

  if (!cleaned) return null;

  const { data, error } = await supabase
    .from("fp_stock_products")
    .select("id,name,unit,icn_number,barcode")
    .eq("barcode", cleaned)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw stockError(
      "Unable to find medication by barcode",
      error
    );
  }

  return data
    ? {
        id: String(data.id),
        name: String(data.name || ""),
        unit: String(data.unit || ""),
        icn_number: data.icn_number ?? null,
        barcode: data.barcode ?? null,
      }
    : null;
}

export async function getBalances(
  facilityId: string
): Promise<Map<string, number>> {

  const facilities = await getAssignedFacilities();

  if (!facilities.includes(facilityId)) {
    throw new Error(
      "You are not assigned to this clinic."
    );
  }

  const { data, error } = await supabase
    .from("fp_stock_balances")
    .select("product_id,quantity_on_hand")
    .eq("facility_id", facilityId);

  if (error) {
    throw stockError(
      "Unable to load stock balances",
      error
    );
  }

  return new Map<string, number>(
    (data || []).map((row) => [
      String(row.product_id),
      Number(row.quantity_on_hand || 0),
    ])
  );
}

export async function getStockBatches(
  facilityId: string,
  productId: string
): Promise<StockBatch[]> {

  const facilities = await getAssignedFacilities();

  if (!facilities.includes(facilityId)) {
    throw new Error("Clinic access denied.");
  }

  const { data, error } = await supabase
    .from("fp_stock_batches")
    .select(
      "id,facility_id,product_id,batch_number," +
      "expiry_date,quantity_on_hand"
    )
    .eq("facility_id", facilityId)
    .eq("product_id", productId)
    .gt("quantity_on_hand", 0)
    .order("expiry_date", {
      ascending: true,
    });

  if (error) {
    throw stockError(
      "Unable to load medication batches",
      error
    );
  }

  return (data || []).map((row) => ({
    id: String(row.id),
    facility_id: String(row.facility_id),
    product_id: String(row.product_id),
    batch_number: String(row.batch_number),
    expiry_date: String(row.expiry_date),
    quantity_on_hand: Number(row.quantity_on_hand),
  }));
}

export
