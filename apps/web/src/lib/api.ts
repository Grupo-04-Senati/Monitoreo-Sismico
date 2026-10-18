/* ════════════════════════════════════════════════════════════════
   Capa de acceso a la API real.

   - `credentials: "include"` para enviar las cookies HttpOnly de sesión.
   - Se apoya en el proxy de Vite (`/api/v1`) en desarrollo, de modo que la
     petición es del mismo origen y no hay problemas de CORS con cookies.
   ════════════════════════════════════════════════════════════════ */

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

/** Error de API con el código HTTP y el mensaje que devuelve el backend. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  /** La sesión no existe o caducó (401). */
  get noAutenticado(): boolean {
    return this.status === 401;
  }

  /** El usuario está autenticado pero no tiene permiso (403). */
  get sinPermiso(): boolean {
    return this.status === 403;
  }

  /** No se pudo conectar con la API (red/servidor caído). */
  get sinConexion(): boolean {
    return this.status === 0;
  }
}

async function detalleDe(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "detail" in data) {
      const detalle = (data as { detail: unknown }).detail;
      if (typeof detalle === "string") return detalle;
      if (Array.isArray(detalle)) {
        return detalle
          .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : String(d)))
          .join("; ");
      }
    }
  } catch {
    /* respuesta sin JSON */
  }
  return res.statusText || `Error ${res.status}`;
}

export interface RequestOptions {
  /** Señal para cancelar la petición (p. ej. al desmontar un componente). */
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const tieneCuerpo = body !== undefined;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers: tieneCuerpo ? { "Content-Type": "application/json" } : undefined,
      body: tieneCuerpo ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    throw new ApiError(0, "No se pudo conectar con el servidor. Verifique su conexión.");
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    if (res.status === 401) throw new ApiError(401, await detalleDe(res));
    if (res.status === 403) throw new ApiError(403, await detalleDe(res));
    throw new ApiError(res.status, await detalleDe(res));
  }

  const tipo = res.headers.get("content-type") ?? "";
  if (tipo.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const apiGet = <T>(path: string, options?: RequestOptions): Promise<T> =>
  request<T>("GET", path, undefined, options);

export const apiPost = <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
  request<T>("POST", path, body, options);

export const apiPatch = <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
  request<T>("PATCH", path, body, options);

export const apiPut = <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
  request<T>("PUT", path, body, options);

export const apiDelete = <T>(path: string, options?: RequestOptions): Promise<T> =>
  request<T>("DELETE", path, undefined, options);
