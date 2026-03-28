async function request(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("token");
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    const msg = data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

export const api = {
  login(payload) {
    return request("/api/auth/login", { method: "POST", body: payload });
  },
  register(payload) {
    return request("/api/auth/register", { method: "POST", body: payload });
  },
  health() {
    return request("/api/health");
  },
  listEntities() {
    return request("/api/entities");
  },
  createEntity(payload) {
    return request("/api/entities", { method: "POST", body: payload });
  },
  listTransactions() {
    return request("/api/transactions");
  },
  createTransaction(payload) {
    return request("/api/transactions", { method: "POST", body: payload });
  },
  editTransaction(id, payload) {
    return request(`/api/transactions/${id}`, { method: "PUT", body: payload });
  },
  deleteTransaction(id) {
    return request(`/api/transactions/${id}`, { method: "DELETE" });
  },
  balances() {
    return request("/api/balances");
  },
  transactionUsage(id) {
    return request(`/api/transaction/${id}/usage`);
  },
  sourceSummary(id) {
    return request(`/api/source/${id}/summary`);
  },
  monthlyExpenses(month) {
    if (!month) throw new Error("month parameter is required");
    return request(`/api/transactions/monthly-expenses?month=${month}`);
  },
  updateEntity(id, payload) {
    return request(`/api/entities/${id}`, { method: "PUT", body: payload });
  },
  deleteEntity(id) {
    return request(`/api/entities/${id}`, { method: "DELETE" });
  },
  listGroups() {
    return request("/api/groups");
  },
  createGroup(payload) {
    return request("/api/groups", { method: "POST", body: payload });
  },
  updateGroup(id, payload) {
    return request(`/api/groups/${id}`, { method: "PUT", body: payload });
  },
  deleteGroup(id) {
    return request(`/api/groups/${id}`, { method: "DELETE" });
  },
  listCycles(sourceId) {
    return request(`/api/cycles/${sourceId}`);
  },
  createCycle(payload) {
    return request("/api/cycles", { method: "POST", body: payload });
  },
  cycleTransactions(cycleId) {
    return request(`/api/cycles/${cycleId}/transactions`);
  },
};

