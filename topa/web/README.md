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

`src-tauri/` wraps the web build. The desktop app shows the kiosk. Android builds produce two
distinct apps from the same codebase:

- **Customer App (`topa`)**: `io.github.kaualimadesouza.topa`, labeled "TOPA", cream launcher
  background (`#FBF7EC`). Opens directly into `PhoneApp` ("Aproximar do totem"). Holding the phone
  to a totem (or its sticker) reads the store link and opens ordering, with "Ler outro totem" to
  return. It has no role-switch gesture, and its manifest excludes `TagEmulationService` and HCE.
- **Store App (`topa-loja`)**: `io.github.kaualimadesouza.topa.loja`, labeled "TOPA Loja", teal
  launcher background (`#1A4D49`). Built for merchant devices, opening in kiosk mode (totem) by
  default. Staff can switch between totem and painel by tapping the TOPA mark 5 times within 2 s, or
  via the sidebar button in the painel. Its manifest includes HCE and `TagEmulationService.kt` to
  answer phones as an NFC Forum Type 4 tag on start and queue screens.

An order placed on a phone (the customer app, or a mobile browser) turns the phone into the counter's
pager: after payment it shows the order being prepared and, once ready, vibrates (Vibration API, so
not on iPhones) and blinks a bell. While waiting it keeps the screen on (Screen Wake Lock API) and
polls `GET /orders/{id}` every 2 s. In demo mode a followed order is ready 5 s after payment; with the
API, the merchant marks it ready on the painel.

You need Rust (rustup). For Android also JDK 17+, the Android SDK with an NDK (`ANDROID_HOME`,
`NDK_HOME`) and `rustup target add aarch64-linux-android`. The Linux desktop build needs
`libwebkit2gtk-4.1-dev librsvg2-dev patchelf`.

```bash
npm run tauri dev                                                      # desktop window over Vite dev server
npm run tauri android dev                                              # phone over adb or emulator
npx tauri android build --debug --apk --target aarch64                # customer APK (io.github.kaualimadesouza.topa)
npx tauri android build --debug --apk --target aarch64 -c src-tauri/tauri.loja.conf.json # store APK (io.github.kaualimadesouza.topa.loja)
```

The APK lands in `src-tauri/gen/android/app/build/outputs/apk/universal/debug/` (about 115 MB:
a debug build keeps its symbols). `src-tauri/gen/android` is committed, as Tauri recommends. After
a build, `./gradlew :app:testUniversalDebugUnitTest` in `src-tauri/gen/android` runs the Kotlin
unit tests (`Type4TagTest.kt` and `VersionCodeTest.kt`).

CI (`.github/workflows/native.yml`) builds both APKs and a Linux bundle (`.deb` and AppImage) on
every PR that touches `topa/web`: download them from the run page as `topa-android-debug-apk`,
`topa-loja-android-debug-apk` and `topa-linux-desktop`. On a release it attaches the Linux, Windows
and macOS installers and both APKs to that release.

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
launcher background for the customer app and teal for the store app) and delete the `icons/ios`
folder it adds: there is no iOS build.

release-please keeps the version in `tauri.conf.json` and `Cargo.toml` equal to `package.json`.
`build.gradle.kts` computes `versionCode` dynamically from the semver string:
`major * 100000 + minor * 1000 + patch` (e.g. `0.1.3` produces `1003`), guaranteeing an integer
strictly greater than 1 that increases on each semver release.
