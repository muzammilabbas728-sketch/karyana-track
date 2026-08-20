import { useState, useEffect, useRef } from "react";
import html2pdf from "html2pdf.js";
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
  getBorrowers,
  createBorrower,
  getBorrowerHistory,
  createLoanTransaction,
  voidLoanTransaction,
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
  const [activeTab, setActiveTab] = useState("cash-flow"); // "cash-flow" | "third-party-loans" | "bank-loans"
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [bankLoansData, setBankLoansData] = useState(null);
  const [borrowersData, setBorrowersData] = useState(null);
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

  // Bank Repayment Form State
  const [showRepayForm, setShowRepayForm] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [repayDate, setRepayDate] = useState(formatDate(new Date()));
  const [principalAmount, setPrincipalAmount] = useState("");
  const [interestAmount, setInterestAmount] = useState("");
  const [repayDescription, setRepayDescription] = useState("");

  // Bank Loan Repayment History
  const [selectedLoanHistory, setSelectedLoanHistory] = useState(null);
  const [loanRepayments, setLoanRepayments] = useState([]);

  // 3rd Party Borrower Loan States
  const [borrowerSearch, setBorrowerSearch] = useState("");
  const [showGiveLoanForm, setShowGiveLoanForm] = useState(false);
  const [showReceiveRepayForm, setShowReceiveRepayForm] = useState(false);
  const [showAddBorrowerForm, setShowAddBorrowerForm] = useState(false);

  // Form fields for 3rd Party Loan transactions
  const [selectedBorrowerId, setSelectedBorrowerId] = useState("");
  const [tpAmount, setTpAmount] = useState("");
  const [tpDate, setTpDate] = useState(formatDate(new Date()));
  const [tpNotes, setTpNotes] = useState("");
  const [tpNewBorrowerName, setTpNewBorrowerName] = useState("");
  const [tpNewBorrowerPhone, setTpNewBorrowerPhone] = useState("");

  // Add Borrower Only Form
  const [newBorrowerNameOnly, setNewBorrowerNameOnly] = useState("");
  const [newBorrowerPhoneOnly, setNewBorrowerPhoneOnly] = useState("");
  const [newBorrowerNotesOnly, setNewBorrowerNotesOnly] = useState("");

  // Borrower Ledger / Statement State
  const [selectedBorrowerHistory, setSelectedBorrowerHistory] = useState(null);
  const [borrowerHistoryList, setBorrowerHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const statementRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);

  // Breakdown visibility
  const [showInBreakdown, setShowInBreakdown] = useState(false);
  const [showOutBreakdown, setShowOutBreakdown] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [sumData, txData, blData, bwData] = await Promise.all([
        getCashSummary(),
        getCashTransactions({
          type: typeFilter || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        }),
        getBankLoans(),
        getBorrowers(),
      ]);
      setSummary(sumData);
      setTransactions(Array.isArray(txData) ? txData : []);
      setBankLoansData(blData);
      setBorrowersData(bwData);

      if (selectedLoanHistory) {
        const reps = await getBankLoanRepayments(selectedLoanHistory.id);
        setLoanRepayments(Array.isArray(reps) ? reps : []);
      }

      if (selectedBorrowerHistory) {
        const history = await getBorrowerHistory(selectedBorrowerHistory.id);
        setBorrowerHistoryList(Array.isArray(history) ? history : []);
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

  // 6. View Bank Repayment History
  async function handleViewLoanHistory(loan) {
    setSelectedLoanHistory(loan);
    try {
      const reps = await getBankLoanRepayments(loan.id);
      setLoanRepayments(Array.isArray(reps) ? reps : []);
    } catch (err) {
      setError(err.message || "Failed to fetch repayment history");
    }
  }

  // 7. Void Bank Repayment
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

  // ---------------------------------------------------------------------------
  // 3rd Party Loans Khata Handlers
  // ---------------------------------------------------------------------------

  // Add Borrower Only
  async function handleCreateBorrowerSubmit(event) {
    event.preventDefault();
    clearMessages();

    if (!newBorrowerNameOnly.trim()) {
      setError("Please enter borrower name.");
      return;
    }

    setSubmitting(true);
    try {
      await createBorrower({
        name: newBorrowerNameOnly.trim(),
        phone: newBorrowerPhoneOnly.trim() || null,
        notes: newBorrowerNotesOnly.trim() || null,
      });

      setSuccessMessage(`Borrower account '${newBorrowerNameOnly.trim()}' created successfully.`);
      setNewBorrowerNameOnly("");
      setNewBorrowerPhoneOnly("");
      setNewBorrowerNotesOnly("");
      setShowAddBorrowerForm(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to create borrower");
    } finally {
      setSubmitting(false);
    }
  }

  // Give Loan (Cash Out to Person)
  async function handleGiveLoanSubmit(event) {
    event.preventDefault();
    clearMessages();

    const amt = Number(tpAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError("Please enter a valid loan amount.");
      return;
    }

    if (!selectedBorrowerId && !tpNewBorrowerName.trim()) {
      setError("Please select an existing person or type a new borrower name.");
      return;
    }

    setSubmitting(true);
    try {
      await createLoanTransaction({
        borrower_id: selectedBorrowerId ? Number(selectedBorrowerId) : undefined,
        borrower_name: selectedBorrowerId ? undefined : tpNewBorrowerName.trim(),
        phone: selectedBorrowerId ? undefined : (tpNewBorrowerPhone.trim() || undefined),
        type: "loan_given",
        amount: amt,
        date: tpDate || formatDate(new Date()),
        notes: tpNotes.trim() || null,
      });

      setSuccessMessage(`Loan of Rs. ${amt.toFixed(2)} recorded successfully.`);
      setTpAmount("");
      setTpNotes("");
      setTpNewBorrowerName("");
      setTpNewBorrowerPhone("");
      setSelectedBorrowerId("");
      setShowGiveLoanForm(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to record loan");
    } finally {
      setSubmitting(false);
    }
  }

  // Receive Repayment (Cash In from Person)
  async function handleReceiveRepaymentSubmit(event) {
    event.preventDefault();
    clearMessages();

    const amt = Number(tpAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError("Please enter a valid repayment amount.");
      return;
    }

    if (!selectedBorrowerId) {
      setError("Please select a borrower who is repaying the loan.");
      return;
    }

    setSubmitting(true);
    try {
      await createLoanTransaction({
        borrower_id: Number(selectedBorrowerId),
        type: "repayment",
        amount: amt,
        date: tpDate || formatDate(new Date()),
        notes: tpNotes.trim() || null,
      });

      setSuccessMessage(`Repayment of Rs. ${amt.toFixed(2)} recorded successfully.`);
      setTpAmount("");
      setTpNotes("");
      setSelectedBorrowerId("");
      setShowReceiveRepayForm(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to record repayment");
    } finally {
      setSubmitting(false);
    }
  }

  // View Borrower History
  async function handleViewBorrowerHistory(borrower) {
    setSelectedBorrowerHistory(borrower);
    setHistoryLoading(true);
    try {
      const history = await getBorrowerHistory(borrower.id);
      setBorrowerHistoryList(Array.isArray(history) ? history : []);
    } catch (err) {
      setError(err.message || "Failed to fetch borrower history");
    } finally {
      setHistoryLoading(false);
    }
  }

  // Void 3rd Party Loan Transaction
  async function handleVoidThirdPartyTx(txId) {
    const confirmed = window.confirm(
      "Are you sure you want to void this loan transaction? It will reverse its impact on cash balance and the borrower's ledger."
    );
    if (!confirmed) return;

    clearMessages();
    try {
      await voidLoanTransaction(txId);
      setSuccessMessage(`Loan transaction #${txId} voided successfully.`);
      await loadData();
      if (selectedBorrowerHistory) {
        const history = await getBorrowerHistory(selectedBorrowerHistory.id);
        setBorrowerHistoryList(Array.isArray(history) ? history : []);
      }
    } catch (err) {
      setError(err.message || "Failed to void transaction");
    }
  }

  // Download PDF Statement for Borrower
  function handleDownloadStatement() {
    if (!statementRef.current || !selectedBorrowerHistory) return;
    const cleanName = selectedBorrowerHistory.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Loan_Ledger_${cleanName}_${formatDate(new Date())}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(opt).from(statementRef.current).save();
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
  const borrowersList = borrowersData?.borrowers || [];
  const filteredBorrowers = borrowersList.filter((b) => {
    if (!borrowerSearch.trim()) return true;
    const term = borrowerSearch.toLowerCase();
    return b.name.toLowerCase().includes(term) || (b.phone && b.phone.toLowerCase().includes(term));
  });

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
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {activeTab === "cash-flow" && (
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
          )}

          {activeTab === "third-party-loans" && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setShowReceiveRepayForm(false);
                  setShowAddBorrowerForm(false);
                  setShowGiveLoanForm((c) => !c);
                }}
                style={{ ...styles.buttonPrimary, backgroundColor: "#ec4899" }}
              >
                {showGiveLoanForm ? "✕ Cancel" : "+ Give Loan (To Person)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setShowGiveLoanForm(false);
                  setShowAddBorrowerForm(false);
                  if (!selectedBorrowerId && borrowersList.length > 0) {
                    const withBal = borrowersList.find((b) => b.balance_owed > 0);
                    setSelectedBorrowerId(String(withBal ? withBal.id : borrowersList[0].id));
                  }
                  setShowReceiveRepayForm((c) => !c);
                }}
                style={{ ...styles.buttonSecondary, borderColor: "#8b5cf6", color: "#8b5cf6" }}
              >
                {showReceiveRepayForm ? "✕ Cancel" : "📥 Receive Repayment"}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setShowGiveLoanForm(false);
                  setShowReceiveRepayForm(false);
                  setShowAddBorrowerForm((c) => !c);
                }}
                style={styles.buttonSecondary}
              >
                {showAddBorrowerForm ? "✕ Cancel" : "👤 Add Borrower"}
              </button>
            </div>
          )}

          {activeTab === "bank-loans" && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                <span>Owner Capital Invested:</span>
                <strong>Rs. {summary.breakdown_in.owner_investments.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>3rd Party Loan Repayments:</span>
                <strong>Rs. {summary.breakdown_in.loan_repayments.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#d97706" }}>
                <span>Bank Loans Disbursed:</span>
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

        {/* 3rd Party Loans Receivable */}
        <div
          style={{
            ...styles.card,
            padding: "1.25rem",
            borderLeft: `5px solid #ec4899`,
            backgroundColor: "#fdf2f8",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#9d174d", textTransform: "uppercase" }}>
            3rd Party Loans Receivable
          </div>
          <div
            style={{
              fontSize: "1.7rem",
              fontWeight: 700,
              marginTop: "0.35rem",
              color: "#be185d",
            }}
          >
            Rs. {(summary?.total_outstanding_third_party_loans ?? borrowersData?.total_outstanding ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#9d174d", marginTop: "0.35rem" }}>
            Total money owed back by persons
          </div>
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
            Outstanding Bank Loans
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
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: `2px solid ${colors.border}`, paddingBottom: "0.25rem", flexWrap: "wrap" }}>
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
          onClick={() => setActiveTab("third-party-loans")}
          style={{
            background: "transparent",
            border: "none",
            padding: "0.6rem 1.2rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            color: activeTab === "third-party-loans" ? colors.primary : colors.muted,
            borderBottom: activeTab === "third-party-loans" ? `3px solid ${colors.primary}` : "3px solid transparent",
            marginBottom: "-0.35rem",
          }}
        >
          👥 3rd Party Loans Khata
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
          🏦 Bank Loans
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CASH FLOW & MOVEMENTS */}
      {/* ===================================================================== */}
      {activeTab === "cash-flow" && (
        <>
          {/* Add Cash Transaction Drawer / Form */}
          {showAddTxForm && (
            <div style={{ ...styles.card, border: `2px solid ${colors.primary}` }}>
              <h2 style={{ ...styles.sectionTitle, fontSize: "1.2rem", marginBottom: "1rem" }}>
                Record Direct Cash Movement
              </h2>
              <form onSubmit={handleCreateTxSubmit} style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                  <div>
                    <label style={styles.fieldLabel}>Transaction Type</label>
                    <select
                      value={txType}
                      onChange={(e) => setTxType(e.target.value)}
                      style={styles.select}
                      disabled={submitting}
                    >
                      {TRANSACTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.direction === "in" ? "[+ IN] " : "[- OUT] "} {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Amount (Rs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Date</label>
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label style={styles.fieldLabel}>Description / Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Electricity bill, partner dividend, etc."
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    style={styles.input}
                    disabled={submitting}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowAddTxForm(false)}
                    style={styles.buttonSecondary}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" style={styles.buttonPrimary} disabled={submitting}>
                    {submitting ? "Saving..." : "Save Transaction"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filters Bar */}
          <div style={{ ...styles.card, padding: "1rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
              <div style={{ minWidth: "180px", flex: 1 }}>
                <label style={styles.fieldLabel}>Filter by Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={styles.select}
                >
                  <option value="">All Cash Transaction Types</option>
                  {TRANSACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.direction === "in" ? "[+ IN] " : "[- OUT] "} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: "150px" }}>
                <label style={styles.fieldLabel}>From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={{ minWidth: "150px" }}>
                <label style={styles.fieldLabel}>To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={styles.input}
                />
              </div>

              {(typeFilter || fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("");
                    setFromDate("");
                    setToDate("");
                  }}
                  style={{ ...styles.buttonSecondary, padding: "0.5rem 0.8rem", fontSize: "0.85rem" }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Transactions List */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ ...styles.sectionTitle, fontSize: "1.2rem", margin: 0 }}>
                Cash Transactions History
              </h2>
              <span style={{ fontSize: "0.85rem", color: colors.muted }}>
                Showing {transactions.length} record(s)
              </span>
            </div>

            {loading ? (
              <p style={{ color: colors.muted }}>Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p style={{ color: colors.muted }}>No cash transactions match your filter criteria.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                      <th style={styles.tableHeaderCell}>Date</th>
                      <th style={styles.tableHeaderCell}>Type</th>
                      <th style={styles.tableHeaderCell}>Amount</th>
                      <th style={styles.tableHeaderCell}>Description</th>
                      <th style={styles.tableHeaderCell}>Recorded By</th>
                      <th style={styles.tableHeaderCell}>Status</th>
                      <th style={styles.tableHeaderCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const meta = getTypeMeta(tx.type);
                      const isVoided = tx.status === "voided";
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
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "#fff",
                                backgroundColor: meta.color,
                              }}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            <strong style={{ color: meta.direction === "in" ? "#10b981" : "#ef4444" }}>
                              {meta.direction === "in" ? "+ " : "- "}
                              Rs. {tx.amount.toFixed(2)}
                            </strong>
                          </td>
                          <td style={styles.tableCell}>{tx.description || "—"}</td>
                          <td style={styles.tableCell}>{tx.user_name || "—"}</td>
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
                                  padding: "0.25rem 0.5rem",
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
        </>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: 3RD PARTY LOANS KHATA */}
      {/* ===================================================================== */}
      {activeTab === "third-party-loans" && (
        <>
          {/* Give Loan Form / Drawer */}
          {showGiveLoanForm && (
            <div style={{ ...styles.card, border: `2px solid #ec4899` }}>
              <h2 style={{ ...styles.sectionTitle, fontSize: "1.2rem", marginBottom: "1rem", color: "#be185d" }}>
                💸 Give Loan to Third Party (Cash Out)
              </h2>
              <p style={{ fontSize: "0.85rem", color: colors.muted, marginTop: "-0.5rem", marginBottom: "1rem" }}>
                Lending money reduces Business Cash Balance and increases the borrower's receivable balance in the khata.
              </p>

              <form onSubmit={handleGiveLoanSubmit} style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                  <div>
                    <label style={styles.fieldLabel}>Select Existing Borrower</label>
                    <select
                      value={selectedBorrowerId}
                      onChange={(e) => {
                        setSelectedBorrowerId(e.target.value);
                        if (e.target.value) {
                          setTpNewBorrowerName("");
                          setTpNewBorrowerPhone("");
                        }
                      }}
                      style={styles.select}
                      disabled={submitting}
                    >
                      <option value="">-- Or type new borrower below --</option>
                      {borrowersList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.phone ? `(${b.phone})` : ""} — Owed: Rs. {b.balance_owed.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!selectedBorrowerId && (
                    <>
                      <div>
                        <label style={styles.fieldLabel}>New Borrower Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Ali Ahmed, Tariq Khan"
                          value={tpNewBorrowerName}
                          onChange={(e) => setTpNewBorrowerName(e.target.value)}
                          style={styles.input}
                          required={!selectedBorrowerId}
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <label style={styles.fieldLabel}>Phone Number (Optional)</label>
                        <input
                          type="text"
                          placeholder="0300-1234567"
                          value={tpNewBorrowerPhone}
                          onChange={(e) => setTpNewBorrowerPhone(e.target.value)}
                          style={styles.input}
                          disabled={submitting}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label style={styles.fieldLabel}>Loan Amount to Give (Rs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={tpAmount}
                      onChange={(e) => setTpAmount(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Date Given</label>
                    <input
                      type="date"
                      value={tpDate}
                      onChange={(e) => setTpDate(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label style={styles.fieldLabel}>Notes / Terms (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Promised to return by end of month"
                    value={tpNotes}
                    onChange={(e) => setTpNotes(e.target.value)}
                    style={styles.input}
                    disabled={submitting}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowGiveLoanForm(false)}
                    style={styles.buttonSecondary}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ ...styles.buttonPrimary, backgroundColor: "#ec4899" }}
                    disabled={submitting}
                  >
                    {submitting ? "Processing..." : "Disburse Loan"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Receive Repayment Form / Drawer */}
          {showReceiveRepayForm && (
            <div style={{ ...styles.card, border: `2px solid #8b5cf6` }}>
              <h2 style={{ ...styles.sectionTitle, fontSize: "1.2rem", marginBottom: "1rem", color: "#6d28d9" }}>
                📥 Receive Loan Repayment (Cash In)
              </h2>
              <p style={{ fontSize: "0.85rem", color: colors.muted, marginTop: "-0.5rem", marginBottom: "1rem" }}>
                Receiving loan repayment increases Business Cash Balance and reduces the borrower's balance owed.
              </p>

              <form onSubmit={handleReceiveRepaymentSubmit} style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                  <div>
                    <label style={styles.fieldLabel}>Select Borrower</label>
                    <select
                      value={selectedBorrowerId}
                      onChange={(e) => setSelectedBorrowerId(e.target.value)}
                      style={styles.select}
                      required
                      disabled={submitting}
                    >
                      <option value="">-- Choose Borrower --</option>
                      {borrowersList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.phone ? `(${b.phone})` : ""} — Current Owed: Rs. {b.balance_owed.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Repayment Amount (Rs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={tpAmount}
                      onChange={(e) => setTpAmount(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Payment Date</label>
                    <input
                      type="date"
                      value={tpDate}
                      onChange={(e) => setTpDate(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label style={styles.fieldLabel}>Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid in cash, partial payment"
                    value={tpNotes}
                    onChange={(e) => setTpNotes(e.target.value)}
                    style={styles.input}
                    disabled={submitting}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowReceiveRepayForm(false)}
                    style={styles.buttonSecondary}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ ...styles.buttonPrimary, backgroundColor: "#8b5cf6" }}
                    disabled={submitting}
                  >
                    {submitting ? "Processing..." : "Record Repayment"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Add Borrower Account Only Form */}
          {showAddBorrowerForm && (
            <div style={{ ...styles.card, border: `2px solid ${colors.primary}` }}>
              <h2 style={{ ...styles.sectionTitle, fontSize: "1.2rem", marginBottom: "1rem" }}>
                👤 Add New Borrower Account
              </h2>
              <form onSubmit={handleCreateBorrowerSubmit} style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                  <div>
                    <label style={styles.fieldLabel}>Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Muhammad Ali"
                      value={newBorrowerNameOnly}
                      onChange={(e) => setNewBorrowerNameOnly(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Phone Number</label>
                    <input
                      type="text"
                      placeholder="0300-1234567"
                      value={newBorrowerPhoneOnly}
                      onChange={(e) => setNewBorrowerPhoneOnly(e.target.value)}
                      style={styles.input}
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Neighbor, Staff member"
                      value={newBorrowerNotesOnly}
                      onChange={(e) => setNewBorrowerNotesOnly(e.target.value)}
                      style={styles.input}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowAddBorrowerForm(false)}
                    style={styles.buttonSecondary}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" style={styles.buttonPrimary} disabled={submitting}>
                    {submitting ? "Saving..." : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3rd Party Summary KPIs */}
          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div style={{ ...styles.card, padding: "1.25rem", borderLeft: "5px solid #ec4899" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.muted, textTransform: "uppercase" }}>
                Total Loans Lent (Given)
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.35rem", color: "#ec4899" }}>
                Rs. {(borrowersData?.total_lent ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "0.75rem", color: colors.muted, marginTop: "0.35rem" }}>
                Cumulative money lent to persons
              </div>
            </div>

            <div style={{ ...styles.card, padding: "1.25rem", borderLeft: "5px solid #10b981" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.muted, textTransform: "uppercase" }}>
                Total Recovered (Repaid)
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.35rem", color: "#10b981" }}>
                Rs. {(borrowersData?.total_recovered ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "0.75rem", color: colors.muted, marginTop: "0.35rem" }}>
                Total repayments received back
              </div>
            </div>

            <div style={{ ...styles.card, padding: "1.25rem", borderLeft: "5px solid #ef4444" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.muted, textTransform: "uppercase" }}>
                Current Outstanding Receivables
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.35rem", color: "#ef4444" }}>
                Rs. {(borrowersData?.total_outstanding ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "0.75rem", color: colors.muted, marginTop: "0.35rem" }}>
                Active debt owed to you
              </div>
            </div>
          </div>

          {/* Search and Borrowers Directory */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h2 style={{ ...styles.sectionTitle, fontSize: "1.2rem", margin: 0 }}>
                  Borrower Accounts Directory
                </h2>
                <span style={{ fontSize: "0.85rem", color: colors.muted }}>
                  {filteredBorrowers.length} borrower account(s)
                </span>
              </div>

              <div style={{ minWidth: "260px" }}>
                <input
                  type="text"
                  placeholder="🔍 Search by name or phone..."
                  value={borrowerSearch}
                  onChange={(e) => setBorrowerSearch(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            {loading ? (
              <p style={{ color: colors.muted }}>Loading borrowers...</p>
            ) : filteredBorrowers.length === 0 ? (
              <p style={{ color: colors.muted }}>No borrower accounts found. Click "+ Give Loan" to create one.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                      <th style={styles.tableHeaderCell}>Borrower Name</th>
                      <th style={styles.tableHeaderCell}>Phone</th>
                      <th style={styles.tableHeaderCell}>Total Lent</th>
                      <th style={styles.tableHeaderCell}>Total Repaid</th>
                      <th style={styles.tableHeaderCell}>Balance Owed</th>
                      <th style={styles.tableHeaderCell}>Status</th>
                      <th style={styles.tableHeaderCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBorrowers.map((b) => {
                      const isSettled = b.balance_owed <= 0;
                      return (
                        <tr key={b.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td style={styles.tableCell}>
                            <strong>{b.name}</strong>
                            {b.notes && <div style={{ fontSize: "0.75rem", color: colors.muted }}>{b.notes}</div>}
                          </td>
                          <td style={styles.tableCell}>{b.phone || "—"}</td>
                          <td style={styles.tableCell}>Rs. {b.total_lent.toFixed(2)}</td>
                          <td style={{ ...styles.tableCell, color: "#10b981" }}>Rs. {b.total_repaid.toFixed(2)}</td>
                          <td style={styles.tableCell}>
                            <strong style={{ color: isSettled ? "#10b981" : "#ef4444", fontSize: "1.05rem" }}>
                              Rs. {b.balance_owed.toFixed(2)}
                            </strong>
                          </td>
                          <td style={styles.tableCell}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "#fff",
                                backgroundColor: isSettled ? "#10b981" : "#f59e0b",
                              }}
                            >
                              {isSettled ? "Settled" : "Active Owed"}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  clearMessages();
                                  setSelectedBorrowerId(String(b.id));
                                  setShowReceiveRepayForm(false);
                                  setShowGiveLoanForm(true);
                                }}
                                style={{
                                  ...styles.buttonSecondary,
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  color: "#ec4899",
                                  borderColor: "#ec4899",
                                }}
                              >
                                + Give More
                              </button>
                              {b.balance_owed > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    clearMessages();
                                    setSelectedBorrowerId(String(b.id));
                                    setShowGiveLoanForm(false);
                                    setShowReceiveRepayForm(true);
                                  }}
                                  style={{
                                    ...styles.buttonSecondary,
                                    padding: "0.25rem 0.5rem",
                                    fontSize: "0.75rem",
                                    color: "#8b5cf6",
                                    borderColor: "#8b5cf6",
                                  }}
                                >
                                  📥 Repay
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleViewBorrowerHistory(b)}
                                style={{
                                  ...styles.buttonSecondary,
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  color: colors.primary,
                                  borderColor: colors.primary,
                                }}
                              >
                                📜 Statement
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
          </div>

          {/* Borrower Statement / Ledger Drawer */}
          {selectedBorrowerHistory && (
            <div style={{ ...styles.card, border: `2px solid ${colors.primary}`, marginTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <h3 style={{ ...styles.pageTitle, fontSize: "1.2rem", margin: 0 }}>
                    📜 Account Ledger & Statement: {selectedBorrowerHistory.name}
                  </h3>
                  <p style={{ margin: "0.2rem 0 0", color: colors.muted, fontSize: "0.85rem" }}>
                    {selectedBorrowerHistory.phone ? `Phone: ${selectedBorrowerHistory.phone} | ` : ""}
                    Current Remaining Balance: <strong style={{ color: selectedBorrowerHistory.balance_owed > 0 ? "#ef4444" : "#10b981" }}>
                      Rs. {selectedBorrowerHistory.balance_owed.toFixed(2)}
                    </strong>
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={handleDownloadStatement}
                    style={{ ...styles.buttonPrimary, padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                  >
                    📥 Download PDF Statement
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBorrowerHistory(null)}
                    style={{ ...styles.buttonSecondary, padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Printable Statement Container (Ref for html2pdf) */}
              <div
                ref={statementRef}
                style={{
                  padding: "1rem",
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                }}
              >
                {/* Statement Header */}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `2px solid ${colors.primary}`, paddingBottom: "0.75rem", marginBottom: "1rem" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.3rem", color: colors.primary }}>KARYANA TRACK</h2>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: colors.muted }}>Third-Party Personal Loan Statement</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.85rem", color: colors.muted }}>Date: {formatDate(new Date())}</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: colors.ink }}>
                      Borrower: {selectedBorrowerHistory.name}
                    </div>
                    {selectedBorrowerHistory.phone && (
                      <div style={{ fontSize: "0.85rem", color: colors.muted }}>{selectedBorrowerHistory.phone}</div>
                    )}
                  </div>
                </div>

                {historyLoading ? (
                  <p style={{ color: colors.muted }}>Loading ledger history...</p>
                ) : borrowerHistoryList.length === 0 ? (
                  <p style={{ color: colors.muted }}>No loan transactions found for this person.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: `2px solid ${colors.border}`, backgroundColor: "#f8fafc" }}>
                        <th style={{ padding: "0.5rem" }}>Date</th>
                        <th style={{ padding: "0.5rem" }}>Type</th>
                        <th style={{ padding: "0.5rem" }}>Disbursed (Loan)</th>
                        <th style={{ padding: "0.5rem" }}>Repaid</th>
                        <th style={{ padding: "0.5rem" }}>Notes</th>
                        <th style={{ padding: "0.5rem" }}>Recorded By</th>
                        <th style={{ padding: "0.5rem" }}>Status</th>
                        <th style={{ padding: "0.5rem" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borrowerHistoryList.map((tx) => {
                        const isGiven = tx.type === "loan_given";
                        const isVoided = tx.status === "voided";
                        return (
                          <tr
                            key={tx.id}
                            style={{
                              borderBottom: `1px solid ${colors.border}`,
                              opacity: isVoided ? 0.45 : 1,
                              textDecoration: isVoided ? "line-through" : "none",
                            }}
                          >
                            <td style={{ padding: "0.5rem" }}>{formatDateTime(tx.date || tx.created_at)}</td>
                            <td style={{ padding: "0.5rem" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "0.15rem 0.4rem",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  color: "#fff",
                                  backgroundColor: isGiven ? "#ec4899" : "#8b5cf6",
                                }}
                              >
                                {isGiven ? "Loan Given" : "Repayment Received"}
                              </span>
                            </td>
                            <td style={{ padding: "0.5rem", color: isGiven ? "#ef4444" : "inherit", fontWeight: isGiven ? 700 : 400 }}>
                              {isGiven ? `Rs. ${tx.amount.toFixed(2)}` : "—"}
                            </td>
                            <td style={{ padding: "0.5rem", color: !isGiven ? "#10b981" : "inherit", fontWeight: !isGiven ? 700 : 400 }}>
                              {!isGiven ? `Rs. ${tx.amount.toFixed(2)}` : "—"}
                            </td>
                            <td style={{ padding: "0.5rem" }}>{tx.notes || "—"}</td>
                            <td style={{ padding: "0.5rem" }}>{tx.user_name || "—"}</td>
                            <td style={{ padding: "0.5rem" }}>
                              <span style={{ fontWeight: 600, color: isVoided ? colors.danger : colors.primary }}>
                                {isVoided ? "Voided" : "Active"}
                              </span>
                            </td>
                            <td style={{ padding: "0.5rem" }}>
                              {!isVoided ? (
                                <button
                                  type="button"
                                  onClick={() => handleVoidThirdPartyTx(tx.id)}
                                  style={{
                                    ...styles.buttonSecondary,
                                    padding: "0.2rem 0.4rem",
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
                )}

                {/* Statement Summary Box */}
                <div
                  style={{
                    marginTop: "1.5rem",
                    padding: "0.75rem",
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "1rem",
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.8rem", color: colors.muted }}>Total Lent:</span>{" "}
                    <strong>Rs. {selectedBorrowerHistory.total_lent.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.8rem", color: colors.muted }}>Total Repaid:</span>{" "}
                    <strong style={{ color: "#10b981" }}>Rs. {selectedBorrowerHistory.total_repaid.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.8rem", color: colors.muted }}>Balance Owed:</span>{" "}
                    <strong style={{ fontSize: "1.1rem", color: selectedBorrowerHistory.balance_owed > 0 ? "#ef4444" : "#10b981" }}>
                      Rs. {selectedBorrowerHistory.balance_owed.toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: BANK LOANS */}
      {/* ===================================================================== */}
      {activeTab === "bank-loans" && (
        <>
          {/* Add Bank Loan Drawer / Form */}
          {showAddLoanForm && (
            <div style={{ ...styles.card, border: `2px solid ${colors.primary}` }}>
              <h2 style={{ ...styles.sectionTitle, fontSize: "1.2rem", marginBottom: "1rem" }}>
                Record New Bank Loan Disbursal
              </h2>
              <form onSubmit={handleCreateLoanSubmit} style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                  <div>
                    <label style={styles.fieldLabel}>Bank / Financial Institution Name</label>
                    <input
                      type="text"
                      placeholder="e.g. HBL, Meezan Bank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Loan Amount (Rs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Disbursal Date</label>
                    <input
                      type="date"
                      value={disbursalDate}
                      onChange={(e) => setDisbursalDate(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Reference / Account # (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. LN-98421"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      style={styles.input}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label style={styles.fieldLabel}>Notes / Terms (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 year tenure at 12% markup"
                    value={loanDescription}
                    onChange={(e) => setLoanDescription(e.target.value)}
                    style={styles.input}
                    disabled={submitting}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowAddLoanForm(false)}
                    style={styles.buttonSecondary}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" style={styles.buttonPrimary} disabled={submitting}>
                    {submitting ? "Saving..." : "Save Bank Loan"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Record Repayment Drawer / Form */}
          {showRepayForm && (
            <div style={{ ...styles.card, border: `2px solid ${colors.primary}` }}>
              <h2 style={{ ...styles.sectionTitle, fontSize: "1.2rem", marginBottom: "1rem" }}>
                Record Bank Loan Repayment
              </h2>
              <form onSubmit={handleCreateRepaySubmit} style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                  <div>
                    <label style={styles.fieldLabel}>Select Bank Loan</label>
                    <select
                      value={selectedLoanId}
                      onChange={(e) => setSelectedLoanId(e.target.value)}
                      style={styles.select}
                      required
                      disabled={submitting}
                    >
                      <option value="">-- Choose Loan --</option>
                      {activeLoans.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.bank_name} {l.reference_number ? `(${l.reference_number})` : ""} — Remaining: Rs.{" "}
                          {l.remaining_balance.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Principal Amount (Rs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={principalAmount}
                      onChange={(e) => setPrincipalAmount(e.target.value)}
                      style={styles.input}
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Interest / Markup (Rs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={interestAmount}
                      onChange={(e) => setInterestAmount(e.target.value)}
                      style={styles.input}
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Payment Date</label>
                    <input
                      type="date"
                      value={repayDate}
                      onChange={(e) => setRepayDate(e.target.value)}
                      style={styles.input}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label style={styles.fieldLabel}>Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly installment via cheque"
                    value={repayDescription}
                    onChange={(e) => setRepayDescription(e.target.value)}
                    style={styles.input}
                    disabled={submitting}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowRepayForm(false)}
                    style={styles.buttonSecondary}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" style={styles.buttonPrimary} disabled={submitting}>
                    {submitting ? "Saving..." : "Record Repayment"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Bank Loans List */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ ...styles.sectionTitle, fontSize: "1.2rem", margin: 0 }}>
                Active & Settled Bank Loans
              </h2>
              <span style={{ fontSize: "0.85rem", color: colors.muted }}>
                {bankLoansData?.loans?.length || 0} loan(s) total
              </span>
            </div>

            {loading ? (
              <p style={{ color: colors.muted }}>Loading bank loans...</p>
            ) : !bankLoansData || bankLoansData.loans.length === 0 ? (
              <p style={{ color: colors.muted }}>No bank loans recorded yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                      <th style={styles.tableHeaderCell}>Disbursal Date</th>
                      <th style={styles.tableHeaderCell}>Bank Name</th>
                      <th style={styles.tableHeaderCell}>Reference #</th>
                      <th style={styles.tableHeaderCell}>Borrowed Amount</th>
                      <th style={styles.tableHeaderCell}>Principal Repaid</th>
                      <th style={styles.tableHeaderCell}>Interest Paid</th>
                      <th style={styles.tableHeaderCell}>Remaining Principal</th>
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
                          <td style={styles.tableCell}>{formatDateTime(loan.disbursal_date || loan.created_at)}</td>
                          <td style={styles.tableCell}>
                            <strong>{loan.bank_name}</strong>
                          </td>
                          <td style={styles.tableCell}>{loan.reference_number || "—"}</td>
                          <td style={styles.tableCell}>Rs. {loan.loan_amount.toFixed(2)}</td>
                          <td style={styles.tableCell}>Rs. {loan.total_principal_repaid.toFixed(2)}</td>
                          <td style={styles.tableCell}>Rs. {loan.total_interest_paid.toFixed(2)}</td>
                          <td style={styles.tableCell}>
                            <strong style={{ color: loan.remaining_balance > 0 ? "#ef4444" : "#10b981" }}>
                              Rs. {loan.remaining_balance.toFixed(2)}
                            </strong>
                          </td>
                          <td style={styles.tableCell}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "#fff",
                                backgroundColor: isVoided ? colors.danger : isClosed ? colors.muted : "#d97706",
                              }}
                            >
                              {isVoided ? "Voided" : isClosed ? "Closed" : "Active"}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                type="button"
                                onClick={() => handleViewLoanHistory(loan)}
                                style={{
                                  ...styles.buttonSecondary,
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  color: colors.primary,
                                  borderColor: colors.primary,
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
