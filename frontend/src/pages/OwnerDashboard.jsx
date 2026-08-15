import { useState, useEffect } from "react";
import html2pdf from "html2pdf.js";
import {
  getDailyReport,
  getRangeReport,
  getRangeReportByProduct,
  getLowStock,
  getProducts,
  createProduct,
  getPurchases,
  createPurchase,
  updatePurchase,
  cancelPurchase,
  getSuppliers,
  createSupplier,
  getSupplierHistory,
  createSupplierPayment,
} from "../api/client";
import { colors, fonts, styles } from "../theme";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

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

function calculateUnitAwareInvestment(prods) {
  if (!Array.isArray(prods)) return 0;
  return prods.reduce((sum, p) => {
    const cost = Number(p.cost_price) || 0;
    const qty = Number(p.quantity_in_stock) || 0;
    const unitType = p.unit_type;
    const unitsPerPack = Number(p.units_per_pack) || 1;

    let itemInv = 0;
    if (unitType === "piece") {
      itemInv = cost * qty;
    } else if (unitType === "weight") {
      itemInv = cost * (qty / 1000);
    } else if (unitType === "pack") {
      itemInv = cost * (unitsPerPack > 0 ? qty / unitsPerPack : qty);
    } else {
      itemInv = cost * qty;
    }
    return sum + itemInv;
  }, 0);
}

export default function OwnerDashboard() {
  const [dailyReport, setDailyReport] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [fromDate, setFromDate] = useState(
    formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  );
  const [toDate, setToDate] = useState(formatDate(new Date()));
  const [rangeReport, setRangeReport] = useState(null);
  const [productBreakdown, setProductBreakdown] = useState([]);
  
  // Inventory Purchase & Total Investment state
  const [totalInventoryInvestment, setTotalInventoryInvestment] = useState(0);
  const [purchases, setPurchases] = useState([]);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [amountPaidNow, setAmountPaidNow] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchaseItems, setPurchaseItems] = useState([
    { product_id: "", quantity: 1, cost_price: "" },
  ]);
  const [purchaseSuccess, setPurchaseSuccess] = useState(null);

  // Supplier Khata state
  const [suppliers, setSuppliers] = useState([]);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [paymentSupplierId, setPaymentSupplierId] = useState(null);
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState("");
  const [historySupplierId, setHistorySupplierId] = useState(null);
  const [supplierHistoryItems, setSupplierHistoryItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [daily, low, pData, prodsData, suppsData] = await Promise.all([
        getDailyReport(),
        getLowStock(),
        getPurchases(),
        getProducts(),
        getSuppliers(),
      ]);
      setDailyReport(daily);
      setLowStock(low);
      const loadedProds = Array.isArray(prodsData) ? prodsData : [];
      setProducts(loadedProds);
      setSuppliers(Array.isArray(suppsData) ? suppsData : []);

      if (pData) {
        const pInv = Number(pData.total_investment) || 0;
        const prodInv = calculateUnitAwareInvestment(loadedProds);
        setTotalInventoryInvestment(pInv > 0 ? pInv : prodInv);
        setPurchases(Array.isArray(pData.purchases) ? pData.purchases : []);
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleRunReport() {
    setError(null);

    try {
      const [report, breakdown] = await Promise.all([
        getRangeReport(fromDate, toDate),
        getRangeReportByProduct(fromDate, toDate),
      ]);
      setRangeReport(report);
      setProductBreakdown(Array.isArray(breakdown) ? breakdown : []);
    } catch (err) {
      setError(err.message || "Failed to load range report");
    }
  }

  function handleAddItemRow() {
    setPurchaseItems((prev) => [
      ...prev,
      {
        product_id: "",
        quantity: 1,
        cost_price: "",
        new_name: "",
        unit_type: "piece",
        selling_price: "",
        low_stock_threshold: "10",
        units_per_pack: "1",
      },
    ]);
  }

  function handleRemoveItemRow(index) {
    if (purchaseItems.length <= 1) return;
    setPurchaseItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleItemChange(index, field, value) {
    setPurchaseItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "product_id" && value && value !== "__NEW__") {
          const selectedProd = products.find((p) => String(p.id) === String(value));
          if (selectedProd && !item.cost_price) {
            updated.cost_price = selectedProd.cost_price;
          }
        } else if (field === "product_id" && value === "__NEW__") {
          if (!updated.unit_type) updated.unit_type = "piece";
          if (updated.low_stock_threshold === undefined || updated.low_stock_threshold === "") {
            updated.low_stock_threshold = "10";
          }
          if (!updated.units_per_pack) updated.units_per_pack = "1";
        }
        return updated;
      })
    );
  }

  async function handleCreatePurchaseSubmit(event) {
    event.preventDefault();
    setError(null);
    setPurchaseSuccess(null);

    for (let i = 0; i < purchaseItems.length; i++) {
      const item = purchaseItems[i];
      if (!item.product_id) {
        setError(`Please select a product or '+ Add New Product' for item #${i + 1}.`);
        return;
      }

      const qty = Number(item.quantity);
      const cost = Number(item.cost_price);
      if (Number.isNaN(qty) || qty <= 0 || Number.isNaN(cost) || cost < 0) {
        setError(`Please enter a valid quantity and unit cost for item #${i + 1}.`);
        return;
      }

      if (item.product_id === "__NEW__") {
        if (!item.new_name || !item.new_name.trim()) {
          setError(`Please enter a Product Name for the new product in item #${i + 1}.`);
          return;
        }
        const sellPrice = Number(item.selling_price);
        if (Number.isNaN(sellPrice) || sellPrice < 0) {
          setError(`Please enter a valid Selling Price for the new product in item #${i + 1}.`);
          return;
        }
        const threshold = Number(item.low_stock_threshold);
        if (Number.isNaN(threshold) || threshold < 0) {
          setError(`Please enter a valid Low Stock Threshold for item #${i + 1}.`);
          return;
        }
        if (item.unit_type === "pack") {
          const uPack = Number(item.units_per_pack);
          if (Number.isNaN(uPack) || uPack <= 0) {
            setError(`Please enter valid Units Per Pack for item #${i + 1}.`);
            return;
          }
        }
      }
    }

    try {
      const finalPurchaseItems = [];

      for (const item of purchaseItems) {
        let targetProductId = item.product_id;
        let isNewProduct = false;

        if (item.product_id === "__NEW__") {
          isNewProduct = true;
          const uType = item.unit_type || "piece";
          const rawQty = Number(item.quantity);
          const rawThreshold = Number(
            item.low_stock_threshold !== undefined && item.low_stock_threshold !== ""
              ? item.low_stock_threshold
              : 10
          );
          const unitsPerPack = uType === "pack" ? Number(item.units_per_pack || 1) : null;

          let convertedQty = rawQty;
          let convertedThreshold = rawThreshold;

          if (uType === "weight") {
            convertedQty = Math.round(rawQty * 1000);
            convertedThreshold = Math.round(rawThreshold * 1000);
          } else if (uType === "pack") {
            convertedQty = Math.round(rawQty * (unitsPerPack || 1));
          }

          const newProductPayload = {
            name: item.new_name.trim(),
            barcode: null,
            unit_type: uType,
            units_per_pack: unitsPerPack,
            cost_price: Number(item.cost_price),
            selling_price: Number(item.selling_price),
            quantity_in_stock: convertedQty,
            low_stock_threshold: convertedThreshold,
          };

          const createdProduct = await createProduct(newProductPayload);
          targetProductId = createdProduct.id;
        }

        finalPurchaseItems.push({
          product_id: Number(targetProductId),
          quantity: Number(item.quantity),
          cost_price: Number(item.cost_price),
          is_new_product: isNewProduct,
          skip_stock_increment: isNewProduct,
        });
      }

      const totalCost = finalPurchaseItems.reduce((sum, item) => sum + item.quantity * item.cost_price, 0);

      let amountPaid = 0;
      if (paymentStatus === "paid") {
        amountPaid = totalCost;
      } else if (paymentStatus === "partial") {
        amountPaid = Number(amountPaidNow);
        if (Number.isNaN(amountPaid) || amountPaid <= 0 || amountPaid >= totalCost) {
          setError("For partial payments, amount paid now must be greater than 0 and less than total purchase cost.");
          return;
        }
      }

      console.log("[PURCHASE SUBMIT] finalPurchaseItems:", finalPurchaseItems);

      if (editingPurchaseId) {
        await updatePurchase(editingPurchaseId, {
          supplier_id: supplierId ? Number(supplierId) : null,
          supplier_name: supplierName.trim() || null,
          payment_status: paymentStatus,
          amount_paid: amountPaid,
          notes: purchaseNotes.trim() || null,
          items: finalPurchaseItems,
        });
        setPurchaseSuccess(`Purchase #${editingPurchaseId} updated successfully.`);
        setEditingPurchaseId(null);
      } else {
        await createPurchase({
          supplier_id: supplierId ? Number(supplierId) : null,
          supplier_name: supplierName.trim() || null,
          payment_status: paymentStatus,
          amount_paid: amountPaid,
          notes: purchaseNotes.trim() || null,
          items: finalPurchaseItems,
        });
        setPurchaseSuccess("Inventory purchase recorded successfully.");
      }

      setSupplierId("");
      setSupplierName("");
      setPaymentStatus("paid");
      setAmountPaidNow("");
      setPurchaseNotes("");
      setPurchaseItems([
        {
          product_id: "",
          quantity: 1,
          cost_price: "",
          new_name: "",
          unit_type: "piece",
          selling_price: "",
          low_stock_threshold: "10",
          units_per_pack: "1",
        },
      ]);
      setShowAddPurchase(false);

      const [pData, suppsData, prodsData] = await Promise.all([
        getPurchases(),
        getSuppliers(),
        getProducts(),
      ]);
      setProducts(Array.isArray(prodsData) ? prodsData : []);
      if (pData) {
        setTotalInventoryInvestment(Number(pData.total_investment) || 0);
        setPurchases(Array.isArray(pData.purchases) ? pData.purchases : []);
      }
      setSuppliers(Array.isArray(suppsData) ? suppsData : []);
    } catch (err) {
      setError(err.message || "Failed to record or update purchase");
    }
  }

  function handleStartEditPurchase(pur) {
    setError(null);
    setPurchaseSuccess(null);
    setEditingPurchaseId(pur.id);
    setSupplierId(pur.supplier_id ? String(pur.supplier_id) : "");
    setSupplierName(pur.supplier_name || "");
    setPaymentStatus(pur.payment_status || "paid");
    setAmountPaidNow(pur.payment_status === "partial" ? String(pur.amount_paid || "") : "");
    setPurchaseNotes(pur.notes || "");
    setPurchaseItems(
      Array.isArray(pur.items) && pur.items.length > 0
        ? pur.items.map((i) => ({
            product_id: String(i.product_id),
            quantity: i.quantity,
            cost_price: i.cost_price,
            new_name: "",
            unit_type: "piece",
            selling_price: "",
            low_stock_threshold: "10",
            units_per_pack: "1",
          }))
        : [
            {
              product_id: "",
              quantity: 1,
              cost_price: "",
              new_name: "",
              unit_type: "piece",
              selling_price: "",
              low_stock_threshold: "10",
              units_per_pack: "1",
            },
          ]
    );
    setShowAddPurchase(true);
  }

  async function handleCancelPurchase(purchaseId) {
    const confirmed = window.confirm(
      "Cancel this purchase? Stock levels will be reverted and this purchase cost will be removed from Total Investment."
    );
    if (!confirmed) return;

    setError(null);
    setPurchaseSuccess(null);

    try {
      await cancelPurchase(purchaseId);
      setPurchaseSuccess(`Purchase #${purchaseId} cancelled.`);
      const [pData, suppsData] = await Promise.all([getPurchases(), getSuppliers()]);
      if (pData) {
        setTotalInventoryInvestment(Number(pData.total_investment) || 0);
        setPurchases(Array.isArray(pData.purchases) ? pData.purchases : []);
      }
      setSuppliers(Array.isArray(suppsData) ? suppsData : []);
    } catch (err) {
      setError(err.message || "Failed to cancel purchase");
    }
  }

  async function handleAddSupplier(event) {
    event.preventDefault();
    setError(null);
    setPurchaseSuccess(null);

    const nameClean = newSupplierName.trim();
    if (!nameClean) {
      setError("Please enter a supplier name.");
      return;
    }

    try {
      await createSupplier({
        name: nameClean,
        phone: newSupplierPhone.trim() || null,
      });
      setNewSupplierName("");
      setNewSupplierPhone("");
      setShowAddSupplier(false);
      setPurchaseSuccess("Supplier added successfully.");
      const suppsData = await getSuppliers();
      setSuppliers(Array.isArray(suppsData) ? suppsData : []);
    } catch (err) {
      setError(err.message || "Failed to add supplier");
    }
  }

  async function handleSupplierPaymentSubmit(event) {
    event.preventDefault();
    setError(null);
    setPurchaseSuccess(null);

    const amt = Number(supplierPaymentAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    try {
      await createSupplierPayment(paymentSupplierId, amt);
      setPaymentSupplierId(null);
      setSupplierPaymentAmount("");
      setPurchaseSuccess("Supplier payment recorded successfully.");
      const suppsData = await getSuppliers();
      setSuppliers(Array.isArray(suppsData) ? suppsData : []);
    } catch (err) {
      setError(err.message || "Failed to record supplier payment");
    }
  }

  async function openSupplierHistory(suppId) {
    setError(null);
    setHistorySupplierId(suppId);
    setSupplierHistoryItems([]);

    try {
      const historyData = await getSupplierHistory(suppId);
      setSupplierHistoryItems(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      setError(err.message || "Failed to load supplier history");
    }
  }

  function closeSupplierHistory() {
    setHistorySupplierId(null);
    setSupplierHistoryItems([]);
  }

  const selectedPaymentSupplier = suppliers.find((s) => s.id === paymentSupplierId);
  const selectedHistorySupplier = suppliers.find((s) => s.id === historySupplierId);

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
              <strong>Total Investment (Inventory Purchased)</strong>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "0.25rem" }}>
                Rs. {totalInventoryInvestment.toFixed(2)}
              </div>
            </div>
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

        {productBreakdown.length > 0 ? (
          <div style={{ marginTop: "1rem", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                  <th style={styles.tableHeaderCell}>Product</th>
                  <th style={styles.tableHeaderCell}>Qty Sold</th>
                  <th style={styles.tableHeaderCell}>Revenue</th>
                  <th style={styles.tableHeaderCell}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {productBreakdown.map((item, index) => (
                  <tr key={`${item.product_name}-${index}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={styles.tableCell}>{item.product_name}</td>
                    <td style={styles.tableCell}>{item.total_quantity}</td>
                    <td style={styles.tableCell}>Rs. {item.total_revenue}</td>
                    <td style={styles.tableCell}>Rs. {item.total_profit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Supplier Khata Summary */}
      <section
        style={{
          ...styles.card,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          gridColumn: "1 / -1",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ ...styles.pageTitle, fontSize: "1.3rem", margin: 0 }}>Suppliers & Khata Summary</h2>
          <button
            type="button"
            onClick={() => setShowAddSupplier((curr) => !curr)}
            style={styles.buttonPrimary}
          >
            {showAddSupplier ? "Cancel" : "+ Add Supplier"}
          </button>
        </div>

        {showAddSupplier ? (
          <form
            onSubmit={handleAddSupplier}
            style={{
              display: "grid",
              gap: "0.75rem",
              marginBottom: "1.25rem",
              ...styles.card,
            }}
          >
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <label style={styles.label}>
                Supplier Name
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="e.g. Metro Wholesale"
                  style={{ ...styles.input, marginTop: "0.35rem" }}
                />
              </label>
              <label style={styles.label}>
                Phone (optional)
                <input
                  type="text"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="e.g. 03001234567"
                  style={{ ...styles.input, marginTop: "0.35rem" }}
                />
              </label>
            </div>
            <div>
              <button type="submit" style={styles.buttonPrimary}>
                Save Supplier Profile
              </button>
            </div>
          </form>
        ) : null}

        {suppliers.length === 0 ? (
          <p style={{ color: colors.muted }}>No supplier records found.</p>
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
                {suppliers.map((supp) => {
                  const owes = supp.balance_owed > 0;
                  return (
                    <tr key={supp.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={styles.tableCell}><strong>{supp.name}</strong></td>
                      <td style={styles.tableCell}>{supp.phone || "—"}</td>
                      <td style={styles.tableCell}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: owes ? colors.danger : colors.muted,
                          }}
                        >
                          Rs. {Number(supp.balance_owed).toFixed(2)}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => openSupplierHistory(supp.id)}
                            style={styles.buttonSecondary}
                          >
                            History
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setPaymentSupplierId(supp.id);
                              setSupplierPaymentAmount("");
                            }}
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
              Record Payment to {selectedPaymentSupplier ? selectedPaymentSupplier.name : "Supplier"}
            </h3>
            <form onSubmit={handleSupplierPaymentSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "300px" }}>
              <label style={styles.label}>
                Payment Amount (Rs.)
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={supplierPaymentAmount}
                  onChange={(e) => setSupplierPaymentAmount(e.target.value)}
                  style={{ ...styles.input, marginTop: "0.35rem" }}
                />
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" style={styles.buttonPrimary}>
                  Save Payment
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSupplierId(null)}
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
                Supplier Statement: {selectedHistorySupplier ? selectedHistorySupplier.name : ""}
              </h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedHistorySupplier) return;
                    try {
                      const totalPurchases = supplierHistoryItems
                        .filter((i) => i.type === "purchase")
                        .reduce((sum, i) => sum + Number(i.total_cost || 0), 0);

                      const totalPaid = supplierHistoryItems
                        .filter((i) => i.type === "payment")
                        .reduce((sum, i) => sum + Number(i.amount || 0), 0) +
                        supplierHistoryItems
                          .filter((i) => i.type === "purchase")
                          .reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);

                      const remainingOwed = Number(selectedHistorySupplier.balance_owed || 0);
                      const reportDate = new Date().toLocaleString();

                      const container = document.createElement("div");
                      container.style.padding = "24px";
                      container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                      container.style.color = "#1C1917";
                      container.style.backgroundColor = "#FFFFFF";

                      const rowsHtml = supplierHistoryItems
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
                      setPurchaseSuccess(`Supplier statement PDF downloaded: Supplier_Statement_${safeName}.pdf`);
                    } catch (err) {
                      setError(err.message || "Failed to download PDF statement");
                    }
                  }}
                  style={styles.buttonPrimary}
                >
                  Download Statement PDF
                </button>
                <button type="button" onClick={closeSupplierHistory} style={styles.buttonSecondary}>
                  Close
                </button>
              </div>
            </div>
            {supplierHistoryItems.length === 0 ? (
              <p style={{ color: colors.muted }}>No purchase or payment history found.</p>
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
                    {supplierHistoryItems.map((item, index) => {
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
                                (Paid: Rs. {item.amount_paid})
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

      {/* Inventory Purchases Section */}
      <section
        style={{
          ...styles.card,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          gridColumn: "1 / -1",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ ...styles.pageTitle, fontSize: "1.3rem", margin: 0 }}>
            {editingPurchaseId ? `Edit Purchase #${editingPurchaseId}` : "Inventory Purchases & Total Investment"}
          </h2>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPurchaseSuccess(null);
              if (showAddPurchase) {
                setShowAddPurchase(false);
                setEditingPurchaseId(null);
                setSupplierId("");
                setSupplierName("");
                setPaymentStatus("paid");
                setAmountPaidNow("");
                setPurchaseNotes("");
                setPurchaseItems([{ product_id: "", quantity: 1, cost_price: "" }]);
              } else {
                setShowAddPurchase(true);
              }
            }}
            style={styles.buttonPrimary}
          >
            {showAddPurchase ? "Cancel" : "Record Purchase"}
          </button>
        </div>

        {purchaseSuccess ? (
          <p style={{ color: colors.primary, marginBottom: "1rem" }}>{purchaseSuccess}</p>
        ) : null}

        {showAddPurchase ? (
          <form
            onSubmit={handleCreatePurchaseSubmit}
            style={{
              display: "grid",
              gap: "1rem",
              marginBottom: "1.5rem",
              ...styles.card,
            }}
          >
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <label style={styles.label}>
                Select Existing Supplier (optional)
                <select
                  value={supplierId}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    if (e.target.value) {
                      const sel = suppliers.find((s) => String(s.id) === String(e.target.value));
                      if (sel) setSupplierName(sel.name);
                    }
                  }}
                  style={{ ...styles.input, marginTop: "0.35rem" }}
                >
                  <option value="">-- Or enter new supplier below --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Owed: Rs. {s.balance_owed.toFixed(2)})
                    </option>
                  ))}
                </select>
              </label>
              <label style={styles.label}>
                Supplier Name
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => {
                    setSupplierName(e.target.value);
                    setSupplierId("");
                  }}
                  placeholder="e.g. Metro Wholesale"
                  style={{ ...styles.input, marginTop: "0.35rem" }}
                />
              </label>
              <label style={styles.label}>
                Payment Status
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  style={{ ...styles.input, marginTop: "0.35rem" }}
                >
                  <option value="paid">Paid in Full</option>
                  <option value="partial">Partial Payment</option>
                  <option value="credit">Pay Later (Credit / Khata)</option>
                </select>
              </label>
              {paymentStatus === "partial" ? (
                <label style={styles.label}>
                  Amount Paid Now (Rs.)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amountPaidNow}
                    onChange={(e) => setAmountPaidNow(e.target.value)}
                    placeholder="e.g. 500"
                    style={{ ...styles.input, marginTop: "0.35rem" }}
                  />
                </label>
              ) : null}
              <label style={styles.label}>
                Notes / Reference (optional)
                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  placeholder="e.g. Invoice #1024"
                  style={{ ...styles.input, marginTop: "0.35rem" }}
                />
              </label>
            </div>

            <div style={{ marginTop: "0.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontFamily: fonts.body }}>Purchased Products</h4>
              {purchaseItems.map((item, idx) => {
                const isNewProduct = item.product_id === "__NEW__";
                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gap: "0.5rem",
                      marginBottom: "0.75rem",
                      padding: isNewProduct ? "0.75rem" : "0",
                      backgroundColor: isNewProduct ? colors.bg : "transparent",
                      borderRadius: isNewProduct ? "8px" : "0",
                      border: isNewProduct ? `1px dashed ${colors.primary}` : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr auto",
                        gap: "0.5rem",
                        alignItems: "center",
                      }}
                    >
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(idx, "product_id", e.target.value)}
                        required
                        style={{
                          ...styles.input,
                          fontWeight: isNewProduct ? 600 : "normal",
                          color: isNewProduct ? colors.primary : colors.ink,
                        }}
                      >
                        <option value="">-- Select Product --</option>
                        <option value="__NEW__" style={{ fontWeight: 600, color: colors.primary }}>
                          + Add New Product
                        </option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Current Cost: Rs. {p.cost_price})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        placeholder={
                          item.unit_type === "weight"
                            ? "Qty (kg)"
                            : item.unit_type === "pack"
                            ? "Qty (packs)"
                            : "Qty"
                        }
                        style={styles.input}
                      />

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={item.cost_price}
                        onChange={(e) => handleItemChange(idx, "cost_price", e.target.value)}
                        placeholder={
                          item.unit_type === "weight"
                            ? "Cost / kg (Rs.)"
                            : item.unit_type === "pack"
                            ? "Cost / pack (Rs.)"
                            : "Unit Cost (Rs.)"
                        }
                        style={styles.input}
                      />

                      {purchaseItems.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          style={{ ...styles.buttonDanger, padding: "0.5rem 0.75rem" }}
                        >
                          ✕
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>

                    {isNewProduct ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                          gap: "0.5rem",
                          marginTop: "0.25rem",
                          paddingTop: "0.5rem",
                          borderTop: `1px solid ${colors.border}`,
                        }}
                      >
                        <label style={{ ...styles.label, fontSize: "0.8rem" }}>
                          Product Name *
                          <input
                            type="text"
                            required
                            value={item.new_name || ""}
                            onChange={(e) => handleItemChange(idx, "new_name", e.target.value)}
                            placeholder="e.g. Basmati Rice 5kg"
                            style={{ ...styles.input, marginTop: "0.2rem", padding: "0.35rem 0.5rem" }}
                          />
                        </label>

                        <label style={{ ...styles.label, fontSize: "0.8rem" }}>
                          Unit Type *
                          <select
                            value={item.unit_type || "piece"}
                            onChange={(e) => handleItemChange(idx, "unit_type", e.target.value)}
                            style={{ ...styles.input, marginTop: "0.2rem", padding: "0.35rem 0.5rem" }}
                          >
                            <option value="piece">Piece / Item</option>
                            <option value="weight">Weight (kg)</option>
                            <option value="pack">Pack / Box</option>
                          </select>
                        </label>

                        <label style={{ ...styles.label, fontSize: "0.8rem" }}>
                          Selling Price (Rs.) *
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={item.selling_price || ""}
                            onChange={(e) => handleItemChange(idx, "selling_price", e.target.value)}
                            placeholder="e.g. 250"
                            style={{ ...styles.input, marginTop: "0.2rem", padding: "0.35rem 0.5rem" }}
                          />
                        </label>

                        <label style={{ ...styles.label, fontSize: "0.8rem" }}>
                          Low Stock Alert *
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={item.low_stock_threshold !== undefined ? item.low_stock_threshold : "10"}
                            onChange={(e) => handleItemChange(idx, "low_stock_threshold", e.target.value)}
                            placeholder={item.unit_type === "weight" ? "in kg (e.g. 5)" : "e.g. 10"}
                            style={{ ...styles.input, marginTop: "0.2rem", padding: "0.35rem 0.5rem" }}
                          />
                        </label>

                        {item.unit_type === "pack" ? (
                          <label style={{ ...styles.label, fontSize: "0.8rem" }}>
                            Units Per Pack *
                            <input
                              type="number"
                              min="1"
                              required
                              value={item.units_per_pack || "1"}
                              onChange={(e) => handleItemChange(idx, "units_per_pack", e.target.value)}
                              placeholder="e.g. 12"
                              style={{ ...styles.input, marginTop: "0.2rem", padding: "0.35rem 0.5rem" }}
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleAddItemRow}
                style={{ ...styles.buttonSecondary, marginTop: "0.25rem", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
              >
                + Add Another Product
              </button>
            </div>

            <div>
              <button type="submit" style={styles.buttonPrimary}>
                {editingPurchaseId ? "Update Purchase & Stock" : "Save Purchase & Update Stock"}
              </button>
            </div>
          </form>
        ) : null}

        {purchases.length === 0 ? (
          <p style={{ color: colors.muted }}>No inventory purchase records found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                  <th style={styles.tableHeaderCell}>Date</th>
                  <th style={styles.tableHeaderCell}>Supplier</th>
                  <th style={styles.tableHeaderCell}>Items</th>
                  <th style={styles.tableHeaderCell}>Total Cost</th>
                  <th style={styles.tableHeaderCell}>Payment Status</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th style={styles.tableHeaderCell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((pur) => {
                  const isCancelled = pur.status === "cancelled";
                  return (
                    <tr key={pur.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={styles.tableCell}>{formatDateTime(pur.created_at)}</td>
                      <td style={styles.tableCell}>{pur.supplier_name || "—"}</td>
                      <td style={styles.tableCell}>
                        {pur.items && pur.items.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: "0.85rem" }}>
                            {pur.items.map((i, idx) => (
                              <li key={idx}>
                                {i.product_name} — {i.quantity} x Rs. {i.cost_price} = Rs. {i.total_cost}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ ...styles.tableCell, fontWeight: 600, color: isCancelled ? colors.muted : colors.primary }}>
                        Rs. {Number(pur.total_cost).toFixed(2)}
                      </td>
                      <td style={styles.tableCell}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: pur.payment_status === "paid" ? colors.primary : colors.warning,
                            textTransform: "capitalize",
                          }}
                        >
                          {pur.payment_status}
                        </span>
                        {pur.payment_status === "partial" ? (
                          <div style={{ fontSize: "0.75rem", color: colors.muted }}>
                            Paid: Rs. {pur.amount_paid}
                          </div>
                        ) : null}
                      </td>
                      <td style={styles.tableCell}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: isCancelled ? colors.danger : colors.primary,
                            textTransform: "capitalize",
                          }}
                        >
                          {pur.status}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        {!isCancelled ? (
                          <button
                            type="button"
                            onClick={() => handleCancelPurchase(pur.id)}
                            style={{ ...styles.buttonDanger, padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}
                          >
                            Cancel Purchase
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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



