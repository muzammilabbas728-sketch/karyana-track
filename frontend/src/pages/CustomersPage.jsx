import { useState, useEffect } from "react";
import html2pdf from "html2pdf.js";
import {
  getCustomers,
  createCustomer,
  getCustomerHistory,
  recordCustomerPayment,
} from "../api/client";
import { colors, fonts, styles } from "../theme";

const initialNewCustomer = {
  name: "",
  phone: "",
  credit_limit: "",
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState(initialNewCustomer);
  const [historyCustomerId, setHistoryCustomerId] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [paymentCustomerId, setPaymentCustomerId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadCustomers() {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const data = await getCustomers();
        setCustomers(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Failed to load customers");
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, []);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
  }

  function handleNewCustomerChange(event) {
    const { name, value } = event.target;
    setNewCustomer((current) => ({ ...current, [name]: value }));
  }

  async function handleAddCustomer(event) {
    event.preventDefault();
    clearMessages();

    const payload = {
      name: newCustomer.name.trim(),
      phone: newCustomer.phone.trim() || null,
      credit_limit:
        newCustomer.credit_limit !== "" ? Number(newCustomer.credit_limit) : null,
    };

    if (payload.credit_limit !== null && Number.isNaN(payload.credit_limit)) {
      setError("Please enter a valid credit limit.");
      return;
    }

    try {
      const createdCustomer = await createCustomer(payload);
      setCustomers((current) => [...current, createdCustomer]);
      setNewCustomer(initialNewCustomer);
      setShowAddForm(false);
      setSuccessMessage("Customer created successfully.");
    } catch (err) {
      setError(err.message || "Failed to create customer");
    }
  }

  function startPayment(customer) {
    clearMessages();
    setPaymentCustomerId(customer.id);
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
      await recordCustomerPayment(paymentCustomerId, amount);
      const refreshedCustomers = await getCustomers();
      setCustomers(Array.isArray(refreshedCustomers) ? refreshedCustomers : []);
      setPaymentCustomerId(null);
      setPaymentAmount("");
      setSuccessMessage("Payment recorded successfully.");
    } catch (err) {
      setError(err.message || "Failed to record payment");
    }
  }

  async function openHistory(customerId) {
    clearMessages();
    setHistoryCustomerId(customerId);
    setHistoryItems([]);

    try {
      const data = await getCustomerHistory(customerId);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load customer history");
    }
  }

  function closeHistory() {
    setHistoryCustomerId(null);
    setHistoryItems([]);
  }

  const selectedPaymentCustomer = customers.find((c) => c.id === paymentCustomerId);
  const selectedHistoryCustomer = customers.find((c) => c.id === historyCustomerId);

  async function handleDownloadCreditHistory() {
    if (!selectedHistoryCustomer) return;
    setDownloading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const totalCredit = historyItems
        .filter((i) => i.type === "sale")
        .reduce((sum, i) => sum + Number(i.amount || 0), 0);

      const totalPaid = historyItems
        .filter((i) => i.type === "payment")
        .reduce((sum, i) => sum + Number(i.amount || 0), 0);

      const remainingBalance = Number(selectedHistoryCustomer.balance || 0);
      const reportDate = new Date().toLocaleString();

      const container = document.createElement("div");
      container.style.padding = "24px";
      container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      container.style.color = "#1C1917";
      container.style.backgroundColor = "#FFFFFF";

      const rowsHtml = historyItems
        .map((item) => {
          const isSale = item.type === "sale";
          const typeLabel = isSale ? "Credit Sale" : "Payment";
          const typeColor = isSale ? "#B42318" : "#2F6844";
          let itemsListHtml = "";

          if (isSale && item.items && item.items.length > 0) {
            const listItems = item.items
              .map(
                (p) =>
                  `<li style="margin-bottom: 2px;">${p.product_name} — ${p.quantity} x Rs. ${p.unit_price} = <strong>Rs. ${p.line_total}</strong></li>`
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
                Rs. ${item.amount}
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
              <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #6B6459; margin-top: 4px;">Customer Credit Statement</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #6B6459;">
              <div><strong>Statement Date:</strong> ${reportDate}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 20px; background: #FAFAF8; padding: 12px 16px; border-radius: 8px; border: 1px solid #E7E4DD; font-size: 13px;">
            <div>
              <div><strong>Customer Name:</strong> ${selectedHistoryCustomer.name}</div>
              <div style="margin-top: 4px;"><strong>Customer ID:</strong> #${selectedHistoryCustomer.id}</div>
            </div>
            <div>
              <div><strong>Phone:</strong> ${selectedHistoryCustomer.phone || "—"}</div>
              <div style="margin-top: 4px;"><strong>Credit Limit:</strong> ${
                selectedHistoryCustomer.credit_limit !== null && selectedHistoryCustomer.credit_limit !== undefined
                  ? `Rs. ${selectedHistoryCustomer.credit_limit}`
                  : "No limit"
              }</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
            <div style="padding: 12px; border-radius: 8px; border: 1px solid #E7E4DD; background: #FAFAF8; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; color: #6B6459; margin-bottom: 4px;">Total Credit</div>
              <div style="font-size: 18px; font-weight: 700; color: #B42318;">Rs. ${totalCredit.toFixed(2)}</div>
            </div>
            <div style="padding: 12px; border-radius: 8px; border: 1px solid #E7E4DD; background: #FAFAF8; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; color: #6B6459; margin-bottom: 4px;">Total Paid</div>
              <div style="font-size: 18px; font-weight: 700; color: #2F6844;">Rs. ${totalPaid.toFixed(2)}</div>
            </div>
            <div style="padding: 12px; border-radius: 8px; border: 1px solid #F87171; background: #FDF2F2; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; color: #6B6459; margin-bottom: 4px;">Remaining Balance</div>
              <div style="font-size: 18px; font-weight: 700; color: #B42318;">Rs. ${remainingBalance.toFixed(2)}</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="border-bottom: 2px solid #E7E4DD; text-align: left; font-size: 11px; text-transform: uppercase; color: #6B6459;">
                <th style="padding: 8px; width: 25%;">Transaction Type</th>
                <th style="padding: 8px; width: 50%;">Amount & Details</th>
                <th style="padding: 8px; width: 25%;">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #666;">No transaction history.</td></tr>'}
            </tbody>
          </table>

          <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #E7E4DD; display: flex; justify-content: space-between; font-size: 11px; color: #6B6459;">
            <div>Thank you for your business!</div>
            <div>Authorized Signature: _______________________</div>
          </div>
        </div>
      `;

      const safeName = selectedHistoryCustomer.name.replace(/[^a-zA-Z0-9]/g, "_");
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Credit_Statement_${safeName}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(container).save();
      setSuccessMessage(`Credit statement PDF downloaded: Credit_Statement_${safeName}.pdf`);
    } catch (err) {
      setError(err.message || "Failed to download PDF report");
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
        <h2 style={{ ...styles.pageTitle, fontSize: "1.4rem", margin: 0 }}>Customers</h2>
        <button
          type="button"
          onClick={() => {
            clearMessages();
            setShowAddForm((current) => !current);
            if (showAddForm) {
              setNewCustomer(initialNewCustomer);
            }
          }}
          style={{
            ...styles.buttonPrimary,
          }}
        >
          {showAddForm ? "Cancel" : "Add Customer"}
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        {error ? <p style={{ color: colors.danger, margin: 0 }}>{error}</p> : null}
        {successMessage ? <p style={{ color: colors.primary, margin: 0 }}>{successMessage}</p> : null}
      </div>

      {showAddForm ? (
        <form
          onSubmit={handleAddCustomer}
          style={{
            display: "grid",
            gap: "0.75rem",
            marginBottom: "1rem",
            ...styles.card,
          }}
        >
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={styles.label}>
              Name
              <input
                name="name"
                value={newCustomer.name}
                onChange={handleNewCustomerChange}
                required
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              Phone (optional)
              <input
                name="phone"
                value={newCustomer.phone}
                onChange={handleNewCustomerChange}
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              Credit Limit (optional)
              <input
                name="credit_limit"
                type="number"
                step="0.01"
                placeholder="Leave blank for no limit"
                value={newCustomer.credit_limit}
                onChange={handleNewCustomerChange}
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
          </div>
          <div>
            <button type="submit" style={styles.buttonPrimary}>
              Save Customer
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p style={{ fontFamily: fonts.body, color: colors.muted }}>Loading customers...</p>
      ) : customers.length === 0 ? (
        <p style={{ fontFamily: fonts.body, color: colors.muted }}>No customers found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                <th style={styles.tableHeaderCell}>Name</th>
                <th style={styles.tableHeaderCell}>Phone</th>
                <th style={styles.tableHeaderCell}>Balance</th>
                <th style={styles.tableHeaderCell}>Credit Limit</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const isOverLimit =
                  customer.credit_limit !== null &&
                  customer.credit_limit !== undefined &&
                  customer.balance >= customer.credit_limit;

                return (
                  <tr key={customer.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={styles.tableCell}>{customer.name}</td>
                    <td style={styles.tableCell}>{customer.phone || "—"}</td>
                    <td style={styles.tableCell}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: customer.balance > 0 ? colors.danger : colors.muted,
                        }}
                      >
                        Rs. {customer.balance}
                      </span>
                      {isOverLimit ? (
                        <span
                          style={{
                            color: colors.warning,
                            marginLeft: "0.5rem",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                          }}
                        >
                          ⚠ Over limit
                        </span>
                      ) : null}
                    </td>
                    <td style={styles.tableCell}>
                      {customer.credit_limit !== null && customer.credit_limit !== undefined
                        ? `Rs. ${customer.credit_limit}`
                        : "No limit"}
                    </td>
                    <td style={styles.tableCell}>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => openHistory(customer.id)}
                          style={styles.buttonSecondary}
                        >
                          History
                        </button>
                        <button
                          type="button"
                          onClick={() => startPayment(customer)}
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

      {paymentCustomerId !== null ? (
        <div
          style={{
            marginTop: "1rem",
            ...styles.card,
          }}
        >
          <h3 style={{ ...styles.pageTitle, fontSize: "1.1rem", marginTop: 0 }}>
            Record Payment {selectedPaymentCustomer ? `for ${selectedPaymentCustomer.name}` : ""}
          </h3>
          <form onSubmit={handlePaymentSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "300px" }}>
            <label style={styles.label}>
              Amount (Rs.)
              <input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                required
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" style={styles.buttonPrimary}>
                Submit
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentCustomerId(null);
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

      {historyCustomerId !== null ? (
        <div
          style={{
            marginTop: "1rem",
            ...styles.card,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ ...styles.pageTitle, fontSize: "1.1rem", margin: 0 }}>
              Customer History {selectedHistoryCustomer ? `for ${selectedHistoryCustomer.name}` : ""}
            </h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={handleDownloadCreditHistory}
                disabled={downloading}
                style={styles.buttonPrimary}
              >
                {downloading ? "Generating PDF..." : "Download Credit History"}
              </button>
              <button type="button" onClick={closeHistory} style={styles.buttonSecondary}>
                Close
              </button>
            </div>
          </div>
          {historyItems.length === 0 ? (
            <p style={{ fontFamily: fonts.body, color: colors.muted }}>No history available.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                    <th style={styles.tableHeaderCell}>Type</th>
                    <th style={styles.tableHeaderCell}>Amount</th>
                    <th style={styles.tableHeaderCell}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item, index) => (
                    <tr key={`${item.type}-${item.id}-${index}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={styles.tableCell}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: item.type === "sale" ? colors.danger : colors.primary,
                            textTransform: "capitalize",
                          }}
                        >
                          {item.type === "sale" ? "Credit Sale" : "Payment"}
                        </span>
                      </td>
                      <td style={{ ...styles.tableCell, fontWeight: 600, color: item.type === "sale" ? colors.danger : colors.primary }}>
                        Rs. {item.amount}
                        {item.items && item.items.length > 0 ? (
                          <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1rem", fontSize: "0.8rem", fontWeight: 400, color: colors.muted }}>
                            {item.items.map((p, i) => (
                              <li key={i}>{p.product_name} — {p.quantity} x Rs. {p.unit_price} = Rs. {p.line_total}</li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                      <td style={styles.tableCell}>
                        {formatDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
