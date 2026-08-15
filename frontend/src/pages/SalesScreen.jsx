import { useState, useEffect } from "react";
import {
  getProducts,
  createSale,
  getCustomers,
  createCustomer,
} from "../api/client";
import { colors, fonts, styles } from "../theme";

export default function SalesScreen() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [weightEntryProductId, setWeightEntryProductId] = useState(null);
  const [weightEntryAmount, setWeightEntryAmount] = useState("");
  const [weightEntryUnit, setWeightEntryUnit] = useState("g");
  const [packEntryProductId, setPackEntryProductId] = useState(null);
  const [packEntryMode, setPackEntryMode] = useState("pack");
  const [packEntryAmount, setPackEntryAmount] = useState("1");
  const [pieceEntryProductId, setPieceEntryProductId] = useState(null);
  const [pieceEntryAmount, setPieceEntryAmount] = useState("1");
  const [paymentMode, setPaymentMode] = useState("paid");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [lastReceipt, setLastReceipt] = useState(null);
  const [showReceiptPanel, setShowReceiptPanel] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [productsData, customersData] = await Promise.all([
          getProducts(),
          getCustomers(),
        ]);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
      } catch (err) {
        setError(err.message || "Failed to load initial data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleAddToCart(product, quantity = 1) {
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.product_id === product.id);
      if (existing) {
        return currentCart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...currentCart,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.selling_price,
          quantity: quantity,
          unit_type: product.unit_type,
          sell_as_pack: false,
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
          sell_as_pack: false,
        },
      ];
    });
  }

  function handleAddPackToCart(product, quantity, sellAsPack) {
    setCart((currentCart) => {
      const existingIndex = currentCart.findIndex(
        (item) =>
          item.product_id === product.id &&
          Boolean(item.sell_as_pack) === Boolean(sellAsPack)
      );

      if (existingIndex !== -1) {
        return currentCart.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      const unit_price = sellAsPack
        ? product.selling_price
        : product.selling_price / product.units_per_pack;

      return [
        ...currentCart,
        {
          product_id: product.id,
          name: product.name,
          unit_price: unit_price,
          quantity: quantity,
          unit_type: product.unit_type,
          sell_as_pack: sellAsPack,
        },
      ];
    });
  }

  function handleUpdateQuantity(targetItem, delta) {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          const isMatch =
            item.product_id === targetItem.product_id &&
            Boolean(item.sell_as_pack) === Boolean(targetItem.sell_as_pack);
          return isMatch
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item;
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function handleRemoveFromCart(targetItem) {
    setCart((currentCart) =>
      currentCart.filter(
        (item) =>
          !(
            item.product_id === targetItem.product_id &&
            Boolean(item.sell_as_pack) === Boolean(targetItem.sell_as_pack)
          )
      )
    );
  }

  async function handleQuickAddCustomer(event) {
    event.preventDefault();
    if (!newCustomerName.trim()) {
      setError("Please enter a customer name");
      return;
    }

    try {
      const created = await createCustomer({ name: newCustomerName.trim() });
      setCustomers((current) => [...current, created]);
      setSelectedCustomerId(created.id);
      setNewCustomerName("");
      setShowNewCustomerForm(false);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to add customer");
    }
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
      sell_as_pack: item.sell_as_pack ?? false,
    }));

    const customerId = paymentMode === "credit" ? selectedCustomerId : null;

    try {
      const response = await createSale(items, customerId, paymentMode);
      const custObj = paymentMode === "credit" ? customers.find((c) => c.id === customerId) : null;

      setLastReceipt({
        id: response.id,
        created_at: response.created_at || new Date().toISOString(),
        total_amount: response.total_amount,
        payment_status: paymentMode,
        customer_name: custObj ? custObj.name : null,
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit_type: item.unit_type,
          sell_as_pack: item.sell_as_pack,
          line_total: item.unit_price * item.quantity,
        })),
      });
      setShowReceiptPanel(false);

      setSuccessMessage(`Sale completed! Total: Rs. ${response.total_amount}`);
      setCart([]);
      setPaymentMode("paid");
      setSelectedCustomerId(null);
      setShowNewCustomerForm(false);
      setNewCustomerName("");
      setShowCalculator(false);
      setAmountReceived("");

      const [refreshedProducts, refreshedCustomers] = await Promise.all([
        getProducts(),
        getCustomers(),
      ]);
      setProducts(Array.isArray(refreshedProducts) ? refreshedProducts : []);
      setCustomers(Array.isArray(refreshedCustomers) ? refreshedCustomers : []);
    } catch (err) {
      setError(err.message || "Failed to complete sale");
    } finally {
      setSubmitting(false);
    }
  }

  const isCompleteDisabled =
    cart.length === 0 ||
    submitting ||
    (paymentMode === "credit" && !selectedCustomerId);

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
                  <div style={{ color: colors.muted }}>
                    Rs. {product.selling_price}
                    {product.unit_type === "pack" && product.units_per_pack
                      ? ` (${product.units_per_pack} units/pack)`
                      : ""}
                  </div>
                </div>

                {pieceEntryProductId === product.id ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      alignItems: "flex-end",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <label style={{ fontSize: "0.8rem", color: colors.muted }}>
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={pieceEntryAmount}
                        onChange={(event) => setPieceEntryAmount(event.target.value)}
                        style={{
                          width: "90px",
                          ...styles.input,
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const quantity = Number(pieceEntryAmount);
                          if (Number.isNaN(quantity) || quantity <= 0) {
                            setError("Enter a valid amount");
                            return;
                          }

                          handleAddToCart(product, quantity);
                          setPieceEntryProductId(null);
                          setPieceEntryAmount("1");
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
                          setPieceEntryProductId(null);
                          setPieceEntryAmount("1");
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
                ) : packEntryProductId === product.id ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      alignItems: "flex-end",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.85rem" }}>
                      <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <input
                          type="radio"
                          name={`pack_mode_${product.id}`}
                          value="pack"
                          checked={packEntryMode === "pack"}
                          onChange={() => setPackEntryMode("pack")}
                        />
                        Sell as pack
                      </label>
                      <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <input
                          type="radio"
                          name={`pack_mode_${product.id}`}
                          value="loose"
                          checked={packEntryMode === "loose"}
                          onChange={() => setPackEntryMode("loose")}
                        />
                        Sell loose units
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <label style={{ fontSize: "0.8rem", color: colors.muted }}>
                        {packEntryMode === "pack" ? "Number of packs" : "Number of units"}
                      </label>
                      <input
                        type="number"
                        value={packEntryAmount}
                        onChange={(event) => setPackEntryAmount(event.target.value)}
                        style={{
                          width: "90px",
                          ...styles.input,
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const quantity = Number(packEntryAmount);
                          if (Number.isNaN(quantity) || quantity <= 0) {
                            setError("Enter a valid amount");
                            return;
                          }

                          handleAddPackToCart(product, quantity, packEntryMode === "pack");
                          setPackEntryProductId(null);
                          setPackEntryMode("pack");
                          setPackEntryAmount("1");
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
                          setPackEntryProductId(null);
                          setPackEntryMode("pack");
                          setPackEntryAmount("1");
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
                ) : weightEntryProductId === product.id ? (
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
                        setPieceEntryProductId(product.id);
                        setPieceEntryAmount("1");
                        setError(null);
                        return;
                      }

                      if (product.unit_type === "pack") {
                        setPackEntryProductId(product.id);
                        setPackEntryMode("pack");
                        setPackEntryAmount("1");
                        setError(null);
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
          <p style={{ color: colors.primary, marginBottom: lastReceipt ? "0.5rem" : "1rem" }}>{successMessage}</p>
        ) : null}

        {lastReceipt ? (
          <div style={{ marginBottom: "1rem" }}>
            <button
              type="button"
              onClick={() => setShowReceiptPanel((prev) => !prev)}
              style={{
                ...styles.buttonSecondary,
                padding: "0.4rem 0.75rem",
                fontSize: "0.85rem",
              }}
            >
              {showReceiptPanel ? "Hide Receipt" : "View Receipt"}
            </button>

            {showReceiptPanel ? (
              <div
                style={{
                  ...styles.card,
                  marginTop: "0.75rem",
                  padding: "1rem",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "10px",
                  backgroundColor: colors.card,
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                    borderBottom: `1px solid ${colors.border}`,
                    paddingBottom: "0.5rem",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontFamily: fonts.body }}>Receipt / Invoice</h3>
                    <span style={{ fontSize: "0.8rem", color: colors.muted }}>
                      Sale #{lastReceipt.id} • {new Date(lastReceipt.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span
                    style={{
                      fontWeight: 600,
                      color: lastReceipt.payment_status === "credit" ? colors.warning : colors.primary,
                      textTransform: "capitalize",
                      fontSize: "0.85rem",
                    }}
                  >
                    {lastReceipt.payment_status === "credit"
                      ? `Credit (${lastReceipt.customer_name || "Customer"})`
                      : "Cash"}
                  </span>
                </div>

                <div style={{ display: "grid", gap: "0.4rem", marginBottom: "0.75rem" }}>
                  {lastReceipt.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.85rem",
                        padding: "0.25rem 0",
                        borderBottom: `1px dashed ${colors.border}`,
                      }}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <div style={{ fontSize: "0.75rem", color: colors.muted }}>
                          {item.unit_type === "weight"
                            ? item.quantity >= 1000
                              ? `${(item.quantity / 1000).toFixed(2)} kg x Rs. ${(item.unit_price * 1000).toFixed(2)}/kg`
                              : `${item.quantity} g x Rs. ${(item.unit_price * 1000).toFixed(2)}/kg`
                            : item.unit_type === "pack"
                              ? item.sell_as_pack
                                ? `${item.quantity} pack(s) x Rs. ${item.unit_price}`
                                : `${item.quantity} loose unit(s) x Rs. ${item.unit_price.toFixed(2)}`
                              : `${item.quantity} x Rs. ${item.unit_price}`}
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, alignSelf: "center" }}>
                        Rs. {Number(item.line_total).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: colors.primary,
                    borderTop: `2px solid ${colors.border}`,
                    paddingTop: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span>Grand Total:</span>
                  <span>Rs. {Number(lastReceipt.total_amount).toFixed(2)}</span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      ...styles.buttonPrimary,
                      padding: "0.35rem 0.75rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReceiptPanel(false)}
                    style={{
                      ...styles.buttonSecondary,
                      padding: "0.35rem 0.75rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {cart.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {cart.map((item) => (
              <div
                key={`${item.product_id}-${item.sell_as_pack ? "pack" : "loose"}`}
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
                    onClick={() => handleRemoveFromCart(item)}
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
                      onClick={() => handleUpdateQuantity(item, item.unit_type === "weight" ? -50 : -1)}
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
                        : item.unit_type === "pack"
                          ? item.sell_as_pack
                            ? `${item.quantity} pack(s)`
                            : `${item.quantity} loose unit(s)`
                          : item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item, item.unit_type === "weight" ? 50 : 1)}
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
                        Rs. {Number(item.unit_price.toFixed(2))} x {item.quantity} = Rs. {Number((item.unit_price * item.quantity).toFixed(2))}
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
              <div>Rs. {Number(grandTotal.toFixed(2))}</div>
            </div>

            <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.5rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.muted }}>
                  Payment Mode:
                </span>
                <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.9rem" }}>
                  <input
                    type="radio"
                    name="paymentMode"
                    value="paid"
                    checked={paymentMode === "paid"}
                    onChange={() => {
                      setPaymentMode("paid");
                      setSelectedCustomerId(null);
                      setShowNewCustomerForm(false);
                    }}
                  />
                  Cash
                </label>
                <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.9rem" }}>
                  <input
                    type="radio"
                    name="paymentMode"
                    value="credit"
                    checked={paymentMode === "credit"}
                    onChange={() => setPaymentMode("credit")}
                  />
                  Credit
                </label>
              </div>

              {paymentMode === "credit" ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      value={selectedCustomerId || ""}
                      onChange={(event) =>
                        setSelectedCustomerId(event.target.value ? Number(event.target.value) : null)
                      }
                      style={{
                        ...styles.input,
                        flex: 1,
                      }}
                    >
                      <option value="">Select a customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} (Balance: Rs. {customer.balance})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCustomerForm((current) => !current)}
                      style={{
                        ...styles.buttonSecondary,
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.85rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {showNewCustomerForm ? "Cancel" : "+ New Customer"}
                    </button>
                  </div>

                  {showNewCustomerForm ? (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Customer Name"
                        value={newCustomerName}
                        onChange={(event) => setNewCustomerName(event.target.value)}
                        style={{
                          ...styles.input,
                          flex: 1,
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddCustomer}
                        style={{
                          ...styles.buttonPrimary,
                          padding: "0.4rem 0.75rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  if (showCalculator) {
                    setAmountReceived("");
                    setShowCalculator(false);
                  } else {
                    setShowCalculator(true);
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.primary,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: 0,
                  marginBottom: showCalculator ? "0.4rem" : "0",
                  display: "inline-block",
                }}
              >
                {showCalculator ? "− Hide Change Calculator" : "+ Calculate Change"}
              </button>

              {showCalculator ? (
                <div
                  style={{
                    display: "grid",
                    gap: "0.5rem",
                    padding: "0.6rem 0.75rem",
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                  }}
                >
                  <label style={{ ...styles.label, fontSize: "0.8rem", margin: 0 }}>
                    Amount Received (Rs.)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder="e.g. 500"
                      style={{ ...styles.input, marginTop: "0.25rem", padding: "0.35rem 0.5rem" }}
                    />
                  </label>

                  {amountReceived.trim() !== "" && !Number.isNaN(Number(amountReceived)) && Number(amountReceived) >= 0 ? (
                    <div style={{ fontSize: "0.85rem" }}>
                      {Number(amountReceived) >= grandTotal ? (
                        <span style={{ color: colors.primary, fontWeight: 600 }}>
                          Change to give: Rs. {(Number(amountReceived) - grandTotal).toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: colors.danger, fontWeight: 600 }}>
                          Change to give: Rs. 0.00 (Rs. {(grandTotal - Number(amountReceived)).toFixed(2)} short)
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={isCompleteDisabled}
              style={{
                ...styles.buttonPrimary,
                width: "100%",
                backgroundColor: isCompleteDisabled ? colors.muted : colors.primary,
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
