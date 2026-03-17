#!/usr/bin/env python3
"""SPA-aware HTTP server for PROMIN Antenna Studio production build."""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
BASE = "/antenna-engine"


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Strip base path for file lookup
        path = self.path.split("?")[0]
        if path.startswith(BASE):
            file_path = path[len(BASE):]
        else:
            file_path = path

        # Check if file exists, otherwise serve index.html (SPA fallback)
        full_path = os.path.join(DIRECTORY, file_path.lstrip("/"))
        if os.path.isfile(full_path):
            # Rewrite path to serve from dist/
            self.path = file_path
        elif file_path.startswith("/assets/"):
            self.path = file_path
        else:
            self.path = "/index.html"

        return super().do_GET()

    def end_headers(self):
        # CORS for API proxying and cache headers
        self.send_header("Access-Control-Allow-Origin", "*")
        if self.path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()

    def log_message(self, format, *args):
        # Quieter logging
        if "200" not in str(args[1]) if len(args) > 1 else True:
            super().log_message(format, *args)


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), SPAHandler)
    print(f"PROMIN Antenna Studio serving at http://0.0.0.0:{PORT}{BASE}/")
    print(f"  Local:   http://localhost:{PORT}{BASE}/")
    try:
        import socket
        ip = socket.gethostbyname(socket.gethostname())
        print(f"  Network: http://{ip}:{PORT}{BASE}/")
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
