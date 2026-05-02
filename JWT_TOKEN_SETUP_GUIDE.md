# JWT Token Setup for Seating API - Frontend Implementation Guide

## Quick Start: Why You're Getting 401 Errors

**401 (Unauthorized)** means the backend didn't receive a valid JWT token in your request. The seating API **requires** the `Authorization: Bearer <token>` header on every single request.

---

## 1. Understanding JWT Tokens

A **JWT (JSON Web Token)** is a string that proves you're logged in. It looks like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTcxNDU0MzIwMH0.xyz...
```

**Key points:**
- Issued by the `/api/auth/login` endpoint (or similar)
- Has an expiration time (e.g., 24 hours)
- Must be included in every seating API request
- Should be stored securely on the client (not in plain HTML)
- When expired, user needs to log in again

---

## 2. Getting the Token

After a successful login, the backend returns a token:

```javascript
// Example login request
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
});

const data = await response.json();
const token = data.token;  // or data.jwtToken or similar, check your auth response

console.log('Token received:', token);
```

---

## 3. Storing the Token Securely

### Option A: localStorage (Simple, Less Secure)
```javascript
// Save after login
localStorage.setItem('auth_token', token);

// Retrieve before API call
const token = localStorage.getItem('auth_token');
```
⚠️ **Risk**: Can be accessed by XSS attacks. Use if you have CSP and security headers.

### Option B: sessionStorage (Session Only)
```javascript
// Save after login
sessionStorage.setItem('auth_token', token);

// Retrieve before API call
const token = sessionStorage.getItem('auth_token');
```
✓ Cleared when browser closes. Better security.

### Option C: Memory (Most Secure, Clears on Refresh)
```javascript
// In your app state/context
let authToken = null;

function setToken(token) {
  authToken = token;
}

function getToken() {
  return authToken;
}
```
✓ Most secure but lost on page refresh (requires re-login).

### Option D: HttpOnly Cookies (Best for Web)
Let your backend set an HttpOnly cookie:
```
Set-Cookie: auth_token=<jwt>; HttpOnly; Secure; SameSite=Strict
```
✓ Browser automatically includes in requests, can't be accessed by JS, immune to XSS.
(Requires backend to support this pattern)

---

## 4. Including Token in Requests (THE CRITICAL PART)

### Format: `Authorization: Bearer <token>`

**Example - Vanilla JavaScript/Fetch:**
```javascript
const token = localStorage.getItem('auth_token');

fetch('/api/seating/tables', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(res => res.json())
  .then(data => console.log('Tables:', data))
  .catch(err => console.error('Error:', err));
```

**Example - Creating a Table:**
```javascript
const token = localStorage.getItem('auth_token');

fetch('/api/seating/tables', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table_name: 'Table 1',
    capacity: 8,
    notes: 'Near the bar'
  })
})
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error('Failed:', data.error);
    } else {
      console.log('Table created:', data);
    }
  })
  .catch(err => console.error('Error:', err));
```

---

## 5. Common Mistakes That Cause 401

### ❌ Missing `Bearer ` prefix
```javascript
// WRONG
headers: { 'Authorization': token }  // Missing "Bearer "

// RIGHT
headers: { 'Authorization': `Bearer ${token}` }
```

### ❌ Token not included at all
```javascript
// WRONG
fetch('/api/seating/tables', {
  headers: { 'Content-Type': 'application/json' }
})

// RIGHT
fetch('/api/seating/tables', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

### ❌ Token expired
```javascript
// Token might be valid for 24 hours, but if user is using outdated token
// Response will be 401: "Token expired"
// Solution: Redirect to login
```

### ❌ Token not retrieved from storage
```javascript
// WRONG - token is undefined
const token = localStorage.getItem('some_other_key_name');

// RIGHT - double-check you're using the right key
const token = localStorage.getItem('auth_token');
if (!token) {
  console.error('No token found, user not logged in');
  // Redirect to login
}
```

### ❌ Wrong URL
```javascript
// WRONG - typo in URL
fetch('/api/seating/tables', {  // Forgot leading slash or wrong path
  headers: { 'Authorization': `Bearer ${token}` }
})

// RIGHT
fetch('/api/seating/tables', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

---

## 6. Complete Service/Hook for Seating API

### **React Hook Example (useSeatingAPI)**
```javascript
import { useState } from 'react';

export function useSeatingAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getToken = () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No auth token found. Please log in.');
    }
    return token;
  };

  const apiCall = async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const token = getToken();

      const response = await fetch(`/api/seating${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // Handle 401 - token expired
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';  // Redirect to login
        throw new Error('Session expired. Please log in again.');
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    // Tables endpoints
    getTables: () => apiCall('/tables'),
    getTable: (tableId) => apiCall(`/tables/${tableId}`),
    createTable: (tableData) =>
      apiCall('/tables', {
        method: 'POST',
        body: JSON.stringify(tableData)
      }),
    updateTable: (tableId, tableData) =>
      apiCall(`/tables/${tableId}`, {
        method: 'PUT',
        body: JSON.stringify(tableData)
      }),
    deleteTable: (tableId) =>
      apiCall(`/tables/${tableId}`, { method: 'DELETE' }),

    // Assignment endpoints
    getAssignments: () => apiCall('/assignments'),
    assignGuest: (assignmentData) =>
      apiCall('/assignments', {
        method: 'POST',
        body: JSON.stringify(assignmentData)
      }),
    updateAssignment: (seatingId, assignmentData) =>
      apiCall(`/assignments/${seatingId}`, {
        method: 'PUT',
        body: JSON.stringify(assignmentData)
      }),
    deleteAssignment: (seatingId) =>
      apiCall(`/assignments/${seatingId}`, { method: 'DELETE' }),

    // Reporting endpoints
    getCapacityReport: () => apiCall('/reports/capacity'),
    getUnassignedGuests: () => apiCall('/reports/unassigned'),
    searchTableAndGuests: (query) =>
      apiCall(`/search?q=${encodeURIComponent(query)}`)
  };
}
```

**Usage in Component:**
```javascript
function SeatingTableForm() {
  const { createTable, loading, error } = useSeatingAPI();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const newTable = await createTable({
        table_name: 'Table 5',
        capacity: 8,
        notes: 'Outdoor patio'
      });
      console.log('Table created:', newTable);
    } catch (err) {
      console.error('Failed to create table:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={loading} type="submit">
        {loading ? 'Creating...' : 'Create Table'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

---

### **Vanilla JS Fetch Wrapper**
```javascript
class SeatingAPI {
  constructor() {
    this.baseURL = '/api/seating';
  }

  getToken() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No auth token. Please log in.');
    }
    return token;
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Tables
  getTables() {
    return this.request('/tables');
  }

  createTable(data) {
    return this.request('/tables', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Assignments
  getAssignments() {
    return this.request('/assignments');
  }

  assignGuest(data) {
    return this.request('/assignments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Reporting
  getCapacityReport() {
    return this.request('/reports/capacity');
  }

  getUnassignedGuests() {
    return this.request('/reports/unassigned');
  }
}

// Usage
const seatingAPI = new SeatingAPI();

(async () => {
  try {
    const tables = await seatingAPI.getTables();
    console.log('All tables:', tables);
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
```

---

## 7. Debugging 401 Errors

**Step 1: Verify token exists**
```javascript
const token = localStorage.getItem('auth_token');
console.log('Token:', token);
if (!token) {
  console.error('No token found! User not logged in.');
}
```

**Step 2: Check token format in network tab**
- Open DevTools → Network tab
- Make a seating API request
- Click on the request
- Look at "Request Headers"
- Verify `Authorization: Bearer eyJ...` is present

**Step 3: Check authorization header syntax**
```javascript
// Open browser console and run:
console.log(`Bearer ${localStorage.getItem('auth_token')}`);
// Should output: Bearer eyJ...

// Compare with what's being sent in network tab
```

**Step 4: Try with test token in Postman/curl**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://api.example.com/api/seating/tables
```

**Step 5: Check token expiration**
Token might be valid format but expired. Backend will return 401. Solution: User must log in again.

---

## 8. Error Handling Strategy

Always handle these cases:
```javascript
async function createSeatingTable() {
  try {
    const response = await fetch('/api/seating/tables', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ table_name: 'Table 1', capacity: 8 })
    });

    // Case 1: Server responded but with error status
    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      return;
    }

    if (response.status === 400) {
      // Bad request - validation error
      const data = await response.json();
      alert(`Validation error: ${data.error}`);
      return;
    }

    if (response.status === 404) {
      // Not found
      alert('Resource not found');
      return;
    }

    if (!response.ok) {
      // Generic server error
      alert(`Server error: ${response.status}`);
      return;
    }

    // Case 2: Success
    const data = await response.json();
    console.log('Table created:', data);

  } catch (err) {
    // Case 3: Network error (no connection, etc)
    console.error('Network error:', err);
    alert('Unable to reach server. Check your connection.');
  }
}
```

---

## 9. Quick Checklist

Before making any seating API request, verify:

- [ ] User is logged in (token exists in storage)
- [ ] `Authorization: Bearer <token>` header is included
- [ ] `<token>` is not empty/undefined
- [ ] URL is correct (e.g., `/api/seating/tables`, not `/seating/tables`)
- [ ] HTTP method is correct (GET, POST, PUT, DELETE)
- [ ] `Content-Type: application/json` is set for POST/PUT requests
- [ ] Request body is valid JSON for POST/PUT requests
- [ ] 401 responses redirect to login
- [ ] Other errors are shown to user

---

## 10. Testing Without Frontend

You can test locally in your browser console or with curl:

**Curl Example:**
```bash
# Get token first (replace with your actual login)
TOKEN="eyJ..."

# Get all tables
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/seating/tables

# Create a table
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_name":"Test","capacity":8}' \
  http://localhost:3001/api/seating/tables
```

**Browser Console (paste into DevTools Console):**
```javascript
const token = localStorage.getItem('auth_token');

fetch('http://localhost:3001/api/seating/tables', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(r => r.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

---

## Summary

**The 401 error means one of these:**
1. ❌ No token in request (missing `Authorization` header)
2. ❌ Token format wrong (missing `Bearer ` prefix)
3. ❌ Token is invalid or expired (need to log in again)
4. ❌ Token stored under wrong key name (check localStorage key)

**Fix it:**
1. ✅ Get token from auth endpoint on login
2. ✅ Store in localStorage/sessionStorage/memory
3. ✅ Include as `Authorization: Bearer <token>` on every seating API request
4. ✅ Handle 401 by redirecting to login
5. ✅ Use one of the service/hook examples above to automate this

Go forth and request! 🚀
