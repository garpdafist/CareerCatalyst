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
  options?: RequestInit & { timeout?: number },
): Promise<Response> {
  try {
    // Create a simple headers object that contains only strings
    const headersObj: Record<string, string> = {};
    
    // Copy any headers from options safely
    if (options?.headers) {
      const headers = options.headers;
      if (headers instanceof Headers) {
        // Convert Headers instance to plain object
        headers.forEach((value, key) => {
          headersObj[key] = value;
        });
      } else if (typeof headers === 'object') {
        // Handle plain object headers safely
        Object.entries(headers as Record<string, unknown>).forEach(([key, value]) => {
          if (typeof value === 'string') {
            headersObj[key] = value;
          }
        });
      }
    }

    // Set up timeout - default to 60 seconds for long-running operations
    const timeout = options?.timeout || 60000;

    // Log request preparation
    console.log('Preparing request:', {
      method,
      url,
      isFormData: data instanceof FormData,
      dataType: data ? typeof data : 'undefined',
      hasHeaders: Object.keys(headersObj).length > 0,
      timeout
    });

    // Only add Content-Type if NOT FormData
    if (data && !(data instanceof FormData)) {
      headersObj["Content-Type"] = "application/json";
      console.log('Setting Content-Type: application/json');
    } else if (data instanceof FormData) {
      console.log('FormData detected - browser will set Content-Type automatically');
      // Log FormData contents for debugging
      console.log('FormData entries:', Array.from((data as FormData).entries()).map(([key]) => key));
    }

    // Create Headers object from our safe headersObj
    const headers = new Headers();
    Object.entries(headersObj).forEach(([key, value]) => {
      headers.append(key, value);
    });
    
    const requestConfig = {
      method,
      headers,
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
      credentials: "include" as RequestCredentials,
      ...(options || {}),
    };
    
    // Remove timeout from passed options to prevent fetch error
    if (requestConfig.timeout) {
      delete requestConfig.timeout;
    }

    // Log final request configuration
    console.log('Sending request with config:', {
      method: requestConfig.method,
      headers: requestConfig.headers,
      hasBody: !!requestConfig.body,
      bodyType: requestConfig.body ? requestConfig.body.constructor.name : 'none',
      timeout
    });

    // Create fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const res = await fetch(url, {
        ...requestConfig,
        signal: controller.signal,
      });
  
      // Log response details
      console.log(`Response from ${url}:`, {
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get('content-type'),
        size: res.headers.get('content-length')
      });
  
      await throwIfResNotOk(res);
      return res;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`API request timeout after ${options?.timeout || 60000}ms (${method} ${url})`);
      throw new Error(`Request timeout: The operation took too long to complete. Please try with a smaller document or try again later.`);
    }
    
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

/**
 * Custom caching configuration for specific query types
 * @param queryKey The query key to check
 * @returns The staleTime in milliseconds
 */
const getQueryStaleTime = (queryKey: unknown[]): number => {
  // Resume analysis data should be cached for a long time
  if (typeof queryKey[0] === 'string' && queryKey[0].includes('/api/resume-analysis/')) {
    // Cache individual resume analyses for 24 hours - they don't change 
    return 24 * 60 * 60 * 1000;
  }
  
  // User analyses list should be refreshed more frequently
  if (queryKey[0] === '/api/user-analyses') {
    // Cache for 5 minutes
    return 5 * 60 * 1000;
  }
  
  // Default to infinite stale time for other queries
  return Infinity;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: (query) => getQueryStaleTime(query.queryKey),
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