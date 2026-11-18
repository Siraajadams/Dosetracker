
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getAssignedFacilities } from "@/lib/fpStock";

type Site = {
  id: string;
  site_name: string;
};

type Product = {
  id: string;
  name: string;
};

type RequestItem = {
  product_id: string;
  quantity: string;
};

export default function NewTransferPage() {
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);

  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");

  const [items, setItems] = useState<RequestItem[]>([
    { product_id: "", quantity: "" },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          throw new Error("Please sign in first.");
        }

        const facilities = await getAssignedFacilities();

        const [siteResult, productResult] =
          await Promise.all([
            supabase
              .from("sites")
              .select("id,site_name")
              .order("site_name"),

            supabase
              .from("fp_stock_products")
              .select("id,name")
              .order("name"),
          ]);

        if (siteResult.error) {
          throw siteResult.error;
        }

        if (productResult.error) {
          throw productResult.error;
        }

        if (cancelled) return;

        setAssigned(facilities);
        setSites((siteResult.data || []) as Site[]);
        setProducts(
          (productResult.data || []) as Product[]
        );

        // FIX:
        // Read query parameters only in the browser.
        // This avoids the useSearchParams prerender error.
        const params = new URLSearchParams(
          window.location.search
        );

        const requestedSite = params.get("site_id");

        if (
          requestedSite &&
          facilities.includes(requestedSite)
        ) {
          setDestination(requestedSite);
        } else if (facilities.length === 1) {
          setDestination(facilities[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load transfer form."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateItem(
    index: number,
    field: keyof RequestItem,
    value: string
  ) {
    setItems((previous) =>
      previous.map((item, i) =>
        i === index
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function addItem() {
    setItems((previous) => [
      ...previous,
      { product_id: "", quantity: "" },
    ]);
  }

  function removeItem(index: number) {
    setItems((previous) =>
      previous.filter((_, i) => i !== index)
    );
  }

  async function submitRequest(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setError("");

    if (!source || !destination) {
      setError("Select both clinics.");
      return;
    }

    if (source === destination) {
      setError(
        "Sending and receiving clinics must differ."
      );
      return;
    }

    if (!assigned.includes(destination)) {
      setError(
        "You must be assigned to the receiving clinic."
      );
      return;
    }

    if (!reason.trim()) {
      setError("Enter a reason for the transfer.");
      return;
    }

    if (
      items.length === 0 ||
      items.some(
        (item) =>
          !item.product_id ||
          item.quantity.trim() === "" ||
          !Number.isSafeInteger(
            Number(item.quantity)
          ) ||
          Number(item.quantity) <= 0
      )
    ) {
      setError(
        "Select a medication and enter a positive whole-number quantity for every item."
      );
      return;
    }

    const productIds = items.map(
      (item) => item.product_id
    );

    if (
      new Set(productIds).size !==
      productIds.length
    ) {
      setError(
        "Each medication must appear only once. Combine quantities for duplicate medications."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error(
          "Your session has expired."
        );
      }

      // Recheck clinic assignment before submitting.
      const currentFacilities =
        await getAssignedFacilities();

      if (
        !currentFacilities.includes(destination)
      ) {
        throw new Error(
          "You no longer have access to the receiving clinic."
        );
      }

      // The RPC reads item.quantity, NOT item.quantity_requested.
      const payload = items.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
      }));

      if (
        payload.some(
          (item) =>
            !item.product_id ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0
        )
      ) {
        throw new Error(
          "Every medication must have a valid positive whole-number quantity."
        );
      }

      // Diagnostic: verify the exact payload shape without logging credentials.
      console.info("DoseTrack transfer request items:", JSON.stringify(payload));

      const { data, error: rpcError } = await supabase.rpc(
        "fp_request_stock_transfer",
        {
          p_source: source,
          p_destination: destination,
          p_reason: reason.trim(),
          p_items: payload,
        }
      );

      if (rpcError) {
        console.error("DoseTrack transfer RPC error:", {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
        });

        const extra =
          rpcError.code === "P0001" &&
          rpcError.message.includes("Invalid medication quantity")
            ? " The SQL function requires p_items entries with a positive integer `quantity`. Check Network > Payload for the actual deployed request; if it contains quantity, confirm the deployed frontend is current and inspect the database function."
            : "";

        throw new Error(
          [
            `Transfer failed [${rpcError.code || "unknown"}]: ${rpcError.message}`,
            rpcError.details ? `Details: ${rpcError.details}` : "",
            rpcError.hint ? `Hint: ${rpcError.hint}` : "",
            extra,
          ]
            .filter(Boolean)
            .join(" | ")
        );
      }

      if (
        typeof data !== "string" ||
        !data
      ) {
        throw new Error(
          "The server did not return a transfer ID."
        );
      }

      router.push(
        `/nurse/stock/transfers/${encodeURIComponent(
          data
        )}`
      );
    } catch (err) {
      console.error("Stock transfer request error:", err);
      const details = err && typeof err === "object" ? err as {
        message?: string; code?: string; details?: string; hint?: string;
      } : {};
      setError(
        [details.message || (err instanceof Error ? err.message : "Transfer request failed."),
         details.code ? `Code: ${details.code}` : "",
         details.details || "",
         details.hint ? `Hint: ${details.hint}` : ""]
          .filter(Boolean).join(" | ")
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        Loading transfer request form...
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/nurse/stock/transfers">
          ← Back to Transfers
        </Link>

        <header style={{ margin: "24px 0" }}>
          <p style={styles.eyebrow}>
            DOSETRACK / STOCK MANAGEMENT
          </p>

          <h1>
            New Inter-Clinic Stock Transfer
          </h1>

          <p style={styles.muted}>
            Request medication stock from
            another clinic. The sending clinic
            must approve and dispatch the
            request before receipt can be
            confirmed.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            style={styles.error}
          >
            {error}
          </div>
        )}

        {assigned.length === 0 && (
          <div style={styles.error}>
            No assigned receiving clinics were
            found. Contact the DoseTrack
            administrator.
          </div>
        )}

        <form onSubmit={submitRequest}>
          <section style={styles.card}>
            <h2>Clinic Details</h2>

            <label style={styles.label}>
              Sending Clinic
            </label>

            <select
              required
              value={source}
              onChange={(e) =>
                setSource(e.target.value)
              }
              style={styles.input}
            >
              <option value="">
                Select sending clinic
              </option>

              {sites
                .filter(
                  (site) =>
                    site.id !== destination
                )
                .map((site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.site_name}
                  </option>
                ))}
            </select>

            <label style={styles.label}>
              Receiving Clinic (Your Clinic)
            </label>

            <select
              required
              value={destination}
              onChange={(e) =>
                setDestination(e.target.value)
              }
              style={styles.input}
            >
              <option value="">
                Select receiving clinic
              </option>

              {sites
                .filter(
                  (site) =>
                    assigned.includes(
                      site.id
                    ) &&
                    site.id !== source
                )
                .map((site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.site_name}
                  </option>
                ))}
            </select>

            <label style={styles.label}>
              Reason for Request
            </label>

            <textarea
              required
              value={reason}
              onChange={(e) =>
                setReason(e.target.value)
              }
              placeholder="Example: Insufficient stock to meet patient demand"
              rows={3}
              style={styles.input}
            />
          </section>

          <section style={styles.card}>
            <h2>Medications Requested</h2>

            <p style={styles.muted}>
              Select one or more medications
              and enter the quantity required
              for each.
            </p>

            {items.map((item, index) => (
              <div
                key={index}
                style={styles.itemRow}
              >
                <div
                  style={{
                    flex: 2,
                    minWidth: 200,
                  }}
                >
                  <label
                    style={styles.label}
                  >
                    Medication
                  </label>

                  <select
                    required
                    value={item.product_id}
                    onChange={(e) =>
                      updateItem(
                        index,
                        "product_id",
                        e.target.value
                      )
                    }
                    style={styles.input}
                  >
                    <option value="">
                      Select medication
                    </option>

                    {products.map(
                      (product) => (
                        <option
                          key={product.id}
                          value={product.id}
                        >
                          {product.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 120,
                  }}
                >
                  <label
                    style={styles.label}
                  >
                    Quantity
                  </label>

                  <input
                    type="number"
                    required
                    min={1}
                    step={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(
                        index,
                        "quantity",
                        e.target.value
                      )
                    }
                    style={styles.input}
                  />
                </div>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      removeItem(index)
                    }
                    style={
                      styles.removeButton
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              style={
                styles.secondaryButton
              }
            >
              + Add Another Medication
            </button>
          </section>

          <section style={styles.card}>
            <h2>
              Submit Transfer Request
            </h2>

            <p style={styles.muted}>
              Submitting creates a pending
              request. Stock must not be
              deducted or added until the
              appropriate dispatch and
              receipt transactions are
              processed.
            </p>

            <button
              type="submit"
              disabled={
                saving ||
                assigned.length === 0 ||
                products.length === 0
              }
              style={{
                ...styles.primaryButton,
                opacity:
                  saving ||
                  assigned.length === 0 ||
                  products.length === 0
                    ? 0.6
                    : 1,
              }}
            >
              {saving
                ? "Submitting..."
                : "Submit Transfer Request"}
            </button>
          </section>
        </form>
      </div>
    </main>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f4f8fa",
    padding: "28px 16px",
    fontFamily: "Arial, sans-serif",
    color: "#17333b",
  },

  container: {
    maxWidth: 950,
    margin: "0 auto",
  },

  eyebrow: {
    fontSize: 12,
    color: "#0f766e",
    fontWeight: 800,
    letterSpacing: 1,
  },

  muted: {
    color: "#64748b",
    lineHeight: 1.6,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 24,
    marginBottom: 20,
  },

  label: {
    display: "block",
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 700,
    fontSize: 14,
  },

  input: {
    display: "block",
    width: "100%",
    padding: 12,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    boxSizing: "border-box",
    fontSize: 15,
    background: "white",
    color: "#17333b",
  },

  itemRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
    paddingBottom: 18,
    borderBottom:
      "1px solid #e2e8f0",
  },

  primaryButton: {
    padding: "14px 22px",
    background: "#164c7e",
    color: "white",
    border: 0,
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 700,
  },

  secondaryButton: {
    padding: "12px 18px",
    background: "white",
    color: "#0f766e",
    border: "1px solid #0f766e",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 700,
  },

  removeButton: {
    padding: "12px 16px",
    background: "#fff0f0",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 8,
    cursor: "pointer",
  },

  error: {
    background: "#fff0f0",
    color: "#991b1b",
    borderRadius: 9,
    padding: 16,
    marginBottom: 20,
  },
};
