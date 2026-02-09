# Heimdall

Multi-tenant authentication and authorization service built with Node.js, Express 5, and MongoDB.

Heimdall provides password-based and WebAuthn/passkey authentication, JWT access and refresh tokens, project-scoped API keys, and a role-based membership system.

## Features

- **Password authentication** with bcrypt hashing
- **Passkey/WebAuthn (FIDO2)** as an alternative login method
- **JWT access tokens** (15 min) + **refresh tokens** (7 days) with rotation
- **Multi-tenant projects** with API key scoping
- **Role hierarchy**: Owner > Admin > Manager > Member
- **Membership management**: invite, accept, update roles, remove, leave
- **Passkey enrollment nudge**: configurable per-project policy with user opt-out
- **Rate limiting** on auth endpoints
- **CORS** support
- **Swagger UI** at `/api/docs`

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express 5
- **Database**: MongoDB (Mongoose 8)
- **Auth**: jsonwebtoken, bcrypt, @simplewebauthn/server v10
- **Testing**: Jest + Supertest

## Setup

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas)

### Install

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
JWT_SECRET=your-secret-key
CONNECTION_STRING=mongodb+srv://user:pass@cluster.mongodb.net/heimdall

# Optional
PORT=7001
REFRESH_TOKEN_SECRET=your-refresh-secret

# WebAuthn/Passkey (optional, defaults shown)
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Heimdall
WEBAUTHN_ORIGIN=http://localhost:3000
```

For multi-origin passkey support, provide comma-separated origins:

```env
WEBAUTHN_ORIGIN=https://app.example.com,https://admin.example.com
```

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Test

```bash
npm test
npm run test:watch
npm run test:coverage
```

## API Documentation

Interactive API docs are available at `/api/docs` (Swagger UI) when the server is running.

All project-scoped endpoints require an `x-api-key` header. Authenticated endpoints require a `Bearer` token in the `Authorization` header.

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | API Key | Register a new user |
| POST | `/login` | API Key | Login with email/password |
| POST | `/refresh` | API Key | Refresh access token |
| POST | `/logout` | Bearer | Logout (revoke refresh token) |

### Passkey (`/api/auth/passkey`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register/options` | Bearer | Generate passkey registration challenge |
| POST | `/register/verify` | Bearer | Complete passkey registration |
| POST | `/login/options` | API Key | Generate passkey login challenge |
| POST | `/login/verify` | API Key | Complete passkey login |
| GET | `/credentials` | Bearer | List registered passkeys |
| PATCH | `/credentials/:id` | Bearer | Rename a passkey |
| DELETE | `/credentials/:id` | Bearer | Delete a passkey |
| POST | `/opt-out` | Bearer | Opt out of passkey enrollment nudge |

### Users (`/api/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer | List all users in project |
| GET | `/:id` | Bearer (Admin+) | Get user by ID |
| PUT | `/:id` | Bearer (Admin+) | Update user |
| DELETE | `/:id` | Bearer (Admin+) | Remove user |

### Memberships (`/api/memberships`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer | List project members |
| GET | `/:userId` | Bearer | Get member details |
| POST | `/invite` | Bearer (Admin+) | Invite a member |
| PUT | `/:userId/role` | Bearer (Admin+) | Update member role |
| DELETE | `/:userId` | Bearer (Admin+) | Remove a member |
| POST | `/leave` | Bearer | Leave project |
| POST | `/accept` | Bearer | Accept invitation |
| PUT | `/metadata` | Bearer | Update own metadata |

## Authentication Flow

### Password Login

```
POST /api/auth/register  (x-api-key) -> creates user + membership
POST /api/auth/login     (x-api-key) -> returns accessToken + refreshToken
POST /api/auth/refresh   (x-api-key) -> rotates refreshToken, returns new pair
POST /api/auth/logout    (Bearer)    -> revokes refreshToken
```

### Passkey Login

```
# 1. Register a passkey (must be logged in first)
POST /api/auth/passkey/register/options  (Bearer) -> returns WebAuthn options + challengeId
POST /api/auth/passkey/register/verify   (Bearer) -> stores credential

# 2. Login with passkey
POST /api/auth/passkey/login/options     (x-api-key) -> returns WebAuthn options + challengeId
POST /api/auth/passkey/login/verify      (x-api-key) -> returns accessToken + refreshToken
```

Passkey login returns the same token structure as password login. Users can have both methods active and use either on any device.

## Passkey Enrollment Policy

Projects can set `passkeyPolicy` to nudge users toward passkey setup:

- **`"optional"`** (default) -- no nudge, users add passkeys if they choose
- **`"encouraged"`** -- login response includes `passkeySetupRequired: true` for users without passkeys who haven't opted out

Users can opt out via `POST /api/auth/passkey/opt-out`, which stores the preference in their membership metadata.

## Project Structure

```
src/
  controllers/    # Request handlers
  db/             # Database connection
  middleware/     # authenticate, authoriseRole, validateApiKey, validateMembership
  models/         # Mongoose schemas (User, Project, UserProjectMembership,
                  #   RefreshToken, PasskeyCredential, WebAuthnChallenge)
  routes/         # Express routers
  types/          # TypeScript interfaces and enums
  index.ts        # App entry point
```

## License

MIT
