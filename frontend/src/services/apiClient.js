const API_BASE = process.env.REACT_APP_API_URL;//'http://localhost:5000';

class APIError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.response = response;
    this.isRetryable = this.determineRetryable(status);
  }

  determineRetryable(status) {
    // Don't retry on 4xx errors (except 408, 429)
    if (status >= 400 && status < 500 && ![408, 429].includes(status)) {
      return false;
    }
    // Retry on 5xx errors and network errors
    return true;
  }
}

// Sleep utility for retry delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = text;
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || text;
    } catch (e) {
      // Not JSON, use text as is
    }
    throw new APIError(errorMsg, res.status, res);
  }
  
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  
  // For non-JSON responses, return empty object
  return {};
}

// Enhanced request function with retry logic
async function requestWithRetry(url, options, retries = 3, retryDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return await handleResponse(res);
      
    } catch (error) {
      lastError = error;
      
      // Don't retry on non-retryable errors
      if (error instanceof APIError && !error.isRetryable) {
        throw error;
      }
      
      // Don't retry on timeout/abort errors
      if (error.name === 'AbortError') {
        throw new APIError('Request timeout', 408, null);
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.warn(`Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`, error.message);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

export async function apiGet(path) {
  return requestWithRetry(`${API_BASE}${path}`, {
    method: 'GET'
  });
}

export async function apiPost(path, body = {}) {
  return requestWithRetry(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export async function apiPut(path, body = {}) {
  return requestWithRetry(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export async function apiDelete(path) {
  return requestWithRetry(`${API_BASE}${path}`, {
    method: 'DELETE'
  });
}