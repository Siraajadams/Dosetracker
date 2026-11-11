
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
    throw new Error(
      "Nurse account is not approved or active."
    );
  }

  const { data: assignments, error: assignmentError } =
    await supabase
      .from("nurse_site_assignments")
      .select("site_id")
      .eq("nurse_id", userId);

  if (assignmentError) throw assignmentError;

  const ids = [
    ...new Set(
      (assignments || [])
        .map((row) => row.site_id)
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

  if (sitesError) throw sitesError;

  return (sites || []).map((site) => site.id);
}

export async function getAssignedPharmacies():
  Promise<StockFacility[]> {

  const ids = await getAssignedFacilities();

  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("sites")
    .select("id,name")
    .in("id", ids)
    .order("name");

  if (error) throw error;

  return (data || []).map((site) => ({
    id: String(site.id),
    name: String(site.name),
  }));
}

export async function getProducts():
  Promise<StockProduct[]> {

  const { data, error } = await supabase
    .from("fp_stock_products")
    .select("id,name,unit,icn_number,barcode")
    .eq("active", true)
    .order("name");

  if (error) throw error;

  return (data || []).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    unit: String(p.unit),
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

  if (error) throw error;

  return data
    ? {
        id: String(data.id),
        name: String(data.name),
        unit: String(data.unit),
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
      "You are not assigned to this pharmacy."
    );
  }

  const { data, error } = await supabase
    .from("fp_stock_balances")
    .select("product_id,quantity_on_hand")
    .eq("facility_id", facilityId);

  if (error) throw error;

  return new Map<string, number>(
    (data || []).map((row) => [
      String(row.product_id),
      Number(row.quantity_on_hand),
    ])
  );
}

export async function getStockBatches(
  facilityId: string,
  productId: string
): Promise<StockBatch[]> {

  const facilities = await getAssignedFacilities();

  if (!facilities.includes(facilityId)) {
    throw new Error("Pharmacy access denied.");
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

  if (error) throw error;

  const rows: unknown = data;

  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    id: String(row.id),
    facility_id: String(row.facility_id),
    product_id: String(row.product_id),
    batch_number: String(row.batch_number),
    expiry_date: String(row.expiry_date),
    quantity_on_hand: Number(row.quantity_on_hand),
  }));
}

export async function recordStockBatch(
  facilityId: string,
  productId: string,
  type: StockMovement,
  quantity: number,
  options: {
    batchId?: string;
    batchNumber?: string;
    expiryDate?: string;
    reason?: string;
    reference?: string;
  } = {}
): Promise<string> {

  const facilities = await getAssignedFacilities();

  if (!facilities.includes(facilityId)) {
    throw new Error("Pharmacy access denied.");
  }

  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Quantity must be a positive whole number."
    );
  }

  if (type === "received") {
    if (
      !options.batchNumber?.trim() ||
      !options.expiryDate
    ) {
      throw new Error(
        "Batch number and expiry date are required."
      );
    }
  } else if (!options.batchId) {
    throw new Error("Select a stock batch.");
  }

  if (
    type === "wasted" &&
    !options.reason?.trim()
  ) {
    throw new Error("Wastage reason is required.");
  }

  const { data, error } = await supabase.rpc(
    "fp_record_stock_batch",
    {
      p_facility_id: facilityId,
      p_product_id: productId,
      p_type: type,
      p_quantity: quantity,
      p_batch_id:
        type === "received"
          ? null
          : options.batchId ?? null,
      p_batch_number:
        type === "received"
          ? options.batchNumber?.trim()
          : null,
      p_expiry_date:
        type === "received"
          ? options.expiryDate
          : null,
      p_reason: options.reason?.trim() || null,
      p_reference: options.reference?.trim() || null,
    }
  );

  if (error) throw error;

  return String(data);
}

// Retained for compatibility with existing pages.
// This is the original non-batch stock transaction.
export async function recordStock(
  facilityId: string,
  productId: string,
  type: StockMovement,
  quantity: number,
  reason?: string,
  reference?: string
): Promise<string> {

  const facilities = await getAssignedFacilities();

  if (!facilities.includes(facilityId)) {
    throw new Error("Pharmacy access denied.");
  }

  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Quantity must be a positive whole number."
    );
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

  return String(data);
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

  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
  ) {
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
    throw new Error(
      "Enter valid medication quantities."
    );
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

  return String(data);
}
