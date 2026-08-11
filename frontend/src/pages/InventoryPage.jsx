import { useState, useEffect } from "react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getStockHistory,
  adjustStock,
} from "../api/client";

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
        padding: "1rem",
        borderRadius: "12px",
        background: "#fff",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Inventory</h2>
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
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#2563eb",
            color: "white",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          {showAddForm ? "Cancel" : "Add Product"}
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        {error ? <p style={{ color: "#dc2626", margin: 0 }}>{error}</p> : null}
        {successMessage ? <p style={{ color: "#15803d", margin: 0 }}>{successMessage}</p> : null}
      </div>

      {showAddForm ? (
        <form
          onSubmit={handleAddProduct}
          style={{
            display: "grid",
            gap: "0.75rem",
            marginBottom: "1rem",
            padding: "1rem",
            borderRadius: "10px",
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label>
              Name
              <input
                name="name"
                value={newProduct.name}
                onChange={handleNewProductChange}
                required
                style={inputStyle}
              />
            </label>
            <label>
              Barcode
              <input
                name="barcode"
                value={newProduct.barcode}
                onChange={handleNewProductChange}
                style={inputStyle}
              />
            </label>
            <label>
              Unit Type
              <select
                name="unit_type"
                value={newProduct.unit_type}
                onChange={handleNewProductChange}
                style={inputStyle}
              >
                <option value="piece">Piece</option>
                <option value="weight">Weight (grams)</option>
              </select>
            </label>
            <label>
              {newProduct.unit_type === "weight" ? "Cost Price (per kg)" : "Cost Price"}
              <input
                name="cost_price"
                type="number"
                step="0.01"
                value={newProduct.cost_price}
                onChange={handleNewProductChange}
                required
                style={inputStyle}
              />
            </label>
            <label>
              {newProduct.unit_type === "weight" ? "Selling Price (per kg)" : "Selling Price"}
              <input
                name="selling_price"
                type="number"
                step="0.01"
                value={newProduct.selling_price}
                onChange={handleNewProductChange}
                required
                style={inputStyle}
              />
            </label>
            <label>
              {newProduct.unit_type === "weight" ? "Quantity in Stock (kg)" : "Quantity in Stock"}
              <input
                name="quantity_in_stock"
                type="number"
                value={newProduct.quantity_in_stock}
                onChange={handleNewProductChange}
                required
                style={inputStyle}
              />
            </label>
            <label>
              {newProduct.unit_type === "weight" ? "Low Stock Threshold (kg)" : "Low Stock Threshold"}
              <input
                name="low_stock_threshold"
                type="number"
                value={newProduct.low_stock_threshold}
                onChange={handleNewProductChange}
                required
                style={inputStyle}
              />
            </label>
          </div>
          <button type="submit" style={buttonStyle}>
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
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={cellStyle}>Name</th>
                <th style={cellStyle}>Barcode</th>
                <th style={cellStyle}>Type</th>
                <th style={cellStyle}>Cost</th>
                <th style={cellStyle}>Selling</th>
                <th style={cellStyle}>Qty</th>
                <th style={cellStyle}>Low Stock</th>
                <th style={cellStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {editingProductId === product.id ? (
                    <>
                      <td style={cellStyle}>
                        <input
                          name="name"
                          value={editValues.name}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          name="barcode"
                          value={editValues.barcode}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <select
                          name="unit_type"
                          value={editValues.unit_type}
                          onChange={handleEditChange}
                          style={inputStyle}
                        >
                          <option value="piece">Piece</option>
                          <option value="weight">Weight (grams)</option>
                        </select>
                      </td>
                      <td style={cellStyle}>
                        <label style={{ display: "block", fontSize: "0.9rem" }}>
                          {editValues.unit_type === "weight" ? "Cost Price (per kg)" : "Cost Price"}
                        </label>
                        <input
                          name="cost_price"
                          type="number"
                          step="0.01"
                          value={editValues.cost_price}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <label style={{ display: "block", fontSize: "0.9rem" }}>
                          {editValues.unit_type === "weight" ? "Selling Price (per kg)" : "Selling Price"}
                        </label>
                        <input
                          name="selling_price"
                          type="number"
                          step="0.01"
                          value={editValues.selling_price}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <label style={{ display: "block", fontSize: "0.9rem" }}>
                          {editValues.unit_type === "weight" ? "Qty (kg)" : "Qty"}
                        </label>
                        <input
                          name="quantity_in_stock"
                          type="number"
                          value={editValues.quantity_in_stock}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <label style={{ display: "block", fontSize: "0.9rem" }}>
                          {editValues.unit_type === "weight" ? "Low Stock Threshold (kg)" : "Low Stock Threshold"}
                        </label>
                        <input
                          name="low_stock_threshold"
                          type="number"
                          value={editValues.low_stock_threshold}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button type="button" onClick={handleSaveEdit} style={buttonStyle}>
                            Save
                          </button>
                          <button type="button" onClick={cancelEditing} style={secondaryButtonStyle}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={cellStyle}>{product.name}</td>
                      <td style={cellStyle}>{product.barcode || "—"}</td>
                      <td style={cellStyle}>{product.unit_type === "weight" ? "Weight (g)" : "Piece"}</td>
                      <td style={cellStyle}>{product.cost_price}</td>
                      <td style={cellStyle}>{product.selling_price}</td>
                      <td style={cellStyle}>
                        {product.unit_type === "weight"
                          ? (product.quantity_in_stock / 1000).toFixed(2)
                          : product.quantity_in_stock}
                      </td>
                      <td style={cellStyle}>
                        {product.unit_type === "weight"
                          ? (product.low_stock_threshold / 1000).toFixed(2)
                          : product.low_stock_threshold}
                      </td>
                      <td style={cellStyle}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button type="button" onClick={() => startEditing(product)} style={secondaryButtonStyle}>
                            Edit
                          </button>
                          <button type="button" onClick={() => startAdjusting(product)} style={secondaryButtonStyle}>
                            Adjust Stock
                          </button>
                          <button type="button" onClick={() => openHistory(product.id)} style={secondaryButtonStyle}>
                            History
                          </button>
                          <button type="button" onClick={() => handleDelete(product)} style={dangerButtonStyle}>
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
            padding: "1rem",
            borderRadius: "10px",
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Adjust Stock</h3>
          <form onSubmit={handleAdjustSubmit} style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Amount
              <input
                type="number"
                value={adjustAmount}
                onChange={(event) => setAdjustAmount(event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              Reason
              <select
                value={adjustReason}
                onChange={(event) => setAdjustReason(event.target.value)}
                style={inputStyle}
              >
                <option value="restock">Restock</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="correction">Correction</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" style={buttonStyle}>
                Submit
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustModalProductId(null);
                  setAdjustAmount("");
                  setAdjustReason("restock");
                }}
                style={secondaryButtonStyle}
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
            padding: "1rem",
            borderRadius: "10px",
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Stock History</h3>
            <button type="button" onClick={closeHistory} style={secondaryButtonStyle}>
              Close
            </button>
          </div>
          {historyItems.length === 0 ? (
            <p>No history available.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={cellStyle}>Change</th>
                    <th style={cellStyle}>Reason</th>
                    <th style={cellStyle}>User</th>
                    <th style={cellStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item, index) => (
                    <tr key={`${item.created_at}-${index}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={cellStyle}>{item.change_amount}</td>
                      <td style={cellStyle}>{item.reason || "—"}</td>
                      <td style={cellStyle}>{item.user_name || "—"}</td>
                      <td style={cellStyle}>{item.created_at || "—"}</td>
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

const inputStyle = {
  width: "100%",
  padding: "0.7rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  marginTop: "0.35rem",
};

const buttonStyle = {
  padding: "0.7rem 0.9rem",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "#2563eb",
  color: "white",
  fontWeight: "600",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "0.7rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  backgroundColor: "#fff",
  color: "#1f2937",
  fontWeight: "600",
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "0.7rem 0.9rem",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "#dc2626",
  color: "white",
  fontWeight: "600",
  cursor: "pointer",
};

const cellStyle = {
  padding: "0.75rem 0.5rem",
  verticalAlign: "top",
};
