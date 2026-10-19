# Extension feature requests

This folder is for things a snippet **can't** do and the extension would need
to learn. Anyone with push access can add a request; Thomas owns the extension
code and ships changes through the Chrome Web Store.

## How it works

1. You (or your AI assistant, following `AGENTS.md` Part C) write one
   Markdown file per capability: `requests/<kebab-case-title>.md`, using
   `_template.md`.
2. Decide whether the snippet is **waiting on** the capability:
   - **Essential** (snippet can't do its job without it): don't push the
     snippet. Put the full draft inside the request so Thomas designs against
     a real use case. Keep iterating on it in your Local Testing folder.
   - **Convenience** (snippet is fully useful today): push the clean snippet —
     with no references to the unshipped tool — and the request together.
3. Slack Thomas with the filename.
4. Thomas builds it as a general tool, releases a new version, and updates the
   request's `Status:` to `done` (with the version) or `declined` (with why).
   The shipped syntax may differ from what was proposed.
5. Once your extension has updated, build or revise the snippet against the
   real capability and push it.

Never push a snippet that references tooling that doesn't exist yet. It goes
live to everyone on their next Sync, and unknown metadata renders as a broken
control.

## What makes a good request

- **General, not one-off.** Describe a reusable param type, attribute, or
  popup behavior that any snippet could use. `detect-computed-color-for-params.md`
  is the model: one attribute that every color param can now use.
- **Grounded.** Say what you already built with existing tooling and exactly
  where it stops.
- **One capability per file.**
- **No extension code.** Describe behavior and the metadata syntax you'd like;
  Thomas handles the implementation.

Before writing one, check the "already provided" table in `AGENTS.md`
Part A — most needs are covered by an existing param type.
