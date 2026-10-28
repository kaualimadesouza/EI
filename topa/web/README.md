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

An order placed on a phone (the app, or a phone browser that opened a store link) turns the phone
into the counter's pager: after payment it shows the order being prepared and, once it is ready,
vibrates (Vibration API, so not on iPhones) and blinks a bell, which stands still under reduced
motion. It asks every 2 s and stays up until the customer leaves it. In demo mode a phone order is
ready 5 s after payment and `/painel` sees it ready too; with the API, the merchant marks it ready
on `/painel`. An order placed at the totem keeps the plain confirmation and waits for the merchant.

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
