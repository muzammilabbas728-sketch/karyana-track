const BASE_URL = window.location.origin;


function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function buildHeaders(options) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = localStorage.getItem("auth_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const init = {
    method: options.method || "GET",
    ...options,
    headers: buildHeaders(options),
  };

  if (options.body !== undefined && isPlainObject(options.body)) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.detail || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function login(username, pin) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: { username, pin },
  });
}

export function getProducts() {
  return apiRequest("/products", {
    method: "GET",
  });
}

export function createSale(items, customerId = null, paymentStatus = "paid") {
  return apiRequest("/sales", {
    method: "POST",
    body: {
      items,
      customer_id: customerId,
      payment_status: paymentStatus,
    },
  });
}

export function getDailyReport() {
  return apiRequest("/reports/daily", {
    method: "GET",
  });
}

export function getRangeReport(fromDate, toDate) {
  return apiRequest(
    `/reports/range?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`,
    {
      method: "GET",
    }
  );
}

export function getRangeReportByProduct(fromDate, toDate) {
  return apiRequest(
    `/reports/range/by-product?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`,
    { method: "GET" }
  );
}


export function getLowStock() {
  return apiRequest("/reports/low-stock", {
    method: "GET",
  });
}

export function createProduct(product) {
  return apiRequest("/products", {
    method: "POST",
    body: product,
  });
}

export function updateProduct(productId, updates) {
  return apiRequest(`/products/${productId}`, {
    method: "PUT",
    body: updates,
  });
}

export function deleteProduct(productId) {
  return apiRequest(`/products/${productId}`, {
    method: "DELETE",
  });
}

export function getStockHistory(productId) {
  return apiRequest(`/products/${productId}/stock-history`, {
    method: "GET",
  });
}

export function adjustStock(productId, changeAmount, reason) {
  return apiRequest(`/products/${productId}/adjust-stock`, {
    method: "POST",
    body: { change_amount: changeAmount, reason },
  });
}

export function getUsers() {
  return apiRequest("/users", {
    method: "GET",
  });
}

export function createUser(user) {
  return apiRequest("/users", {
    method: "POST",
    body: user,
  });
}

export function changeUserPin(userId, newPin) {
  return apiRequest(`/users/${userId}/pin`, {
    method: "PUT",
    body: { new_pin: newPin },
  });
}

export function getCustomers() {
  return apiRequest("/customers", {
    method: "GET",
  });
}

export function createCustomer(customer) {
  return apiRequest("/customers", {
    method: "POST",
    body: customer,
  });
}

export function getCustomerHistory(customerId) {
  return apiRequest(`/customers/${customerId}/history`, {
    method: "GET",
  });
}

export function recordCustomerPayment(customerId, amount) {
  return apiRequest(`/customers/${customerId}/payments`, {
    method: "POST",
    body: { amount },
  });
}

export function getSales() {
  return apiRequest("/sales", { method: "GET" });
}

export function getSaleDetails(saleId) {
  return apiRequest(`/sales/${saleId}`, { method: "GET" });
}

export function updateSale(saleId, payload) {
  return apiRequest(`/sales/${saleId}`, {
    method: "PUT",
    body: payload,
  });
}

export function voidSale(saleId) {
  return apiRequest(`/sales/${saleId}/void`, { method: "POST" });
}

export function getInvestments() {
  return apiRequest("/investments", { method: "GET" });
}

export function createInvestment(payload) {
  return apiRequest("/investments", {
    method: "POST",
    body: payload,
  });
}

export function getPurchases() {
  return apiRequest("/purchases", { method: "GET" });
}

export function createPurchase(payload) {
  return apiRequest("/purchases", {
    method: "POST",
    body: payload,
  });
}

export function cancelPurchase(purchaseId) {
  return apiRequest(`/purchases/${purchaseId}/cancel`, {
    method: "POST",
  });
}

export function updatePurchase(purchaseId, payload) {
  return apiRequest(`/purchases/${purchaseId}`, {
    method: "PUT",
    body: payload,
  });
}

export function getSuppliers() {
  return apiRequest("/suppliers", { method: "GET" });
}

export function createSupplier(payload) {
  return apiRequest("/suppliers", {
    method: "POST",
    body: payload,
  });
}

export function getSupplierHistory(supplierId) {
  return apiRequest(`/suppliers/${supplierId}/history`, { method: "GET" });
}

export function createSupplierPayment(supplierId, amount) {
  return apiRequest(`/suppliers/${supplierId}/payments`, {
    method: "POST",
    body: { amount: Number(amount) },
  });
}






