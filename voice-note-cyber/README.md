# ECHO compatibility entry point

This directory now shares `public/`, `server/`, `scripts/`, and `tests/` with `../voice-note/` through relative symbolic links. There is one app implementation. The local `.env` and Git history are preserved.

Use `npm start` from the workspace root to launch ECHO at http://localhost:3000. If you have existing browser notes on port 3001, run `PORT=3001 npm start` here to access them with the new interface.

See `../README.md` and `../voice-note/README.md` for details.
