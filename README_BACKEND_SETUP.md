# Backend Server Setup for SQLite with Express

This guide explains how to set up a simple backend server using Node.js, Express, and SQLite to serve API endpoints for your frontend hosted on GitHub Pages.

## Prerequisites

- Node.js and npm installed on your machine
- SQLite database file (`database.sqlite`) in the backend directory

## Setup Steps

1. **Install dependencies**

```bash
npm install express sqlite3 cors
```

2. **Start the backend server**

```bash
node backend/server.js
```

The server will start on port 3000 (or the port specified in the `PORT` environment variable).

## API Endpoints

- `GET /api/users` - Retrieves all users from the SQLite database.
- `POST /api/users` - Adds a new user. Requires JSON body with `name` and `email`.

## Connecting Frontend to Backend

- Your frontend (hosted on GitHub Pages) can make HTTP requests to the backend API endpoints.
- Ensure CORS is enabled on the backend (already enabled in the example).
- Use your backend server URL in frontend API calls.

## Domain Configuration

- Point your domain to GitHub Pages for the frontend.
- Host your backend server on a platform that supports Node.js.
- Use a subdomain or different path for backend API calls, and configure DNS accordingly.

## Notes

- This is a basic example. For production, consider security, authentication, error handling, and database migrations.
- You can deploy the backend on platforms like Heroku, AWS, DigitalOcean, or any VPS.

If you need help with deployment or frontend integration, feel free to ask.
