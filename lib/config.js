// Where the snippet library lives. The extension syncs the head/ and body/
// folders of this GitHub repo (public, fetched anonymously).
//
// To test snippets from a fork or branch before pushing to main, point these
// at it and reload the extension.
window.AMPLIFY_CONFIG = {
  repo: {
    owner: "TBB10",
    name: "amplify-advanced-toolkit",
    branch: "main",
  },
  // Folders inside the repo, keyed by injection target.
  paths: { head: "head", body: "body" },
  // Silent background re-sync when the library is older than this.
  autoSyncIntervalMs: 24 * 60 * 60 * 1000,
};
