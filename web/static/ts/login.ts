export {};

interface LoginConfig {
  name: string;
  siteKey: string;
  authUrl: string;
}

interface AuthResponse {
  ok?: boolean;
  mode?: string;
  username?: string;
  error?: string;
}

type StatusType = "error" | "ok" | "";

interface TurnstileApi {
  render: (
    container: HTMLElement | string,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark";
      appearance?: "always" | "execute" | "interaction-only";
    },
  ) => string;
  reset: (widgetId?: string) => void;
}

interface UiRefs {
  username: HTMLInputElement;
  password: HTMLInputElement;
  submitBtn: HTMLButtonElement;
  resetCaptchaBtn: HTMLButtonElement;
  status: HTMLParagraphElement;
  widgetHost: HTMLDivElement;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const styleText = `
:root {
  --bg: #0b0122;
  --card-border: rgba(151, 104, 228, 0.28);
  --line: rgba(150, 112, 222, 0.4);
  --input-border: rgba(177, 140, 247, 0.48);
  --text: #eadfff;
  --muted: #9e8bc6;
  --danger: #ff9bad;
  --ok: #a2e8be;
  --verify-top: #6d46ce;
  --verify-bottom: #4f2ea5;
}

* { box-sizing: border-box; }

html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background: radial-gradient(1000px 620px at 50% 5%, #140538 0%, #0d0328 45%, var(--bg) 100%);
  color: var(--text);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

#app { height: 100%; }

.viewport {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 14px;
}

.stack {
  width: min(96vw, 560px);
  display: grid;
  justify-items: center;
  gap: 14px;
  transform: translateY(8px);
}

.logo {
  width: min(78vw, 360px);
  height: auto;
  -webkit-user-drag: none;
  pointer-events: none;
  filter: drop-shadow(0 8px 18px rgba(84, 48, 161, 0.48));
}

.card {
  width: min(95vw, 404px);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(54, 31, 94, 0.62), rgba(21, 11, 43, 0.9));
  border: 1px solid var(--card-border);
  box-shadow:
    0 18px 38px rgba(6, 2, 18, 0.62),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  padding: 12px 12px 11px;
  backdrop-filter: blur(4px);
}

.title-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  margin: 0 4px 10px;
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.8px;
  color: #8e7eb7;
}

.title-row::before,
.title-row::after {
  content: "";
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--line), transparent);
}

.credentials {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.input-wrap {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: #8e7eb7;
  opacity: 0.92;
  pointer-events: none;
}

.input {
  width: 100%;
  height: 36px;
  border-radius: 13px;
  border: 2px solid rgba(190, 149, 255, 0.42);
  background: linear-gradient(180deg, rgba(38, 20, 67, 0.84), rgba(31, 16, 57, 0.9));
  color: #ebdeff;
  font-size: 17px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1;
  text-align: left;
  padding: 0 11px 0 34px;
  letter-spacing: 0.2px;
  outline: none;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}

.input::placeholder {
  color: #8b7ea9;
  font-size: 17px;
}

.input:focus {
  border-color: rgba(221, 193, 255, 0.88);
  box-shadow: 0 0 0 3px rgba(118, 79, 198, 0.28);
}

.captcha-box {
  margin-top: 12px;
  border-radius: 14px;
  border: 1px solid rgba(122, 82, 197, 0.84);
  background: linear-gradient(180deg, rgba(40, 22, 72, 0.82), rgba(31, 16, 58, 0.92));
  box-shadow: inset 0 0 0 1px rgba(157, 118, 236, 0.2);
  padding: 11px 10px 8px;
}

.turnstile-wrap {
  border-radius: 10px;
  border: 1px solid rgba(142, 109, 204, 0.32);
  padding: 8px;
  background: rgba(24, 13, 45, 0.6);
  display: flex;
  justify-content: center;
}

#turnstile-widget {
  min-height: 68px;
}

.captcha-actions {
  margin-top: 6px;
  text-align: center;
}

.text-link {
  border: 0;
  background: transparent;
  color: #9d8bc8;
  font-size: 12px;
  cursor: pointer;
  padding: 3px 8px;
}

.text-link:hover {
  color: #beadf0;
}

.submit-btn {
  width: 100%;
  margin-top: 12px;
  height: 40px;
  border-radius: 20px;
  border: 1px solid rgba(158, 119, 233, 0.88);
  background: linear-gradient(180deg, var(--verify-top) 0%, var(--verify-bottom) 100%);
  color: #d7c7ff;
  font-size: 32px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: filter 0.14s ease, transform 0.14s ease;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1;
  box-shadow: 0 7px 18px rgba(95, 59, 182, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.submit-btn .icon {
  font-size: 16px;
  transform: translateY(-0.7px);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: default;
}

.submit-btn:not(:disabled):hover { filter: brightness(1.1); }
.submit-btn:not(:disabled):active { transform: translateY(1px); }

.forgot {
  display: block;
  margin: 10px auto 0;
  width: fit-content;
  color: #9a88c5;
  text-decoration: none;
  font-size: 12px;
}

.forgot:hover { color: #b9a8e5; }

.status {
  margin: 6px 0 0;
  min-height: 16px;
  text-align: center;
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.2px;
  word-break: break-word;
}

.status.error { color: var(--danger); }
.status.ok { color: var(--ok); }

@media (max-width: 420px) {
  .card { width: min(95vw, 390px); }
  .submit-btn { font-size: 28px; }
  .credentials {
    grid-template-columns: 1fr;
    gap: 7px;
  }
}
`;

const body = document.body;
const app = document.getElementById("app");
if (!app) {
  throw new Error("app root not found");
}

const config: LoginConfig = {
  name: body.dataset.name ?? "CRYSTALXRAT",
  siteKey: body.dataset.siteKey ?? "",
  authUrl: body.dataset.authUrl ?? "/login/api/auth",
};

let turnstileToken = "";
let turnstileWidgetId = "";
let turnstileApi: TurnstileApi | undefined;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (typeof text === "string") {
    node.textContent = text;
  }
  return node;
};

const addStyles = (): void => {
  const style = document.createElement("style");
  style.textContent = styleText;
  document.head.appendChild(style);
};

const createInput = (
  id: string,
  placeholder: string,
  iconText: string,
  type: "text" | "password",
): HTMLDivElement => {
  const wrap = el("div", "input-wrap");

  const icon = el("span", "input-icon", iconText);
  wrap.appendChild(icon);

  const input = el("input", "input") as HTMLInputElement;
  input.id = id;
  input.type = type;
  input.placeholder = placeholder;
  input.autocomplete = type === "password" ? "current-password" : "username";
  input.spellcheck = false;
  wrap.appendChild(input);

  return wrap;
};

const renderUi = (): UiRefs => {
  const viewport = el("main", "viewport");
  const stack = el("section", "stack");
  viewport.appendChild(stack);
  app.appendChild(viewport);

  const logo = el("img", "logo") as HTMLImageElement;
  logo.src = "/assets/logo.png";
  logo.alt = config.name;
  stack.appendChild(logo);

  const card = el("div", "card");
  stack.appendChild(card);
  card.appendChild(el("div", "title-row", "Authorization"));

  const credentials = el("div", "credentials");
  card.appendChild(credentials);
  credentials.append(
    createInput("username", "login", "◌", "text"),
    createInput("password", "password", "◔", "password"),
  );

  const captchaBox = el("div", "captcha-box");
  card.appendChild(captchaBox);

  const turnstileWrap = el("div", "turnstile-wrap");
  const widgetHost = el("div") as HTMLDivElement;
  widgetHost.id = "turnstile-widget";
  turnstileWrap.appendChild(widgetHost);
  captchaBox.appendChild(turnstileWrap);

  const captchaActions = el("div", "captcha-actions");
  captchaBox.appendChild(captchaActions);

  const resetCaptchaBtn = el("button", "text-link", "change the captcha") as HTMLButtonElement;
  resetCaptchaBtn.type = "button";
  captchaActions.appendChild(resetCaptchaBtn);

  const submitBtn = el("button", "submit-btn") as HTMLButtonElement;
  submitBtn.type = "button";
  submitBtn.innerHTML = '<span class="icon">➜</span><span>Register Or Login</span>';
  card.appendChild(submitBtn);

  const forgot = el("a", "forgot", "forgot password?") as HTMLAnchorElement;
  forgot.href = "#";
  card.appendChild(forgot);

  const status = el("p", "status");
  card.appendChild(status);

  const username = card.querySelector("#username") as HTMLInputElement;
  const password = card.querySelector("#password") as HTMLInputElement;

  return {
    username,
    password,
    submitBtn,
    resetCaptchaBtn,
    status,
    widgetHost,
  };
};

const waitTurnstile = async (): Promise<TurnstileApi> => {
  const started = Date.now();
  while (Date.now() - started < 12000) {
    if (window.turnstile) {
      return window.turnstile;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("turnstile_not_loaded");
};

const setStatus = (ui: UiRefs, message: string, type: StatusType = ""): void => {
  ui.status.textContent = message;
  ui.status.classList.remove("error", "ok");
  if (type) {
    ui.status.classList.add(type);
  }
};

const initTurnstile = async (ui: UiRefs): Promise<void> => {
  if (!config.siteKey) {
    setStatus(ui, "Missing site key in env (site_key).", "error");
    return;
  }

  try {
    turnstileApi = await waitTurnstile();
    turnstileWidgetId = turnstileApi.render(ui.widgetHost, {
      sitekey: config.siteKey,
      theme: "dark",
      appearance: "always",
      callback: (token) => {
        turnstileToken = token;
        setStatus(ui, "Captcha solved.", "ok");
      },
      "expired-callback": () => {
        turnstileToken = "";
        setStatus(ui, "Captcha expired. Solve again.", "error");
      },
      "error-callback": () => {
        turnstileToken = "";
        setStatus(ui, "Captcha error. Reload widget.", "error");
      },
    });
  } catch {
    setStatus(ui, "Cloudflare captcha failed to load.", "error");
  }
};

const handleAuth = async (ui: UiRefs): Promise<void> => {
  const username = ui.username.value.trim();
  const password = ui.password.value;

  if (username.length < 3) {
    setStatus(ui, "Login must be at least 3 characters.", "error");
    return;
  }

  if (password.length < 6) {
    setStatus(ui, "Password must be at least 6 characters.", "error");
    return;
  }

  if (!turnstileToken) {
    setStatus(ui, "Complete Cloudflare captcha first.", "error");
    return;
  }

  ui.submitBtn.disabled = true;
  try {
    const response = await fetch(config.authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
        turnstileToken,
      }),
    });

    const payload = (await response.json()) as AuthResponse;
    if (!response.ok || !payload.ok) {
      const code = payload.error ?? "auth_failed";
      if (code === "invalid_credentials") {
        setStatus(ui, "Wrong password for this account.", "error");
        return;
      }
      if (code === "invalid_username") {
        setStatus(ui, "Login format: 3-32 chars (a-z, 0-9, _, ., -).", "error");
        return;
      }
      if (code === "invalid_password") {
        setStatus(ui, "Password too short (min 6).", "error");
        return;
      }
      if (code.includes("turnstile") || code.includes("timeout")) {
        setStatus(ui, "Cloudflare captcha rejected. Solve it again.", "error");
        return;
      }
      setStatus(ui, "Authorization failed.", "error");
      return;
    }

    const modeText = payload.mode === "registered" ? "Registered" : "Logged in";
    setStatus(ui, `${modeText}: ${payload.username ?? username}`, "ok");
  } catch {
    setStatus(ui, "Network error. Try again.", "error");
  } finally {
    ui.submitBtn.disabled = false;
    turnstileToken = "";
    if (turnstileApi && turnstileWidgetId) {
      turnstileApi.reset(turnstileWidgetId);
    }
  }
};

const blockClientTools = (ui: UiRefs): void => {
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  document.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const blocked =
      key === "f12" ||
      (event.ctrlKey && event.shiftKey && (key === "i" || key === "j" || key === "c")) ||
      (event.ctrlKey && (key === "u" || key === "s"));

    if (blocked) {
      event.preventDefault();
      setStatus(ui, "This shortcut is disabled on this page.", "error");
    }
  });
};

addStyles();
const ui = renderUi();
void initTurnstile(ui);
blockClientTools(ui);

ui.submitBtn.addEventListener("click", () => {
  void handleAuth(ui);
});

ui.password.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    void handleAuth(ui);
  }
});

ui.username.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    void handleAuth(ui);
  }
});

ui.resetCaptchaBtn.addEventListener("click", () => {
  turnstileToken = "";
  if (turnstileApi && turnstileWidgetId) {
    turnstileApi.reset(turnstileWidgetId);
    setStatus(ui, "Captcha reset.", "");
    return;
  }
  setStatus(ui, "Captcha not ready yet.", "error");
});
