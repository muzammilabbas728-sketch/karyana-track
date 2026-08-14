import { useState, useEffect } from "react";
import {
  getSales,
  getSaleDetails,
  updateSale,
  voidSale,
  getCustomers,
} from "../api/client";
import { colors, fonts, styles } from "../theme";

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  let str = String(dateStr).trim();
  if (!str) return "—";
  if (str.includes(" ") && !str.includes("T")) {
    str = str.replace(" ", "T");
  }
  if (!str.endsWith("Z") && !str.includes("+") && !str.slice(10).includes("-")) {
    str += "Z";
  }
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? String(dateStr) : date.toLocaleString();
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Edit state
  const [editingSale, setEditingSale] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editPaymentStatus, setEditPaymentStatus] = useState("paid");
  const [editCustomerId, setEditCustomerId] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // View state
  const [viewingSale, setViewingSale] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [salesData, customersData] = await Promise.all([
        getSales(),
        getCustomers(),
      ]);
      setSales(Array.isArray(salesData) ? salesData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
    } catch (err) {
      setError(err.message || "Failed to load sales history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
    setEditError(null);
  }

  async function handleViewSale(saleId) {
    clearMessages();
    setViewLoading(true);
    try {
      const detail = await getSaleDetails(saleId);
      setViewingSale(detail);
    } catch (err) {
      setError(err.message || "Failed to load sale details");
    } finally {
      setViewLoading(false);
    }
  }

  async function handleStartEdit(sale) {
    clearMessages();
    setEditLoading(true);
    try {
      const detail = await getSaleDetails(sale.id);
      setEditingSale(detail);
      setEditItems(
        detail.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit_cost: item.unit_cost,
          sell_as_pack: item.sell_as_pack ?? false,
        }))
      );
      setEditPaymentStatus(detail.payment_status || "paid");
      setEditCustomerId(detail.customer_id || null);
    } catch (err) {
      setError(err.message || "Failed to load sale details for editing");
    } finally {
      setEditLoading(false);
    }
  }

  function handleCancelEdit() {
    setEditingSale(null);
    setEditItems([]);
    setEditError(null);
  }

  function handleItemQuantityChange(index, newQty) {
    setEditItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, newQty) } : item
      )
    );
  }

  function handleItemPriceChange(index, newPrice) {
    setEditItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, unit_price: Math.max(0, newPrice) } : item
      )
    );
  }

  function handleRemoveItem(index) {
    if (editItems.length <= 1) {
      setEditError(
        "Transaction must contain at least one item. To cancel the entire transaction, use Void instead."
      );
      return;
    }
    setEditError(null);
    setEditItems((current) => current.filter((_, i) => i !== index));
  }

  async function handleSaveEdit() {
    setEditError(null);
    if (!editingSale) return;

    if (editItems.length === 0) {
      setEditError("Transaction must contain at least one item.");
      return;
    }

    if (editPaymentStatus === "credit" && !editCustomerId) {
      setEditError("Please select a customer for credit sales.");
      return;
    }

    const confirmed = window.confirm(
      `Save changes to Sale #${editingSale.id}?`
    );
    if (!confirmed) return;

    setEditLoading(true);
    try {
      const payload = {
        items: editItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          sell_as_pack: item.sell_as_pack,
        })),
        customer_id: editPaymentStatus === "credit" ? editCustomerId : null,
        payment_status: editPaymentStatus,
      };

      await updateSale(editingSale.id, payload);
      setSuccessMessage(`Sale #${editingSale.id} updated successfully.`);
      setEditingSale(null);
      setEditItems([]);
      await loadData();
    } catch (err) {
      setEditError(err.message || "Failed to update sale");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleVoid(saleId) {
    clearMessages();
    const confirmed = window.confirm(
      "Void this sale? This will restore stock and remove it from reports."
    );
    if (!confirmed) return;

    try {
      await voidSale(saleId);
      setSuccessMessage("Sale voided successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to void sale");
    }
  }

  const role = localStorage.getItem("auth_role") || "staff";
  const isOwner = role === "owner";

  const editTotal = editItems.reduce(
    (sum, item) => sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0),
    0
  );

  const totalSalesAmount = sales
    .filter((s) => !s.voided)
    .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

  const totalProfitAmount = sales
    .filter((s) => !s.voided)
    .reduce((sum, s) => sum + Number(s.total_profit || 0), 0);

  const activeSalesCount = sales.filter((s) => !s.voided).length;
  const voidedSalesCount = sales.filter((s) => s.voided).length;

  return (
    <section
      style={{
        ...styles.card,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ ...styles.pageTitle, fontSize: "1.4rem", margin: 0 }}>Sales History</h2>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        {error ? <p style={{ color: colors.danger, margin: 0 }}>{error}</p> : null}
        {successMessage ? <p style={{ color: colors.primary, margin: 0 }}>{successMessage}</p> : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={styles.card}>
          <div style={styles.label}>Total Sales</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: colors.ink, marginTop: "0.25rem" }}>
            Rs. {totalSalesAmount.toFixed(2)}
          </div>
        </div>

        {isOwner ? (
          <div style={styles.card}>
            <div style={styles.label}>Total Profit</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: colors.primary, marginTop: "0.25rem" }}>
              Rs. {totalProfitAmount.toFixed(2)}
            </div>
          </div>
        ) : null}

        <div style={styles.card}>
          <div style={styles.label}>Active Sales</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: colors.ink, marginTop: "0.25rem" }}>
            {activeSalesCount}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.label}>Voided Sales</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: colors.danger, marginTop: "0.25rem" }}>
            {voidedSalesCount}
          </div>
        </div>
      </div>

      {editingSale ? (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1.25rem",
            border: `1px solid ${colors.border}`,
            borderRadius: "12px",
            backgroundColor: colors.surface,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ ...styles.pageTitle, fontSize: "1.2rem", margin: 0 }}>
              Edit Sale #{editingSale.id}
            </h3>
            <button
              type="button"
              onClick={handleCancelEdit}
              style={styles.buttonSecondary}
            >
              Cancel
            </button>
          </div>

          {editError ? (
            <p style={{ color: colors.danger, marginBottom: "1rem" }}>{editError}</p>
          ) : null}

          <div style={{ display: "grid", gap: "1rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Payment Status:</span>
                <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.9rem" }}>
                  <input
                    type="radio"
                    name="editPaymentMode"
                    value="paid"
                    checked={editPaymentStatus === "paid"}
                    onChange={() => {
                      setEditPaymentStatus("paid");
                      setEditCustomerId(null);
                    }}
                  />
                  Cash / Paid
                </label>
                <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.9rem" }}>
                  <input
                    type="radio"
                    name="editPaymentMode"
                    value="credit"
                    checked={editPaymentStatus === "credit"}
                    onChange={() => setEditPaymentStatus("credit")}
                  />
                  Credit (Udhaar)
                </label>
              </div>

              {editPaymentStatus === "credit" ? (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Customer:</span>
                  <select
                    value={editCustomerId || ""}
                    onChange={(e) => setEditCustomerId(Number(e.target.value) || null)}
                    style={{ ...styles.input, width: "auto", padding: "0.4rem 0.6rem" }}
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                    <th style={styles.tableHeaderCell}>Product</th>
                    <th style={styles.tableHeaderCell}>Qty</th>
                    <th style={styles.tableHeaderCell}>Unit Price (Rs.)</th>
                    <th style={styles.tableHeaderCell}>Line Total</th>
                    <th style={styles.tableHeaderCell}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, idx) => {
                    const lineTotal = (
                      (Number(item.unit_price) || 0) * (Number(item.quantity) || 0)
                    ).toFixed(2);

                    return (
                      <tr key={idx} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={styles.tableCell}>
                          <strong>{item.product_name}</strong>
                        </td>
                        <td style={styles.tableCell}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemQuantityChange(idx, Number(e.target.value))}
                            style={{ ...styles.input, width: "80px" }}
                          />
                        </td>
                        <td style={styles.tableCell}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handleItemPriceChange(idx, Number(e.target.value))}
                            style={{ ...styles.input, width: "100px" }}
                          />
                        </td>
                        <td style={{ ...styles.tableCell, fontWeight: 600 }}>
                          Rs. {lineTotal}
                        </td>
                        <td style={styles.tableCell}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            style={{
                              ...styles.buttonDanger,
                              padding: "0.35rem 0.6rem",
                              fontSize: "0.8rem",
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem",
                ...styles.cardAccent(colors.primary),
              }}
            >
              <strong>Updated Total:</strong>
              <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                Rs. {editTotal.toFixed(2)}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editLoading}
                style={{ ...styles.buttonPrimary, padding: "0.6rem 1.25rem" }}
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{ ...styles.buttonSecondary, padding: "0.6rem 1.25rem" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewingSale ? (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1.25rem",
            border: `1px solid ${colors.border}`,
            borderRadius: "12px",
            backgroundColor: colors.surface,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ ...styles.pageTitle, fontSize: "1.2rem", margin: 0 }}>
              Sale Details #{viewingSale.id}
            </h3>
            <button
              type="button"
              onClick={() => setViewingSale(null)}
              style={styles.buttonSecondary}
            >
              Close
            </button>
          </div>

          <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
            <div><strong>Date:</strong> {formatDateTime(viewingSale.created_at)}</div>
            <div><strong>Payment Status:</strong> <span style={{ textTransform: "capitalize" }}>{viewingSale.payment_status}</span></div>
            {viewingSale.customer_id ? (
              <div>
                <strong>Customer:</strong>{" "}
                {customers.find((c) => c.id === viewingSale.customer_id)?.name || `#${viewingSale.customer_id}`}
              </div>
            ) : null}
          </div>

          <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                  <th style={styles.tableHeaderCell}>Product</th>
                  <th style={styles.tableHeaderCell}>Qty</th>
                  <th style={styles.tableHeaderCell}>Unit Price</th>
                  <th style={styles.tableHeaderCell}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {viewingSale.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={styles.tableCell}><strong>{item.product_name}</strong></td>
                    <td style={styles.tableCell}>{item.quantity}</td>
                    <td style={styles.tableCell}>Rs. {item.unit_price}</td>
                    <td style={{ ...styles.tableCell, fontWeight: 600 }}>Rs. {item.line_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem",
              ...styles.cardAccent(colors.primary),
            }}
          >
            <strong>Total Amount:</strong>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              Rs. {viewingSale.total_amount}
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p style={{ fontFamily: fonts.body, color: colors.muted }}>Loading sales...</p>
      ) : sales.length === 0 ? (
        <p style={{ fontFamily: fonts.body, color: colors.muted }}>No sales history found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                <th style={styles.tableHeaderCell}>ID</th>
                <th style={styles.tableHeaderCell}>Total</th>
                {isOwner ? <th style={styles.tableHeaderCell}>Profit</th> : null}
                <th style={styles.tableHeaderCell}>Payment Status</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Date</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const isVoided = Boolean(sale.voided);
                return (
                  <tr key={sale.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={styles.tableCell}>#{sale.id}</td>
                    <td style={{ ...styles.tableCell, fontWeight: 600 }}>
                      Rs. {sale.total_amount}
                    </td>
                    {isOwner ? (
                      <td style={styles.tableCell}>
                        {sale.total_profit !== null && sale.total_profit !== undefined
                          ? `Rs. ${sale.total_profit}`
                          : "—"}
                      </td>
                    ) : null}
                    <td style={{ ...styles.tableCell, textTransform: "capitalize" }}>
                      {sale.payment_status}
                    </td>
                    <td style={styles.tableCell}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: isVoided ? colors.danger : colors.primary,
                        }}
                      >
                        {isVoided ? "Voided" : "Active"}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      {formatDateTime(sale.created_at)}
                    </td>
                    <td style={styles.tableCell}>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleViewSale(sale.id)}
                          disabled={viewLoading}
                          style={styles.buttonSecondary}
                        >
                          View Details
                        </button>
                        {!isVoided ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(sale)}
                              disabled={editLoading}
                              style={styles.buttonSecondary}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVoid(sale.id)}
                              style={styles.buttonDanger}
                            >
                              Void
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
