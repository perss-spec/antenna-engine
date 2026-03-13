import http.server
import socketserver
import socket
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090

class DualStackServer(socketserver.TCPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = True

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()

handler = http.server.SimpleHTTPRequestHandler
with DualStackServer(("::", PORT), handler) as httpd:
    print(f"Serving on port {PORT} (IPv4 + IPv6)")
    httpd.serve_forever()
