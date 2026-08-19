import { useState, useEffect } from "react";
import {
  getCashSummary,
  getCashTransactions,
  createCashTransaction,
  voidCashTransaction,
  getBankLoans,
  createBankLoan,
  voidBankLoan,
  getBankLoanRepayments,
  createBankLoanRepayment,
  voidBankLoanRepayment,
} from "../api/client";
import { colors, fonts, styles } from "../theme";

const TRANSACTION_TYPES = [
  { value: "owner_investment", label: "Owner Investment (Capital)", direction: "in", color: "#10b981" },
  { value: "other_income", label: "Other Income", direction: "in", color: "#06b6d4" },
  { value: "loan_repayment", label: "Loan Repayment (Received from Person)", direction: "in", color: "#8b5cf6" },
  { value: "owner_withdrawal", label: "Owner Withdrawal (Personal)", direction: "out", color: "#f59e0b" },
  { value: "other_expense", label: "Other Business Expense", direction: "out", color: "#ef4444" },
  { value: "loan_given", label: "Loan Given (To Person)", direction: "out", color: "#ec4899" },
];

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
  return Number.isNaN(date.getTime()) ? String(dateStr) : date.toLocaleDateString();
}

export default function CashManagementPage() {
  const [activeTab, setActiveTab] = useState("cash-flow"); // "cash-flow" | "bank-loans"
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [bankLoansData, setBankLoansData] = useState(null);
  const [selectedLoanHistory, setSelectedLoanHistory] = useState(null);
  const [loanRepayments, setLoanRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters for Cash Movements
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // New Cash Transaction Form State
  const [showAddTxForm, setShowAddTxForm] = useState(false);
  const [txType, setTxType] = useState("owner_investment");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txDate, setTxDate] = useState(formatDate(new Date()));

  // Bank Loan Form State
  const [showAddLoanForm, setShowAddLoanForm] = useState(false);
  const [bankName, setBankName] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [disbursalDate, setDisbursalDate] = useState(formatDate(new Date()));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [loanDescription, setLoanDescription] = useState("");

  // Repayment Form State
  const [showRepayForm, setShowRepayForm] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [repayDate, setRepayDate] = useState(formatDate(new Date()));
  const [principalAmount, setPrincipalAmount] = useState("");
  const [interestAmount, setInterestAmount] = useState("");
  const [repayDescription, setRepayDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Breakdown visibility
  const [showInBreakdown, setShowInBreakdown] = useState(false);
  const [showOutBreakdown, setShowOutBreakdown] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [sumData, txData, blData] = await Promise.all([
        getCashSummary(),
        getCashTransactions({
          type: typeFilter || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        }),
        getBankLoans(),
      ]);
      setSummary(sumData);
      setTransactions(Array.isArray(txData) ? txData : []);
      setBankLoansData(blData);

      if (selectedLoanHistory) {
        const reps = await getBankLoanRepayments(selectedLoanHistory.id);
        setLoanRepayments(Array.isArray(reps) ? reps : []);
      }
    } catch (err) {
      setError(err.message || "Failed to load cash management data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [typeFilter, fromDate, toDate]);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
  }

  // 1. Create Cash Movement
  async function handleCreateTxSubmit(event) {
    event.preventDefault();
    clearMessages();

    const numAmount = Number(txAmount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    setSubmitting(true);
    try {
      await createCashTransaction({
        type: txType,
        amount: numAmount,
        description: txDescription.trim() || null,
        date: txDate || formatDate(new Date()),
      });

      setSuccessMessage("Cash transaction recorded successfully.");
      setTxAmount("");
      setTxDescription("");
      setTxDate(formatDate(new Date()));
      setShowAddTxForm(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to record cash transaction");
    } finally {
      setSubmitting(false);
    }
  }

  // 2. Void Cash Movement
  async function handleVoidTx(txId) {
    const confirmed = window.confirm(
      "Are you sure you want to void this cash transaction? It will be removed from the active cash balance."
    );
    if (!confirmed) return;

    clearMessages();
    try {
      await voidCashTransaction(txId);
      setSuccessMessage(`Transaction #${txId} voided successfully.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to void transaction");
    }
  }

  // 3. Create Bank Loan
  async function handleCreateLoanSubmit(event) {
    event.preventDefault();
    clearMessages();

    const numAmount = Number(loanAmount);
    if (!bankName.trim()) {
      setError("Please enter the bank or financial institution name.");
      return;
    }
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid loan amount.");
      return;
    }

    setSubmitting(true);
    try {
      await createBankLoan({
        bank_name: bankName.trim(),
        loan_amount: numAmount,
        disbursal_date: disbursalDate || formatDate(new Date()),
        reference_number: referenceNumber.trim() || null,
        description: loanDescription.trim() || null,
      });

      setSuccessMessage(`Bank loan of Rs. ${numAmount.toFixed(2)} from ${bankName} recorded successfully.`);
      setBankName("");
      setLoanAmount("");
      setReferenceNumber("");
      setLoanDescription("");
      setDisbursalDate(formatDate(new Date()));
      setShowAddLoanForm(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to record bank loan");
    } finally {
      setSubmitting(false);
    }
  }

  // 4. Void Bank Loan
  async function handleVoidLoan(loanId) {
    const confirmed = window.confirm(
      "Are you sure you want to void this bank loan? It will reverse the cash-in flow and remove the outstanding loan balance."
    );
    if (!confirmed) return;

    clearMessages();
    try {
      await voidBankLoan(loanId);
      setSuccessMessage(`Bank Loan #${loanId} voided successfully.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to void bank loan");
    }
  }

  // 5. Create Repayment
  async function handleCreateRepaySubmit(event) {
    event.preventDefault();
    clearMessages();

    if (!selectedLoanId) {
      setError("Please select a bank loan to repay.");
      return;
    }

    const pAmt = Number(principalAmount || 0);
    const iAmt = Number(interestAmount || 0);

    if (pAmt <= 0 && iAmt <= 0) {
      setError("Please enter either a principal amount or interest amount to repay.");
      return;
    }

    setSubmitting(true);
    try {
      await createBankLoanRepayment(Number(selectedLoanId), {
        payment_date: repayDate || formatDate(new Date()),
        principal_amount: pAmt,
        interest_amount: iAmt,
        description: repayDescription.trim() || null,
      });

      setSuccessMessage(`Loan repayment of Rs. ${(pAmt + iAmt).toFixed(2)} recorded successfully.`);
      setPrincipalAmount("");
      setInterestAmount("");
      setRepayDescription("");
      setRepayDate(formatDate(new Date()));
      setShowRepayForm(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to record repayment");
    } finally {
      setSubmitting(false);
    }
  }

  // 6. View Repayment History
  async function handleViewLoanHistory(loan) {
    setSelectedLoanHistory(loan);
    try {
      const reps = await getBankLoanRepayments(loan.id);
      setLoanRepayments(Array.isArray(reps) ? reps : []);
    } catch (err) {
      setError(err.message || "Failed to fetch repayment history");
    }
  }

  // 7. Void Repayment
  async function handleVoidRepayment(repaymentId) {
    const confirmed = window.confirm(
      "Are you sure you want to void this repayment? This will reverse the cash deduction and restore the loan's outstanding balance."
    );
    if (!confirmed) return;

    clearMessages();
    try {
      await voidBankLoanRepayment(repaymentId);
      setSuccessMessage(`Repayment #${repaymentId} voided successfully.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to void repayment");
    }
  }

  function getTypeMeta(typeVal) {
    return (
      TRANSACTION_TYPES.find((t) => t.value === typeVal) || {
        label: typeVal,
        direction: "out",
        color: colors.muted,
      }
    );
  }

  const balance = summary ? summary.current_balance : 0;
  const isPositiveBalance = balance >= 0;
  const activeLoans = bankLoansData?.loans?.filter((l) => l.status === "active") || [];

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ ...styles.pageTitle, fontSize: "1.6rem" }}>Business Cash & Loans Management</h1>
          <p style={{ margin: "0.25rem 0 0", color: colors.muted, fontSize: "0.9rem" }}>
            Track Business Cash Balance, capital injections, owner withdrawals, third-party loans, and bank borrowings in real-time.
          </p>
        </div>

        {/* Action Button */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {activeTab === "cash-flow" ? (
            <button
              type="button"
              onClick={() => {
                clearMessages();
                setShowAddTxForm((curr) => !curr);
              }}
              style={styles.buttonPrimary}
            >
              {showAddTxForm ? "✕ Cancel" : "+ Record Cash Movement"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setShowRepayForm(false);
                  setShowAddLoanForm((c) => !c);
                }}
                style={styles.buttonPrimary}
              >
                {showAddLoanForm ? "✕ Cancel" : "+ Add Bank Loan"}
              </button>
              {activeLoans.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setShowAddLoanForm(false);
                    if (!selectedLoanId && activeLoans.length > 0) {
                      setSelectedLoanId(String(activeLoans[0].id));
                    }
                    setShowRepayForm((c) => !c);
                  }}
                  style={{
                    ...styles.buttonSecondary,
                    borderColor: colors.primary,
                    color: colors.primary,
                  }}
                >
                  {showRepayForm ? "✕ Cancel" : "💸 Record Repayment"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && <p style={{ color: colors.danger, margin: 0, fontWeight: 500 }}>{error}</p>}
      {successMessage && <p style={{ color: colors.primary, margin: 0, fontWeight: 500 }}>{successMessage}</p>}

      {/* Top Overview Cards */}
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {/* Current Cash Balance */}
        <div
          style={{
            ...styles.card,
            padding: "1.25rem",
            borderLeft: `5px solid ${isPositiveBalance ? colors.primary : colors.danger}`,
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.muted, textTransform: "uppercase" }}>
            Current Cash Balance
          </div>
          <div
            style={{
              fontSize: "1.7rem",
              fontWeight: 700,
              marginTop: "0.35rem",
              color: isPositiveBalance ? colors.ink : colors.danger,
            }}
          >
            Rs. {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: colors.muted, marginTop: "0.35rem" }}>
            Liquid cash available in business
          </div>
        </div>

        {/* Total Money In */}
        <div
          style={{
            ...styles.card,
            padding: "1.25rem",
            borderLeft: `5px solid #10b981`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.muted, textTransform: "uppercase" }}>
              Total Money In
            </div>
            <button
              type="button"
              onClick={() => setShowInBreakdown((c) => !c)}
              style={{
                background: "transparent",
                border: "none",
                color: colors.primary,
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {showInBreakdown ? "Hide" : "Details"}
            </button>
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.35rem", color: "#10b981" }}>
            + Rs. {(summary?.total_money_in ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          {showInBreakdown && summary && (
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: `1px solid ${colors.border}`, fontSize: "0.8rem", display: "grid", gap: "0.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Paid Cash Sales:</span>
                <strong>Rs. {summary.breakdown_in.sales_cash.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Customer Credit Payments:</span>
                <strong>Rs. {summary.breakdown_in.customer_payments.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Owner Capital:</span>
                <strong>Rs. {summary.breakdown_in.owner_investments.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Loan Repayments (3rd Party):</span>
                <strong>Rs. {summary.breakdown_in.loan_repayments.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#2563eb" }}>
                <span>Bank Loans Borrowed:</span>
                <strong>Rs. {(summary.breakdown_in.bank_loans_received || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Other Income:</span>
                <strong>Rs. {summary.breakdown_in.other_income.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Total Money Out */}
        <div
          style={{
            ...styles.card,
            padding: "1.25rem",
            borderLeft: `5px solid #ef4444`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.muted, textTransform: "uppercase" }}>
              Total Money Out
            </div>
            <button
              type="button"
              onClick={() => setShowOutBreakdown((c) => !c)}
              style={{
                background: "transparent",
                border: "none",
                color: colors.primary,
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {showOutBreakdown ? "Hide" : "Details"}
            </button>
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.35rem", color: "#ef4444" }}>
            - Rs. {(summary?.total_money_out ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          {showOutBreakdown && summary && (
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: `1px solid ${colors.border}`, fontSize: "0.8rem", display: "grid", gap: "0.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Purchases Paid:</span>
                <strong>Rs. {summary.breakdown_out.purchases_paid.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Supplier Payments:</span>
                <strong>Rs. {summary.breakdown_out.supplier_payments.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Owner Withdrawals:</span>
                <strong>Rs. {summary.breakdown_out.owner_withdrawals.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Loans Given (3rd Party):</span>
                <strong>Rs. {summary.breakdown_out.loans_given.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#d97706" }}>
                <span>Bank Loan Principal Repaid:</span>
                <strong>Rs. {(summary.breakdown_out.bank_loan_principal || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#d97706" }}>
                <span>Bank Loan Interest Paid:</span>
                <strong>Rs. {(summary.breakdown_out.bank_loan_interest || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Other Expenses:</span>
                <strong>Rs. {summary.breakdown_out.other_expenses.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Outstanding Bank Loans */}
        <div
          style={{
            ...styles.card,
            padding: "1.25rem",
            borderLeft: `5px solid #d97706`,
            backgroundColor: "#fffbeb",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#92400e", textTransform: "uppercase" }}>
            Total Outstanding Bank Loans
          </div>
          <div
            style={{
              fontSize: "1.7rem",
              fontWeight: 700,
              marginTop: "0.35rem",
              color: "#b45309",
            }}
          >
            Rs. {(summary?.total_outstanding_bank_loans ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#92400e", marginTop: "0.35rem" }}>
            Remaining bank debt owed
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: `2px solid ${colors.border}`, paddingBottom: "0.25rem" }}>
        <button
          type="button"
          onClick={() => setActiveTab("cash-flow")}
          style={{
            background: "transparent",
            border: "none",
            padding: "0.6rem 1.2rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            color: activeTab === "cash-flow" ? colors.primary : colors.muted,
            borderBottom: activeTab === "cash-flow" ? `3px solid ${colors.primary}` : "3px solid transparent",
            marginBottom: "-0.35rem",
          }}
        >
          💵 Cash Flow & Movements
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bank-loans")}
          style={{
            background: "transparent",
            border: "none",
            padding: "0.6rem 1.2rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            color: activeTab === "bank-loans" ? colors.primary : colors.muted,
            borderBottom: activeTab === "bank-loans" ? `3px solid ${colors.primary}` : "3px solid transparent",
            marginBottom: "-0.35rem",
          }}
        >
          🏦 Bank Loans & Repayments ({bankLoansData?.loans?.length || 0})
        </button>
      </div>

      {/* TAB 1: CASH MOVEMENTS */}
      {activeTab === "cash-flow" && (
        <>
          {/* Record Transaction Form */}
          {showAddTxForm && (
            <form
              onSubmit={handleCreateTxSubmit}
              style={{
                ...styles.card,
                padding: "1.5rem",
                display: "grid",
                gap: "1rem",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <h2 style={{ ...styles.pageTitle, fontSize: "1.2rem", margin: 0 }}>Record Cash Movement</h2>

              <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <label style={styles.label}>
                  Transaction Type
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    style={{
                      ...styles.input,
                      marginTop: "0.4rem",
                      cursor: "pointer",
                    }}
                  >
                    <optgroup label="📥 Money In (Increase Cash)">
                      <option value="owner_investment">Owner Investment / Capital (+)</option>
                      <option value="other_income">Other Business Income (+)</option>
                      <option value="loan_repayment">Loan Repayment Received from 3rd Party (+)</option>
                    </optgroup>
                    <optgroup label="📤 Money Out (Decrease Cash)">
                      <option value="owner_withdrawal">Owner Withdrawal / Personal (-)</option>
                      <option value="other_expense">Other Business Expense (-)</option>
                      <option value="loan_given">Loan Given to 3rd Party (-)</option>
                    </optgroup>
                  </select>
                </label>

                <label style={styles.label}>
                  Amount (Rs.)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    style={{
                      ...styles.input,
                      marginTop: "0.4rem",
                    }}
                  />
                </label>

                <label style={styles.label}>
                  Date
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    style={{
                      ...styles.input,
                      marginTop: "0.4rem",
                    }}
                  />
                </label>
              </div>

              <label style={styles.label}>
                Description / Note (Optional)
                <input
                  type="text"
                  placeholder="e.g. Shop renovation, electricity bill, personal withdrawal..."
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  style={{
                    ...styles.input,
                    marginTop: "0.4rem",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...styles.buttonPrimary,
                    backgroundColor: submitting ? colors.muted : colors.primary,
                  }}
                >
                  {submitting ? "Saving..." : "Save Transaction"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTxForm(false)}
                  style={styles.buttonSecondary}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Transaction History Section */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
              <h2 style={{ ...styles.pageTitle, fontSize: "1.2rem", margin: 0 }}>Cash Movements History</h2>

              {/* Filters */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    ...styles.input,
                    padding: "0.45rem 0.75rem",
                    fontSize: "0.85rem",
                    width: "auto",
                  }}
                >
                  <option value="">All Movement Types</option>
                  {TRANSACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    ...styles.input,
                    padding: "0.45rem 0.6rem",
                    fontSize: "0.85rem",
                    width: "auto",
                  }}
                />

                <span style={{ color: colors.muted, fontSize: "0.85rem" }}>to</span>

                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    ...styles.input,
                    padding: "0.45rem 0.6rem",
                    fontSize: "0.85rem",
                    width: "auto",
                  }}
                />

                {(typeFilter || fromDate || toDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter("");
                      setFromDate("");
                      setToDate("");
                    }}
                    style={{
                      ...styles.buttonSecondary,
                      padding: "0.45rem 0.75rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <p style={{ color: colors.muted }}>Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p style={{ color: colors.muted, margin: "1rem 0" }}>No cash transactions found for the selected filters.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                      <th style={styles.tableHeaderCell}>Date</th>
                      <th style={styles.tableHeaderCell}>Type</th>
                      <th style={styles.tableHeaderCell}>Description</th>
                      <th style={styles.tableHeaderCell}>Amount</th>
                      <th style={styles.tableHeaderCell}>Recorded By</th>
                      <th style={styles.tableHeaderCell}>Status</th>
                      <th style={styles.tableHeaderCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const meta = getTypeMeta(tx.type);
                      const isVoided = tx.status === "voided";
                      const isIn = meta.direction === "in";

                      return (
                        <tr
                          key={tx.id}
                          style={{
                            borderBottom: `1px solid ${colors.border}`,
                            opacity: isVoided ? 0.5 : 1,
                            textDecoration: isVoided ? "line-through" : "none",
                          }}
                        >
                          <td style={styles.tableCell}>{formatDateTime(tx.date || tx.created_at)}</td>
                          <td style={styles.tableCell}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.55rem",
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                backgroundColor: `${meta.color}18`,
                                color: meta.color,
                              }}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td style={styles.tableCell}>{tx.description || "—"}</td>
                          <td style={styles.tableCell}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: isVoided ? colors.muted : isIn ? "#10b981" : "#ef4444",
                              }}
                            >
                              {isIn ? "+" : "-"} Rs. {Number(tx.amount).toFixed(2)}
                            </span>
                          </td>
                          <td style={styles.tableCell}>{tx.user_name || "Owner"}</td>
                          <td style={styles.tableCell}>
                            <span
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                color: isVoided ? colors.danger : colors.primary,
                              }}
                            >
                              {isVoided ? "Voided" : "Active"}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            {!isVoided ? (
                              <button
                                type="button"
                                onClick={() => handleVoidTx(tx.id)}
                                style={{
                                  ...styles.buttonSecondary,
                                  padding: "0.25rem 0.55rem",
                                  fontSize: "0.75rem",
                                  color: colors.danger,
                                  borderColor: colors.danger,
                                }}
                              >
                                Void
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.8rem", color: colors.muted }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: BANK LOANS */}
      {activeTab === "bank-loans" && (
        <>
          {/* Add Bank Loan Form */}
          {showAddLoanForm && (
            <form
              onSubmit={handleCreateLoanSubmit}
              style={{
                ...styles.card,
                padding: "1.5rem",
                display: "grid",
                gap: "1rem",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <h2 style={{ ...styles.pageTitle, fontSize: "1.2rem", margin: 0 }}>Record New Bank Loan</h2>

              <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <label style={styles.label}>
                  Bank / Financial Institution *
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bank Alfalah, HBL, Meezan Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    style={{ ...styles.input, marginTop: "0.4rem" }}
                  />
                </label>

                <label style={styles.label}>
                  Loan Amount (Rs.) *
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="500000"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    style={{ ...styles.input, marginTop: "0.4rem" }}
                  />
                </label>

                <label style={styles.label}>
                  Disbursal Date *
                  <input
                    type="date"
                    required
                    value={disbursalDate}
                    onChange={(e) => setDisbursalDate(e.target.value)}
                    style={{ ...styles.input, marginTop: "0.4rem" }}
                  />
                </label>

                <label style={styles.label}>
                  Loan / Reference Account Number (Optional)
                  <input
                    type="text"
                    placeholder="e.g. LN-998822"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    style={{ ...styles.input, marginTop: "0.4rem" }}
                  />
                </label>
              </div>

              <label style={styles.label}>
                Description / Purpose / Terms (Optional)
                <input
                  type="text"
                  placeholder="e.g. 2-year business expansion loan at 12% interest"
                  value={loanDescription}
                  onChange={(e) => setLoanDescription(e.target.value)}
                  style={{ ...styles.input, marginTop: "0.4rem" }}
                />
              </label>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...styles.buttonPrimary,
                    backgroundColor: submitting ? colors.muted : colors.primary,
                  }}
                >
                  {submitting ? "Saving..." : "Save Bank Loan"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLoanForm(false)}
                  style={styles.buttonSecondary}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Record Repayment Form */}
          {showRepayForm && (
            <form
              onSubmit={handleCreateRepaySubmit}
              style={{
                ...styles.card,
                padding: "1.5rem",
                display: "grid",
                gap: "1rem",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                borderLeft: `5px solid ${colors.primary}`,
              }}
            >
              <h2 style={{ ...styles.pageTitle, fontSize: "1.2rem", margin: 0 }}>Record Bank Loan Repayment</h2>

              <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <label style={styles.label}>
                  Select Bank Loan *
                  <select
                    value={selectedLoanId}
                    onChange={(e) => setSelectedLoanId(e.target.value)}
                    required
                    style={{ ...styles.input, marginTop: "0.4rem" }}
                  >
                    {activeLoans.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.bank_name} {l.reference_number ? `(${l.reference_number})` : ""} — Balance: Rs. {l.remaining_balance.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Payment Date *
                  <input
                    type="date"
                    required
                    value={repayDate}
                    onChange={(e) => setRepayDate(e.target.value)}
                    style={{ ...styles.input, marginTop: "0.4rem" }}
                  />
                </label>

                <label style={styles.label}>
                  Principal Amount (Rs.)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    style={{ ...styles.input, marginTop: "0.4rem" }}
                  />
                  <small style={{ color: colors.muted, fontSize: "0.75rem" }}>Directly reduces loan balance</small>
                </label>

                <label style={styles.label}>
                  Interest Amount (Rs.) (Optional)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(e.target.value)}
                    style={{ ...styles.input, marginTop: "0.4rem" }}
                  />
                  <small style={{ color: colors.muted, fontSize: "0.75rem" }}>Recorded as bank interest paid</small>
                </label>
              </div>

              <label style={styles.label}>
                Notes / Reference (Optional)
                <input
                  type="text"
                  placeholder="e.g. Month 1 installment paid via cheque #102938"
                  value={repayDescription}
                  onChange={(e) => setRepayDescription(e.target.value)}
                  style={{ ...styles.input, marginTop: "0.4rem" }}
                />
              </label>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...styles.buttonPrimary,
                    backgroundColor: submitting ? colors.muted : colors.primary,
                  }}
                >
                  {submitting ? "Saving..." : `Pay Total Rs. ${((Number(principalAmount) || 0) + (Number(interestAmount) || 0)).toFixed(2)}`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRepayForm(false)}
                  style={styles.buttonSecondary}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Bank Loans List */}
          <div style={styles.card}>
            <h2 style={{ ...styles.pageTitle, fontSize: "1.2rem", margin: "0 0 1rem" }}>Active & Past Bank Loans</h2>

            {loading ? (
              <p style={{ color: colors.muted }}>Loading bank loans...</p>
            ) : !bankLoansData?.loans || bankLoansData.loans.length === 0 ? (
              <p style={{ color: colors.muted, margin: "1rem 0" }}>No bank loans recorded yet. Click "+ Add Bank Loan" above to add one.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                      <th style={styles.tableHeaderCell}>Bank Name</th>
                      <th style={styles.tableHeaderCell}>Ref #</th>
                      <th style={styles.tableHeaderCell}>Disbursed</th>
                      <th style={styles.tableHeaderCell}>Loan Amount</th>
                      <th style={styles.tableHeaderCell}>Principal Repaid</th>
                      <th style={styles.tableHeaderCell}>Interest Paid</th>
                      <th style={styles.tableHeaderCell}>Outstanding Debt</th>
                      <th style={styles.tableHeaderCell}>Status</th>
                      <th style={styles.tableHeaderCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankLoansData.loans.map((loan) => {
                      const isVoided = loan.status === "voided";
                      const isClosed = loan.status === "closed";

                      return (
                        <tr
                          key={loan.id}
                          style={{
                            borderBottom: `1px solid ${colors.border}`,
                            opacity: isVoided ? 0.5 : 1,
                            textDecoration: isVoided ? "line-through" : "none",
                          }}
                        >
                          <td style={styles.tableCell}>
                            <strong>{loan.bank_name}</strong>
                            {loan.description && <div style={{ fontSize: "0.75rem", color: colors.muted }}>{loan.description}</div>}
                          </td>
                          <td style={styles.tableCell}>{loan.reference_number || "—"}</td>
                          <td style={styles.tableCell}>{formatDateTime(loan.disbursal_date)}</td>
                          <td style={styles.tableCell}>
                            <span style={{ fontWeight: 600, color: "#10b981" }}>
                              Rs. {loan.loan_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td style={styles.tableCell}>Rs. {loan.total_principal_repaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td style={styles.tableCell}>Rs. {loan.total_interest_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td style={styles.tableCell}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: loan.remaining_balance > 0 ? "#b45309" : "#10b981",
                              }}
                            >
                              Rs. {loan.remaining_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: isVoided ? "#fee2e2" : isClosed ? "#e0f2fe" : "#fef3c7",
                                color: isVoided ? colors.danger : isClosed ? "#0369a1" : "#b45309",
                              }}
                            >
                              {isVoided ? "Voided" : isClosed ? "Fully Paid" : "Active"}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            <div style={{ display: "flex", gap: "0.35rem" }}>
                              {loan.status === "active" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    clearMessages();
                                    setSelectedLoanId(String(loan.id));
                                    setShowAddLoanForm(false);
                                    setShowRepayForm(true);
                                  }}
                                  style={{
                                    ...styles.buttonSecondary,
                                    padding: "0.25rem 0.5rem",
                                    fontSize: "0.75rem",
                                    color: colors.primary,
                                    borderColor: colors.primary,
                                  }}
                                >
                                  Repay
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleViewLoanHistory(loan)}
                                style={{
                                  ...styles.buttonSecondary,
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                }}
                              >
                                History
                              </button>
                              {!isVoided && loan.total_principal_repaid === 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleVoidLoan(loan.id)}
                                  style={{
                                    ...styles.buttonSecondary,
                                    padding: "0.25rem 0.5rem",
                                    fontSize: "0.75rem",
                                    color: colors.danger,
                                    borderColor: colors.danger,
                                  }}
                                >
                                  Void
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Repayment History Drawer / Card */}
          {selectedLoanHistory && (
            <div style={{ ...styles.card, border: `2px solid ${colors.primary}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ ...styles.pageTitle, fontSize: "1.1rem", margin: 0 }}>
                  Repayment History for {selectedLoanHistory.bank_name}{" "}
                  {selectedLoanHistory.reference_number ? `(${selectedLoanHistory.reference_number})` : ""}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedLoanHistory(null)}
                  style={{ ...styles.buttonSecondary, padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
                >
                  ✕ Close History
                </button>
              </div>

              {loanRepayments.length === 0 ? (
                <p style={{ color: colors.muted }}>No repayments recorded yet for this loan.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                        <th style={styles.tableHeaderCell}>Payment Date</th>
                        <th style={styles.tableHeaderCell}>Principal</th>
                        <th style={styles.tableHeaderCell}>Interest</th>
                        <th style={styles.tableHeaderCell}>Total Disbursed</th>
                        <th style={styles.tableHeaderCell}>Notes</th>
                        <th style={styles.tableHeaderCell}>Status</th>
                        <th style={styles.tableHeaderCell}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanRepayments.map((rep) => {
                        const isVoided = rep.status === "voided";
                        return (
                          <tr
                            key={rep.id}
                            style={{
                              borderBottom: `1px solid ${colors.border}`,
                              opacity: isVoided ? 0.5 : 1,
                              textDecoration: isVoided ? "line-through" : "none",
                            }}
                          >
                            <td style={styles.tableCell}>{formatDateTime(rep.payment_date || rep.created_at)}</td>
                            <td style={styles.tableCell}>Rs. {rep.principal_amount.toFixed(2)}</td>
                            <td style={styles.tableCell}>Rs. {rep.interest_amount.toFixed(2)}</td>
                            <td style={styles.tableCell}>
                              <strong style={{ color: isVoided ? colors.muted : "#ef4444" }}>
                                - Rs. {rep.total_payment.toFixed(2)}
                              </strong>
                            </td>
                            <td style={styles.tableCell}>{rep.description || "—"}</td>
                            <td style={styles.tableCell}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: isVoided ? colors.danger : colors.primary }}>
                                {isVoided ? "Voided" : "Active"}
                              </span>
                            </td>
                            <td style={styles.tableCell}>
                              {!isVoided ? (
                                <button
                                  type="button"
                                  onClick={() => handleVoidRepayment(rep.id)}
                                  style={{
                                    ...styles.buttonSecondary,
                                    padding: "0.2rem 0.5rem",
                                    fontSize: "0.75rem",
                                    color: colors.danger,
                                    borderColor: colors.danger,
                                  }}
                                >
                                  Void
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
