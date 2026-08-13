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


class SaleItemResponse(BaseModel):
    """Response payload for a single sale line item."""

    model_config = {"from_attributes": True}

    product_id: int = Field(..., description="Product identifier")
    product_name: str = Field(..., description="Product name")
    quantity: int = Field(..., gt=0, description="Quantity sold")
    unit_price: float = Field(..., ge=0, description="Selling price snapshot")
    unit_cost: float = Field(..., ge=0, description="Cost price snapshot")
    line_total: float = Field(..., ge=0, description="Line item total")


class SaleResponse(BaseModel):
    """Response payload for a completed sale."""

    model_config = {"from_attributes": True}

    id: int = Field(..., description="Sale identifier")
    user_id: int = Field(..., description="User who created the sale")
    total_amount: float = Field(..., ge=0, description="Total sale amount")
    total_profit: float = Field(..., description="Total sale profit")
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

