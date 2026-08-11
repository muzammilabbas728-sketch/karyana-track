const BASE_URL = "http://192.168.1.3:8000"; // TODO: use VITE_API_BASE_URL from env in the future

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

export function createSale(items) {
  return apiRequest("/sales", {
    method: "POST",
    body: { items },
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
