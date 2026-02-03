# E2E Tests (Tauri v2 + WebDriver)

This project uses Tauri's WebDriver approach via `tauri-driver` and WebdriverIO.

## Prerequisites

- Rust toolchain + Cargo installed.
- `tauri-driver` installed:
  - `cargo install tauri-driver --locked`
- Native WebDriver for your OS:
  - Windows: Microsoft Edge WebDriver (`msedgedriver`).
  - Linux: WebKitWebDriver (`webkit2gtk-driver`).

> Note: macOS does not have a supported WKWebView WebDriver, so this setup is intended for Windows/Linux.

## Install E2E deps

```bash
pnpm -C e2e-tests install
```

## Run E2E tests

```bash
pnpm e2e
```

The E2E runner will:
1. Build the Tauri app in debug mode without bundling.
2. Start `tauri-driver`.
3. Run WebdriverIO against the app.

## Config

- `e2e-tests/wdio.conf.mjs` controls build + driver boot.
- `e2e-tests/test/specs/*.e2e.js` contains tests.
