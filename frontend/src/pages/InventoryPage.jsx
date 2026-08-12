import { useState, useEffect } from "react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getStockHistory,
  adjustStock,
} from "../api/client";
import { colors, fonts, styles } from "../theme";

function createEmptyProductForm() {
  return {
    name: "",
    barcode: "",
    unit_type: "piece",
    cost_price: "",
    selling_price: "",
    quantity_in_stock: "",
    low_stock_threshold: "5",
  };
}

function toInputValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState(() => createEmptyProductForm());
  const [editingProductId, setEditingProductId] = useState(null);
  const [editValues, setEditValues] = useState(() => createEmptyProductForm());
  const [historyModalProductId, setHistoryModalProductId] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [adjustModalProductId, setAdjustModalProductId] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("restock");

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const data = await getProducts();
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Failed to load products");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
  }

  function handleNewProductChange(event) {
    const { name, value } = event.target;
    setNewProduct((current) => ({ ...current, [name]: value }));
  }

  function handleEditChange(event) {
    const { name, value } = event.target;
    setEditValues((current) => ({ ...current, [name]: value }));
  }

  async function handleAddProduct(event) {
    event.preventDefault();
    clearMessages();

    const payload = {
      name: newProduct.name.trim(),
      barcode: newProduct.barcode.trim() || null,
      unit_type: newProduct.unit_type,
      cost_price: Number(newProduct.cost_price),
      selling_price: Number(newProduct.selling_price),
      quantity_in_stock:
        newProduct.unit_type === "weight"
          ? Math.round(Number(newProduct.quantity_in_stock) * 1000)
          : Number(newProduct.quantity_in_stock),
      low_stock_threshold:
        newProduct.unit_type === "weight"
          ? Math.round(Number(newProduct.low_stock_threshold) * 1000)
          : Number(newProduct.low_stock_threshold),
    };

    if (
      Number.isNaN(payload.cost_price) ||
      Number.isNaN(payload.selling_price) ||
      Number.isNaN(payload.quantity_in_stock) ||
      Number.isNaN(payload.low_stock_threshold)
    ) {
      setError("Please enter valid numeric values.");
      return;
    }

    try {
      const createdProduct = await createProduct(payload);
      setProducts((current) => [createdProduct, ...current]);
      setNewProduct(createEmptyProductForm());
      setShowAddForm(false);
      setSuccessMessage("Product created successfully.");
    } catch (err) {
      setError(err.message || "Failed to create product");
    }
  }

  function startEditing(product) {
    clearMessages();
    setEditingProductId(product.id);
    setEditValues({
      ...createEmptyProductForm(),
      name: product.name || "",
      barcode: product.barcode || "",
      unit_type: product.unit_type || "piece",
      cost_price: toInputValue(product.cost_price),
      selling_price: toInputValue(product.selling_price),
      quantity_in_stock: toInputValue(
        product.unit_type === "weight" ? product.quantity_in_stock / 1000 : product.quantity_in_stock
      ),
      low_stock_threshold: toInputValue(
        product.unit_type === "weight" ? product.low_stock_threshold / 1000 : product.low_stock_threshold
      ),
    });
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    clearMessages();

    const payload = {
      name: editValues.name.trim(),
      barcode: editValues.barcode.trim() || null,
      unit_type: editValues.unit_type,
      cost_price: Number(editValues.cost_price),
      selling_price: Number(editValues.selling_price),
      quantity_in_stock:
        editValues.unit_type === "weight"
          ? Math.round(Number(editValues.quantity_in_stock) * 1000)
          : Number(editValues.quantity_in_stock),
      low_stock_threshold:
        editValues.unit_type === "weight"
          ? Math.round(Number(editValues.low_stock_threshold) * 1000)
          : Number(editValues.low_stock_threshold),
    };

    if (
      Number.isNaN(payload.cost_price) ||
      Number.isNaN(payload.selling_price) ||
      Number.isNaN(payload.quantity_in_stock) ||
      Number.isNaN(payload.low_stock_threshold)
    ) {
      setError("Please enter valid numeric values.");
      return;
    }

    try {
      const updatedProduct = await updateProduct(editingProductId, payload);
      setProducts((current) =>
        current.map((product) =>
          product.id === editingProductId ? { ...product, ...updatedProduct } : product
        )
      );
      setEditingProductId(null);
      setEditValues(createEmptyProductForm());
      setSuccessMessage("Product updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update product");
    }
  }

  function cancelEditing() {
    setEditingProductId(null);
    setEditValues(createEmptyProductForm());
  }

  async function handleDelete(product) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${product.name}?`
    );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {
      await deleteProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setSuccessMessage("Product deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete product");
    }
  }

  function startAdjusting(product) {
    clearMessages();
    setAdjustModalProductId(product.id);
    setAdjustAmount("");
    setAdjustReason("restock");
  }

  async function handleAdjustSubmit(event) {
    event.preventDefault();
    clearMessages();

    const changeAmount = Number(adjustAmount);
    if (Number.isNaN(changeAmount)) {
      setError("Please enter a valid stock adjustment.");
      return;
    }

    try {
      const updatedProduct = await adjustStock(adjustModalProductId, changeAmount, adjustReason);
      setProducts((current) =>
        current.map((product) =>
          product.id === adjustModalProductId
            ? { ...product, quantity_in_stock: updatedProduct?.quantity_in_stock ?? product.quantity_in_stock }
            : product
        )
      );
      setAdjustModalProductId(null);
      setAdjustAmount("");
      setAdjustReason("restock");
      setSuccessMessage("Stock adjusted successfully.");
    } catch (err) {
      setError(err.message || "Failed to adjust stock");
    }
  }

  async function openHistory(productId) {
    clearMessages();
    setHistoryModalProductId(productId);
    setHistoryItems([]);

    try {
      const data = await getStockHistory(productId);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load stock history");
    }
  }

  function closeHistory() {
    setHistoryModalProductId(null);
    setHistoryItems([]);
  }

  return (
    <section
      style={{
        ...styles.card,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ ...styles.pageTitle, fontSize: "1.4rem", margin: 0 }}>Inventory</h2>
        <button
          type="button"
          onClick={() => {
            clearMessages();
            setShowAddForm((current) => !current);
            if (showAddForm) {
              setNewProduct(createEmptyProductForm());
            }
          }}
          style={{
            ...styles.buttonPrimary,
          }}
        >
          {showAddForm ? "Cancel" : "Add Product"}
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        {error ? <p style={{ color: colors.danger, margin: 0 }}>{error}</p> : null}
        {successMessage ? <p style={{ color: colors.primary, margin: 0 }}>{successMessage}</p> : null}
      </div>

      {showAddForm ? (
        <form
          onSubmit={handleAddProduct}
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
                value={newProduct.name}
                onChange={handleNewProductChange}
                required
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              Barcode
              <input
                name="barcode"
                value={newProduct.barcode}
                onChange={handleNewProductChange}
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              Unit Type
              <select
                name="unit_type"
                value={newProduct.unit_type}
                onChange={handleNewProductChange}
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              >
                <option value="piece">Piece</option>
                <option value="weight">Weight (grams)</option>
              </select>
            </label>
            <label style={styles.label}>
              {newProduct.unit_type === "weight" ? "Cost Price (per kg)" : "Cost Price"}
              <input
                name="cost_price"
                type="number"
                step="0.01"
                value={newProduct.cost_price}
                onChange={handleNewProductChange}
                required
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              {newProduct.unit_type === "weight" ? "Selling Price (per kg)" : "Selling Price"}
              <input
                name="selling_price"
                type="number"
                step="0.01"
                value={newProduct.selling_price}
                onChange={handleNewProductChange}
                required
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              {newProduct.unit_type === "weight" ? "Quantity in Stock (kg)" : "Quantity in Stock"}
              <input
                name="quantity_in_stock"
                type="number"
                value={newProduct.quantity_in_stock}
                onChange={handleNewProductChange}
                required
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              {newProduct.unit_type === "weight" ? "Low Stock Threshold (kg)" : "Low Stock Threshold"}
              <input
                name="low_stock_threshold"
                type="number"
                value={newProduct.low_stock_threshold}
                onChange={handleNewProductChange}
                required
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
          </div>
          <button type="submit" style={styles.buttonPrimary}>
            Save Product
          </button>
        </form>
      ) : null}

      {loading ? (
        <p>Loading products...</p>
      ) : products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                <th style={styles.tableHeaderCell}>Name</th>
                <th style={styles.tableHeaderCell}>Barcode</th>
                <th style={styles.tableHeaderCell}>Type</th>
                <th style={styles.tableHeaderCell}>Cost</th>
                <th style={styles.tableHeaderCell}>Selling</th>
                <th style={styles.tableHeaderCell}>Qty</th>
                <th style={styles.tableHeaderCell}>Low Stock</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  {editingProductId === product.id ? (
                    <>
                      <td style={styles.tableCell}>
                        <input
                          name="name"
                          value={editValues.name}
                          onChange={handleEditChange}
                          style={styles.input}
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <input
                          name="barcode"
                          value={editValues.barcode}
                          onChange={handleEditChange}
                          style={styles.input}
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <select
                          name="unit_type"
                          value={editValues.unit_type}
                          onChange={handleEditChange}
                          style={styles.input}
                        >
                          <option value="piece">Piece</option>
                          <option value="weight">Weight (grams)</option>
                        </select>
                      </td>
                      <td style={styles.tableCell}>
                        <label style={{ ...styles.label, display: "block", fontSize: "0.9rem" }}>
                          {editValues.unit_type === "weight" ? "Cost Price (per kg)" : "Cost Price"}
                        </label>
                        <input
                          name="cost_price"
                          type="number"
                          step="0.01"
                          value={editValues.cost_price}
                          onChange={handleEditChange}
                          style={styles.input}
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <label style={{ ...styles.label, display: "block", fontSize: "0.9rem" }}>
                          {editValues.unit_type === "weight" ? "Selling Price (per kg)" : "Selling Price"}
                        </label>
                        <input
                          name="selling_price"
                          type="number"
                          step="0.01"
                          value={editValues.selling_price}
                          onChange={handleEditChange}
                          style={styles.input}
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <label style={{ ...styles.label, display: "block", fontSize: "0.9rem" }}>
                          {editValues.unit_type === "weight" ? "Qty (kg)" : "Qty"}
                        </label>
                        <input
                          name="quantity_in_stock"
                          type="number"
                          value={editValues.quantity_in_stock}
                          onChange={handleEditChange}
                          style={styles.input}
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <label style={{ ...styles.label, display: "block", fontSize: "0.9rem" }}>
                          {editValues.unit_type === "weight" ? "Low Stock Threshold (kg)" : "Low Stock Threshold"}
                        </label>
                        <input
                          name="low_stock_threshold"
                          type="number"
                          value={editValues.low_stock_threshold}
                          onChange={handleEditChange}
                          style={styles.input}
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button type="button" onClick={handleSaveEdit} style={styles.buttonPrimary}>
                            Save
                          </button>
                          <button type="button" onClick={cancelEditing} style={styles.buttonSecondary}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={styles.tableCell}>{product.name}</td>
                      <td style={styles.tableCell}>{product.barcode || "—"}</td>
                      <td style={styles.tableCell}>{product.unit_type === "weight" ? "Weight (g)" : "Piece"}</td>
                      <td style={styles.tableCell}>{product.cost_price}</td>
                      <td style={styles.tableCell}>{product.selling_price}</td>
                      <td style={styles.tableCell}>
                        {product.unit_type === "weight"
                          ? (product.quantity_in_stock / 1000).toFixed(2)
                          : product.quantity_in_stock}
                      </td>
                      <td style={styles.tableCell}>
                        {product.unit_type === "weight"
                          ? (product.low_stock_threshold / 1000).toFixed(2)
                          : product.low_stock_threshold}
                      </td>
                      <td style={styles.tableCell}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button type="button" onClick={() => startEditing(product)} style={styles.buttonSecondary}>
                            Edit
                          </button>
                          <button type="button" onClick={() => startAdjusting(product)} style={styles.buttonSecondary}>
                            Adjust Stock
                          </button>
                          <button type="button" onClick={() => openHistory(product.id)} style={styles.buttonSecondary}>
                            History
                          </button>
                          <button type="button" onClick={() => handleDelete(product)} style={styles.buttonDanger}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjustModalProductId !== null ? (
        <div
          style={{
            marginTop: "1rem",
            ...styles.card,
          }}
        >
          <h3 style={{ ...styles.pageTitle, marginTop: 0 }}>Adjust Stock</h3>
          <form onSubmit={handleAdjustSubmit} style={{ display: "grid", gap: "0.75rem" }}>
            <label style={styles.label}>
              Amount
              <input
                type="number"
                value={adjustAmount}
                onChange={(event) => setAdjustAmount(event.target.value)}
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              Reason
              <select
                value={adjustReason}
                onChange={(event) => setAdjustReason(event.target.value)}
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              >
                <option value="restock">Restock</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="correction">Correction</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" style={styles.buttonPrimary}>
                Submit
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustModalProductId(null);
                  setAdjustAmount("");
                  setAdjustReason("restock");
                }}
                style={styles.buttonSecondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {historyModalProductId !== null ? (
        <div
          style={{
            marginTop: "1rem",
            ...styles.card,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ ...styles.pageTitle, marginTop: 0 }}>Stock History</h3>
            <button type="button" onClick={closeHistory} style={styles.buttonSecondary}>
              Close
            </button>
          </div>
          {historyItems.length === 0 ? (
            <p>No history available.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                    <th style={styles.tableHeaderCell}>Change</th>
                    <th style={styles.tableHeaderCell}>Reason</th>
                    <th style={styles.tableHeaderCell}>User</th>
                    <th style={styles.tableHeaderCell}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item, index) => (
                    <tr key={`${item.created_at}-${index}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={styles.tableCell}>{item.change_amount}</td>
                      <td style={styles.tableCell}>{item.reason || "—"}</td>
                      <td style={styles.tableCell}>{item.user_name || "—"}</td>
                      <td style={styles.tableCell}>{item.created_at || "—"}</td>
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
