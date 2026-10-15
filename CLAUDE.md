# Instructions for AI agents working in this repo

This repo is a library of snippet files for a Chrome extension. Before doing
anything, read `AI-CONTEXT.md` — it is the complete specification for snippet
files and the only reference you need.

Hard rules:

1. Only create or edit `.html` files inside `head/` or `body/`. Do not touch
   anything else in this repo.
2. Never rename, move, or delete an existing file in `head/` or `body/`. To
   change a snippet, edit its file in place and keep the filename exactly as is.
   If the user asks for a rename, explain that it will unlink every site where
   the snippet is installed and tell them to coordinate with the extension
   owner (Thomas) first.
3. Follow `AI-CONTEXT.md` precisely for folder choice, filename, metadata
   lines, parameters, and script safety.

This repo does not contain the extension's code; it is maintained separately.
Requests to change how the extension itself behaves cannot be fulfilled here.
