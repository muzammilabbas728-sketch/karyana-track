import { useState, useEffect } from "react";
import { getSales, voidSale } from "../api/client";
import { colors, fonts, styles } from "../theme";

export default function SalesHistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  async function loadSales() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSales();
      setSales(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load sales history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSales();
  }, []);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
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
      await loadSales();
    } catch (err) {
      setError(err.message || "Failed to void sale");
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
        <h2 style={{ ...styles.pageTitle, fontSize: "1.4rem", margin: 0 }}>Sales History</h2>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        {error ? <p style={{ color: colors.danger, margin: 0 }}>{error}</p> : null}
        {successMessage ? <p style={{ color: colors.primary, margin: 0 }}>{successMessage}</p> : null}
      </div>

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
                <th style={styles.tableHeaderCell}>Profit</th>
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
                    <td style={styles.tableCell}>
                      Rs. {sale.total_profit}
                    </td>
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
                      {sale.created_at ? new Date(sale.created_at).toLocaleString() : "—"}
                    </td>
                    <td style={styles.tableCell}>
                      {!isVoided ? (
                        <button
                          type="button"
                          onClick={() => handleVoid(sale.id)}
                          style={styles.buttonDanger}
                        >
                          Void
                        </button>
                      ) : (
                        <span style={{ color: colors.muted, fontSize: "0.85rem" }}>—</span>
                      )}
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
