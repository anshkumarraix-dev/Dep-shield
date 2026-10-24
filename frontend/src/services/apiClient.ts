import { envConfig } from '@/config/env';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${envConfig.apiUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  // Safety Guard: In mock demonstration mode, block all external network fetch calls
  if (envConfig.useMocks) {
    throw new Error(
      `[DepShield Safety Guard] Blocked network request to "${url}". Application is running in offline demonstration mode (NEXT_PUBLIC_USE_MOCKS=1).`
    );
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // Response might not be JSON
      }
      throw new ApiError(response.status, response.statusText, errorData);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error(
      `Network request failed to ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
