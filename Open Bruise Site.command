#!/bin/bash
cd "$(dirname "$0")"
PORT=8773
open "http://127.0.0.1:${PORT}/bruiseme.html"
python3 -m http.server "$PORT"
