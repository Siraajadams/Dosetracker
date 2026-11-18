
import { supabase } from "@/lib/supabaseClient";

// =====================================================
// DOSETRACK FAMILY PLANNING
// STOCK MANAGEMENT LIBRARY
// =====================================================

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

export type DepotOrderItem = {
  product_id: string;
  quantity: number;
};

// =====================================================
// ERROR HANDLING
// =====================================================

function stockError(
  operation: string,
  error: { message: string; code?: string }
): Error {
  return new Error(
    `${operation}: ${error.message}` +
      (error.code ? ` (${error.code})` : "")
  );
}

// =====================================================
// AUTHENTICATION AND ASSIGNED CLINICS
// =====================================================

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

  if (!ids.length) {
    return [];
  }

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

// =====================================================
// GET ASSIGNED CLINIC NAMES
// =====================================================

export async function getAssignedPharmacies():
  Promise<StockFacility[]> {

  const ids = await getAssignedFacilities();

  if (!ids.length) {
    return [];
  }

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

// =====================================================
// MEDICATION CATALOGUE
// =====================================================

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

  return (data || []).map((product) => ({
    id: String(product.id),
    name: String(product.name || ""),
    unit: String(product.unit || ""),
    icn_number: product.icn_number ?? null,
    barcode: product.barcode ?? null,
  }));
}

// =====================================================
// BARCODE LOOKUP
// =====================================================

export async function findProductByBarcode(
  barcode: string
): Promise<StockProduct | null> {

  const cleaned = barcode.trim();

  if (!cleaned) {
    return null;
  }

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

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    name: String(data.name || ""),
    unit: String(data.unit || ""),
    icn_number: data.icn_number ?? null,
    barcode: data.barcode ?? null,
  };
}

// =====================================================
// STOCK BALANCES
// =====================================================

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

// =====================================================
// STOCK BATCHES
// FIXED GENERICSTRINGERROR TYPESCRIPT ERROR
// =====================================================

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
      "id,facility_id,product_id,batch_number,expiry_date,quantity_on_hand"
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

  // Treat the response as unknown before validating it.
  // This avoids accessing properties on GenericStringError.

  const rows: unknown = data;

  if (!Array.isArray(rows)) {
    throw new Error(
      "Unexpected stock batch response from Supabase."
    );
  }

  return rows.map((value: unknown): StockBatch => {
    if (
      typeof value !== "object" ||
      value === null ||
      !("id" in value) ||
      !("facility_id" in value) ||
      !("product_id" in value) ||
      !("batch_number" in value) ||
      !("expiry_date" in value) ||
      !("quantity_on_hand" in value)
    ) {
      throw new Error(
        "Invalid stock batch record returned by Supabase."
      );
    }

    return {
      id: String(value.id),
      facility_id: String(value.facility_id),
      product_id: String(value.product_id),
      batch_number: String(value.batch_number),
      expiry_date: String(value.expiry_date),
      quantity_on_hand: Number(value.quantity_on_hand),
    };
  });
}

// =====================================================
// RECORD STOCK BY BATCH
// =====================================================

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
    throw new Error("Clinic access denied.");
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
      p_reason:
        options.reason?.trim() || null,
      p_reference:
        options.reference?.trim() || null,
    }
  );

  if (error) {
    throw stockError(
      "Unable to record stock batch",
      error
    );
  }

  return String(data);
}

// =====================================================
// LEGACY STOCK TRANSACTION
// =====================================================

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
    throw new Error("Clinic access denied.");
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
      p_reason: reason?.trim() || null,
      p_reference: reference?.trim() || null,
    }
  );

  if (error) {
    throw stockError(
      "Unable to record stock",
      error
    );
  }

  return String(data);
}

// =====================================================
// CREATE DEPOT MEDICATION ORDER
// =====================================================

export async function createDepotOrder(
  facilityId: string,
  month: string,
  items: DepotOrderItem[]
): Promise<string> {

  const facilities = await getAssignedFacilities();

  if (!facilities.includes(facilityId)) {
    throw new Error("Clinic access denied.");
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
        !item.product_id ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0
    )
  ) {
    throw new Error(
      "Enter valid medication quantities."
    );
  }

  const productIds = items.map(
    (item) => item.product_id
  );

  if (
    new Set(productIds).size !== productIds.length
  ) {
    throw new Error(
      "Duplicate medications are not allowed in one order."
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

  if (error) {
    throw stockError(
      "Unable to create medication order",
      error
    );
  }

  return String(data);
}
