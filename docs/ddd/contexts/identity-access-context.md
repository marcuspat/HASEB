# Identity & Access Context

**Type:** Generic subdomain.
**Position:** the gatekeeper for every other context. Stateless verification
through JWT (see ADR 0014).

## Purpose

Authenticate humans and service principals; authorise their access to the
HTTP API and the WebSocket channel; provide the audit primitives the rest
of the system relies on.

## Ubiquitous Language (local)

- **User** — a human or service principal.
- **Role** — coarse-grained authorisation grant (`admin`, `analyst`,
  `submitter`, `viewer`).
- **Access Token** — short-lived JWT presented on every request.
- **Refresh Token** — long-lived rotating token that can mint Access Tokens.

## Aggregates

### User (root)

Members:
- `Role[]` (value objects)
- `RefreshToken[]` (entities)

See [../aggregates.md](../aggregates.md#4-user-aggregate-generic).

## Use Cases

| Use case                | Application service      | HTTP route                          |
|-------------------------|--------------------------|-------------------------------------|
| Register                | `RegisterUser`           | `POST /api/v1/auth/register`        |
| Login                   | `IssueAuthToken`         | `POST /api/v1/auth/login`           |
| Refresh                 | `RefreshAuthToken`       | `POST /api/v1/auth/refresh`         |
| Logout                  | `RevokeRefreshToken`     | `POST /api/v1/auth/logout`          |
| Change password         | `ChangePassword`         | `POST /api/v1/auth/password`        |
| Assign / revoke role    | `AssignRole`/`RevokeRole`| `POST /api/v1/users/{id}/roles`     |
| Deactivate user         | `DeactivateUser`         | `DELETE /api/v1/users/{id}`         |

## Repositories

- `IUserRepository`.

## Domain Events

- `user.registered`, `user.authenticated`, `user.password.changed`,
  `user.deactivated`.

Sensitive material (passwords, tokens) **never** appears in event payloads.

## Authorisation Model

- Authentication is by JWT (HS256 dev / RS256 prod).
- Authorisation is by Role × Scope:
  - `admin`: full access.
  - `analyst`: read all, no writes.
  - `submitter`: register Agents, submit Evaluations, view their own runs.
  - `viewer`: read-only on the Leaderboard.
- Each application service declares the required Roles. The middleware in
  `src/middleware/validation.ts` enforces them before invocation.

## Token Lifecycle

| Token              | Lifetime      | Storage                                   |
|--------------------|---------------|-------------------------------------------|
| Access Token       | 15 minutes    | client memory (no localStorage in v1)     |
| Refresh Token      | 14 days       | server-stored hash + client httpOnly cookie |

Refresh tokens **rotate**: every refresh issues a new pair and invalidates
the previous refresh token.

## Persistence Mapping

- Tables: `users`, `user_roles`, `refresh_tokens`.
- Indexes: `users(email)` unique, `refresh_tokens(token_hash)`.

## Boundaries

| Other context              | Interaction                                                |
|----------------------------|------------------------------------------------------------|
| All contexts               | Generic auth dependency (middleware).                      |
| Notifications & Real-time  | Validates JWT on WebSocket handshake.                      |
| Logging                    | Audit events go to Winston with redaction filters applied. |

## Verification

- Tests in `tests/security/` cover:
  - Token tampering / signature verification.
  - Expired tokens rejected.
  - Refresh-token replay protected by rotation.
  - Rate limits on login and registration endpoints (ADR 0024).
- Secret scanning runs weekly.

## Open Questions / Future Work

- Replace local Identity & Access with an external OIDC IdP. Will supersede
  ADR 0014.
- Add MFA before exposing the API to external customers.
