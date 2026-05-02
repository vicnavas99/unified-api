# Seating Chart API Reference

## Overview
The Seating API manages wedding seating tables and guest-to-table assignments. All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

**Base URL**: `/api/seating`

---

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

If token is missing or invalid, you'll receive:
```json
{ "error": "Unauthorized" }
```

---

## Table Management Endpoints

### 1. GET /tables
**List all seating tables with occupancy**

**Request:**
```
GET /api/seating/tables
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "table_id": 1,
    "table_name": "Table 1",
    "capacity": 8,
    "notes": "Near bar",
    "occupancy": 5
  },
  {
    "table_id": 2,
    "table_name": "VIP",
    "capacity": 10,
    "notes": "Main room",
    "occupancy": 8
  }
]
```

---

### 2. GET /tables/:table_id
**Get specific table with all assignments and guest details**

**Request:**
```
GET /api/seating/tables/1
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "table": {
    "table_id": 1,
    "table_name": "Table 1",
    "capacity": 8,
    "notes": "Near bar"
  },
  "assignments": [
    {
      "seating_id": 42,
      "table_id": 1,
      "guest_list_id": 15,
      "seat_number": 1,
      "notes": "Vegetarian",
      "guest_name": "John Smith",
      "email": "john@example.com",
      "phone": "555-0123",
      "rsvp_status": "confirmed"
    },
    {
      "seating_id": 43,
      "table_id": 1,
      "guest_list_id": 16,
      "seat_number": 2,
      "notes": null,
      "guest_name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "555-0124",
      "rsvp_status": "confirmed"
    }
  ],
  "occupancy": 2
}
```

**Error Responses:**
- `404`: Table not found
```json
{ "error": "Table not found" }
```

---

### 3. POST /tables
**Create a new seating table**

**Request:**
```
POST /api/seating/tables
Authorization: Bearer <token>
Content-Type: application/json

{
  "table_name": "Table 5",
  "capacity": 8,
  "notes": "Outdoor area"
}
```

**Response (201):**
```json
{
  "table_id": 5,
  "table_name": "Table 5",
  "capacity": 8,
  "notes": "Outdoor area"
}
```

**Request Body:**
- `table_name` (required): String, max 50 chars - e.g., "Table 1", "VIP", "Family A"
- `capacity` (optional): Integer - max seats at table (defaults to 0)
- `notes` (optional): String, max 255 chars - decorations, location, dietary info, etc.

**Error Responses:**
- `400`: Missing required field
```json
{ "error": "table_name is required" }
```

---

### 4. PUT /tables/:table_id
**Update an existing seating table**

**Request:**
```
PUT /api/seating/tables/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "table_name": "Table 1 - Main Room",
  "capacity": 10,
  "notes": "Updated location"
}
```

**Response (200):**
```json
{
  "table_id": 1,
  "table_name": "Table 1 - Main Room",
  "capacity": 10,
  "notes": "Updated location"
}
```

**Request Body:** (all optional, only provided fields are updated)
- `table_name`: String, max 50 chars
- `capacity`: Integer
- `notes`: String, max 255 chars

**Error Responses:**
- `404`: Table not found
- `400`: No fields to update
```json
{ "error": "No fields to update" }
```

---

### 5. DELETE /tables/:table_id
**Hard delete a seating table (cascades to remove all assignments)**

**Request:**
```
DELETE /api/seating/tables/1
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "ok": true,
  "message": "Table deleted"
}
```

**Error Responses:**
- `404`: Table not found

⚠️ **Warning**: This is a hard delete. All assignments for this table will also be deleted.

---

## Assignment Management Endpoints

### 6. GET /assignments
**List all guest assignments with guest and table details**

**Request:**
```
GET /api/seating/assignments
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "seating_id": 42,
    "table_id": 1,
    "guest_list_id": 15,
    "seat_number": 1,
    "notes": "Vegetarian",
    "table_name": "Table 1",
    "guest_name": "John Smith",
    "email": "john@example.com",
    "phone": "555-0123",
    "rsvp_status": "confirmed"
  },
  {
    "seating_id": 43,
    "table_id": 1,
    "guest_list_id": 16,
    "seat_number": 2,
    "notes": null,
    "table_name": "Table 1",
    "guest_name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "555-0124",
    "rsvp_status": "confirmed"
  }
]
```

---

### 7. POST /assignments
**Assign a guest to a seating table (auto-handles reassignment)**

**Request:**
```
POST /api/seating/assignments
Authorization: Bearer <token>
Content-Type: application/json

{
  "guest_list_id": 15,
  "table_id": 1,
  "seat_number": 3,
  "notes": "Wheelchair accessible"
}
```

**Response (201):**
```json
{
  "ok": true,
  "message": "Guest assigned to table",
  "assignment": {
    "seating_id": 44,
    "table_id": 1,
    "guest_list_id": 15,
    "seat_number": 3,
    "notes": "Wheelchair accessible",
    "table_name": "Table 1",
    "guest_name": "John Smith",
    "email": "john@example.com",
    "phone": "555-0123",
    "rsvp_status": "confirmed"
  }
}
```

**Request Body:**
- `guest_list_id` (required): Integer - ID of guest from guest_list table
- `table_id` (required): Integer - ID of seating table
- `seat_number` (optional): Integer - specific seat position at table
- `notes` (optional): String, max 255 chars - dietary, wheelchair, allergies, etc.

**Behavior:**
- If guest is already assigned to a different table, they are **automatically removed from old table** and added to new table (overwrite strategy)
- Returns `"Guest reassigned to new table"` if guest was previously assigned

**Error Responses:**
- `400`: Missing required fields
- `404`: Guest not found
- `404`: Table not found

---

### 8. PUT /assignments/:seating_id
**Update an existing assignment (seat number, notes)**

**Request:**
```
PUT /api/seating/assignments/42
Authorization: Bearer <token>
Content-Type: application/json

{
  "seat_number": 2,
  "notes": "Vegetarian, nut allergy"
}
```

**Response (200):**
```json
{
  "seating_id": 42,
  "table_id": 1,
  "guest_list_id": 15,
  "seat_number": 2,
  "notes": "Vegetarian, nut allergy",
  "table_name": "Table 1",
  "guest_name": "John Smith",
  "email": "john@example.com",
  "phone": "555-0123",
  "rsvp_status": "confirmed"
}
```

**Request Body:** (all optional)
- `seat_number`: Integer
- `notes`: String, max 255 chars

**Error Responses:**
- `404`: Assignment not found
- `400`: No fields to update

---

### 9. DELETE /assignments/:seating_id
**Remove a guest from their seating assignment**

**Request:**
```
DELETE /api/seating/assignments/42
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "ok": true,
  "message": "Assignment deleted"
}
```

**Error Responses:**
- `404`: Assignment not found

---

## Bulk Operations

### 10. DELETE /tables/:table_id/assignments
**Clear all guest assignments from a specific table**

**Request:**
```
DELETE /api/seating/tables/1/assignments
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "ok": true,
  "message": "Cleared 5 assignments from table"
}
```

**Error Responses:**
- `404`: Table not found

---

## Reports & Analytics

### 11. GET /reports/capacity
**Get table occupancy and fullness report**

**Request:**
```
GET /api/seating/reports/capacity
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "table_id": 1,
    "table_name": "Table 1",
    "capacity": 8,
    "occupancy": 5,
    "fullness_percentage": 62.5,
    "status": "Available"
  },
  {
    "table_id": 2,
    "table_name": "VIP",
    "capacity": 10,
    "occupancy": 10,
    "fullness_percentage": 100,
    "status": "Full"
  },
  {
    "table_id": 3,
    "table_name": "Kids Table",
    "capacity": 0,
    "occupancy": 3,
    "fullness_percentage": 0,
    "status": "No capacity set"
  }
]
```

**Status Values:**
- `"Full"`: occupancy >= capacity
- `"Available"`: occupancy < capacity (when capacity > 0)
- `"No capacity set"`: capacity is 0

---

### 12. GET /reports/unassigned
**Get list of all guests not yet assigned to any table**

**Request:**
```
GET /api/seating/reports/unassigned
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "guest_list_id": 20,
    "guest_name": "Bob Johnson",
    "email": "bob@example.com",
    "phone": "555-0200",
    "rsvp_status": "tentative",
    "party_size": 2
  },
  {
    "guest_list_id": 21,
    "guest_name": "Alice Williams",
    "email": "alice@example.com",
    "phone": "555-0201",
    "rsvp_status": "confirmed",
    "party_size": 1
  }
]
```

---

### 13. GET /search?q=...
**Search for guests or tables by name**

**Request:**
```
GET /api/seating/search?q=john
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "tables": [
    {
      "type": "table",
      "id": 5,
      "name": "John's Table",
      "capacity": 8,
      "email": null
    }
  ],
  "guests": [
    {
      "type": "guest",
      "id": 15,
      "name": "John Smith",
      "capacity": null,
      "email": "john@example.com"
    },
    {
      "type": "guest",
      "id": 105,
      "name": "Johnson Doe",
      "capacity": null,
      "email": "jdoe@example.com"
    }
  ]
}
```

**Query Parameters:**
- `q` (required): Search string - case insensitive, partial match

**Error Responses:**
- `400`: Missing search query
```json
{ "error": "Search query required" }
```

---

## Common Error Responses

### 401 Unauthorized
```json
{ "error": "Unauthorized" }
```
**Cause**: Missing or invalid JWT token

### 400 Bad Request
```json
{ "error": "Description of what went wrong" }
```
**Possible causes**: Missing required fields, invalid data format

### 404 Not Found
```json
{ "error": "Resource not found" }
```

### 500 Internal Server Error
```json
{ "error": "Error message from server" }
```

---

## Typical Workflows

### Workflow 1: Create Tables and Assign Guests
```javascript
// 1. Create a table
POST /api/seating/tables
{
  "table_name": "Table 1",
  "capacity": 8,
  "notes": "Main room"
}

// 2. Assign guests to table
POST /api/seating/assignments
{
  "guest_list_id": 15,
  "table_id": 1,
  "seat_number": 1,
  "notes": "Vegetarian"
}

// 3. View all assignments at table
GET /api/seating/tables/1
```

### Workflow 2: Reassign Guest to Different Table
```javascript
// 1. Simply POST a new assignment for same guest
POST /api/seating/assignments
{
  "guest_list_id": 15,  // Same guest
  "table_id": 3         // Different table
}
// Old assignment is automatically deleted

// 2. Confirm reassignment
GET /api/seating/assignments
```

### Workflow 3: Generate Seating Report
```javascript
// 1. Get capacity report
GET /api/seating/reports/capacity

// 2. Find unassigned guests
GET /api/seating/reports/unassigned

// 3. Clear a table and reassign
DELETE /api/seating/tables/2/assignments
```

### Workflow 4: Search and Bulk Update
```javascript
// 1. Search for a guest
GET /api/seating/search?q=smith

// 2. Get their current assignment
GET /api/seating/assignments

// 3. Update assignment if needed
PUT /api/seating/assignments/42
{
  "notes": "Updated dietary info"
}
```

---

## Implementation Tips for Frontend

### 1. **Authentication Setup**
Store JWT token from login/auth endpoint and include in all requests:
```javascript
const headers = {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
};
```

### 2. **Error Handling Pattern**
```javascript
.catch(error => {
  if (error.response?.status === 401) {
    // Token expired, redirect to login
  } else if (error.response?.status === 404) {
    // Resource not found
  } else if (error.response?.status === 400) {
    // Validation error, show message to user
  }
});
```

### 3. **Handling Reassignment**
When a user drags a guest from one table to another:
```javascript
// POST new assignment (old one auto-deletes)
POST /api/seating/assignments
{
  "guest_list_id": guestId,
  "table_id": newTableId
}
```

### 4. **Real-time Table View**
```javascript
// Get all tables with occupancy
GET /api/seating/tables

// Then fetch individual table details with assignments
GET /api/seating/tables/:table_id
```

### 5. **Capacity Warnings**
```javascript
// Use /reports/capacity to show UI warnings
const isFull = (table.occupancy >= table.capacity && table.capacity > 0);
const percentage = table.capacity > 0 
  ? (table.occupancy / table.capacity) * 100 
  : 0;
```

---

## Data Structures Reference

### Table Object
```json
{
  "table_id": 1,
  "table_name": "Table 1",
  "capacity": 8,
  "notes": "Near bar"
}
```

### Assignment Object (with joins)
```json
{
  "seating_id": 42,
  "table_id": 1,
  "guest_list_id": 15,
  "seat_number": 1,
  "notes": "Vegetarian",
  "table_name": "Table 1",
  "guest_name": "John Smith",
  "email": "john@example.com",
  "phone": "555-0123",
  "rsvp_status": "confirmed"
}
```

### Guest Object
```json
{
  "guest_list_id": 15,
  "guest_name": "John Smith",
  "email": "john@example.com",
  "phone": "555-0123",
  "rsvp_status": "confirmed",
  "party_size": 2
}
```

---

## Rate Limiting
Production environment applies rate limiting:
- **Window**: 15 minutes
- **Limit**: 300 requests per window per IP
- **Headers**: Check `RateLimit-*` headers in response

---

## Questions?
Refer to the endpoint documentation above or check the backend implementation in `routes/seating.routes.js`.
