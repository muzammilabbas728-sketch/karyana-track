"""Pydantic models for the product and sale resources."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    """Schema used to create a new product."""

    name: str = Field(..., description="Product name")
    barcode: Optional[str] = Field(default=None, description="Unique product barcode")
    cost_price: float = Field(..., ge=0, description="Cost price of the product")
    selling_price: float = Field(..., ge=0, description="Selling price of the product")
    quantity_in_stock: int = Field(..., ge=0, description="Current stock quantity")
    unit_type: Literal["piece", "weight", "pack"] = Field(
        default="piece",
        description="Whether this product is sold as whole units or by weight in grams or as packs",
    )
    units_per_pack: Optional[int] = Field(
        default=None,
        gt=0,
        description="Number of individual units in one pack (required when unit_type is 'pack')",
    )
    low_stock_threshold: int = Field(default=5, ge=0, description="Threshold for low stock warnings")


class ProductUpdate(BaseModel):
    """Schema used for partially updating an existing product."""

    name: Optional[str] = Field(default=None, description="Product name")
    barcode: Optional[str] = Field(default=None, description="Unique product barcode")
    cost_price: Optional[float] = Field(default=None, ge=0, description="Cost price of the product")
    selling_price: Optional[float] = Field(default=None, ge=0, description="Selling price of the product")
    quantity_in_stock: Optional[int] = Field(default=None, ge=0, description="Current stock quantity")
    unit_type: Optional[Literal["piece", "weight", "pack"]] = Field(
        default=None,
        description="Whether this product is sold as whole units or by weight in grams or as packs",
    )
    units_per_pack: Optional[int] = Field(default=None, gt=0)
    low_stock_threshold: Optional[int] = Field(default=None, ge=0, description="Threshold for low stock warnings")


class ProductResponse(BaseModel):
    """Schema returned for product API responses."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Unique product identifier")
    name: str = Field(..., description="Product name")
    barcode: Optional[str] = Field(default=None, description="Unique product barcode")
    cost_price: float = Field(..., ge=0, description="Cost price of the product")
    selling_price: float = Field(..., ge=0, description="Selling price of the product")
    quantity_in_stock: int = Field(..., description="Current stock quantity")
    unit_type: str = Field(..., description="Whether this product is sold as whole units or by weight in grams or as packs")
    units_per_pack: Optional[int] = Field(default=None)
    low_stock_threshold: int = Field(..., description="Threshold for low stock warnings")
    is_active: bool = Field(..., description="Whether the product is active")
    created_at: Optional[datetime] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")


class StockAdjustmentRequest(BaseModel):
    """Schema used to adjust product stock quantities."""

    change_amount: int = Field(..., description="Quantity change to apply to stock")
    reason: Literal["restock", "damaged", "expired", "correction"] = Field(
        ..., description="Reason for the stock adjustment"
    )


class StockAdjustmentHistoryItem(BaseModel):
    """Response payload for a stock adjustment history record."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Stock adjustment identifier")
    change_amount: int = Field(..., description="Quantity change applied")
    reason: Literal["restock", "damaged", "expired", "correction"] = Field(
        ..., description="Reason for the stock adjustment"
    )
    user_name: str = Field(..., description="Name of the user who made the adjustment")
    created_at: datetime = Field(..., description="Timestamp when the adjustment was recorded")


class SaleItemRequest(BaseModel):
    """Input payload for a single sale line item."""

    product_id: int = Field(..., description="Identifier of the product being sold")
    quantity: int = Field(..., gt=0, description="Quantity to sell")
    sell_as_pack: bool = Field(
        default=False,
        description="For pack-type products, whether this line item sells one full pack (true) or individual loose units (false)",
    )


class SaleCreate(BaseModel):
    """Input payload for creating a new sale."""

    items: List[SaleItemRequest] = Field(..., min_length=1, description="Sale line items")
    customer_id: Optional[int] = Field(default=None, description="Customer ID if this sale is on credit")
    payment_status: Literal["paid", "credit"] = Field(
        default="paid", description="Whether this sale was paid immediately or is on credit"
    )


class SaleItemUpdate(BaseModel):
    """Input payload for updating a sale line item."""

    product_id: int = Field(..., description="Identifier of the product")
    quantity: int = Field(..., gt=0, description="Quantity")
    unit_price: Optional[float] = Field(default=None, ge=0, description="Custom unit price override if specified")
    sell_as_pack: bool = Field(
        default=False,
        description="For pack-type products, whether this line item sells one full pack (true) or individual loose units (false)",
    )


class SaleUpdate(BaseModel):
    """Input payload for updating an existing sale."""

    items: List[SaleItemUpdate] = Field(..., min_length=1, description="Updated sale line items")
    customer_id: Optional[int] = Field(default=None, description="Customer ID if sale is on credit")
    payment_status: Literal["paid", "credit"] = Field(
        default="paid", description="Whether this sale is paid immediately or on credit"
    )


class SaleItemResponse(BaseModel):
    """Response payload for a single sale line item."""

    model_config = {"from_attributes": True}

    product_id: int = Field(..., description="Product identifier")
    product_name: str = Field(..., description="Product name")
    quantity: int = Field(..., gt=0, description="Quantity sold")
    unit_price: float = Field(..., ge=0, description="Selling price snapshot")
    unit_cost: Optional[float] = Field(default=None, description="Cost price snapshot")
    line_total: float = Field(..., ge=0, description="Line item total")


class SaleResponse(BaseModel):
    """Response payload for a completed sale."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Sale identifier")
    user_id: int = Field(..., description="User who created the sale")
    customer_id: Optional[int] = Field(default=None, description="Customer identifier if sale is on credit")
    total_amount: float = Field(..., ge=0, description="Total sale amount")
    total_profit: Optional[float] = Field(default=None, description="Total sale profit")
    payment_status: str = Field(default="paid", description="Payment status")
    created_at: datetime = Field(..., description="Sale creation timestamp")
    items: List[SaleItemResponse] = Field(..., description="Sale line items")


class LoginRequest(BaseModel):
    """Input payload for a user login request."""

    username: str = Field(..., description="Username")
    pin: str = Field(..., description="PIN")


class LoginResponse(BaseModel):
    """Response payload returned after a successful login."""

    token: str = Field(..., description="Authentication token")
    role: str = Field(..., description="User role")
    name: str = Field(..., description="User display name")


class UserCreate(BaseModel):
    """Schema used to create a new user."""

    name: str = Field(..., description="User full name")
    username: str = Field(..., description="Username")
    pin: str = Field(..., min_length=4, description="User PIN")
    role: Literal["owner", "staff"] = Field(..., description="User role")


class UserResponse(BaseModel):
    """Response payload representing a user."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="User identifier")
    name: str = Field(..., description="User full name")
    username: str = Field(..., description="Username")
    role: str = Field(..., description="User role")
    created_at: datetime = Field(..., description="Creation timestamp")


class PinChangeRequest(BaseModel):
    """Schema used to update a user's PIN."""

    new_pin: str = Field(..., min_length=4, description="New PIN")


class CustomerCreate(BaseModel):
    """Schema used to create a new customer."""

    name: str = Field(..., description="Customer full name")
    phone: Optional[str] = Field(default=None, description="Customer phone number")
    credit_limit: Optional[float] = Field(default=None, ge=0, description="Customer credit limit")


class CustomerResponse(BaseModel):
    """Response payload representing a customer with computed credit balance."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Customer identifier")
    name: str = Field(..., description="Customer full name")
    phone: Optional[str] = Field(default=None, description="Customer phone number")
    credit_limit: Optional[float] = Field(default=None, description="Customer credit limit")
    created_at: datetime = Field(..., description="Customer creation timestamp")
    balance: float = Field(..., description="Computed customer credit balance")


class CustomerPaymentCreate(BaseModel):
    """Schema used to record a payment against a customer's balance."""

    amount: float = Field(..., gt=0, description="Payment amount")


class CustomerPaymentResponse(BaseModel):
    """Response payload for a customer payment record."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Payment identifier")
    amount: float = Field(..., description="Payment amount")
    user_name: str = Field(..., description="Name of user who recorded the payment")
    created_at: datetime = Field(..., description="Payment timestamp")


class InvestmentCreate(BaseModel):
    """Schema used to record an owner capital investment."""

    amount: float = Field(..., gt=0, description="Capital investment amount")
    description: Optional[str] = Field(default=None, description="Note or description for the investment")


class InvestmentResponse(BaseModel):
    """Response payload for an owner capital investment record."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Investment identifier")
    user_id: int = Field(..., description="User ID who recorded the investment")
    user_name: Optional[str] = Field(default=None, description="Name of user who recorded the investment")
    amount: float = Field(..., description="Capital investment amount")
    description: Optional[str] = Field(default=None, description="Investment description or note")
    created_at: datetime = Field(..., description="Investment timestamp")


class InvestmentSummaryResponse(BaseModel):
    """Response payload containing total owner investment and history."""

    total_investment: float = Field(..., description="Sum of all owner capital investments")
    investments: List[InvestmentResponse] = Field(..., description="List of investment records")


class SupplierCreate(BaseModel):
    """Schema for creating a supplier."""

    name: str = Field(..., min_length=1, description="Supplier or vendor name")
    phone: Optional[str] = Field(default=None, description="Supplier phone number")


class SupplierResponse(BaseModel):
    """Response payload for a supplier."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Supplier identifier")
    name: str = Field(..., description="Supplier name")
    phone: Optional[str] = Field(default=None, description="Supplier phone number")
    created_at: datetime = Field(..., description="Account creation timestamp")
    balance_owed: float = Field(0.0, description="Computed net balance owed to supplier")


class SupplierPaymentCreate(BaseModel):
    """Schema for recording a payment to a supplier."""

    amount: float = Field(..., gt=0, description="Payment amount")


class SupplierPaymentResponse(BaseModel):
    """Response payload for a recorded supplier payment."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Payment identifier")
    supplier_id: int = Field(..., description="Supplier identifier")
    user_id: int = Field(..., description="User ID who recorded payment")
    user_name: Optional[str] = Field(default=None, description="Name of user who recorded payment")
    amount: float = Field(..., description="Payment amount")
    created_at: datetime = Field(..., description="Payment timestamp")


class PurchaseItemCreate(BaseModel):
    """Schema for an item in a purchase record."""

    product_id: int = Field(..., description="Product identifier")
    quantity: int = Field(..., gt=0, description="Quantity purchased")
    cost_price: float = Field(..., ge=0, description="Cost per unit purchased")
    is_new_product: Optional[bool] = Field(default=False, description="Whether product was created with initial stock set")
    skip_stock_increment: Optional[bool] = Field(default=False, description="Whether to skip stock increment step")


class PurchaseCreate(BaseModel):
    """Schema used to record an inventory purchase."""

    supplier_id: Optional[int] = Field(default=None, description="Supplier ID if selected from directory")
    supplier_name: Optional[str] = Field(default=None, description="Supplier name or vendor")
    payment_status: Literal["paid", "partial", "credit"] = Field(
        default="paid", description="Payment status of purchase ('paid', 'partial', 'credit')"
    )
    amount_paid: Optional[float] = Field(default=0.0, ge=0, description="Amount paid immediately for partial/paid purchases")
    notes: Optional[str] = Field(default=None, description="Optional note or reference for purchase")
    items: List[PurchaseItemCreate] = Field(..., min_length=1, description="Purchase line items")


class PurchaseItemResponse(BaseModel):
    """Response payload for a purchase line item."""

    model_config = {"from_attributes": True}

    product_id: int = Field(..., description="Product identifier")
    product_name: str = Field(..., description="Product name")
    quantity: int = Field(..., description="Quantity purchased")
    cost_price: float = Field(..., description="Unit cost price")
    total_cost: float = Field(..., description="Line total cost")


class PurchaseResponse(BaseModel):
    """Response payload for an inventory purchase record."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Purchase identifier")
    user_id: int = Field(..., description="User ID who recorded the purchase")
    user_name: Optional[str] = Field(default=None, description="User display name")
    supplier_id: Optional[int] = Field(default=None, description="Supplier ID")
    supplier_name: Optional[str] = Field(default=None, description="Supplier name")
    total_cost: float = Field(..., description="Total purchase cost")
    payment_status: str = Field(..., description="Payment status ('paid', 'partial', 'credit')")
    amount_paid: float = Field(0.0, description="Amount paid upfront")
    notes: Optional[str] = Field(default=None, description="Purchase notes")
    status: str = Field(..., description="Purchase status ('active' or 'cancelled')")
    created_at: datetime = Field(..., description="Purchase creation timestamp")
    items: List[PurchaseItemResponse] = Field(..., description="Purchase line items")


class PurchaseSummaryResponse(BaseModel):
    """Response payload containing total investment in inventory purchases and history."""

    total_investment: float = Field(..., description="Sum of active inventory purchase costs")
    purchases: List[PurchaseResponse] = Field(..., description="List of inventory purchase records")


class CashTransactionCreate(BaseModel):
    """Payload for creating a non-sales/purchases cash transaction."""

    type: str = Field(
        ...,
        description="Transaction type: 'owner_investment', 'owner_withdrawal', 'loan_given', 'loan_repayment', 'other_income', 'other_expense'",
    )
    amount: float = Field(..., gt=0, description="Amount of money involved (must be positive)")
    description: Optional[str] = Field(default=None, description="Optional description/note")
    date: Optional[str] = Field(default=None, description="Date in YYYY-MM-DD format (defaults to current date)")


class CashTransactionResponse(BaseModel):
    """Response model for a cash transaction."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Transaction identifier")
    user_id: int = Field(..., description="User who recorded the transaction")
    user_name: Optional[str] = Field(default=None, description="User name")
    type: str = Field(..., description="Transaction type")
    amount: float = Field(..., description="Transaction amount")
    description: Optional[str] = Field(default=None, description="Note or description")
    date: str = Field(..., description="Transaction date")
    status: str = Field(..., description="Status ('active' or 'voided')")
    created_at: datetime = Field(..., description="Creation timestamp")


class CashBreakdownIn(BaseModel):
    """Detailed breakdown of all cash inflows."""

    sales_cash: float = Field(0.0, description="Cash received immediately from paid sales")
    customer_payments: float = Field(0.0, description="Cash received from customer credit payments")
    owner_investments: float = Field(0.0, description="Capital injected by owner")
    loan_repayments: float = Field(0.0, description="Loan repayments received from third parties (Loan Given)")
    bank_loans_received: float = Field(0.0, description="Money borrowed from bank loans")
    other_income: float = Field(0.0, description="Other business income")
    total: float = Field(0.0, description="Sum of all cash in")


class CashBreakdownOut(BaseModel):
    """Detailed breakdown of all cash outflows."""

    purchases_paid: float = Field(0.0, description="Cash paid immediately for inventory purchases")
    supplier_payments: float = Field(0.0, description="Payments made to suppliers for credit purchases")
    owner_withdrawals: float = Field(0.0, description="Owner cash withdrawals")
    loans_given: float = Field(0.0, description="Loans given to other people")
    bank_loan_principal: float = Field(0.0, description="Bank loan principal repayments")
    bank_loan_interest: float = Field(0.0, description="Bank loan interest paid")
    other_expenses: float = Field(0.0, description="Other business expenses")
    total: float = Field(0.0, description="Sum of all cash out")


class CashSummaryResponse(BaseModel):
    """Complete Business Cash summary and balance."""

    current_balance: float = Field(..., description="Net liquid cash balance available (Money In - Money Out)")
    total_money_in: float = Field(..., description="Total cash received across all sources")
    total_money_out: float = Field(..., description="Total cash spent across all destinations")
    total_outstanding_bank_loans: float = Field(0.0, description="Total current debt owed across active bank loans")
    total_outstanding_third_party_loans: float = Field(0.0, description="Total outstanding loans receivable from 3rd parties")
    breakdown_in: CashBreakdownIn = Field(..., description="Breakdown of cash inflows")
    breakdown_out: CashBreakdownOut = Field(..., description="Breakdown of cash outflows")
    recent_transactions: List[CashTransactionResponse] = Field(default_factory=list, description="Recent cash transactions")


class BankLoanCreate(BaseModel):
    """Payload to record a new bank loan disbursal."""

    bank_name: str = Field(..., min_length=1, description="Bank or financial institution name")
    loan_amount: float = Field(..., gt=0, description="Borrowed loan amount (must be positive)")
    disbursal_date: Optional[str] = Field(default=None, description="Disbursal date in YYYY-MM-DD format")
    reference_number: Optional[str] = Field(default=None, description="Optional loan account/reference number")
    description: Optional[str] = Field(default=None, description="Optional notes or terms")


class BankLoanRepaymentCreate(BaseModel):
    """Payload to record a repayment on an active bank loan."""

    payment_date: Optional[str] = Field(default=None, description="Repayment date in YYYY-MM-DD format")
    principal_amount: float = Field(..., ge=0, description="Principal amount to repay")
    interest_amount: float = Field(default=0.0, ge=0, description="Interest amount paid, if applicable")
    description: Optional[str] = Field(default=None, description="Optional repayment notes")


class BankLoanRepaymentResponse(BaseModel):
    """Response payload for a single bank loan repayment."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Repayment identifier")
    bank_loan_id: int = Field(..., description="Associated bank loan ID")
    bank_name: Optional[str] = Field(default=None, description="Bank name")
    user_id: int = Field(..., description="User who recorded the payment")
    user_name: Optional[str] = Field(default=None, description="User display name")
    payment_date: str = Field(..., description="Repayment date")
    principal_amount: float = Field(..., description="Principal amount paid")
    interest_amount: float = Field(..., description="Interest amount paid")
    total_payment: float = Field(..., description="Total cash disbursed (principal + interest)")
    description: Optional[str] = Field(default=None, description="Notes")
    status: str = Field(..., description="Repayment status ('active' or 'voided')")
    created_at: datetime = Field(..., description="Creation timestamp")


class BankLoanResponse(BaseModel):
    """Response payload for a bank loan with live balance calculations."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Loan identifier")
    user_id: int = Field(..., description="User who recorded the loan")
    user_name: Optional[str] = Field(default=None, description="User display name")
    bank_name: str = Field(..., description="Bank name")
    loan_amount: float = Field(..., description="Original borrowed amount")
    disbursal_date: str = Field(..., description="Disbursal date")
    reference_number: Optional[str] = Field(default=None, description="Reference/account number")
    description: Optional[str] = Field(default=None, description="Notes")
    status: str = Field(..., description="Loan status ('active', 'voided', 'closed')")
    created_at: datetime = Field(..., description="Creation timestamp")
    total_principal_repaid: float = Field(0.0, description="Sum of active principal repayments")
    total_interest_paid: float = Field(0.0, description="Sum of active interest payments")
    remaining_balance: float = Field(0.0, description="Remaining principal debt owed")


class BankLoansOverviewResponse(BaseModel):
    """Overview summary and list of bank loans."""

    total_borrowed: float = Field(0.0, description="Total borrowed across all active bank loans")
    total_principal_repaid: float = Field(0.0, description="Total principal repaid")
    total_interest_paid: float = Field(0.0, description="Total interest paid")
    total_outstanding: float = Field(0.0, description="Total net outstanding bank debt")
    loans: List[BankLoanResponse] = Field(default_factory=list, description="List of bank loans")


class BorrowerCreate(BaseModel):
    """Payload to create a new third party borrower."""

    name: str = Field(..., min_length=1, description="Person / borrower name")
    phone: Optional[str] = Field(default=None, description="Contact phone number")
    notes: Optional[str] = Field(default=None, description="Optional notes")


class BorrowerResponse(BaseModel):
    """Response payload for a borrower including live ledger balance."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Borrower ID")
    name: str = Field(..., description="Borrower name")
    phone: Optional[str] = Field(default=None, description="Phone number")
    notes: Optional[str] = Field(default=None, description="Notes")
    total_lent: float = Field(0.0, description="Total money lent to this person")
    total_repaid: float = Field(0.0, description="Total money repaid by this person")
    balance_owed: float = Field(0.0, description="Remaining balance owed to business")
    status: str = Field("active", description="'active' if balance > 0 else 'settled'")
    created_at: datetime = Field(..., description="Creation timestamp")


class BorrowersOverviewResponse(BaseModel):
    """Overview summary and directory of third-party borrowers."""

    total_lent: float = Field(0.0, description="Total loan money lent across all borrowers")
    total_recovered: float = Field(0.0, description="Total loan money recovered/repaid")
    total_outstanding: float = Field(0.0, description="Total outstanding receivables owed to business")
    borrowers: List[BorrowerResponse] = Field(default_factory=list, description="List of borrowers")


class ThirdPartyLoanTransactionCreate(BaseModel):
    """Payload to record giving a loan or receiving a repayment."""

    borrower_id: Optional[int] = Field(default=None, description="Existing borrower ID")
    borrower_name: Optional[str] = Field(default=None, description="Borrower name if creating a new borrower inline")
    phone: Optional[str] = Field(default=None, description="Borrower phone if creating inline")
    type: Literal["loan_given", "repayment"] = Field(..., description="'loan_given' (Cash Out) or 'repayment' (Cash In)")
    amount: float = Field(..., gt=0, description="Transaction amount")
    date: Optional[str] = Field(default=None, description="Date in YYYY-MM-DD format")
    notes: Optional[str] = Field(default=None, description="Optional notes or terms")


class ThirdPartyLoanTransactionResponse(BaseModel):
    """Response payload for a single third-party loan transaction."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Transaction ID")
    borrower_id: int = Field(..., description="Borrower ID")
    borrower_name: str = Field(..., description="Borrower name")
    user_id: int = Field(..., description="User ID who recorded the transaction")
    user_name: Optional[str] = Field(default=None, description="User name")
    type: str = Field(..., description="'loan_given' or 'repayment'")
    amount: float = Field(..., description="Amount")
    date: str = Field(..., description="Date YYYY-MM-DD")
    notes: Optional[str] = Field(default=None, description="Notes")
    status: str = Field(..., description="'active' or 'voided'")
    created_at: datetime = Field(..., description="Creation timestamp")





