You are a frontend developer building a wedding planner application. Your task is to implement seating chart functionality that connects to a backend API.

## Backend Context

The backend provides a `/api/seating` REST API with the following endpoints:

### Tables Management
- `GET /api/seating/tables` → Returns array of all tables with occupancy count
- `GET /api/seating/tables/:table_id` → Returns single table with all assignments and guest details
- `POST /api/seating/tables` → Create new table (requires: table_name, optional: capacity, notes)
- `PUT /api/seating/tables/:table_id` → Update table details
- `DELETE /api/seating/tables/:table_id` → Hard delete table

### Assignments
- `GET /api/seating/assignments` → Returns all guest assignments with guest details joined
- `POST /api/seating/assignments` → Assign guest to table (auto-handles reassignment by removing old assignment)
  - Request body: { guest_list_id, table_id, seat_number?, notes? }
  - Auto-removes guest from old table if they're already assigned elsewhere
- `PUT /api/seating/assignments/:seating_id` → Update seat number or notes
- `DELETE /api/seating/assignments/:seating_id` → Remove guest from table

### Bulk & Reporting
- `DELETE /api/seating/tables/:table_id/assignments` → Clear all assignments from a table
- `GET /api/seating/reports/capacity` → Returns table occupancy report with fullness percentage
- `GET /api/seating/reports/unassigned` → Returns all guests not yet assigned
- `GET /api/seating/search?q=searchterm` → Search tables and guests by name (returns {tables[], guests[]})

## Key API Behaviors
1. **All endpoints require JWT authentication** via `Authorization: Bearer <token>` header
2. **Reassignment is automatic** — if you POST an assignment for a guest who's already at a table, their old assignment is deleted
3. **Hard deletes** — deletions permanently remove records, not soft-delete
4. **Guest details are joined** — assignment responses include guest name, email, phone, rsvp_status from guest_list table
5. **Error responses** have format: `{ error: "message" }` or `{ ok: false, message: "..." }`
6. **Success responses** vary: `{ ok: true, ...}` or `{ success: true }` or direct data array/object

## Your Task
Build a frontend component/page for the seating chart that allows users to:

1. **View all tables** with their current occupancy
2. **View a specific table** with all assigned guests and their details
3. **Create new seating tables** (with name, capacity, optional notes)
4. **Assign guests to tables** (with optional seat number and dietary/accessibility notes)
5. **Reassign guests** to different tables (drag-and-drop or form-based)
6. **Update guest assignments** (change seat number or notes)
7. **Remove guests** from tables
8. **Clear an entire table** of all assignments
9. **View unassigned guests** (those not yet seated)
10. **Search** for guests or tables by name
11. **See capacity report** (which tables are full, partially full, empty)

## Response Data Structures
When you GET /api/seating/assignments or GET /api/seating/tables/:table_id/assignments, you receive guest details:
```
{
  seating_id: number,
  table_id: number,
  guest_list_id: number,
  seat_number: number | null,
  notes: string | null,
  table_name: string,
  guest_name: string,
  email: string,
  phone: string,
  rsvp_status: "confirmed" | "tentative" | "declined" | etc
}
```

When you GET /api/seating/reports/capacity, you receive:
```
{
  table_id: number,
  table_name: string,
  capacity: number,
  occupancy: number,
  fullness_percentage: number (0-100),
  status: "Full" | "Available" | "No capacity set"
}
```

## Implementation Considerations
- Store the JWT token securely and include it in all API requests
- Handle 401 responses (token expired) by redirecting to login
- Show loading states while fetching data
- Debounce search queries to avoid excessive API calls
- Show real-time occupancy/capacity info to guide user decisions
- Prevent overbooking if needed (check capacity before assigning)
- Consider using drag-and-drop for reassigning guests between tables
- Use optimistic updates or refetch after mutations to keep UI in sync

## Next Steps for Frontend Development
1. Create a service/hook to wrap all seating API calls (with auth header)
2. Build a "Tables View" component showing all tables and occupancy
3. Build a "Table Detail View" showing guests at a specific table
4. Build an "Assign Guest" form/modal
5. Build a capacity report/dashboard
6. Build a search interface for finding guests/tables
7. Implement drag-and-drop or action buttons for reassigning guests

Use the SEATING_API_REFERENCE.md file in the repo for detailed endpoint documentation, request/response examples, and error handling patterns.

---

Instructions:
- Ask clarifying questions about the frontend framework being used (React, Vue, Svelte, etc.)
- Ask about the UI/UX approach (table-based, card-based, drag-and-drop, etc.)
- Propose component architecture
- Write example API service methods/hooks
- Provide code examples for common workflows
- Handle all error cases properly
- Implement proper loading and error states
