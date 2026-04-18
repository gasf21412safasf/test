export {};

interface CaptchaConfig {
  name: string;
  newUrl: string;
  verifyUrl: string;
}

interface CaptchaState {
  token: string;
}

interface CaptchaCreateResponse {
  token?: string;
  challenge?: string;
}

type StatusType = "error" | "ok" | "";

interface UiRefs {
  canvas: HTMLCanvasElement;
  input: HTMLInputElement;
  status: HTMLParagraphElement;
  newCaptchaBtn: HTMLButtonElement;
  verifyBtn: HTMLButtonElement;
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
  --verify-top: #6741c7;
  --verify-bottom: #502ea4;
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
  padding: 28px 14px;
}

.stack {
  width: min(96vw, 560px);
  display: grid;
  justify-items: center;
  gap: 16px;
  transform: translateY(16px);
}

.logo {
  width: min(80vw, 390px);
  height: auto;
  -webkit-user-drag: none;
  pointer-events: none;
  filter: drop-shadow(0 10px 22px rgba(84, 48, 161, 0.5));
}

.card {
  width: min(95vw, 402px);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(54, 31, 94, 0.65), rgba(21, 11, 43, 0.9));
  border: 1px solid var(--card-border);
  box-shadow:
    0 18px 38px rgba(6, 2, 18, 0.62),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    inset 0 10px 24px rgba(116, 70, 196, 0.08);
  padding: 12px 14px 12px;
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

.captcha-shell {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(122, 82, 197, 0.9);
  background: radial-gradient(360px 160px at 50% 0%, rgba(20, 26, 50, 0.55), #02040d 82%);
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(157, 118, 236, 0.22);
}

#captcha-canvas {
  display: block;
  width: 100%;
  height: 138px;
}

.controls {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.btn {
  width: 100%;
  height: 33px;
  border: 1px solid rgba(176, 137, 247, 0.54);
  border-radius: 15px;
  background: linear-gradient(180deg, rgba(52, 29, 93, 0.78), rgba(35, 19, 66, 0.88));
  color: #9483bf;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.6px;
  cursor: pointer;
  text-transform: uppercase;
  transition: filter 0.14s ease, transform 0.14s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 12px;
  line-height: 1;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

.btn:active { transform: translateY(1px); }
.btn:hover { filter: brightness(1.12); }
.btn:disabled { opacity: 0.65; cursor: default; filter: none; }
.btn .icon { font-size: 12px; transform: translateY(-0.5px); opacity: 0.9; }

.input {
  width: 100%;
  height: 39px;
  border-radius: 14px;
  border: 2px solid rgba(190, 149, 255, 0.5);
  background: linear-gradient(180deg, rgba(38, 20, 67, 0.84), rgba(31, 16, 57, 0.9));
  color: #ebdeff;
  font-size: 19px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1;
  text-align: center;
  padding: 0 10px;
  letter-spacing: 0.3px;
  outline: none;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
  text-transform: lowercase;
}

.input::placeholder { color: #8b7ea9; font-size: 18px; }
.input:focus {
  border-color: rgba(221, 193, 255, 0.88);
  box-shadow: 0 0 0 3px rgba(118, 79, 198, 0.32);
}

.verify-btn {
  width: 100%;
  height: 40px;
  border-radius: 20px;
  border: 1px solid rgba(158, 119, 233, 0.88);
  background: linear-gradient(180deg, #7147d3 0%, var(--verify-top) 48%, var(--verify-bottom) 100%);
  color: #d7c7ff;
  font-size: 22px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: filter 0.14s ease, transform 0.14s ease;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1;
  padding: 0 12px;
  box-shadow: 0 7px 18px rgba(95, 59, 182, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.verify-btn .icon { font-size: 17px; transform: translateY(-1px); opacity: 0.9; }
.verify-btn:active { transform: translateY(1px); }
.verify-btn:hover { filter: brightness(1.1); }

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
  .card { width: min(95vw, 382px); }
  #captcha-canvas { height: 130px; }
  .verify-btn { font-size: 20px; }
  .input, .input::placeholder { font-size: 17px; }
}
`;

const body = document.body;
const app = document.getElementById("app");
if (!app) {
  throw new Error("app root not found");
}

const config: CaptchaConfig = {
  name: body.dataset.name ?? "CRYSTALXRAT",
  newUrl: body.dataset.captchaNewUrl ?? "/captcha/api/new",
  verifyUrl: body.dataset.captchaVerifyUrl ?? "/captcha/api/verify",
};

const state: CaptchaState = {
  token: "",
};

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

const createButton = (
  className: string,
  id: string,
  icon: string,
  label: string,
): HTMLButtonElement => {
  const button = el("button", className) as HTMLButtonElement;
  button.type = "button";
  button.id = id;

  const iconEl = el("span", "icon", icon);
  const labelEl = el("span", "", label);
  button.append(iconEl, labelEl);
  return button;
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
  card.appendChild(el("div", "title-row", "Verification"));

  const captchaShell = el("div", "captcha-shell");
  card.appendChild(captchaShell);

  const canvas = el("canvas") as HTMLCanvasElement;
  canvas.id = "captcha-canvas";
  canvas.width = 840;
  canvas.height = 320;
  captchaShell.appendChild(canvas);

  const controls = el("div", "controls");
  card.appendChild(controls);

  const newCaptchaBtn = createButton("btn", "new-captcha-btn", "↻", "New captcha");
  controls.appendChild(newCaptchaBtn);

  const input = el("input", "input") as HTMLInputElement;
  input.id = "captcha-input";
  input.type = "text";
  input.maxLength = 5;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.inputMode = "latin";
  input.placeholder = "enter code";
  controls.appendChild(input);

  const verifyBtn = createButton("verify-btn", "verify-btn", "⛩", "Verify");
  controls.appendChild(verifyBtn);

  const status = el("p", "status");
  card.appendChild(status);

  return { canvas, input, status, newCaptchaBtn, verifyBtn };
};

addStyles();
const ui = renderUi();

const ctx = ui.canvas.getContext("2d");
if (!ctx) {
  throw new Error("cannot get canvas context");
}

const setStatus = (message: string, type: StatusType = ""): void => {
  ui.status.textContent = message;
  ui.status.classList.remove("error", "ok");
  if (type) {
    ui.status.classList.add(type);
  }
};

const drawCaptcha = (challenge: string): void => {
  const width = ui.canvas.width;
  const height = ui.canvas.height;

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#03070f");
  bg.addColorStop(0.5, "#03060f");
  bg.addColorStop(1, "#01020a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 130; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 3.2 + 0.8;
    const alpha = Math.random() * 0.42 + 0.08;
    ctx.fillStyle = `rgba(118, 94, 176, ${alpha})`;
    ctx.fillRect(x, y, size, size);
  }

  for (let i = 0; i < 11; i += 1) {
    ctx.strokeStyle = `rgba(120, 86, 193, ${Math.random() * 0.24 + 0.13})`;
    ctx.lineWidth = Math.random() * 2 + 1.2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  const chars = challenge.split("");
  const gap = width / (chars.length + 1);
  chars.forEach((char, index) => {
    const x = gap * (index + 1);
    const y = height / 2 + (Math.random() * 14 - 7);
    const rotation = Math.random() * 0.42 - 0.21;
    const fontSize = 106 + Math.random() * 18;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.font = `${fontSize}px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(236, 234, 246, 0.95)";
    ctx.fillText(char, 0, 0);
    ctx.restore();
  });
};

const loadCaptcha = async (): Promise<void> => {
  setStatus("");
  ui.newCaptchaBtn.disabled = true;

  try {
    const response = await fetch(config.newUrl, { method: "GET" });
    if (!response.ok) {
      throw new Error("captcha_request_failed");
    }

    const payload = (await response.json()) as CaptchaCreateResponse;
    const token = payload.token ?? "";
    const challenge = payload.challenge ?? "";
    if (!token || !challenge) {
      throw new Error("captcha_response_invalid");
    }

    state.token = token;
    ui.input.value = "";
    drawCaptcha(challenge);
  } catch {
    setStatus("Cannot load captcha. Reload page.", "error");
  } finally {
    ui.newCaptchaBtn.disabled = false;
  }
};

const verifyCaptcha = async (): Promise<void> => {
  const code = ui.input.value.trim();
  if (!state.token) {
    setStatus("Captcha is not ready yet.", "error");
    return;
  }

  if (code.length < 5) {
    setStatus("Enter full code.", "error");
    return;
  }

  ui.verifyBtn.disabled = true;
  try {
    const response = await fetch(config.verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: state.token,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error("captcha_verify_failed");
    }

    const payload = (await response.json()) as { redirect?: string };
    setStatus("Verified. Redirecting to login...", "ok");
    window.setTimeout(() => {
      window.location.href = payload.redirect ?? "/login/";
    }, 260);
  } catch {
    setStatus("Code is invalid. Try again.", "error");
    await loadCaptcha();
  } finally {
    ui.verifyBtn.disabled = false;
  }
};

const blockClientTools = (): void => {
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
      setStatus("This shortcut is disabled on this page.", "error");
    }
  });
};

ui.newCaptchaBtn.addEventListener("click", () => {
  void loadCaptcha();
});

ui.verifyBtn.addEventListener("click", () => {
  void verifyCaptcha();
});

ui.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    void verifyCaptcha();
  }
});

blockClientTools();
void loadCaptcha();
