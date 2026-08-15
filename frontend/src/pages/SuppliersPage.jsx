import { useState, useEffect } from "react";
import html2pdf from "html2pdf.js";
import {
  getSuppliers,
  createSupplier,
  getSupplierHistory,
  createSupplierPayment,
} from "../api/client";
import { colors, fonts, styles } from "../theme";

const initialNewSupplier = {
  name: "",
  phone: "",
};

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

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState(initialNewSupplier);
  const [historySupplierId, setHistorySupplierId] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [paymentSupplierId, setPaymentSupplierId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [downloading, setDownloading] = useState(false);

  async function loadSuppliers() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
  }

  function handleNewSupplierChange(event) {
    const { name, value } = event.target;
    setNewSupplier((current) => ({ ...current, [name]: value }));
  }

  async function handleAddSupplier(event) {
    event.preventDefault();
    clearMessages();

    const nameClean = newSupplier.name.trim();
    if (!nameClean) {
      setError("Please enter a valid supplier name.");
      return;
    }

    try {
      const created = await createSupplier({
        name: nameClean,
        phone: newSupplier.phone.trim() || null,
      });
      setSuppliers((current) => [...current, created]);
      setNewSupplier(initialNewSupplier);
      setShowAddForm(false);
      setSuccessMessage("Supplier added successfully.");
      loadSuppliers();
    } catch (err) {
      setError(err.message || "Failed to create supplier");
    }
  }

  function startPayment(supplier) {
    clearMessages();
    setPaymentSupplierId(supplier.id);
    setPaymentAmount("");
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    clearMessages();

    const amount = Number(paymentAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    try {
      await createSupplierPayment(paymentSupplierId, amount);
      setPaymentSupplierId(null);
      setPaymentAmount("");
      setSuccessMessage("Supplier payment recorded successfully.");
      loadSuppliers();
    } catch (err) {
      setError(err.message || "Failed to record payment");
    }
  }

  async function openHistory(supplierId) {
    clearMessages();
    setHistorySupplierId(supplierId);
    setHistoryItems([]);

    try {
      const data = await getSupplierHistory(supplierId);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load supplier history");
    }
  }

  function closeHistory() {
    setHistorySupplierId(null);
    setHistoryItems([]);
  }

  const selectedPaymentSupplier = suppliers.find((s) => s.id === paymentSupplierId);
  const selectedHistorySupplier = suppliers.find((s) => s.id === historySupplierId);

  async function handleDownloadSupplierStatement() {
    if (!selectedHistorySupplier) return;
    setDownloading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const totalPurchases = historyItems
        .filter((i) => i.type === "purchase")
        .reduce((sum, i) => sum + Number(i.total_cost || 0), 0);

      const totalPaid = historyItems
        .filter((i) => i.type === "payment")
        .reduce((sum, i) => sum + Number(i.amount || 0), 0) +
        historyItems
          .filter((i) => i.type === "purchase")
          .reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);

      const remainingOwed = Number(selectedHistorySupplier.balance_owed || 0);
      const reportDate = new Date().toLocaleString();

      const container = document.createElement("div");
      container.style.padding = "24px";
      container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      container.style.color = "#1C1917";
      container.style.backgroundColor = "#FFFFFF";

      const rowsHtml = historyItems
        .map((item) => {
          const isPurchase = item.type === "purchase";
          const typeLabel = isPurchase ? `Purchase (${item.payment_status})` : "Supplier Payment";
          const typeColor = isPurchase ? "#B42318" : "#2F6844";
          let itemsListHtml = "";

          if (isPurchase && item.items && item.items.length > 0) {
            const listItems = item.items
              .map(
                (p) =>
                  `<li style="margin-bottom: 2px;">${p.product_name} — ${p.quantity} x Rs. ${p.cost_price} = <strong>Rs. ${p.total_cost}</strong></li>`
              )
              .join("");
            itemsListHtml = `<ul style="margin: 4px 0 0 16px; padding: 0; font-size: 11px; color: #555; list-style-type: disc;">${listItems}</ul>`;
          }

          return `
            <tr style="border-bottom: 1px solid #E7E4DD;">
              <td style="padding: 8px; vertical-align: top;">
                <strong style="color: ${typeColor};">${typeLabel}</strong>
              </td>
              <td style="padding: 8px; vertical-align: top; font-weight: 600; color: ${typeColor};">
                Rs. ${isPurchase ? item.total_cost : item.amount}
                ${isPurchase && item.amount_paid > 0 ? `<div style="font-size: 11px; color: #666;">Paid upfront: Rs. ${item.amount_paid}</div>` : ""}
                ${itemsListHtml}
              </td>
              <td style="padding: 8px; vertical-align: top; color: #333; font-size: 12px;">
                ${formatDateTime(item.created_at)}
              </td>
            </tr>
          `;
        })
        .join("");

      container.innerHTML = `
        <div style="max-width: 750px; margin: 0 auto; background: #ffffff; border: 1px solid #E7E4DD; border-radius: 12px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2F6844; padding-bottom: 12px; margin-bottom: 20px;">
            <div>
              <h1 style="font-size: 22px; font-weight: 700; color: #2F6844; margin: 0;">Karyana Track</h1>
              <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #6B6459; margin-top: 4px;">Supplier Statement / Khata History</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #6B6459;">
              <div><strong>Statement Date:</strong> ${reportDate}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 20px; background: #FAFAF8; padding: 12px 16px; border-radius: 8px; border: 1px solid #E7E4DD; font-size: 13px;">
            <div>
              <div><strong>Supplier Name:</strong> ${selectedHistorySupplier.name}</div>
              <div style="margin-top: 4px;"><strong>Supplier ID:</strong> #${selectedHistorySupplier.id}</div>
            </div>
            <div>
              <div><strong>Phone:</strong> ${selectedHistorySupplier.phone || "—"}</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
            <div style="padding: 12px; border-radius: 8px; border: 1px solid #E7E4DD; background: #FAFAF8; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; color: #6B6459; margin-bottom: 4px;">Total Purchases</div>
              <div style="font-size: 18px; font-weight: 700; color: #B42318;">Rs. ${totalPurchases.toFixed(2)}</div>
            </div>
            <div style="padding: 12px; border-radius: 8px; border: 1px solid #E7E4DD; background: #FAFAF8; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; color: #6B6459; margin-bottom: 4px;">Total Paid</div>
              <div style="font-size: 18px; font-weight: 700; color: #2F6844;">Rs. ${totalPaid.toFixed(2)}</div>
            </div>
            <div style="padding: 12px; border-radius: 8px; border: 1px solid #F87171; background: #FDF2F2; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; color: #6B6459; margin-bottom: 4px;">Balance Owed</div>
              <div style="font-size: 18px; font-weight: 700; color: #B42318;">Rs. ${remainingOwed.toFixed(2)}</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="border-bottom: 2px solid #E7E4DD; text-align: left; font-size: 11px; text-transform: uppercase; color: #6B6459;">
                <th style="padding: 8px; width: 30%;">Transaction Type</th>
                <th style="padding: 8px; width: 45%;">Amount & Details</th>
                <th style="padding: 8px; width: 25%;">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #666;">No transaction history.</td></tr>'}
            </tbody>
          </table>

          <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #E7E4DD; display: flex; justify-content: space-between; font-size: 11px; color: #6B6459;">
            <div>Karyana Track Supplier Khata Record</div>
            <div>Authorized Signature: _______________________</div>
          </div>
        </div>
      `;

      const safeName = selectedHistorySupplier.name.replace(/[^a-zA-Z0-9]/g, "_");
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Supplier_Statement_${safeName}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(container).save();
      setSuccessMessage(`Supplier statement PDF downloaded: Supplier_Statement_${safeName}.pdf`);
    } catch (err) {
      setError(err.message || "Failed to download PDF statement");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section
      style={{
        ...styles.card,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ ...styles.pageTitle, fontSize: "1.4rem", margin: 0 }}>Suppliers & Khata</h2>
        <button
          type="button"
          onClick={() => {
            clearMessages();
            setShowAddForm((current) => !current);
            if (showAddForm) {
              setNewSupplier(initialNewSupplier);
            }
          }}
          style={styles.buttonPrimary}
        >
          {showAddForm ? "Cancel" : "+ Add Supplier"}
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        {error ? <p style={{ color: colors.danger, margin: 0 }}>{error}</p> : null}
        {successMessage ? <p style={{ color: colors.primary, margin: 0 }}>{successMessage}</p> : null}
      </div>

      {showAddForm ? (
        <form
          onSubmit={handleAddSupplier}
          style={{
            display: "grid",
            gap: "0.75rem",
            marginBottom: "1rem",
            ...styles.card,
          }}
        >
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <label style={styles.label}>
              Supplier Name
              <input
                name="name"
                value={newSupplier.name}
                onChange={handleNewSupplierChange}
                required
                placeholder="e.g. Metro Wholesale"
                style={{ ...styles.input, marginTop: "0.35rem" }}
              />
            </label>
            <label style={styles.label}>
              Phone (optional)
              <input
                name="phone"
                value={newSupplier.phone}
                onChange={handleNewSupplierChange}
                placeholder="e.g. 03001234567"
                style={{ ...styles.input, marginTop: "0.35rem" }}
              />
            </label>
          </div>
          <div>
            <button type="submit" style={styles.buttonPrimary}>
              Save Supplier
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p style={{ color: colors.muted }}>Loading suppliers...</p>
      ) : suppliers.length === 0 ? (
        <p style={{ color: colors.muted }}>No suppliers found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                <th style={styles.tableHeaderCell}>Supplier Name</th>
                <th style={styles.tableHeaderCell}>Phone</th>
                <th style={styles.tableHeaderCell}>Total Owed</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => {
                const owes = supplier.balance_owed > 0;
                return (
                  <tr key={supplier.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={styles.tableCell}><strong>{supplier.name}</strong></td>
                    <td style={styles.tableCell}>{supplier.phone || "—"}</td>
                    <td style={styles.tableCell}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: owes ? colors.danger : colors.muted,
                        }}
                      >
                        Rs. {Number(supplier.balance_owed).toFixed(2)}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => openHistory(supplier.id)}
                          style={styles.buttonSecondary}
                        >
                          History
                        </button>
                        <button
                          type="button"
                          onClick={() => startPayment(supplier)}
                          style={styles.buttonSecondary}
                        >
                          Record Payment
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {paymentSupplierId !== null ? (
        <div style={{ marginTop: "1rem", ...styles.card }}>
          <h3 style={{ ...styles.pageTitle, fontSize: "1.1rem", marginTop: 0 }}>
            Record Payment {selectedPaymentSupplier ? `for ${selectedPaymentSupplier.name}` : ""}
          </h3>
          <form onSubmit={handlePaymentSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "300px" }}>
            <label style={styles.label}>
              Amount (Rs.)
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                required
                style={{ ...styles.input, marginTop: "0.35rem" }}
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" style={styles.buttonPrimary}>
                Submit
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentSupplierId(null);
                  setPaymentAmount("");
                }}
                style={styles.buttonSecondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {historySupplierId !== null ? (
        <div style={{ marginTop: "1rem", ...styles.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ ...styles.pageTitle, fontSize: "1.1rem", margin: 0 }}>
              Supplier History {selectedHistorySupplier ? `for ${selectedHistorySupplier.name}` : ""}
            </h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={handleDownloadSupplierStatement}
                disabled={downloading}
                style={styles.buttonPrimary}
              >
                {downloading ? "Generating PDF..." : "Download Statement PDF"}
              </button>
              <button type="button" onClick={closeHistory} style={styles.buttonSecondary}>
                Close
              </button>
            </div>
          </div>
          {historyItems.length === 0 ? (
            <p style={{ color: colors.muted }}>No purchase or payment history available.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                    <th style={styles.tableHeaderCell}>Transaction</th>
                    <th style={styles.tableHeaderCell}>Amount & Details</th>
                    <th style={styles.tableHeaderCell}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item, index) => {
                    const isPurchase = item.type === "purchase";
                    return (
                      <tr key={`${item.type}-${item.id}-${index}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={styles.tableCell}>
                          <span
                            style={{
                              fontWeight: 600,
                              color: isPurchase ? colors.danger : colors.primary,
                              textTransform: "capitalize",
                            }}
                          >
                            {isPurchase ? `Purchase (${item.payment_status})` : "Supplier Payment"}
                          </span>
                        </td>
                        <td style={{ ...styles.tableCell, fontWeight: 600, color: isPurchase ? colors.danger : colors.primary }}>
                          Rs. {isPurchase ? item.total_cost : item.amount}
                          {isPurchase && item.amount_paid > 0 ? (
                            <span style={{ fontSize: "0.85rem", fontWeight: 400, color: colors.muted, marginLeft: "0.5rem" }}>
                              (Paid upfront: Rs. {item.amount_paid})
                            </span>
                          ) : null}
                          {isPurchase && item.items && item.items.length > 0 ? (
                            <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1rem", fontSize: "0.8rem", fontWeight: 400, color: colors.muted }}>
                              {item.items.map((p, i) => (
                                <li key={i}>{p.product_name} — {p.quantity} x Rs. {p.cost_price} = Rs. {p.total_cost}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                        <td style={styles.tableCell}>
                          {formatDateTime(item.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
