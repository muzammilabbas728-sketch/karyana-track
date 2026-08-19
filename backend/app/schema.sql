CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    username      TEXT NOT NULL UNIQUE,
    pin_hash      TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    barcode             TEXT UNIQUE,
    cost_price          REAL NOT NULL CHECK (cost_price >= 0),
    selling_price       REAL NOT NULL CHECK (selling_price >= 0),
    quantity_in_stock   INTEGER NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
    unit_type           TEXT NOT NULL DEFAULT 'piece' CHECK (unit_type IN ('piece', 'weight', 'pack')),
    units_per_pack      INTEGER,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    is_active           BOOLEAN NOT NULL DEFAULT 1,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    customer_id    INTEGER,
    total_amount   REAL NOT NULL,
    total_profit   REAL NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'credit')),
    voided         BOOLEAN NOT NULL DEFAULT 0,
    voided_at      TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id        INTEGER NOT NULL,
    product_id     INTEGER NOT NULL,
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    unit_price     REAL NOT NULL,
    unit_cost      REAL NOT NULL,
    stock_deducted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    INTEGER NOT NULL,
    user_id       INTEGER NOT NULL,
    change_amount INTEGER NOT NULL,
    reason        TEXT NOT NULL CHECK (reason IN ('restock', 'damaged', 'expired', 'correction')),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS customers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    phone         TEXT,
    credit_limit  REAL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_payments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id   INTEGER NOT NULL,
    user_id       INTEGER NOT NULL,
    amount        REAL NOT NULL CHECK (amount > 0),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS investments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    amount        REAL NOT NULL CHECK (amount > 0),
    description   TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    phone       TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_payments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id  INTEGER NOT NULL,
    user_id      INTEGER NOT NULL,
    amount       REAL NOT NULL CHECK (amount > 0),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_purchases (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    supplier_id     INTEGER,
    supplier_name   TEXT,
    total_cost      REAL NOT NULL CHECK (total_cost >= 0),
    payment_status  TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'credit', 'pending', 'partial')),
    amount_paid     REAL NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id    INTEGER NOT NULL,
    product_id     INTEGER NOT NULL,
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    cost_price     REAL NOT NULL CHECK (cost_price >= 0),
    total_cost     REAL NOT NULL CHECK (total_cost >= 0),
    FOREIGN KEY (purchase_id) REFERENCES inventory_purchases(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_user_id ON inventory_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_supplier_id ON inventory_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);

CREATE TABLE IF NOT EXISTS license (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name    TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL UNIQUE,
    license_key      TEXT NOT NULL,
    issued_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at       TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    type        TEXT NOT NULL CHECK (type IN (
                    'owner_investment',
                    'owner_withdrawal',
                    'loan_given',
                    'loan_repayment',
                    'other_income',
                    'other_expense'
                )),
    amount      REAL NOT NULL CHECK (amount > 0),
    description TEXT,
    date        DATE NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_user_id ON cash_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON cash_transactions(type);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON cash_transactions(date);

CREATE TABLE IF NOT EXISTS bank_loans (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    bank_name        TEXT NOT NULL,
    loan_amount      REAL NOT NULL CHECK (loan_amount > 0),
    disbursal_date   DATE NOT NULL,
    reference_number TEXT,
    description      TEXT,
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided', 'closed')),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bank_loans_user_id ON bank_loans(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_loans_status ON bank_loans(status);
CREATE INDEX IF NOT EXISTS idx_bank_loans_date ON bank_loans(disbursal_date);

CREATE TABLE IF NOT EXISTS bank_loan_repayments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_loan_id     INTEGER NOT NULL,
    user_id          INTEGER NOT NULL,
    payment_date     DATE NOT NULL,
    principal_amount REAL NOT NULL CHECK (principal_amount >= 0),
    interest_amount  REAL NOT NULL DEFAULT 0.0 CHECK (interest_amount >= 0),
    total_payment    REAL NOT NULL CHECK (total_payment > 0),
    description      TEXT,
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_loan_id) REFERENCES bank_loans(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bank_loan_repayments_loan_id ON bank_loan_repayments(bank_loan_id);
CREATE INDEX IF NOT EXISTS idx_bank_loan_repayments_status ON bank_loan_repayments(status);
