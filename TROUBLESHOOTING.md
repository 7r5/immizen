# Troubleshooting

Known issues and findings encountered during development.

---

## 1. Album assets return empty (0 items)

**Symptom:** Opening an album shows 0 photos even though `assetCount` is non-zero.

**Cause:** In newer Immich versions (roughly v1.90+), `GET /api/albums/{id}` no longer embeds the asset list in the response body by default. The app falls back to `POST /api/search/metadata`.

**Current workaround:** The app:
1. Calls `GET /api/albums/{id}` and checks `album.assets`.
2. If empty but `assetCount > 0`, calls `POST /api/search/metadata` with `{ albumIds: [albumId], size: 1000, page: 1 }`.

**Still broken?** Open browser DevTools → Network → find the request to `/api/albums/{id}` → paste the full JSON response here so we can see the exact field names returned.

---

## 2. Album detail shows all user photos instead of album photos

**Symptom:** The album grid shows the user's entire library rather than the selected album's content.

**Cause:** `POST /api/search/metadata` ignores the `albumId`/`albumIds` filter in some Immich versions or configurations.

**What to check:**
- In DevTools → Network, check the response of `POST /api/search/metadata`. If it returns all assets regardless of the filter, the endpoint doesn't support album filtering in this version.
- As an alternative, inspect `GET /api/albums/{id}` — if it returns a full `assets` array embedded in the response, we can skip the search API entirely by removing the fallback and using `GET /api/albums/{id}?withoutAssets=false`.

---

## 3. Images not loading on Samsung TV (but working in browser)

**Cause:** `<img src="...">` and `<video src="...">` cannot send `Authorization: Bearer` headers. Using `?accessToken=` as a URL query param works in some Immich versions but not all, and Tizen's webview may block it.

**Fix applied:** A custom `AuthImage` component (`src/components/AuthImage.jsx`) fetches each image with `fetch()` + `Authorization` header and converts the response to a `blob://` URL. Results are cached per session.

**Video limitation:** `<video>` streaming via blob URL is impractical for large files. Videos still use `?accessToken=` in the `src`. If videos don't play on TV, it means that parameter isn't accepted by the Immich version — no clean fix exists without a service worker.

---

## 4. "Cannot reach server" on Samsung TV (but works in browser)

**Cause:** Tizen web apps require explicit network access declarations in `config.xml`. Without them, the webview silently blocks all outgoing HTTP requests.

**Fix applied:** Added to both `public/config.xml` and `Debug/projects/immizen/config.xml`:
```xml
<access origin="*" subdomains="true"></access>
<tizen:privilege name="http://tizen.org/privilege/internet"></tizen:privilege>
```

**After changing `config.xml`:** Always rebuild and re-package the `.wgt` in Tizen Studio. Changes to `config.xml` are not picked up by a hot reload.

---

## 5. CORS errors in development (browser)

**Cause:** The browser at `localhost:5173` blocks direct `fetch()` calls to `http://192.168.x.x:2283` (cross-origin).

**Fix applied:** In `vite.config.js`, the dev server proxies all `/api/*` requests to `VITE_IMMICH_URL`. The API client uses relative paths (`/api/...`) in dev mode and full URLs in production builds.

**Important:** After editing `.env.local`, stop and restart `npm run dev` — Vite does not hot-reload environment variables.

---

## 6. Tizen Back button not working

**Tizen remote Back key codes:** `10009` (most models) and `461` (some older models). Both are handled in `src/hooks/useDpad.js`.

If Back still doesn't work on a specific TV model, check the Tizen Studio logs or add a `console.log(e.keyCode)` in the keydown handler to identify the actual code sent by that remote.
