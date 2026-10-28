# topa-web

The TOPA kiosk: Vite, React 19, TypeScript and Tailwind 4, hexagonal (`src/domain`, `src/ports`,
`src/adapters`, `src/ui`, wired only in `src/composition.ts`). Tauri 2 packages the same build as a
desktop app and an Android phone app.

## Run and test

```bash
npx -y npm@11 install   # npm 10 hangs on Tailwind's optional wasm package
npm run dev             # http://localhost:5173, demo mode unless VITE_API_URL is set
npm test                # Vitest, fails under 100% coverage
npm run lint && npm run typecheck
```

`make run` from `topa/` brings up the web app with the API and Postgres.

## Which API a build talks to

`src/composition.ts` uses the API when `VITE_API_URL` is set and demo mode when it is unset or
empty.

- `npm run dev` and the tests read no URL, so they run in demo mode; `make run` sets `/api`, which
  Vite proxies to the local API.
- Every production build (`npm run build`: each Vercel deploy, PR previews included, and both
  Tauri apps) reads the deployed API's URL from `.env.production`. There is one environment, so
  whatever these builds do lands in the production database. The URL is the `api_url` the API
  deploy prints; if it ever changes, update the file.
- The API answers CORS only for the origins in `topa/api/infrastructure/main.tf`: the Vercel
  project's URLs and the apps' webviews. Served from anywhere else, such as `npm run preview` on
  localhost, a production build cannot reach it; `VITE_API_URL=` in `.env.production.local`
  (gitignored) makes a local build run in demo mode.
- A `VITE_API_URL` set in the Vercel project's settings would come down with `vercel pull` and
  beat the file: keep it unset there.
- A kiosk on `make run` sends its queue QR to the hosted site (`src/domain/store.ts`), so phone
  orders placed through it go to the production API, not the local one.

### Deploying by hand

`.github/workflows/web.yml` deploys on its own once the repo holds the Vercel secrets. Until then,
from `topa/web`:

```bash
npx -y vercel@59.10.0 link --yes --project topa-totem    # once per checkout

# PROD: topa-totem.vercel.app
npx -y vercel@59.10.0 pull --yes --environment=production
npx -y vercel@59.10.0 build --prod
npx -y vercel@59.10.0 deploy --prebuilt --prod

# DEV: topa-totem-dev.vercel.app
npx -y vercel@59.10.0 pull --yes --environment=preview
npx -y vercel@59.10.0 build
url=$(npx -y vercel@59.10.0 deploy --prebuilt)
npx -y vercel@59.10.0 alias set "$url" topa-totem-dev.vercel.app
```

## Apps (desktop e Android)

`src-tauri/` wraps the web build. The desktop app shows the kiosk. The Android app has two roles,
picked in `src/composition.ts`:

- **Phone** (the default): it opens on plain TOPA and "Aproximar do totem". Holding the phone to a
  totem (or its sticker) reads the store's link, and the app opens that store's ordering screens,
  with "Ler outro totem" to go back.
- **Totem**: it runs the kiosk and answers phones as an NFC Forum Type 4 tag holding the store's
  link (`TagEmulationService.kt` over host card emulation), on the start and queue screens only,
  so a card held to the totem at payment never meets the tag. A phone without the app opens the
  link in its browser. Devices without HCE fall back to the sticker.

Staff switch a device between the two roles by tapping the TOPA mark (top of the phone screen,
"por TOPA" on the kiosk start) five times within 2 s; the app reloads in the other role. Both
screens show the app version next to the mark.

You need Rust (rustup). For Android also JDK 17+, the Android SDK with an NDK (`ANDROID_HOME`,
`NDK_HOME`) and `rustup target add aarch64-linux-android`. The Linux desktop build needs
`libwebkit2gtk-4.1-dev librsvg2-dev patchelf`.

```bash
npm run tauri dev                                         # desktop window over the Vite dev server
npm run tauri android dev                                 # phone over adb, or an emulator
npx tauri android build --debug --apk --target aarch64   # debug APK, arm64 phones
```

The APK lands in `src-tauri/gen/android/app/build/outputs/apk/universal/debug/` (about 115 MB:
a debug build keeps its symbols). `src-tauri/gen/android` is committed, as Tauri recommends. After
a build, `./gradlew :app:testUniversalDebugUnitTest` in `src-tauri/gen/android` runs the Kotlin
tests of the tag's APDU exchange (`Type4TagTest.kt`).

CI (`.github/workflows/native.yml`) builds the APK and a Linux bundle (`.deb` and AppImage) on
every PR that touches `topa/web`: download them from the run page as `topa-android-debug-apk`
and `topa-linux-desktop`. On a release it attaches the Linux, Windows and macOS installers and
the APK to that release.

### Writing the NFC sticker

Use any NFC writer app (NFC Tools, for example) and an NTAG213 or larger sticker. Write a single
URI record with the store's URL, `https://topa-totem.vercel.app/?loja=<slug>`, where the slug is
lowercase letters, digits and hyphens. Lock the tag afterwards so nobody can rewrite it. The app
accepts only http(s) URLs with a valid `loja`; anything else shows "Não é um totem TOPA.". A
phone without the app opens the same URL in its browser. An Android totem with HCE needs no
sticker: it serves the same URL itself.

### Icons and versions

`src-tauri/app-icon.png` is the totem mark redrawn at 1024 px on cream. Regenerate every icon,
Android included, with `npx tauri icon src-tauri/app-icon.json` (the manifest sets the cream
launcher background) and delete the `icons/ios` folder it adds: there is no iOS build.

release-please keeps the version in `tauri.conf.json` and `Cargo.toml` equal to `package.json`.
Android rejects `0.0.0`, so `bundle.android.versionCode` is pinned to 1; drop it after the first
release so every release gets a higher version code.
