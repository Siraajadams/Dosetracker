
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

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error(
      "Quantity must be a positive whole number."
    );
  }

  if (type === "received") {
    if (!options.batchNumber?.trim() || !options.expiryDate) {
      throw new Error(
        "Batch number and expiry date are required."
      );
    }
  } else if (!options.batchId) {
    throw new Error("Select a stock batch.");
  }

  if (type === "wasted" && !options.reason?.trim()) {
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
        type === "received" ? null : options.batchId ?? null,
      p_batch_number:
        type === "received"
          ? options.batchNumber?.trim()
          : null,
      p_expiry_date:
        type === "received" ? options.expiryDate : null,
      p_reason: options.reason?.trim() || null,
      p_reference: options.reference?.trim() || null,
    }
  );

  if (error) {
    throw stockError("Unable to record stock batch", error);
  }

  return String(data);
}

// Retained for compatibility with existing pages.
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

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
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

  if (error) {
    throw stockError("Unable to record stock", error);
  }

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
    throw new Error("Clinic access denied.");
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
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

  const productIds = items.map((item) => item.product_id);

  if (new Set(productIds).size !== productIds.length) {
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
