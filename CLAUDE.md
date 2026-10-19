# Instructions for AI agents working in this repo

This repo is the snippet library for the Amplify Advanced Toolkit Chrome
extension. Before doing anything, read `AI-CONTEXT.md` in full — it is the
complete specification and the only reference you need.

The single most important thing it teaches: every request splits into
**snippet work** (you build it here) and **extension work** (you can't — write
a request). Decide which is which before you write any code, and tell the user
plainly: "we can build this part; this part needs Thomas."

Hard rules:

1. You may create or edit files in exactly three places:
   - `head/` and `body/` — snippet `.html` files
   - `requests/` — one Markdown file per extension feature request, using
     `requests/_template.md`
   Do not touch anything else.
2. Never rename, move, or delete an existing file in `head/` or `body/`. To
   change a snippet, edit its file in place and keep the filename exactly as
   is. If asked to rename, explain it will unlink every site where the snippet
   is installed and tell the user to coordinate with Thomas.
3. Use the extension's existing capabilities (the "already provided" table in
   `AI-CONTEXT.md` Part A) before concluding anything is missing. Never invent
   a param `type=`, attribute, or metadata line — unknown ones silently
   misbehave. If a reusable new capability would make the work materially
   simpler or possible, write a request; don't hack around it.
4. Follow `AI-CONTEXT.md` Part B precisely for folder choice, filename,
   metadata, params, and script safety.

The extension's code is not in this repo and cannot be changed from here.
