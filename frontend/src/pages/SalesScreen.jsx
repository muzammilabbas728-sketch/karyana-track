import { useState, useEffect } from "react";
import { getProducts, createSale } from "../api/client";
import { colors, fonts, styles } from "../theme";

export default function SalesScreen() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [weightEntryProductId, setWeightEntryProductId] = useState(null);
  const [weightEntryAmount, setWeightEntryAmount] = useState("");
  const [weightEntryUnit, setWeightEntryUnit] = useState("g");

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
          unit_type: product.unit_type,
        },
      ];
    });
  }

  function handleAddWeightToCart(product, grams) {
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.product_id === product.id);
      if (existing) {
        return currentCart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + grams }
            : item
        );
      }
      return [
        ...currentCart,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.selling_price / 1000,
          quantity: grams,
          unit_type: product.unit_type,
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
          ...styles.card,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h2 style={{ ...styles.pageTitle, fontSize: "1.4rem", marginBottom: "1rem" }}>Products</h2>
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search products"
            style={{
              ...styles.input,
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
                  border: `1px solid ${colors.border}`,
                  borderRadius: "10px",
                }}
              >
                <div>
                  <strong>{product.name}</strong>
                  <div style={{ color: colors.muted }}>Rs. {product.selling_price}</div>
                </div>
                {weightEntryProductId === product.id ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      alignItems: "flex-end",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="number"
                        value={weightEntryAmount}
                        onChange={(event) => setWeightEntryAmount(event.target.value)}
                        placeholder="Amount"
                        style={{
                          width: "90px",
                          ...styles.input,
                        }}
                      />
                      <select
                        value={weightEntryUnit}
                        onChange={(event) => setWeightEntryUnit(event.target.value)}
                        style={{
                          ...styles.input,
                          width: "auto",
                        }}
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const amount = Number(weightEntryAmount);
                          const grams = weightEntryUnit === "kg" ? Math.round(amount * 1000) : Math.round(amount);

                          if (Number.isNaN(grams) || grams <= 0) {
                            setError("Enter a valid amount");
                            return;
                          }

                          handleAddWeightToCart(product, grams);
                          setWeightEntryProductId(null);
                          setWeightEntryAmount("");
                          setWeightEntryUnit("g");
                          setError(null);
                        }}
                        style={{
                          ...styles.buttonPrimary,
                          padding: "0.5rem 0.75rem",
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWeightEntryProductId(null);
                          setWeightEntryAmount("");
                          setWeightEntryUnit("g");
                          setError(null);
                        }}
                        style={{
                          ...styles.buttonSecondary,
                          padding: "0.5rem 0.75rem",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (product.unit_type === "piece") {
                        handleAddToCart(product);
                        return;
                      }

                      setWeightEntryProductId(product.id);
                      setWeightEntryAmount("");
                      setWeightEntryUnit("g");
                    }}
                    style={{
                      ...styles.buttonPrimary,
                      padding: "0.5rem 0.75rem",
                    }}
                  >
                    Add to Cart
                  </button>
                )}
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
          ...styles.card,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          minWidth: "320px",
        }}
      >
        <h2 style={{ ...styles.pageTitle, fontSize: "1.4rem", marginBottom: "1rem" }}>Cart</h2>

        {error ? (
          <p style={{ color: colors.danger }}>{error}</p>
        ) : null}
        {successMessage ? (
          <p style={{ color: colors.primary }}>{successMessage}</p>
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
                  border: `1px solid ${colors.border}`,
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
                      color: colors.danger,
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
                      onClick={() => handleUpdateQuantity(item.product_id, item.unit_type === "weight" ? -50 : -1)}
                      style={{
                        ...styles.buttonSecondary,
                        padding: "0.35rem 0.6rem",
                        marginRight: "0.5rem",
                      }}
                    >
                      -
                    </button>
                    <span>
                      {item.unit_type === "weight"
                        ? item.quantity >= 1000
                          ? `${(item.quantity / 1000).toFixed(2)} kg`
                          : `${item.quantity} g`
                        : item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.product_id, item.unit_type === "weight" ? 50 : 1)}
                      style={{
                        ...styles.buttonSecondary,
                        padding: "0.35rem 0.6rem",
                        marginLeft: "0.5rem",
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div>
                    {item.unit_type === "weight" ? (
                      <span>
                        Rs. {(item.unit_price * 1000).toFixed(2)}/kg — Total: Rs. {(item.unit_price * item.quantity).toFixed(2)}
                      </span>
                    ) : (
                      <span>
                        Rs. {item.unit_price} x {item.quantity} = Rs. {item.unit_price * item.quantity}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div
              style={{
                padding: "0.85rem",
                ...styles.cardAccent(colors.primary),
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
                ...styles.buttonPrimary,
                width: "100%",
                backgroundColor: cart.length === 0 || submitting ? colors.muted : colors.primary,
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
