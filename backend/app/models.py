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





