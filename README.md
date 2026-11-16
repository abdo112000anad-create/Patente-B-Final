# Patente B بالعربي

Bilingual Italian–Arabic driving-theory study app. The Android package id is `it.patenteb.sideload.v29`; the public build workflow produces a debug APK for v46.

## Build with GitHub Actions

Push to `main` or select **Build Android APK** under the repository’s Actions tab. The workflow runs the project tests, synchronizes Capacitor, builds the Android debug variant, and uploads `app-debug.apk` as a downloadable artifact.

The workflow uses GitHub’s generated debug signing key. It is intended for clean installs or reinstalling after uninstalling a build signed with a different key; it is not a Play Store release.

## Local development

Requirements: Node.js 22, Java 21, and Android SDK Platform 36. Run `npm ci`, `npm test`, `npx cap sync android`, then `cd android && ./gradlew :app:assembleDebug`.
