# 5 Seconds Budgeting

A fast, private, local-first budgeting web app for people who want clarity without busywork. It supports current and historical expense entry, editable categories, monthly cash-outflow views, configurable long-range projections, offline use, and local backup and restore.

## Privacy model

Financial records remain in the browser's IndexedDB storage on the user's device. The app has no bank connection, backend database, analytics, advertising, or third-party runtime scripts. The service worker caches only the static app shell.

Backups are explicit JSON downloads and are not encrypted; they should be stored privately.

## Local verification

```sh
npm ci
npm test
npm run build
```

The production build is written to `dist/` and includes the generated offline service worker.

