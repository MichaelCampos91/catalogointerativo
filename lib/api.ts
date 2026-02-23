const API_URL = "/api"

async function request<T>(
  endpoint: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  const { method = "GET", body } = options
  const config: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  }
  if (body) {
    config.body = JSON.stringify(body)
  }
  const response = await fetch(`${API_URL}${endpoint}`, config)
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Erro desconhecido" }))
    throw new Error(data.error ?? data.message ?? "Erro na requisição")
  }
  return response.json()
}

export const authApi = {
  login: (password: string) =>
    request<{ success: boolean }>("/auth/login", { method: "POST", body: { password } }),
  logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: { id: string; email: string } }>("/auth/me"),
}
