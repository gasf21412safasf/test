# crystalxrat

Go web app with captcha-first flow and login/register page protected by Cloudflare Turnstile.

## Run

```bash
go run ./cmd/server
```

Server starts on `http://localhost:8080`.
Flow:
- `http://localhost:8080/captcha/`
- after success redirect to `http://localhost:8080/login/`

## Environment

Create/edit `.env`:

```env
name=CRYSTALXRAT
site_key=1x00000000000000000000AA
secret_key=1x0000000000000000000000000000000AA
```

`name` (or `NAME`) is rendered on page titles.
`site_key` and `secret_key` are used for Cloudflare Turnstile verification.

## Frontend script

TypeScript sources:
- `web/static/ts/captcha.ts`
- `web/static/ts/login.ts`

Runtime files:
- `web/static/js/captcha.js`
- `web/static/js/login.js`

Build frontend JS from TS:

```bash
npm install
npm run build:ts
```
