package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	captchaCookieName             = "captcha_verified"
	authCookieName                = "auth_session"
	captchaLength                 = 5
	captchaTTL                    = 2 * time.Minute
	authSessionTTL                = 24 * time.Hour
	defaultTurnstileSiteKey       = "1x00000000000000000000AA"
	defaultTurnstileSecretKey     = "1x0000000000000000000000000000000AA"
	turnstileVerifyEndpoint       = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
	minUsernameLength             = 3
	maxUsernameLength             = 32
	minPasswordLength             = 6
	passwordSaltSize              = 16
	maxJSONRequestBodyBytes int64 = 1 << 20
)

var (
	usernamePattern       = regexp.MustCompile(`^[a-zA-Z0-9_.-]{3,32}$`)
	errInvalidCredentials = errors.New("invalid credentials")
	errInvalidUsername    = errors.New("invalid username")
	errInvalidPassword    = errors.New("invalid password")
)

type captchaPageData struct {
	Name string
}

type loginPageData struct {
	Name             string
	TurnstileSiteKey string
}

type captchaEntry struct {
	Code      string
	ExpiresAt time.Time
}

type captchaStore struct {
	mu      sync.Mutex
	entries map[string]captchaEntry
}

func newCaptchaStore() *captchaStore {
	return &captchaStore{
		entries: make(map[string]captchaEntry),
	}
}

func (s *captchaStore) create() (string, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cleanupLocked()

	token, err := randomToken(16)
	if err != nil {
		return "", "", err
	}

	code, err := randomCode(captchaLength)
	if err != nil {
		return "", "", err
	}

	s.entries[token] = captchaEntry{
		Code:      code,
		ExpiresAt: time.Now().Add(captchaTTL),
	}

	return token, code, nil
}

func (s *captchaStore) verify(token, input string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cleanupLocked()

	entry, ok := s.entries[token]
	if !ok {
		return false
	}

	if !strings.EqualFold(strings.TrimSpace(input), entry.Code) {
		return false
	}

	delete(s.entries, token)
	return true
}

func (s *captchaStore) cleanupLocked() {
	now := time.Now()
	for token, entry := range s.entries {
		if now.After(entry.ExpiresAt) {
			delete(s.entries, token)
		}
	}
}

type userAccount struct {
	Username  string
	SaltHex   string
	HashHex   string
	CreatedAt time.Time
}

type userStore struct {
	mu    sync.Mutex
	users map[string]userAccount
}

func newUserStore() *userStore {
	return &userStore{
		users: make(map[string]userAccount),
	}
}

func (s *userStore) registerOrLogin(username, password string) (mode string, normalized string, err error) {
	normalized = strings.ToLower(strings.TrimSpace(username))

	if len(normalized) < minUsernameLength || len(normalized) > maxUsernameLength || !usernamePattern.MatchString(normalized) {
		return "", "", errInvalidUsername
	}

	if len(password) < minPasswordLength {
		return "", "", errInvalidPassword
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	existing, ok := s.users[normalized]
	if ok {
		if !verifyPassword(password, existing.SaltHex, existing.HashHex) {
			return "", "", errInvalidCredentials
		}
		return "logged_in", existing.Username, nil
	}

	saltHex, hashHex, hashErr := makePasswordHash(password)
	if hashErr != nil {
		return "", "", hashErr
	}

	created := userAccount{
		Username:  normalized,
		SaltHex:   saltHex,
		HashHex:   hashHex,
		CreatedAt: time.Now(),
	}

	s.users[normalized] = created
	return "registered", created.Username, nil
}

type sessionEntry struct {
	Username  string
	ExpiresAt time.Time
}

type sessionStore struct {
	mu       sync.Mutex
	sessions map[string]sessionEntry
}

func newSessionStore() *sessionStore {
	return &sessionStore{
		sessions: make(map[string]sessionEntry),
	}
}

func (s *sessionStore) create(username string, ttl time.Duration) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cleanupLocked()

	token, err := randomToken(24)
	if err != nil {
		return "", err
	}

	s.sessions[token] = sessionEntry{
		Username:  username,
		ExpiresAt: time.Now().Add(ttl),
	}

	return token, nil
}

func (s *sessionStore) username(token string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cleanupLocked()

	entry, ok := s.sessions[token]
	if !ok {
		return "", false
	}

	return entry.Username, true
}

func (s *sessionStore) cleanupLocked() {
	now := time.Now()
	for token, entry := range s.sessions {
		if now.After(entry.ExpiresAt) {
			delete(s.sessions, token)
		}
	}
}

type app struct {
	projectRoot      string
	captchaTemplate  *template.Template
	loginTemplate    *template.Template
	captchas         *captchaStore
	users            *userStore
	sessions         *sessionStore
	upgrader         websocket.Upgrader
	turnstileChecker *http.Client
}

func main() {
	projectRoot, err := findProjectRoot()
	if err != nil {
		log.Fatalf("cannot find project root: %v", err)
	}

	captchaTplPath := filepath.Join(projectRoot, "web", "templates", "index.html")
	captchaTpl, err := template.ParseFiles(captchaTplPath)
	if err != nil {
		log.Fatalf("cannot parse captcha template: %v", err)
	}

	loginTplPath := filepath.Join(projectRoot, "web", "templates", "login.html")
	loginTpl, err := template.ParseFiles(loginTplPath)
	if err != nil {
		log.Fatalf("cannot parse login template: %v", err)
	}

	a := &app{
		projectRoot:      projectRoot,
		captchaTemplate:  captchaTpl,
		loginTemplate:    loginTpl,
		captchas:         newCaptchaStore(),
		users:            newUserStore(),
		sessions:         newSessionStore(),
		turnstileChecker: &http.Client{Timeout: 10 * time.Second},
		upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool { return true },
		},
	}

	mux := http.NewServeMux()
	mux.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir(filepath.Join(projectRoot, "assets")))))
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(filepath.Join(projectRoot, "web", "static")))))
	mux.HandleFunc("/captcha", redirectWithSlash("/captcha/"))
	mux.HandleFunc("/captcha/", a.handleCaptchaPage)
	mux.HandleFunc("/captcha/api/new", a.handleCaptchaNew)
	mux.HandleFunc("/captcha/api/verify", a.handleCaptchaVerify)
	mux.HandleFunc("/login", redirectWithSlash("/login/"))
	mux.HandleFunc("/login/", a.handleLoginPage)
	mux.HandleFunc("/login/api/auth", a.handleAuth)
	mux.HandleFunc("/captcha/ws", a.handleWebsocket)
	mux.HandleFunc("/", handleRootRedirect)

	addr := ":" + getEnvOrDefault("PORT", "8080")
	log.Printf("server started on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

func (a *app) handleCaptchaPage(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/captcha/" {
		http.NotFound(w, r)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Cache-Control", "no-store")
	if err := a.captchaTemplate.Execute(w, captchaPageData{Name: a.readAppName()}); err != nil {
		http.Error(w, "cannot render page", http.StatusInternalServerError)
		log.Printf("captcha template execute error: %v", err)
	}
}

func (a *app) handleLoginPage(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/login/" {
		http.NotFound(w, r)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !hasCaptchaVerification(r) {
		http.Redirect(w, r, "/captcha/", http.StatusTemporaryRedirect)
		return
	}

	w.Header().Set("Cache-Control", "no-store")
	if err := a.loginTemplate.Execute(w, loginPageData{
		Name:             a.readAppName(),
		TurnstileSiteKey: a.readTurnstileSiteKey(),
	}); err != nil {
		http.Error(w, "cannot render page", http.StatusInternalServerError)
		log.Printf("login template execute error: %v", err)
	}
}

func (a *app) handleCaptchaNew(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token, code, err := a.captchas.create()
	if err != nil {
		http.Error(w, "cannot create captcha", http.StatusInternalServerError)
		log.Printf("captcha create error: %v", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"token":     token,
		"challenge": code,
	})
}

func (a *app) handleCaptchaVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Token string `json:"token"`
		Code  string `json:"code"`
	}

	if err := decodeJSONBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": "invalid_payload",
		})
		return
	}

	if !a.captchas.verify(strings.TrimSpace(req.Token), req.Code) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"ok":    false,
			"error": "captcha_failed",
		})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     captchaCookieName,
		Value:    "1",
		MaxAge:   int((30 * time.Minute).Seconds()),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"name":     a.readAppName(),
		"redirect": "/login/",
	})
}

func (a *app) handleAuth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !hasCaptchaVerification(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"ok":    false,
			"error": "captcha_required",
		})
		return
	}

	var req struct {
		Username       string `json:"username"`
		Password       string `json:"password"`
		TurnstileToken string `json:"turnstileToken"`
	}

	if err := decodeJSONBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":    false,
			"error": "invalid_payload",
		})
		return
	}

	ok, turnstileError, verifyErr := a.verifyTurnstile(strings.TrimSpace(req.TurnstileToken), r.RemoteAddr)
	if verifyErr != nil {
		log.Printf("turnstile verification error: %v", verifyErr)
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"ok":    false,
			"error": "turnstile_unavailable",
		})
		return
	}

	if !ok {
		if turnstileError == "" {
			turnstileError = "turnstile_failed"
		}
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"ok":    false,
			"error": turnstileError,
		})
		return
	}

	mode, username, authErr := a.users.registerOrLogin(req.Username, req.Password)
	if authErr != nil {
		status := http.StatusBadRequest
		code := "auth_failed"

		switch authErr {
		case errInvalidUsername:
			code = "invalid_username"
		case errInvalidPassword:
			code = "invalid_password"
		case errInvalidCredentials:
			code = "invalid_credentials"
			status = http.StatusUnauthorized
		default:
			status = http.StatusInternalServerError
			code = "auth_internal_error"
			log.Printf("auth error: %v", authErr)
		}

		writeJSON(w, status, map[string]any{
			"ok":    false,
			"error": code,
		})
		return
	}

	sessionToken, tokenErr := a.sessions.create(username, authSessionTTL)
	if tokenErr != nil {
		log.Printf("session create error: %v", tokenErr)
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"ok":    false,
			"error": "session_failed",
		})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    sessionToken,
		MaxAge:   int(authSessionTTL.Seconds()),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"mode":     mode,
		"username": username,
	})
}

func (a *app) handleWebsocket(w http.ResponseWriter, r *http.Request) {
	username, ok := a.authorizedUsername(r)
	if !ok {
		http.Error(w, "login required", http.StatusUnauthorized)
		return
	}

	conn, err := a.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}
	defer conn.Close()

	if err := conn.WriteJSON(map[string]string{
		"type":     "welcome",
		"name":     a.readAppName(),
		"username": username,
		"message":  "WebSocket connected",
	}); err != nil {
		log.Printf("ws welcome write error: %v", err)
		return
	}

	for {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			break
		}

		if messageType != websocket.TextMessage {
			continue
		}

		if err := conn.WriteJSON(map[string]string{
			"type":     "echo",
			"name":     a.readAppName(),
			"username": username,
			"message":  string(payload),
		}); err != nil {
			break
		}
	}
}

func (a *app) authorizedUsername(r *http.Request) (string, bool) {
	cookie, err := r.Cookie(authCookieName)
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		return "", false
	}

	return a.sessions.username(strings.TrimSpace(cookie.Value))
}

func (a *app) verifyTurnstile(token, remoteAddr string) (bool, string, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return false, "turnstile_token_missing", nil
	}

	form := url.Values{}
	form.Set("secret", a.readTurnstileSecretKey())
	form.Set("response", token)

	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		form.Set("remoteip", host)
	}

	resp, err := a.turnstileChecker.PostForm(turnstileVerifyEndpoint, form)
	if err != nil {
		return false, "", err
	}
	defer resp.Body.Close()

	var parsed struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return false, "", err
	}

	if parsed.Success {
		return true, "", nil
	}

	if len(parsed.ErrorCodes) == 0 {
		return false, "turnstile_failed", nil
	}

	return false, strings.Join(parsed.ErrorCodes, ","), nil
}

func makePasswordHash(password string) (saltHex string, hashHex string, err error) {
	salt := make([]byte, passwordSaltSize)
	if _, err := rand.Read(salt); err != nil {
		return "", "", err
	}

	hash := hashWithSalt(salt, password)
	return hex.EncodeToString(salt), hash, nil
}

func verifyPassword(password, saltHex, hashHex string) bool {
	salt, err := hex.DecodeString(saltHex)
	if err != nil {
		return false
	}

	computed := hashWithSalt(salt, password)
	if len(computed) != len(hashHex) {
		return false
	}

	return subtle.ConstantTimeCompare([]byte(computed), []byte(hashHex)) == 1
}

func hashWithSalt(salt []byte, password string) string {
	combined := make([]byte, 0, len(salt)+len(password))
	combined = append(combined, salt...)
	combined = append(combined, password...)

	sum := sha256.Sum256(combined)
	return hex.EncodeToString(sum[:])
}

func (a *app) readAppName() string {
	value := a.readEnvValue("name", "NAME")
	if value == "" {
		return "CRYSTALXRAT"
	}
	return value
}

func (a *app) readTurnstileSiteKey() string {
	value := a.readEnvValue("site_key", "SITE_KEY", "TURNSTILE_SITE_KEY", "turnstile_site_key")
	if value == "" {
		return defaultTurnstileSiteKey
	}
	return value
}

func (a *app) readTurnstileSecretKey() string {
	value := a.readEnvValue("secret_key", "SECRET_KEY", "TURNSTILE_SECRET_KEY", "turnstile_secret_key")
	if value == "" {
		return defaultTurnstileSecretKey
	}
	return value
}

func (a *app) readEnvValue(keys ...string) string {
	dotEnvPath := filepath.Join(a.projectRoot, ".env")
	if fileData, err := os.ReadFile(dotEnvPath); err == nil {
		content := string(fileData)
		for _, key := range keys {
			if value, ok := envValue(content, key); ok && value != "" {
				return value
			}
		}
	}

	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}

	return ""
}

func hasCaptchaVerification(r *http.Request) bool {
	cookie, err := r.Cookie(captchaCookieName)
	return err == nil && cookie.Value == "1"
}

func decodeJSONBody(r *http.Request, dst any) error {
	limited := io.LimitReader(r.Body, maxJSONRequestBodyBytes)
	decoder := json.NewDecoder(limited)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}

func findProjectRoot() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	current := wd
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(current, "web", "templates", "index.html")
		if _, err := os.Stat(candidate); err == nil {
			return current, nil
		}

		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		current = parent
	}

	return "", fmt.Errorf("index template not found from %s", wd)
}

func randomToken(bytesCount int) (string, error) {
	b := make([]byte, bytesCount)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}

	return hex.EncodeToString(b), nil
}

func randomCode(length int) (string, error) {
	const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"

	var sb strings.Builder
	sb.Grow(length)

	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}

		sb.WriteByte(alphabet[n.Int64()])
	}

	return sb.String(), nil
}

func envValue(contents, key string) (string, bool) {
	lines := strings.Split(contents, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		}

		pair := strings.SplitN(line, "=", 2)
		if len(pair) != 2 {
			continue
		}

		if strings.TrimSpace(pair[0]) != key {
			continue
		}

		value := strings.TrimSpace(pair[1])
		value = strings.Trim(value, `"`)
		value = strings.Trim(value, `'`)
		return value, true
	}

	return "", false
}

func getEnvOrDefault(name, fallback string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	return value
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("json encode error: %v", err)
	}
}

func handleRootRedirect(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	http.Redirect(w, r, "/captcha/", http.StatusTemporaryRedirect)
}

func redirectWithSlash(target string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target, http.StatusTemporaryRedirect)
	}
}
