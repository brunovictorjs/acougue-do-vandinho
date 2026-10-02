export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  form?: FormData
}

/** Browser-side call to the NestJS API through the same-origin `/api` rewrite. */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    credentials: "include",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  })
  if (!res.ok) {
    let message = "Algo deu errado. Tente novamente."
    let code: string | undefined
    try {
      const data = (await res.json()) as { message?: string | string[]; code?: string }
      if (Array.isArray(data.message)) message = data.message[0] ?? message
      else if (data.message) message = data.message
      code = data.code
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(message, res.status, code)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** SWR fetcher: keys are API paths. */
export const fetcher = <T,>(path: string) => api<T>(path)

/** Server components: public data straight from the API (no session). */
export async function serverApi<T>(path: string): Promise<T> {
  const base = process.env.BACKEND_URL ?? "http://localhost:3333"
  const res = await fetch(`${base}/api${path}`, { cache: "no-store" })
  if (!res.ok) throw new ApiError(`API ${res.status}`, res.status)
  return (await res.json()) as T
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Algo deu errado. Tente novamente."
}
