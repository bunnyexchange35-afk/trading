# Mudrexx Earn Admin Configuration API

The admin configuration endpoint is deliberately disabled unless `ADMIN_API_KEY` is set at runtime. It is a small deployment-time control surface, not a replacement for identity, audit storage, or a back-office system.

## Enable

Set a long, random secret only in the Northflank secret manager (never in `VITE_*`, source control, or a browser):

```bash
ADMIN_API_KEY='replace-with-a-long-random-secret' npm start
```

Every admin request must include `Authorization: Bearer <ADMIN_API_KEY>`. Requests are rate-limited, return `Cache-Control: no-store`, and an unavailable secret yields `503`; invalid credentials yield `401`.

## Endpoints

### `GET /api/admin/config`

Returns the currently active non-secret configuration.

### `PUT /api/admin/config`

Accepts only these fields. Unknown fields are rejected.

```json
{
  "maintenanceMode": false,
  "supportUrl": "https://t.me/your_verified_support_handle",
  "announcement": "Flexible Earn vaults are now available."
}
```

`supportUrl` must pass the Link Safety Guard: public HTTPS, no embedded credentials, no localhost or `.local` host. `announcement` is limited to 180 characters. Values live in process memory and reset on redeploy; use environment configuration for durable deployment settings.

## Smoke check

```bash
curl -H "Authorization: Bearer $ADMIN_API_KEY" http://localhost:8080/api/admin/config
curl -X PUT -H "Authorization: Bearer $ADMIN_API_KEY" -H 'Content-Type: application/json' \
  --data '{"announcement":"Service update"}' http://localhost:8080/api/admin/config
```
