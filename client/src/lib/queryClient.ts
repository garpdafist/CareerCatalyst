import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorDetails: string;
    try {
      // Try to parse as JSON first
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const jsonResponse = await res.json();
        errorDetails = JSON.stringify(jsonResponse);
      } else {
        errorDetails = await res.text();
      }
    } catch (e) {
      errorDetails = res.statusText;
    }

    console.error(`API Error ${res.status}:`, errorDetails);
    throw new Error(`${res.status}: ${errorDetails || res.statusText}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: RequestInit,
): Promise<Response> {
  try {
    const headers: Record<string, string> = {
      ...(options?.headers || {}),
    };

    // Log request preparation
    console.log('Preparing request:', {
      method,
      url,
      isFormData: data instanceof FormData,
      dataType: data ? typeof data : 'undefined',
      hasHeaders: Object.keys(headers).length > 0
    });

    // Only add Content-Type if NOT FormData
    if (data && !(data instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      console.log('Setting Content-Type: application/json');
    } else if (data instanceof FormData) {
      console.log('FormData detected - browser will set Content-Type automatically');
      // Log FormData contents for debugging
      console.log('FormData entries:', Array.from((data as FormData).entries()).map(([key]) => key));
    }

    const requestConfig = {
      method,
      headers,
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
      credentials: "include" as RequestCredentials,
      ...options,
    };

    // Log final request configuration
    console.log('Sending request with config:', {
      method: requestConfig.method,
      headers: requestConfig.headers,
      hasBody: !!requestConfig.body,
      bodyType: requestConfig.body ? requestConfig.body.constructor.name : 'none'
    });

    const res = await fetch(url, requestConfig);

    // Log response details
    console.log(`Response from ${url}:`, {
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type'),
      size: res.headers.get('content-length')
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API request error (${method} ${url}):`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except for 429 (rate limit)
        if (error instanceof Error) {
          const status = parseInt(error.message.split(':')[0]);
          if (status >= 400 && status < 500 && status !== 429) {
            return false;
          }
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // Similar retry logic for mutations
        if (error instanceof Error) {
          const status = parseInt(error.message.split(':')[0]);
          if (status >= 400 && status < 500 && status !== 429) {
            return false;
          }
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
    },
  },
});