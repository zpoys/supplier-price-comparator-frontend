# Supplier Price Comparator — Frontend

React + TypeScript + Vite + Bun + Chakra UI v2.

```sh
bun install
cp .env.example .env
# default Vite proxy forwards API routes to http://localhost:3000
bun run dev
```
Open http://localhost:5173.

Build/check: `bun run typecheck && bun run build`.

## Backend endpoint coverage
- Target types: GET `/target-types/find`, POST `/target-types/create` (the supplied backend does not implement update/delete).
- Providers: GET `/providers/find`, POST `/providers/create`, `/providers/update/:code`, `/providers/delete/:code`.
- Products: GET `/products/find`, POST `/products/create`, `/products/update/:code`, `/products/delete/:code`.
- Suppliers: GET `/suppliers/find`, POST `/suppliers/create`, `/suppliers/update/:code`, `/suppliers/delete/:code`.
- Product suppliers: POST `/product-suppliers/create`, GET `/product-suppliers/find/:productCode`, POST `/product-suppliers/update/:productCode/:supplierCode`, `/product-suppliers/delete/:productCode/:supplierCode`.
- Sync: POST `/sync`, GET `/sync/last-synced`.

Search syntax mirrors the backend: exact, `%contains%`, `prefix%`, `%suffix`, and `!value` negation. FK filters and form fields use Chakra Select populated from related master endpoints. The API envelope `{success,data,message}` is handled centrally. During development, Vite proxies backend paths to `http://localhost:3000` (override with `VITE_API_PROXY_TARGET`). For deployment without a reverse proxy, set `VITE_API_URL` to the backend origin and configure backend CORS for the frontend origin.

## Product best price
The Products table reads the `bestPrice` field returned by `GET /products/find` and formats it as Indonesian Rupiah (IDR), alongside the other product fields. It remains a read-only API-derived value and is not included in create/update forms.


## Bulk operations (Excel)
- On master-data pages, use **Download Excel template** to get an `.xlsx` workbook with a `Data` sheet and a `Petunjuk` sheet describing columns and requirements. Keep the exact column names (`code`, `name`, `providerCode`, `targetTypeCode`, `productListUrl`, etc.) and fill data from row 2.
- **Import Excel** creates each row through the existing single-create API endpoint. Rows that fail are reported; successful rows remain saved, so fix the reported rows and import again. Relation codes must already exist.
- Select rows using the checkboxes in the table and click **Delete selected** to delete multiple records through existing delete endpoints. Delete is available only for entities whose backend has a delete endpoint.
- The frontend uses the `xlsx` package to read/write `.xlsx` files. Run `bun install` after updating dependencies.

## Routing, authentication, and frontend cache

- The application uses React Router (`BrowserRouter`) with browser-history URLs. Dashboard is `/`; master-data screens use paths such as `/products/find` and `/suppliers/find`.
- Search criteria are encoded into the URL query string. For example, `/products/find?name=%25yourname%25`. Refreshing or opening a shared URL restores the same section and submitted filters.
- Login calls `POST /auth/login` with `{ username, password }`. The backend's `HttpOnly` `access_token` cookie is sent automatically through `credentials: include`; the frontend never reads or stores the token. Logout calls `POST /auth/logout`.
- `AuthProvider` validates the session on application startup through `GET /me` with `cache: no-store`. Protected routes wait for this check and redirect unauthenticated users to `/login`; authenticated users are redirected away from the login page.
- After `POST /auth/login`, the frontend calls `GET /me` to confirm the cookie-backed session and obtain the username. The username is kept only in React state.
- A protected request returning `401` clears the in-memory response cache and session state, then the route guard redirects to `/login`. Logout always clears local session state and cache, even if the logout request fails.
- The access token remains in the backend-managed `HttpOnly` cookie. The frontend never reads or stores the token in `localStorage` or `sessionStorage`.
- Successful GET responses are cached in memory using the full request path, including query parameters. The cache uses LRU eviction and keeps at most 100 keys. It is cleared on refresh/reload.
- A successful POST mutation clears cached GET entries under the same first path segment (for example, any `/products/...` mutation clears `/products`, `/products/find`, and related product request entries). Sync also clears product and product-supplier cache entries.
- The frontend does not implement pagination or client-side result limits. The API's `/find` endpoints must return the complete result set from the database; the frontend renders the returned rows.

### Backend deployment notes

- Configure backend CORS to allow the exact frontend origin and credentials (`Access-Control-Allow-Credentials: true`); do not use `*` as the allowed origin when credentials are enabled.
- Keep the cookie options from the backend contract. If frontend and API are hosted on different sites (not merely different subdomains of the same site), `SameSite=Lax` may prevent the cookie from being sent cross-site; that deployment needs a deliberate cookie/CORS setup (typically `SameSite=None; Secure`) and HTTPS.
- Configure the production static host to rewrite unknown application paths (such as `/products/find`) to `index.html`, so browser refreshes are served by the SPA entry point.
