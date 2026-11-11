
import { supabase } from "@/lib/supabaseClient";

export type StockProduct = {
  id: string;
  name: string;
  unit: string;
  icn_number: string | null;
};

export async function getAssignedFacilities(): Promise<string[]> {
  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError || !auth.user) {
    throw new Error("Please log in.");
  }

  const userId = auth.user.id;

  const { data: profile, error: profileError } =
    await supabase
      .from("staff_profiles")
      .select("role,approval_status,is_active")
      .eq("id", userId)
      .maybeSingle();

  if (profileError) throw profileError;

  if (
    !profile ||
    profile.role !== "nurse" ||
    profile.approval_status !== "approved" ||
    profile.is_active !== true
  ) {
    throw new Error("Nurse account is not approved or active.");
  }

  const { data: assignments, error: assignmentError } =
    await supabase
      .from("nurse_site_assignments")
      .select("site_id")
      .eq("nurse_id", userId);

  if (assignmentError) throw assignmentError;

  const ids = [
    ...new Set(
      (assignments || []).map((row) => row.site_id)
    ),
  ];

  if (!ids.length) return [];

  const { data: sites, error: sitesError } =
    await supabase
      .from("sites")
      .select("id")
      .in("id", ids)
      .eq("is_active", true);

  if (sitesError) throw sitesError;

  return (sites || []).map((site) => site.id);
}

export async function getProducts(): Promise<StockProduct[]> {
  const { data, error } = await supabase
    .from("fp_stock_products")
    .select("id,name,unit,icn_number")
    .eq("active", true)
    .order("name");

  if (error) throw error;

  return (data || []) as StockProduct[];
}

export async function getBalances(
  facilityId: string
): Promise<Map<string, number>> {
  const facilities = await getAssignedFacilities();

  if (!facilities.includes(facilityId)) {
    throw new Error("You are not assigned to this pharmacy.");
  }

  const { data, error } = await supabase
    .from("fp_stock_balances")
    .select("product_id,quantity_on_hand")
    .eq("facility_id", facilityId);

  if (error) throw error;

  return new Map<string, number>(
    (data || []).map((row) => [
      row.product_id,
      Number(row.quantity_on_hand),
    ])
  );
}

export async function recordStock(
  facilityId: string,
  productId: string,
  type: "received" | "dispensed" | "wasted",
  quantity: number,
  reason?: string,
  reference?: string
): Promise<string> {
  const facilities = await getAssignedFacilities();

  if (!facilities.includes(facilityId)) {
    throw new Error("Pharmacy access denied.");
  }

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive whole number.");
  }

  const { data, error } = await supabase.rpc(
    "fp_record_stock",
    {
      p_facility_id: facilityId,
      p_product_id: productId,
      p_type: type,
      p_quantity: quantity,
      p_reason: reason || null,
      p_reference: reference || null,
    }
  );

  if (error) throw error;

  return data as string;
}

export async function createDepotOrder(
  facilityId: string,
  month: string,
  items: {
    product_id: string;
    quantity: number;
  }[]
): Promise<string> {
  const facilities = await getAssignedFacilities();

  if (!facilities.includes(facilityId)) {
    throw new Error("Pharmacy access denied.");
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Invalid order month.");
  }

  if (
    !items.length ||
    items.some(
      (item) =>
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0
    )
  ) {
    throw new Error("Enter valid medication quantities.");
  }

  const { data, error } = await supabase.rpc(
    "fp_create_depot_order",
    {
      p_facility_id: facilityId,
      p_order_month: `${month}-01`,
      p_items: items,
      p_depot_name: "Family Planning Depot",
    }
  );

  if (error) throw error;

  return data as string;
}
