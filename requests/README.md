# Extension feature requests

This folder is for things a snippet **can't** do and the extension would need
to learn. Anyone with push access can add a request; Thomas owns the extension
code and ships changes through the Chrome Web Store.

## How it works

1. You (or your AI assistant, following `AI-CONTEXT.md` Part C) write one
   Markdown file per capability: `requests/<kebab-case-title>.md`, using
   `_template.md`.
2. Build whatever part of the ask *is* a snippet with existing tooling, and
   push both together.
3. Slack Thomas with the filename.
4. Thomas builds it into the extension, releases a new version, and updates the
   request's `Status:` to `done` (with the version) or `declined` (with why).
5. Once your extension has updated, revise the snippet to use the new
   capability.

## What makes a good request

- **General, not one-off.** Describe a reusable param type, attribute, or
  popup behavior that any snippet could use. `detect-computed-color-for-params.md`
  is the model: one attribute that every color param can now use.
- **Grounded.** Say what you already built with existing tooling and exactly
  where it stops.
- **One capability per file.**
- **No extension code.** Describe behavior and the metadata syntax you'd like;
  Thomas handles the implementation.

Before writing one, check the "already provided" table in `AI-CONTEXT.md`
Part A — most needs are covered by an existing param type.
