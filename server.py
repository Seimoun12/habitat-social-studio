import http.cookies
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
def load_dotenv():
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() and not key.lstrip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_dotenv()
PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "127.0.0.1")
REDIRECT_URI = os.environ.get("META_REDIRECT_URI", f"http://127.0.0.1:{PORT}/oauth/meta/callback")
APP_ID = os.environ.get("META_APP_ID", "")
APP_SECRET = os.environ.get("META_APP_SECRET", "")
GRAPH_VERSION = os.environ.get("META_GRAPH_VERSION", "")
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
SCOPES = "pages_show_list,pages_read_engagement,pages_read_user_content,instagram_basic"
SESSIONS = {}
STATIC_FILES = {"/": ("index.html", "text/html; charset=utf-8"), "/index.html": ("index.html", "text/html; charset=utf-8"), "/app.js": ("app.js", "text/javascript; charset=utf-8"), "/styles.css": ("styles.css", "text/css; charset=utf-8")}


def refresh_config():
    global APP_ID, APP_SECRET, GRAPH_VERSION, REDIRECT_URI, COOKIE_SECURE
    APP_ID = os.environ.get("META_APP_ID", "")
    APP_SECRET = os.environ.get("META_APP_SECRET", "")
    GRAPH_VERSION = os.environ.get("META_GRAPH_VERSION", "")
    REDIRECT_URI = os.environ.get("META_REDIRECT_URI", f"http://127.0.0.1:{PORT}/oauth/meta/callback")
    COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"


def config_ready():
    return bool(APP_ID and APP_SECRET and GRAPH_VERSION)


def graph_get(path, params):
    query = urllib.parse.urlencode(params)
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{path}?{query}"
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "HabitatLocal/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError("meta_request_failed") from error
    if isinstance(result, dict) and result.get("error"):
        raise RuntimeError("meta_request_failed")
    return result


def public_connection(connection):
    if not connection:
        return {"connected": False, "facebook": None, "pages": [], "instagram": []}
    pages = connection.get("pages", [])
    return {
        "connected": True,
        "facebook": connection.get("facebook"),
        "pages": [{"id": page.get("id"), "name": page.get("name")} for page in pages],
        "instagram": [
            {"id": page["instagram"].get("id"), "username": page["instagram"].get("username"), "page": page.get("name")}
            for page in pages if page.get("instagram")
        ],
    }


class HabitatHandler(BaseHTTPRequestHandler):
    server_version = "HabitatLocal/1.0"

    def log_message(self, format_string, *args):
        safe_path = urllib.parse.urlsplit(self.path).path
        if safe_path == "/oauth/meta/callback":
            self.log_error("OAuth callback completed")
            return
        super().log_message(format_string, *args)

    def _session(self, create=True):
        cookie = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("habitat_session")
        session_id = morsel.value if morsel else None
        if session_id in SESSIONS:
            return session_id, SESSIONS[session_id], False
        if not create:
            return None, None, False
        session_id = secrets.token_urlsafe(32)
        session = {"oauth_state": None, "connection": None, "error": None}
        SESSIONS[session_id] = session
        return session_id, session, True

    def _set_session_cookie(self, session_id):
        secure = "; Secure" if COOKIE_SECURE else ""
        self.send_header("Set-Cookie", f"habitat_session={session_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000{secure}")

    def _json(self, payload, status=200, new_session=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if new_session:
            self._set_session_cookie(new_session)
        self.end_headers()
        self.wfile.write(body)

    def _redirect(self, location, new_session=None):
        self.send_response(303)
        self.send_header("Location", location)
        self.send_header("Cache-Control", "no-store")
        if new_session:
            self._set_session_cookie(new_session)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _same_origin(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        return urllib.parse.urlsplit(origin).netloc == self.headers.get("Host")

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/meta/connection":
            session_id, session, is_new = self._session()
            payload = public_connection(session["connection"])
            payload["errorCode"] = session.get("error")
            session["error"] = None
            self._json(payload, new_session=session_id if is_new else None)
            return
        if path == "/oauth/meta/start":
            if not config_ready():
                self._redirect("/?meta=not-configured")
                return
            session_id, session, is_new = self._session()
            state = secrets.token_urlsafe(32)
            session["oauth_state"] = state
            query = urllib.parse.urlencode({
                "client_id": APP_ID,
                "redirect_uri": REDIRECT_URI,
                "state": state,
                "response_type": "code",
                "scope": SCOPES,
            })
            self._redirect(f"https://www.facebook.com/{GRAPH_VERSION}/dialog/oauth?{query}", session_id if is_new else None)
            return
        if path == "/oauth/meta/callback":
            self._handle_callback()
            return
        static_file = STATIC_FILES.get(path)
        if static_file:
            self._serve_static(*static_file)
            return
        self.send_error(404)

    def do_POST(self):
        if urllib.parse.urlsplit(self.path).path != "/api/meta/disconnect":
            self.send_error(404)
            return
        if not self._same_origin():
            self._json({"error": "origin_not_allowed"}, status=403)
            return
        session_id, session, is_new = self._session()
        session["connection"] = None
        session["error"] = None
        self._json({"connected": False}, new_session=session_id if is_new else None)

    def _serve_static(self, filename, content_type):
        content = (BASE_DIR / filename).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def _handle_callback(self):
        session_id, session, is_new = self._session(create=False)
        params = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        state = params.get("state", [""])[0]
        expected_state = session.get("oauth_state") if session else None
        if not expected_state or not state or not secrets.compare_digest(state, expected_state):
            self._redirect("/?meta=state-error")
            return
        session["oauth_state"] = None
        if params.get("error"):
            session["error"] = "consent-denied"
            self._redirect("/?meta=denied")
            return
        code = params.get("code", [""])[0]
        if not code or not config_ready():
            session["error"] = "connection-failed"
            self._redirect("/?meta=failed")
            return
        try:
            short_lived = graph_get("oauth/access_token", {
                "client_id": APP_ID,
                "client_secret": APP_SECRET,
                "redirect_uri": REDIRECT_URI,
                "code": code,
            })
            long_lived = graph_get("oauth/access_token", {
                "grant_type": "fb_exchange_token",
                "client_id": APP_ID,
                "client_secret": APP_SECRET,
                "fb_exchange_token": short_lived["access_token"],
            })
            access_token = long_lived["access_token"]
            facebook = graph_get("me", {"fields": "id,name", "access_token": access_token})
            page_result = graph_get("me/accounts", {
                "fields": "id,name,access_token,instagram_business_account{id,username}",
                "access_token": access_token,
            })
            session["connection"] = {
                "facebook": {"id": facebook.get("id"), "name": facebook.get("name")},
                "pages": page_result.get("data", []),
                "access_token": access_token,
                "expires_in": long_lived.get("expires_in"),
            }
            session["error"] = None
            self._redirect("/?meta=connected")
        except (KeyError, RuntimeError, TypeError, urllib.error.URLError):
            session["error"] = "connection-failed"
            self._redirect("/?meta=failed")


def main():
    refresh_config()
    server = ThreadingHTTPServer((HOST, PORT), HabitatHandler)
    print(f"Habitat locale: http://localhost:{PORT}")
    if not config_ready():
        print("OAuth Meta inattivo: configura META_APP_ID, META_APP_SECRET e META_GRAPH_VERSION nel file .env.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()