const BASE_URL = process.env.ASAAS_SANDBOX === 'true'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://www.asaas.com/api/v3'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`
  console.log(`[asaas.request] ${method} ${path}`)
  if (body) {
    console.log(`[asaas.request] body:`, JSON.stringify(body, null, 2))
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': process.env.ASAAS_ACCESS_TOKEN!,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  console.log(`[asaas.request] response status: ${res.status}`)
  console.log(`[asaas.request] response body: ${text}`)

  if (!res.ok) {
    throw new Error(`Asaas ${method} ${path} → ${res.status}: ${text}`)
  }

  return JSON.parse(text) as T
}

export const asaas = {
  get:    <T>(path: string): Promise<T> => request<T>('GET', path),
  post:   <T>(path: string, body: unknown): Promise<T> => request<T>('POST', path, body),
  put:    <T>(path: string, body: unknown): Promise<T> => request<T>('PUT', path, body),
  delete: <T>(path: string): Promise<T> => request<T>('DELETE', path),
}
