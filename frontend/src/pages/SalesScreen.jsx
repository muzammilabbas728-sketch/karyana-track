import { useState, useEffect } from "react";
import { getProducts, createSale } from "../api/client";

export default function SalesScreen() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError(null);

      try {
        const data = await getProducts();
        setProducts(data);
      } catch (err) {
        setError(err.message || "Failed to load products");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleAddToCart(product) {
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.product_id === product.id);
      if (existing) {
        return currentCart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...currentCart,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.selling_price,
          quantity: 1,
        },
      ];
    });
  }

  function handleUpdateQuantity(productId, delta) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function handleRemoveFromCart(productId) {
    setCart((currentCart) => currentCart.filter((item) => item.product_id !== productId));
  }

  const grandTotal = cart.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  async function handleCompleteSale() {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const items = cart.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));

    try {
      const response = await createSale(items);
      setSuccessMessage(`Sale completed! Total: Rs. ${response.total_amount}`);
      setCart([]);

      const refreshedProducts = await getProducts();
      setProducts(refreshedProducts);
    } catch (err) {
      setError(err.message || "Failed to complete sale");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        alignItems: "flex-start",
      }}
    >
      <section
        style={{
          flex: 2,
          padding: "1rem",
          borderRadius: "12px",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h2>Products</h2>
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search products"
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        {loading ? (
          <p>Loading products...</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.85rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                }}
              >
                <div>
                  <strong>{product.name}</strong>
                  <div style={{ color: "#6b7280" }}>Rs. {product.selling_price}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddToCart(product)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#2563eb",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Add to Cart
                </button>
              </div>
            ))}
            {!loading && filteredProducts.length === 0 ? (
              <p>No matching products found.</p>
            ) : null}
          </div>
        )}
      </section>

      <section
        style={{
          flex: 1,
          padding: "1rem",
          borderRadius: "12px",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          minWidth: "320px",
        }}
      >
        <h2>Cart</h2>

        {error ? (
          <p style={{ color: "#d00" }}>{error}</p>
        ) : null}
        {successMessage ? (
          <p style={{ color: "#166534" }}>{successMessage}</p>
        ) : null}

        {cart.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {cart.map((item) => (
              <div
                key={item.product_id}
                style={{
                  padding: "0.85rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <strong>{item.name}</strong>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromCart(item.product_id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#dc2626",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.product_id, -1)}
                      style={{
                        padding: "0.35rem 0.6rem",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        background: "#f9fafb",
                        cursor: "pointer",
                        marginRight: "0.5rem",
                      }}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.product_id, 1)}
                      style={{
                        padding: "0.35rem 0.6rem",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        background: "#f9fafb",
                        cursor: "pointer",
                        marginLeft: "0.5rem",
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div>
                    Rs. {item.unit_price} x {item.quantity} = Rs. {item.unit_price * item.quantity}
                  </div>
                </div>
              </div>
            ))}

            <div
              style={{
                padding: "0.85rem",
                borderRadius: "10px",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
              }}
            >
              <strong>Grand Total:</strong>
              <div>Rs. {grandTotal}</div>
            </div>

            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={cart.length === 0 || submitting}
              style={{
                width: "100%",
                padding: "0.85rem",
                borderRadius: "8px",
                border: "none",
                backgroundColor: cart.length === 0 || submitting ? "#94a3b8" : "#16a34a",
                color: "white",
                fontWeight: "600",
                cursor: cart.length === 0 || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Completing sale..." : "Complete Sale"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
