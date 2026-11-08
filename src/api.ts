import { baseUrl } from "./baseUrl";

export const API_URL = baseUrl.replace(/\/$/, "");

type Envelope<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { code: string; message: string } };

const MAX_CACHE_KEYS = 100;
const responseCache = new Map<string, unknown>();
let activeRequests = 0;

function emitRequestActivity(delta: 1 | -1) {
  activeRequests = Math.max(0, activeRequests + delta);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("app:network-activity", {
        detail: { active: activeRequests },
      }),
    );
  }
}

function touchCacheKey(key: string, value: unknown) {
  // Map insertion order is used as the LRU order: newest access goes last.
  responseCache.delete(key);
  responseCache.set(key, value);
  while (responseCache.size > MAX_CACHE_KEYS) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey === undefined) break;
    responseCache.delete(oldestKey);
  }
}

export function clearCacheByPrefix(prefix: string) {
  const normalized = prefix.startsWith("/") ? prefix : `/${prefix}`;
  for (const key of responseCache.keys()) {
    const pathname = key.split("?")[0];
    if (pathname === normalized || pathname.startsWith(`${normalized}/`)) {
      responseCache.delete(key);
    }
  }
}

export function clearAllCache() {
  responseCache.clear();
}

function invalidateAfterMutation(path: string) {
  const pathname = path.split("?")[0];
  const root = pathname.split("/").filter(Boolean)[0];
  if (!root || root === "auth") return;

  clearCacheByPrefix(`/${root}`);

  // Synchronization can change both product and mapping data.
  if (root === "sync") {
    clearCacheByPrefix("/products");
    clearCacheByPrefix("/product-suppliers");
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const shouldCache = method === "GET" && init?.cache !== "no-store";
  const cacheKey = path;

  if (shouldCache && responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey) as T;
    touchCacheKey(cacheKey, cached);
    return cached;
  }

  emitRequestActivity(1);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } finally {
    emitRequestActivity(-1);
  }

  if (response.status === 401 && !path.startsWith("/auth/login")) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app:unauthorized"));
    }
  }

  const payload = (await response
    .json()
    .catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload || !payload.success) {
    throw new Error(
      payload && !payload.success
        ? payload.error.message
        : `Request gagal (${response.status})`,
    );
  }

  if (shouldCache) touchCacheKey(cacheKey, payload.data);
  return payload.data;
}

export const post = async (path: string, body?: unknown) => {
  const result = await request<unknown>(
    path,
    body === undefined
      ? { method: "POST", cache: "no-store" }
      : { method: "POST", body: JSON.stringify(body), cache: "no-store" },
  );
  invalidateAfterMutation(path);
  return result;
};

export function queryString(params: Record<string, string>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value.trim()) query.set(key, value.trim());
  });
  return query.size ? `?${query.toString()}` : "";
}
