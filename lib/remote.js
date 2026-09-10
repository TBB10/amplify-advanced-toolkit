// Snippet library sync against the GitHub repo in lib/config.js.
//
// The popup never hits the network just to open: it renders from the cached
// library in chrome.storage.local (loadCachedLibrary). syncLibrary() is the
// only thing that talks to GitHub — run by the Sync button and by a silent
// once-a-day auto-sync — and it only downloads files whose git sha changed.
//
// Cache shape (key CACHE_KEY):
//   { files: { "<target>/<filename>": { sha, raw } }, lastSynced: <ms> }
(function () {
  var CACHE_KEY = "libraryCache";
  var API = "https://api.github.com";
  var HEADERS = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  function cfg() {
    return window.AMPLIFY_CONFIG;
  }

  function repoPath() {
    var r = cfg().repo;
    return API + "/repos/" + r.owner + "/" + r.name + "/contents/";
  }

  function fileKey(target, filename) {
    return target + "/" + filename;
  }

  function b64ToUtf8(b64) {
    var clean = String(b64).replace(/\s+/g, "");
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function readCache() {
    if (!chrome.storage || !chrome.storage.local) return null;
    try {
      var data = await chrome.storage.local.get(CACHE_KEY);
      return data[CACHE_KEY] || null;
    } catch (e) {
      return null;
    }
  }

  async function writeCache(cache) {
    if (!chrome.storage || !chrome.storage.local) return;
    var obj = {};
    obj[CACHE_KEY] = cache;
    await chrome.storage.local.set(obj);
  }

  // Turn cached raw files into library entries, in a stable order.
  function entriesFromCache(cache) {
    var S = window.AmplifySnippets;
    var out = [];
    if (!cache || !cache.files) return out;
    var keys = Object.keys(cache.files).sort();
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var slash = key.indexOf("/");
      var target = key.slice(0, slash);
      var filename = key.slice(slash + 1);
      var parsed = S.parseSnippet(cache.files[key].raw);
      var id = S.slugify(filename);
      out.push({
        id: id,
        target: target,
        title: parsed.title || S.prettify(id),
        params: parsed.params,
        content: parsed.content,
        label: target + "/" + filename,
      });
    }
    return out;
  }

  // { entries, lastSynced } or null when nothing has ever been synced.
  async function loadCachedLibrary() {
    var cache = await readCache();
    if (!cache) return null;
    return { entries: entriesFromCache(cache), lastSynced: cache.lastSynced || null };
  }

  async function ghGet(url) {
    var r = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (r.status === 403 || r.status === 429) {
      var reset = r.headers.get("x-ratelimit-reset");
      var when = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : "later";
      throw new Error("GitHub rate limit reached \u2014 try again after " + when + ".");
    }
    if (r.status === 404) {
      throw new Error("Repo folder not found (" + url.replace(API, "") + ").");
    }
    if (!r.ok) throw new Error("GitHub returned HTTP " + r.status + ".");
    return r.json();
  }

  async function listDir(target) {
    var r = cfg().repo;
    var url = repoPath() + cfg().paths[target] + "?ref=" + encodeURIComponent(r.branch);
    var items = await ghGet(url);
    if (!Array.isArray(items)) return [];
    return items.filter(function (it) {
      return it.type === "file" && /\.html$/i.test(it.name);
    });
  }

  async function fetchFile(item) {
    // The contents endpoint returns fresh base64 (no CDN lag, unlike raw.*).
    var j = await ghGet(item.url);
    if (j.encoding !== "base64" || typeof j.content !== "string") {
      throw new Error("Unexpected response for " + item.path + ".");
    }
    return b64ToUtf8(j.content);
  }

  // Sync the library from GitHub. Resolves to
  //   { entries, lastSynced, added, updated, removed }
  // and rejects with a human-readable Error on failure (cache left untouched).
  async function syncLibrary() {
    var prev = (await readCache()) || { files: {} };
    var prevFiles = prev.files || {};
    var nextFiles = {};
    var added = 0;
    var updated = 0;

    var targets = Object.keys(cfg().paths);
    var listings = await Promise.all(targets.map(listDir));

    var toFetch = [];
    for (var t = 0; t < targets.length; t++) {
      var target = targets[t];
      var items = listings[t];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var key = fileKey(target, item.name);
        var old = prevFiles[key];
        if (old && old.sha === item.sha) {
          nextFiles[key] = old;
        } else {
          toFetch.push({ key: key, item: item, isNew: !old });
        }
      }
    }

    var contents = await Promise.all(
      toFetch.map(function (f) {
        return fetchFile(f.item);
      })
    );
    for (var k = 0; k < toFetch.length; k++) {
      nextFiles[toFetch[k].key] = { sha: toFetch[k].item.sha, raw: contents[k] };
      if (toFetch[k].isNew) added++;
      else updated++;
    }

    var removed = Object.keys(prevFiles).filter(function (key) {
      return !nextFiles[key];
    }).length;

    var cache = { files: nextFiles, lastSynced: Date.now() };
    await writeCache(cache);

    return {
      entries: entriesFromCache(cache),
      lastSynced: cache.lastSynced,
      added: added,
      updated: updated,
      removed: removed,
    };
  }

  window.AmplifyRemote = {
    loadCachedLibrary: loadCachedLibrary,
    syncLibrary: syncLibrary,
  };
})();
