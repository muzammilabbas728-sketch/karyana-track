"""Business Cash Balance, Money Management & Bank Loans router."""

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import transaction
from ..models import (
    BankLoanCreate,
    BankLoanRepaymentCreate,
    BankLoanRepaymentResponse,
    BankLoanResponse,
    BankLoansOverviewResponse,
    CashBreakdownIn,
    CashBreakdownOut,
    CashSummaryResponse,
    CashTransactionCreate,
    CashTransactionResponse,
)
from .auth import require_role

router = APIRouter(prefix="/cash", tags=["cash"])

VALID_TRANSACTION_TYPES = {
    "owner_investment",
    "owner_withdrawal",
    "loan_given",
    "loan_repayment",
    "other_income",
    "other_expense",
}


def _fetch_cash_summary(cursor: Any) -> CashSummaryResponse:
    """Calculate and return the complete business cash summary from database."""
    # 1. Money In
    # a) Paid cash sales
    row_sales = cursor.execute(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE payment_status = 'paid' AND voided = 0"
    ).fetchone()
    sales_cash = float(row_sales[0]) if row_sales else 0.0

    # b) Customer credit payments received
    row_cust = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM customer_payments"
    ).fetchone()
    customer_payments = float(row_cust[0]) if row_cust else 0.0

    # c) Owner investments (cash_transactions + legacy investments table)
    row_owner_inv = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE type = 'owner_investment' AND status = 'active'"
    ).fetchone()
    row_legacy_inv = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM investments"
    ).fetchone()
    owner_investments = (float(row_owner_inv[0]) if row_owner_inv else 0.0) + (
        float(row_legacy_inv[0]) if row_legacy_inv else 0.0
    )

    # d) Loan repayments received from third parties (Loan Given)
    row_loan_rep = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE type = 'loan_repayment' AND status = 'active'"
    ).fetchone()
    loan_repayments = float(row_loan_rep[0]) if row_loan_rep else 0.0

    # e) Bank loans received (Money borrowed from bank)
    row_bank_loans = cursor.execute(
        "SELECT COALESCE(SUM(loan_amount), 0) FROM bank_loans WHERE status != 'voided'"
    ).fetchone()
    bank_loans_received = float(row_bank_loans[0]) if row_bank_loans else 0.0

    # f) Other business income
    row_other_in = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE type = 'other_income' AND status = 'active'"
    ).fetchone()
    other_income = float(row_other_in[0]) if row_other_in else 0.0

    total_in = round(sales_cash + customer_payments + owner_investments + loan_repayments + bank_loans_received + other_income, 2)

    # 2. Money Out
    # a) Inventory purchases paid upfront
    row_purchases = cursor.execute(
        """
        SELECT COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_cost ELSE amount_paid END), 0)
        FROM inventory_purchases
        WHERE status = 'active'
        """
    ).fetchone()
    purchases_paid = float(row_purchases[0]) if row_purchases else 0.0

    # b) Supplier credit payments made
    row_supp_pay = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM supplier_payments"
    ).fetchone()
    supplier_payments = float(row_supp_pay[0]) if row_supp_pay else 0.0

    # c) Owner withdrawals
    row_owner_with = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE type = 'owner_withdrawal' AND status = 'active'"
    ).fetchone()
    owner_withdrawals = float(row_owner_with[0]) if row_owner_with else 0.0

    # d) Loans given to third parties
    row_loan_giv = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE type = 'loan_given' AND status = 'active'"
    ).fetchone()
    loans_given = float(row_loan_giv[0]) if row_loan_giv else 0.0

    # e) Bank loan principal repayments
    row_bl_prin = cursor.execute(
        "SELECT COALESCE(SUM(principal_amount), 0) FROM bank_loan_repayments WHERE status = 'active'"
    ).fetchone()
    bank_loan_principal = float(row_bl_prin[0]) if row_bl_prin else 0.0

    # f) Bank loan interest payments
    row_bl_int = cursor.execute(
        "SELECT COALESCE(SUM(interest_amount), 0) FROM bank_loan_repayments WHERE status = 'active'"
    ).fetchone()
    bank_loan_interest = float(row_bl_int[0]) if row_bl_int else 0.0

    # g) Other business expenses
    row_other_exp = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE type = 'other_expense' AND status = 'active'"
    ).fetchone()
    other_expenses = float(row_other_exp[0]) if row_other_exp else 0.0

    total_out = round(purchases_paid + supplier_payments + owner_withdrawals + loans_given + bank_loan_principal + bank_loan_interest + other_expenses, 2)

    balance = round(total_in - total_out, 2)

    # Outstanding Bank Loans: sum of active loans minus sum of active principal repayments for those loans
    row_active_loans = cursor.execute(
        "SELECT COALESCE(SUM(loan_amount), 0) FROM bank_loans WHERE status != 'voided'"
    ).fetchone()
    total_borrowed_active = float(row_active_loans[0]) if row_active_loans else 0.0
    outstanding_bank_loans = max(0.0, round(total_borrowed_active - bank_loan_principal, 2))

    # Recent transactions
    recent_rows = cursor.execute(
        """
        SELECT ct.id, ct.user_id, u.name AS user_name, ct.type, ct.amount, ct.description,
               ct.date, ct.status, ct.created_at
        FROM cash_transactions ct
        JOIN users u ON ct.user_id = u.id
        ORDER BY ct.id DESC
        LIMIT 10
        """
    ).fetchall()

    recent_list = [
        CashTransactionResponse(
            id=r["id"],
            user_id=r["user_id"],
            user_name=r["user_name"],
            type=r["type"],
            amount=float(r["amount"]),
            description=r["description"],
            date=str(r["date"]),
            status=r["status"],
            created_at=r["created_at"],
        )
        for r in recent_rows
    ]

    return CashSummaryResponse(
        current_balance=balance,
        total_money_in=total_in,
        total_money_out=total_out,
        total_outstanding_bank_loans=outstanding_bank_loans,
        breakdown_in=CashBreakdownIn(
            sales_cash=round(sales_cash, 2),
            customer_payments=round(customer_payments, 2),
            owner_investments=round(owner_investments, 2),
            loan_repayments=round(loan_repayments, 2),
            bank_loans_received=round(bank_loans_received, 2),
            other_income=round(other_income, 2),
            total=total_in,
        ),
        breakdown_out=CashBreakdownOut(
            purchases_paid=round(purchases_paid, 2),
            supplier_payments=round(supplier_payments, 2),
            owner_withdrawals=round(owner_withdrawals, 2),
            loans_given=round(loans_given, 2),
            bank_loan_principal=round(bank_loan_principal, 2),
            bank_loan_interest=round(bank_loan_interest, 2),
            other_expenses=round(other_expenses, 2),
            total=total_out,
        ),
        recent_transactions=recent_list,
    )


@router.get("/summary", response_model=CashSummaryResponse)
def get_cash_summary(
    current_user: dict = Depends(require_role("owner")),
) -> CashSummaryResponse:
    """Retrieve full Business Cash balance and breakdown (owner only)."""
    with transaction() as cursor:
        return _fetch_cash_summary(cursor)


@router.get("/transactions", response_model=List[CashTransactionResponse])
def list_cash_transactions(
    type_filter: Optional[str] = Query(None, alias="type", description="Filter by transaction type"),
    from_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    current_user: dict = Depends(require_role("owner")),
) -> List[CashTransactionResponse]:
    """List cash transactions with optional type and date range filters (owner only)."""
    query = """
        SELECT ct.id, ct.user_id, u.name AS user_name, ct.type, ct.amount, ct.description,
               ct.date, ct.status, ct.created_at
        FROM cash_transactions ct
        JOIN users u ON ct.user_id = u.id
        WHERE 1=1
    """
    params: List[Any] = []

    if type_filter and type_filter in VALID_TRANSACTION_TYPES:
        query += " AND ct.type = ?"
        params.append(type_filter)

    if from_date:
        query += " AND ct.date >= ?"
        params.append(from_date)

    if to_date:
        query += " AND ct.date <= ?"
        params.append(to_date)

    query += " ORDER BY ct.id DESC"

    with transaction() as cursor:
        rows = cursor.execute(query, tuple(params)).fetchall()

    return [
        CashTransactionResponse(
            id=r["id"],
            user_id=r["user_id"],
            user_name=r["user_name"],
            type=r["type"],
            amount=float(r["amount"]),
            description=r["description"],
            date=str(r["date"]),
            status=r["status"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.post("/transactions", response_model=CashTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_cash_transaction(
    payload: CashTransactionCreate,
    current_user: dict = Depends(require_role("owner")),
) -> CashTransactionResponse:
    """Record a new cash movement transaction (owner only)."""
    if payload.type not in VALID_TRANSACTION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transaction type '{payload.type}'. Must be one of: {', '.join(sorted(VALID_TRANSACTION_TYPES))}",
        )

    tx_date = payload.date if payload.date else date.today().isoformat()
    desc_clean = payload.description.strip() if payload.description else None

    with transaction() as cursor:
        cursor.execute(
            """
            INSERT INTO cash_transactions (user_id, type, amount, description, date, status)
            VALUES (?, ?, ?, ?, ?, 'active')
            """,
            (current_user["id"], payload.type, payload.amount, desc_clean, tx_date),
        )
        tx_id = cursor.lastrowid

        row = cursor.execute(
            """
            SELECT ct.id, ct.user_id, u.name AS user_name, ct.type, ct.amount, ct.description,
                   ct.date, ct.status, ct.created_at
            FROM cash_transactions ct
            JOIN users u ON ct.user_id = u.id
            WHERE ct.id = ?
            """,
            (tx_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record cash transaction",
        )

    return CashTransactionResponse(
        id=row["id"],
        user_id=row["user_id"],
        user_name=row["user_name"],
        type=row["type"],
        amount=float(row["amount"]),
        description=row["description"],
        date=str(row["date"]),
        status=row["status"],
        created_at=row["created_at"],
    )


@router.post("/transactions/{transaction_id}/void", response_model=CashTransactionResponse)
def void_cash_transaction(
    transaction_id: int,
    current_user: dict = Depends(require_role("owner")),
) -> CashTransactionResponse:
    """Void a cash transaction (owner only)."""
    with transaction() as cursor:
        row = cursor.execute(
            "SELECT id, status FROM cash_transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )

        if row["status"] == "voided":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction is already voided",
            )

        cursor.execute(
            "UPDATE cash_transactions SET status = 'voided' WHERE id = ?",
            (transaction_id,),
        )

        updated_row = cursor.execute(
            """
            SELECT ct.id, ct.user_id, u.name AS user_name, ct.type, ct.amount, ct.description,
                   ct.date, ct.status, ct.created_at
            FROM cash_transactions ct
            JOIN users u ON ct.user_id = u.id
            WHERE ct.id = ?
            """,
            (transaction_id,),
        ).fetchone()

    return CashTransactionResponse(
        id=updated_row["id"],
        user_id=updated_row["user_id"],
        user_name=updated_row["user_name"],
        type=updated_row["type"],
        amount=float(updated_row["amount"]),
        description=updated_row["description"],
        date=str(updated_row["date"]),
        status=updated_row["status"],
        created_at=updated_row["created_at"],
    )


# ==========================================
# BANK LOANS & REPAYMENTS ENDPOINTS
# ==========================================


@router.get("/bank-loans", response_model=BankLoansOverviewResponse)
def list_bank_loans(
    current_user: dict = Depends(require_role("owner")),
) -> BankLoansOverviewResponse:
    """Retrieve all bank loans with live outstanding principal calculations (owner only)."""
    with transaction() as cursor:
        rows = cursor.execute(
            """
            SELECT bl.id, bl.user_id, u.name AS user_name, bl.bank_name, bl.loan_amount,
                   bl.disbursal_date, bl.reference_number, bl.description, bl.status, bl.created_at,
                   COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.principal_amount ELSE 0 END), 0) AS total_principal_repaid,
                   COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.interest_amount ELSE 0 END), 0) AS total_interest_paid
            FROM bank_loans bl
            JOIN users u ON bl.user_id = u.id
            LEFT JOIN bank_loan_repayments r ON bl.id = r.bank_loan_id
            GROUP BY bl.id
            ORDER BY bl.id DESC
            """
        ).fetchall()

        loan_responses: List[BankLoanResponse] = []
        overall_borrowed = 0.0
        overall_principal_repaid = 0.0
        overall_interest_paid = 0.0
        overall_outstanding = 0.0

        for r in rows:
            l_amt = float(r["loan_amount"])
            p_rep = float(r["total_principal_repaid"])
            i_rep = float(r["total_interest_paid"])
            rem = max(0.0, round(l_amt - p_rep, 2)) if r["status"] != "voided" else 0.0

            if r["status"] != "voided":
                overall_borrowed += l_amt
                overall_principal_repaid += p_rep
                overall_interest_paid += i_rep
                overall_outstanding += rem

            loan_responses.append(
                BankLoanResponse(
                    id=r["id"],
                    user_id=r["user_id"],
                    user_name=r["user_name"],
                    bank_name=r["bank_name"],
                    loan_amount=l_amt,
                    disbursal_date=str(r["disbursal_date"]),
                    reference_number=r["reference_number"],
                    description=r["description"],
                    status=r["status"],
                    created_at=r["created_at"],
                    total_principal_repaid=round(p_rep, 2),
                    total_interest_paid=round(i_rep, 2),
                    remaining_balance=round(rem, 2),
                )
            )

        return BankLoansOverviewResponse(
            total_borrowed=round(overall_borrowed, 2),
            total_principal_repaid=round(overall_principal_repaid, 2),
            total_interest_paid=round(overall_interest_paid, 2),
            total_outstanding=round(overall_outstanding, 2),
            loans=loan_responses,
        )


@router.post("/bank-loans", response_model=BankLoanResponse, status_code=status.HTTP_201_CREATED)
def create_bank_loan(
    payload: BankLoanCreate,
    current_user: dict = Depends(require_role("owner")),
) -> BankLoanResponse:
    """Record a newly disbursed bank loan (owner only)."""
    bank_clean = payload.bank_name.strip()
    if not bank_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bank name is required",
        )

    disbursal = payload.disbursal_date if payload.disbursal_date else date.today().isoformat()
    ref_clean = payload.reference_number.strip() if payload.reference_number else None
    desc_clean = payload.description.strip() if payload.description else None

    with transaction() as cursor:
        cursor.execute(
            """
            INSERT INTO bank_loans (user_id, bank_name, loan_amount, disbursal_date, reference_number, description, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
            """,
            (current_user["id"], bank_clean, payload.loan_amount, disbursal, ref_clean, desc_clean),
        )
        loan_id = cursor.lastrowid

        row = cursor.execute(
            """
            SELECT bl.id, bl.user_id, u.name AS user_name, bl.bank_name, bl.loan_amount,
                   bl.disbursal_date, bl.reference_number, bl.description, bl.status, bl.created_at
            FROM bank_loans bl
            JOIN users u ON bl.user_id = u.id
            WHERE bl.id = ?
            """,
            (loan_id,),
        ).fetchone()

    return BankLoanResponse(
        id=row["id"],
        user_id=row["user_id"],
        user_name=row["user_name"],
        bank_name=row["bank_name"],
        loan_amount=float(row["loan_amount"]),
        disbursal_date=str(row["disbursal_date"]),
        reference_number=row["reference_number"],
        description=row["description"],
        status=row["status"],
        created_at=row["created_at"],
        total_principal_repaid=0.0,
        total_interest_paid=0.0,
        remaining_balance=float(row["loan_amount"]),
    )


@router.post("/bank-loans/{loan_id}/void", response_model=BankLoanResponse)
def void_bank_loan(
    loan_id: int,
    current_user: dict = Depends(require_role("owner")),
) -> BankLoanResponse:
    """Void a bank loan entry (owner only). Cannot void if active repayments exist."""
    with transaction() as cursor:
        row = cursor.execute(
            "SELECT id, status, loan_amount FROM bank_loans WHERE id = ?",
            (loan_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bank loan not found",
            )

        if row["status"] == "voided":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bank loan is already voided",
            )

        # Check for active repayments
        active_reps = cursor.execute(
            "SELECT COUNT(*) FROM bank_loan_repayments WHERE bank_loan_id = ? AND status = 'active'",
            (loan_id,),
        ).fetchone()[0]

        if active_reps > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot void a bank loan with active repayments. Please void all repayments for this loan first.",
            )

        cursor.execute(
            "UPDATE bank_loans SET status = 'voided' WHERE id = ?",
            (loan_id,),
        )

        updated_row = cursor.execute(
            """
            SELECT bl.id, bl.user_id, u.name AS user_name, bl.bank_name, bl.loan_amount,
                   bl.disbursal_date, bl.reference_number, bl.description, bl.status, bl.created_at
            FROM bank_loans bl
            JOIN users u ON bl.user_id = u.id
            WHERE bl.id = ?
            """,
            (loan_id,),
        ).fetchone()

    return BankLoanResponse(
        id=updated_row["id"],
        user_id=updated_row["user_id"],
        user_name=updated_row["user_name"],
        bank_name=updated_row["bank_name"],
        loan_amount=float(updated_row["loan_amount"]),
        disbursal_date=str(updated_row["disbursal_date"]),
        reference_number=updated_row["reference_number"],
        description=updated_row["description"],
        status=updated_row["status"],
        created_at=updated_row["created_at"],
        total_principal_repaid=0.0,
        total_interest_paid=0.0,
        remaining_balance=0.0,
    )


@router.get("/bank-loans/{loan_id}/repayments", response_model=List[BankLoanRepaymentResponse])
def get_bank_loan_repayments(
    loan_id: int,
    current_user: dict = Depends(require_role("owner")),
) -> List[BankLoanRepaymentResponse]:
    """Retrieve full repayment history for a specific bank loan (owner only)."""
    with transaction() as cursor:
        rows = cursor.execute(
            """
            SELECT r.id, r.bank_loan_id, bl.bank_name, r.user_id, u.name AS user_name,
                   r.payment_date, r.principal_amount, r.interest_amount, r.total_payment,
                   r.description, r.status, r.created_at
            FROM bank_loan_repayments r
            JOIN bank_loans bl ON r.bank_loan_id = bl.id
            JOIN users u ON r.user_id = u.id
            WHERE r.bank_loan_id = ?
            ORDER BY r.id DESC
            """,
            (loan_id,),
        ).fetchall()

    return [
        BankLoanRepaymentResponse(
            id=r["id"],
            bank_loan_id=r["bank_loan_id"],
            bank_name=r["bank_name"],
            user_id=r["user_id"],
            user_name=r["user_name"],
            payment_date=str(r["payment_date"]),
            principal_amount=float(r["principal_amount"]),
            interest_amount=float(r["interest_amount"]),
            total_payment=float(r["total_payment"]),
            description=r["description"],
            status=r["status"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.post("/bank-loans/{loan_id}/repayments", response_model=BankLoanRepaymentResponse, status_code=status.HTTP_201_CREATED)
def create_bank_loan_repayment(
    loan_id: int,
    payload: BankLoanRepaymentCreate,
    current_user: dict = Depends(require_role("owner")),
) -> BankLoanRepaymentResponse:
    """Record a repayment against a bank loan (owner only)."""
    if payload.principal_amount <= 0 and payload.interest_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repayment must contain either a positive principal amount or interest amount.",
        )

    pay_date = payload.payment_date if payload.payment_date else date.today().isoformat()
    desc_clean = payload.description.strip() if payload.description else None
    total_pay = round(payload.principal_amount + payload.interest_amount, 2)

    with transaction() as cursor:
        loan_row = cursor.execute(
            "SELECT id, bank_name, loan_amount, status FROM bank_loans WHERE id = ?",
            (loan_id,),
        ).fetchone()

        if loan_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bank loan not found",
            )

        if loan_row["status"] == "voided":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot record repayment against a voided bank loan.",
            )

        # Check existing active principal repayments
        row_rep = cursor.execute(
            "SELECT COALESCE(SUM(principal_amount), 0) FROM bank_loan_repayments WHERE bank_loan_id = ? AND status = 'active'",
            (loan_id,),
        ).fetchone()
        already_repaid_principal = float(row_rep[0]) if row_rep else 0.0
        remaining_principal = round(float(loan_row["loan_amount"]) - already_repaid_principal, 2)

        if payload.principal_amount > remaining_principal + 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Principal repayment (Rs. {payload.principal_amount:.2f}) exceeds outstanding principal balance (Rs. {remaining_principal:.2f}).",
            )

        cursor.execute(
            """
            INSERT INTO bank_loan_repayments (bank_loan_id, user_id, payment_date, principal_amount, interest_amount, total_payment, description, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            """,
            (
                loan_id,
                current_user["id"],
                pay_date,
                payload.principal_amount,
                payload.interest_amount,
                total_pay,
                desc_clean,
            ),
        )
        rep_id = cursor.lastrowid

        # If fully paid off, update status to closed
        if round(remaining_principal - payload.principal_amount, 2) <= 0.001:
            cursor.execute(
                "UPDATE bank_loans SET status = 'closed' WHERE id = ?",
                (loan_id,),
            )

        rep_row = cursor.execute(
            """
            SELECT r.id, r.bank_loan_id, bl.bank_name, r.user_id, u.name AS user_name,
                   r.payment_date, r.principal_amount, r.interest_amount, r.total_payment,
                   r.description, r.status, r.created_at
            FROM bank_loan_repayments r
            JOIN bank_loans bl ON r.bank_loan_id = bl.id
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
            """,
            (rep_id,),
        ).fetchone()

    return BankLoanRepaymentResponse(
        id=rep_row["id"],
        bank_loan_id=rep_row["bank_loan_id"],
        bank_name=rep_row["bank_name"],
        user_id=rep_row["user_id"],
        user_name=rep_row["user_name"],
        payment_date=str(rep_row["payment_date"]),
        principal_amount=float(rep_row["principal_amount"]),
        interest_amount=float(rep_row["interest_amount"]),
        total_payment=float(rep_row["total_payment"]),
        description=rep_row["description"],
        status=rep_row["status"],
        created_at=rep_row["created_at"],
    )


@router.post("/bank-loans/repayments/{repayment_id}/void", response_model=BankLoanRepaymentResponse)
def void_bank_loan_repayment(
    repayment_id: int,
    current_user: dict = Depends(require_role("owner")),
) -> BankLoanRepaymentResponse:
    """Void a bank loan repayment (owner only)."""
    with transaction() as cursor:
        rep_row = cursor.execute(
            "SELECT id, bank_loan_id, status FROM bank_loan_repayments WHERE id = ?",
            (repayment_id,),
        ).fetchone()

        if rep_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repayment not found",
            )

        if rep_row["status"] == "voided":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Repayment is already voided",
            )

        cursor.execute(
            "UPDATE bank_loan_repayments SET status = 'voided' WHERE id = ?",
            (repayment_id,),
        )

        # Ensure loan status is active if it was closed
        cursor.execute(
            "UPDATE bank_loans SET status = 'active' WHERE id = ? AND status = 'closed'",
            (rep_row["bank_loan_id"],),
        )

        updated_row = cursor.execute(
            """
            SELECT r.id, r.bank_loan_id, bl.bank_name, r.user_id, u.name AS user_name,
                   r.payment_date, r.principal_amount, r.interest_amount, r.total_payment,
                   r.description, r.status, r.created_at
            FROM bank_loan_repayments r
            JOIN bank_loans bl ON r.bank_loan_id = bl.id
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
            """,
            (repayment_id,),
        ).fetchone()

    return BankLoanRepaymentResponse(
        id=updated_row["id"],
        bank_loan_id=updated_row["bank_loan_id"],
        bank_name=updated_row["bank_name"],
        user_id=updated_row["user_id"],
        user_name=updated_row["user_name"],
        payment_date=str(updated_row["payment_date"]),
        principal_amount=float(updated_row["principal_amount"]),
        interest_amount=float(updated_row["interest_amount"]),
        total_payment=float(updated_row["total_payment"]),
        description=updated_row["description"],
        status=updated_row["status"],
        created_at=updated_row["created_at"],
    )
