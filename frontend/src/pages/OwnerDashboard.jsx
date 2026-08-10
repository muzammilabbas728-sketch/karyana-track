import { useState, useEffect } from "react";
import { getDailyReport, getRangeReport, getLowStock } from "../api/client";

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
          padding: "1rem",
          borderRadius: "12px",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h2>Today's Summary</h2>
        {loading ? (
          <p>Loading summary...</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div
              style={{
                padding: "1rem",
                borderRadius: "10px",
                background: "#f8fafc",
              }}
            >
              <strong>Sales Count</strong>
              <div>{dailyReport?.total_sales_count ?? "—"}</div>
            </div>
            <div
              style={{
                padding: "1rem",
                borderRadius: "10px",
                background: "#f8fafc",
              }}
            >
              <strong>Total Revenue</strong>
              <div>Rs. {dailyReport?.total_revenue ?? "—"}</div>
            </div>
            <div
              style={{
                padding: "1rem",
                borderRadius: "10px",
                background: "#f8fafc",
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
          padding: "1rem",
          borderRadius: "12px",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h2>Date Range Report</h2>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <label style={{ display: "block" }}>
            From
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid #ccc",
                marginTop: "0.5rem",
              }}
            />
          </label>
          <label style={{ display: "block" }}>
            To
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid #ccc",
                marginTop: "0.5rem",
              }}
            />
          </label>
          <button
            type="button"
            onClick={handleRunReport}
            style={{
              padding: "0.85rem",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "white",
              fontWeight: "600",
              cursor: "pointer",
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
                borderRadius: "10px",
                background: "#f8fafc",
              }}
            >
              <strong>Sales Count</strong>
              <div>{rangeReport?.total_sales_count ?? "—"}</div>
            </div>
            <div
              style={{
                padding: "1rem",
                borderRadius: "10px",
                background: "#f8fafc",
              }}
            >
              <strong>Total Revenue</strong>
              <div>Rs. {rangeReport?.total_revenue ?? "—"}</div>
            </div>
            <div
              style={{
                padding: "1rem",
                borderRadius: "10px",
                background: "#f8fafc",
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
          padding: "1rem",
          borderRadius: "12px",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          gridColumn: "1 / -1",
        }}
      >
        <h2>Low Stock Alerts</h2>
        {error ? <p style={{ color: "#d00" }}>{error}</p> : null}
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
                  borderRadius: "10px",
                  background: "#fff7ed",
                  border: "1px solid #fb923c",
                  color: "#b45309",
                }}
              >
                {item.name}: {item.quantity_in_stock} left (threshold: {item.low_stock_threshold})
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
