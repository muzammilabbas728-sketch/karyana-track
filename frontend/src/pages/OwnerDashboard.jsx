import { useState, useEffect } from "react";
import { getDailyReport, getRangeReport, getLowStock } from "../api/client";
import { colors, fonts, styles } from "../theme";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export default function OwnerDashboard() {
  const [dailyReport, setDailyReport] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [fromDate, setFromDate] = useState(
    formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  );
  const [toDate, setToDate] = useState(formatDate(new Date()));
  const [rangeReport, setRangeReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const [daily, low] = await Promise.all([getDailyReport(), getLowStock()]);
        setDailyReport(daily);
        setLowStock(low);
      } catch (err) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  async function handleRunReport() {
    setError(null);

    try {
      const report = await getRangeReport(fromDate, toDate);
      setRangeReport(report);
    } catch (err) {
      setError(err.message || "Failed to load range report");
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "1fr 1fr",
      }}
    >
      <section
        style={{
          ...styles.card,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h2 style={{ ...styles.pageTitle, fontSize: "1.3rem", marginBottom: "1rem" }}>Today's Summary</h2>
        {loading ? (
          <p>Loading summary...</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div
              style={{
                padding: "1rem",
                ...styles.cardAccent(colors.primary),
              }}
            >
              <strong>Sales Count</strong>
              <div>{dailyReport?.total_sales_count ?? "—"}</div>
            </div>
            <div
              style={{
                padding: "1rem",
                ...styles.cardAccent(colors.primary),
              }}
            >
              <strong>Total Revenue</strong>
              <div>Rs. {dailyReport?.total_revenue ?? "—"}</div>
            </div>
            <div
              style={{
                padding: "1rem",
                ...styles.cardAccent(colors.primary),
              }}
            >
              <strong>Total Profit</strong>
              <div>Rs. {dailyReport?.total_profit ?? "—"}</div>
            </div>
          </div>
        )}
      </section>

      <section
        style={{
          ...styles.card,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h2 style={{ ...styles.pageTitle, fontSize: "1.3rem", marginBottom: "1rem" }}>Date Range Report</h2>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <label style={{ display: "block", ...styles.label }}>
            From
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              style={{
                ...styles.input,
                marginTop: "0.5rem",
              }}
            />
          </label>
          <label style={{ display: "block", ...styles.label }}>
            To
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              style={{
                ...styles.input,
                marginTop: "0.5rem",
              }}
            />
          </label>
          <button
            type="button"
            onClick={handleRunReport}
            style={{
              ...styles.buttonPrimary,
              width: "100%",
            }}
          >
            Run Report
          </button>
        </div>

        {rangeReport ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div
              style={{
                padding: "1rem",
                ...styles.cardAccent(colors.primary),
              }}
            >
              <strong>Sales Count</strong>
              <div>{rangeReport?.total_sales_count ?? "—"}</div>
            </div>
            <div
              style={{
                padding: "1rem",
                ...styles.cardAccent(colors.primary),
              }}
            >
              <strong>Total Revenue</strong>
              <div>Rs. {rangeReport?.total_revenue ?? "—"}</div>
            </div>
            <div
              style={{
                padding: "1rem",
                ...styles.cardAccent(colors.primary),
              }}
            >
              <strong>Total Profit</strong>
              <div>Rs. {rangeReport?.total_profit ?? "—"}</div>
            </div>
          </div>
        ) : (
          <p>Run the report to see range statistics.</p>
        )}
      </section>

      <section
        style={{
          ...styles.card,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          gridColumn: "1 / -1",
        }}
      >
        <h2 style={{ ...styles.pageTitle, fontSize: "1.3rem", marginBottom: "1rem" }}>Low Stock Alerts</h2>
        {error ? <p style={{ color: colors.danger }}>{error}</p> : null}
        {loading ? (
          <p>Loading low stock alerts...</p>
        ) : lowStock.length === 0 ? (
          <p>All stock levels are healthy.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {lowStock.map((item) => (
              <div
                key={item.product_id ?? item.id ?? item.name}
                style={{
                  padding: "1rem",
                  ...styles.cardAccent(colors.warning),
                  color: colors.warning,
                }}
              >
                {item.unit_type === "weight"
                  ? `${item.name}: ${(item.quantity_in_stock / 1000).toFixed(2)} kg left (threshold: ${(item.low_stock_threshold / 1000).toFixed(2)} kg)`
                  : `${item.name}: ${item.quantity_in_stock} left (threshold: ${item.low_stock_threshold})`}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
