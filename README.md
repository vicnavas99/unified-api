# Unified API

A centralized Express API for wedding RSVP, seating management, to-do lists, auth, and logging. This project uses PostgreSQL and supports optional static frontend hosting from the `public/` folder.

## Features

- `POST /api/auth/login` — login and receive JWT token
- `POST /api/rsvp/gate` — find guest by first/last name
- `GET /api/rsvp/group/:groupId` — retrieve group guests
- `GET /api/rsvp/groupList/:groupIdList` — retrieve multiple group IDs
- `POST /api/rsvp/updateUser` — update guest RSVP details
- `GET /api/rsvp/guests` — list all guests
- `GET /api/rsvp/guests.xlsx` — export guests to Excel
- `GET /api/seating/tables` — list seating tables with occupancy
- `GET /api/seating/tables/:table_id` — table details with assignments
- `POST /api/seating/tables` — create seating table
- `PUT /api/seating/tables/:table_id` — update table
- `DELETE /api/seating/tables/:table_id` — delete table
- `GET /api/seating/assignments` — list seating assignments
- `POST /api/seating/assignments` — assign guest to table
- `PUT /api/seating/assignments/:seating_id` — update assignment
- `DELETE /api/seating/assignments/:seating_id` — remove assignment
- `DELETE /api/seating/tables/:table_id/assignments` — clear a table
- `GET /api/seating/reports/capacity` — seating capacity report
- `GET /api/seating/reports/unassigned` — list unassigned guests
- `GET /api/seating/search?q=...` — search tables and guests
- `GET /api/health` — health check
- `POST /api/logs/:site` — create site log entry
- `GET /api/todo/*` — authenticated to-do list routes
- `GET /api/plants` — list plant sensor data
- `GET /api/plants/:sensor_id` — retrieve one plant sensor
- `PUT /api/plants/:sensor_id` — create or update plant sensor data
- `POST /api/users` — create a user; requires JWT
- `PUT /api/users/:id` — update a user; requires JWT
- `DELETE /api/users/:id` — delete a user; requires JWT

## Requirements

- Node.js
- PostgreSQL database
- `.env` file with required environment variables

## Installation

```bash
cd /Users/victor/Desktop/GitHubRepositories/unified-api
npm install
```

## Environment

Create a `.env` file in the project root with the following variables:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgres://user:password@host:port/database
JWT_SECRET=your_jwt_secret
JWT_EXPIRES=1h
CORS_ORIGINS=http://localhost:3000
VICTOR_API_KEY=...
WEDDING_API_KEY=...
CUATRO_API_KEY=...
```

### Notes

- `DATABASE_URL` is required for PostgreSQL connectivity.
- `JWT_SECRET` and `JWT_EXPIRES` are required for auth token generation.
- `CORS_ORIGINS` is optional in development; in production it controls allowed origins.
- API key values are loaded into `utils/keys.js` for the logging route.

## Running the app

```bash
npm start
```

The server listens on `PORT` or `3001` by default.

## API Usage

### General

- Base path: `/api`
- JSON bodies are accepted with a `1mb` limit.
- In production, rate limiting is enabled for `/api/*` and CORS is restricted.

### Auth

`POST /api/auth/login`

Request body:

```json
{
  "username": "user",
  "password": "password"
}
```

Response:

```json
{
  "token": "<JWT>"
}
```

### To-do routes (require JWT)

All `/api/todo` routes require `Authorization: Bearer <token>`.

- `GET /api/todo/lists`
- `GET /api/todo/lists/:list/tasks`
- `POST /api/todo/lists/:list/tasks`
- `PUT /api/todo/tasks/:id`
- `DELETE /api/todo/tasks/:id`

### RSVP routes

- `POST /api/rsvp/gate`
  - Body: `{ firstName, lastName }`
- `GET /api/rsvp/group/:groupId`
- `GET /api/rsvp/groupList/:groupIdList`
- `POST /api/rsvp/updateUser`
  - Body may include: `guestListId`, `guestName`, `hotel`, `specialMessage`, `status`, `songRecomenation`, `allergyComment`, `usersWithStatusChange`
- `GET /api/rsvp/guests`
- `GET /api/rsvp/guests.xlsx`

### Seating routes

- `GET /api/seating/tables`
- `GET /api/seating/tables/:table_id`
- `POST /api/seating/tables`
- `PUT /api/seating/tables/:table_id`
- `DELETE /api/seating/tables/:table_id`
- `GET /api/seating/assignments`
- `POST /api/seating/assignments`
- `PUT /api/seating/assignments/:seating_id`
- `DELETE /api/seating/assignments/:seating_id`
- `DELETE /api/seating/tables/:table_id/assignments`
- `GET /api/seating/reports/capacity`
- `GET /api/seating/reports/unassigned`
- `GET /api/seating/search?q=...`

#### Update table example

```bash
curl -X PUT http://localhost:3001/api/seating/tables/1 \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "Updated Table Name",
    "capacity": 8,
    "notes": "Updated notes"
  }'
```

#### Delete table example

```bash
curl -X DELETE http://localhost:3001/api/seating/tables/1
```

> Deleting a table also removes any seating assignments for that table first.

### Logging route

`POST /api/logs/:site`

- Requires header `x-api-key: <site-key>`
- Uses site keys configured in environment variables via `utils/keys.js`

Request body example:

```json
{
  "message": "Visitor logged",
  "url": "https://example.com/page"
}
```

### Health check

`GET /api/health`

Response includes status, environment, and current time.

### Plant routes

- `GET /api/plants`
- `GET /api/plants/:sensor_id`
- `PUT /api/plants/:sensor_id`

The update body must include `plant_name`, `battery_level`, `humidity_number`,
and `humidity_percentage`. The `sensor_id` is supplied in the URL and existing
sensors are updated automatically.

### User management routes

All user management routes require `Authorization: Bearer <token>`.

`POST /api/users` accepts:

```json
{
  "username": "new-user",
  "password": "password"
}
```

`PUT /api/users/:id` accepts either or both of `username` and `password`.
Passwords are stored as bcrypt hashes. Responses never include `password_hash`.

`DELETE /api/users/:id` deletes the user and returns the deleted user's public
fields.

## Database

The app expects a PostgreSQL database and a `DATABASE_URL` connection string. The server uses `pg` and attaches a pool to `app.locals.db`.

The routes reference these schemas/tables:

- `victornavas.users`
- `victornavas.todolist`
- `wedding.guest_list`
- `wedding.seating_table`
- `wedding.seating_assignment`
- `appdata.logs`
- `plants.plant_data`

## Deployment

- Set `NODE_ENV=production`
- Provide `DATABASE_URL` and API key environment variables
- Configure `CORS_ORIGINS` to allow only trusted origins
- Use `npm start` or a process manager like PM2

## Project structure

- `server.js` — app entrypoint
- `routes/` — API route handlers
- `middleware/` — auth and API key validation
- `db/` — PostgreSQL pool helper
- `utils/` — API key map and user-agent parsing
- `public/` — optional static frontend files

## Notes

- The seating routes include commented-out JWT auth middleware; if enabled, `/api/seating` routes will require a valid token.
- Some RSVP responses include Spanish-language messages.
- `logs.routes.js` uses client IP detection and external geolocation (`ipapi.co`).
