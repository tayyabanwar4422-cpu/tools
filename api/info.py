from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import subprocess
import sys

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        url = (qs.get('query') or qs.get('url') or [None])[0]
        format_type = (qs.get('format') or [None])[0]

        if not url:
            self._json(400, {"error": '"query" parameter is required'})
            return

        try:
            # Use python3 -m yt_dlp instead of yt-dlp binary
            args = [sys.executable, '-m', 'yt_dlp', '-J', '--no-warnings', '--no-playlist']
            if format_type:
                args.extend(['-f', format_type])
            args.append(url)

            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=25
            )

            if result.returncode != 0:
                self._json(400, {"error": result.stderr or "yt-dlp failed"})
                return

            info = json.loads(result.stdout)
            self._json(200, info)

        except subprocess.TimeoutExpired:
            self._json(504, {"error": "Request timed out"})
        except Exception as e:
            self._json(500, {"error": str(e)})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
