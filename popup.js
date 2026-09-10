"use strict";

const M = window.AmplifyMarkers;
const P = window.AmplifyParams;
const S = window.AmplifySnippets;

const els = {
  status: document.getElementById("status"),
  content: document.getElementById("content"),
  listHead: document.getElementById("list-head"),
  listBody: document.getElementById("list-body"),
  save: document.getElementById("save"),
  previewRow: document.getElementById("preview-row"),
  previewToggle: document.getElementById("preview-toggle"),
};

// Snippet library, discovered at runtime from the head/ and body/ folders.
// Entry: { id, target, title, params, content, label }
let LIBRARY = [];
// Live field values read from the site: { head: string, body: string }.
let fields = null;
let tabId = null;
// Per-snippet parameter values, keyed by `${target}:${id}` -> { paramName: value }.
const paramValues = {};
// Live preview state.
let previewOn = false;
let previewTimer = null;
// Pending-state persistence (survives popup close; reset by Save or a page
// refresh).
let persistTimer = null;
let siteKey = null;
let pageToken = null;
// Snippets whose controls the user collapsed (UI preference, remembered
// permanently and shared across sites).
let collapsedKeys = new Set();

async function loadCollapsed() {
  if (!chrome.storage || !chrome.storage.local) return;
  try {
    const { collapsedSnippets } = await chrome.storage.local.get("collapsedSnippets");
    if (Array.isArray(collapsedSnippets)) collapsedKeys = new Set(collapsedSnippets);
  } catch (e) {
    // ignore
  }
}

function saveCollapsed() {
  if (!chrome.storage || !chrome.storage.local) return;
  try {
    chrome.storage.local.set({ collapsedSnippets: Array.from(collapsedKeys) });
  } catch (e) {
    // ignore
  }
}

function setStatus(msg, kind) {
  els.status.textContent = msg;
  els.status.className = "status " + (kind || "info");
}

function pkey(target, id) {
  return target + ":" + id;
}

function params(entry) {
  return Array.isArray(entry.params) ? entry.params : [];
}

// ---------------------------------------------------------------------------
// Functions injected INTO the page. They talk to the site's GraphQL API on the
// page's own origin (so the session cookie + CSRF token apply), which means we
// never open the Advanced settings UI and always read the authoritative stored
// value instead of a half-hydrated textarea. Must be fully self-contained: only
// their source is serialized, so no references to anything in this file.
// ---------------------------------------------------------------------------

function pageReadFields() {
  return (async function () {
    try {
      const meta = document.querySelector("meta[name=csrf-token]");
      const csrf = meta ? meta.getAttribute("content") : null;
      const headers = Object.assign(
        { "Content-Type": "application/json" },
        csrf ? { "X-CSRF-Token": csrf } : {}
      );
      const query =
        "query($h:String!,$b:String!){ head: variable(name:$h){ value } body: variable(name:$b){ value } }";
      const r = await fetch("/api/graphql", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({
          query,
          variables: { h: "html_head_end", b: "html_body_end" },
        }),
      });
      if (!r.ok) {
        return {
          ok: false,
          reason:
            "Couldn't read settings (HTTP " +
            r.status +
            "). Make sure you're logged in to Streamline.",
        };
      }
      const j = await r.json();
      if (j.errors && j.errors.length) {
        return { ok: false, reason: "Read error: " + j.errors[0].message };
      }
      const head = j.data && j.data.head ? j.data.head.value : "";
      const body = j.data && j.data.body ? j.data.body.value : "";
      return {
        ok: true,
        head: head == null ? "" : String(head),
        body: body == null ? "" : String(body),
        // Identifies this specific page load; pending tweaks are tied to it so
        // refreshing the page acts as a "start over".
        pageToken: performance.timeOrigin,
      };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  })();
}

function pageApplyFields(newHead, newBody) {
  return (async function () {
    try {
      const meta = document.querySelector("meta[name=csrf-token]");
      const csrf = meta ? meta.getAttribute("content") : null;
      const headers = Object.assign(
        { "Content-Type": "application/json" },
        csrf ? { "X-CSRF-Token": csrf } : {}
      );
      const mutation =
        'mutation($htmlHeadEnd: JSON!, $htmlBodyEnd: JSON!){ setHtmlHeadEndVariable: setVariable(input:{name:"html_head_end", value:$htmlHeadEnd}){ variable { value } } setHtmlBodyEndVariable: setVariable(input:{name:"html_body_end", value:$htmlBodyEnd}){ variable { value } } }';
      const r = await fetch("/api/graphql", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({
          query: mutation,
          variables: { htmlHeadEnd: newHead, htmlBodyEnd: newBody },
        }),
      });
      if (!r.ok) {
        return { ok: false, reason: "Save failed (HTTP " + r.status + ")." };
      }
      const j = await r.json();
      if (j.errors && j.errors.length) {
        return { ok: false, reason: "Save error: " + j.errors[0].message };
      }
      const h =
        j.data && j.data.setHtmlHeadEndVariable
          ? j.data.setHtmlHeadEndVariable.variable.value
          : newHead;
      const b =
        j.data && j.data.setHtmlBodyEndVariable
          ? j.data.setHtmlBodyEndVariable.variable.value
          : newBody;
      return {
        ok: true,
        saved: true,
        head: h == null ? "" : String(h),
        body: b == null ? "" : String(b),
      };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  })();
}

// Live preview: inject the pending selection into the CURRENT page so changes
// are visible immediately, without saving. Injected nodes are tagged so we can
// swap/remove them. Reloading the page clears everything and shows the real
// saved state. Note: this can only ADD effects on top of what's already on the
// page — CSS previews revert when cleared, but DOM created by a snippet's
// <script> only disappears on a page refresh.
function pagePreviewApply(headHtml, bodyHtml) {
  return (function () {
    try {
      const FLAG = "data-amplify-preview";

      function makeExecutable(node) {
        if (node.nodeType === 1 && node.tagName === "SCRIPT") {
          const s = document.createElement("script");
          for (const a of node.attributes) s.setAttribute(a.name, a.value);
          s.textContent = node.textContent;
          return s;
        }
        const clone = node.cloneNode(false);
        if (node.nodeType === 1) {
          for (const child of Array.from(node.childNodes)) {
            clone.appendChild(makeExecutable(child));
          }
        }
        return clone;
      }

      function injectInto(container, html) {
        let styles = 0;
        let scripts = 0;
        if (!container || !html) return { styles, scripts };
        const tpl = document.createElement("template");
        tpl.innerHTML = html;
        for (const node of Array.from(tpl.content.childNodes)) {
          if (node.nodeType === 3 && !node.textContent.trim()) continue;
          const exec = makeExecutable(node);
          if (exec.nodeType === 1) {
            exec.setAttribute(FLAG, "1");
            if (exec.tagName === "STYLE") styles++;
            if (exec.tagName === "SCRIPT") scripts++;
          }
          container.appendChild(exec);
        }
        return { styles, scripts };
      }

      const prev = document.querySelectorAll("[" + FLAG + "]");
      prev.forEach((n) => n.remove());

      const h = injectInto(document.head, headHtml);
      const b = injectInto(document.body, bodyHtml);
      window.__amplifyPreviewOn = !!(headHtml || bodyHtml);
      return {
        ok: true,
        styles: h.styles + b.styles,
        scripts: h.scripts + b.scripts,
      };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  })();
}

function pagePreviewClear() {
  return (function () {
    try {
      document.querySelectorAll("[data-amplify-preview]").forEach((n) => n.remove());
      window.__amplifyPreviewOn = false;
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  })();
}

// ---------------------------------------------------------------------------
// Library discovery: enumerate head/ and body/ inside the extension package at
// runtime, so dropping a .html file in either folder is all it takes.
// ---------------------------------------------------------------------------

function getPackageDir() {
  return new Promise((resolve) => {
    if (!chrome.runtime.getPackageDirectoryEntry) {
      resolve(null);
      return;
    }
    try {
      chrome.runtime.getPackageDirectoryEntry(resolve);
    } catch (e) {
      resolve(null);
    }
  });
}

function getSubdir(root, name) {
  return new Promise((resolve) => {
    root.getDirectory(name, {}, resolve, () => resolve(null));
  });
}

function readDirEntries(dirEntry) {
  return new Promise((resolve) => {
    const reader = dirEntry.createReader();
    const all = [];
    (function readMore() {
      reader.readEntries(
        (entries) => {
          if (!entries.length) {
            resolve(all);
            return;
          }
          all.push(...entries);
          readMore();
        },
        () => resolve(all)
      );
    })();
  });
}

function readFileEntry(fileEntry) {
  return new Promise((resolve) => {
    fileEntry.file(
      (file) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => resolve(null);
        r.readAsText(file);
      },
      () => resolve(null)
    );
  });
}

async function discoverFolderSnippets() {
  const out = [];
  const root = await getPackageDir();
  if (!root) return { entries: out, unavailable: true };

  for (const target of ["head", "body"]) {
    const dir = await getSubdir(root, target);
    if (!dir) continue;
    const entries = await readDirEntries(dir);
    const files = entries
      .filter((e) => e.isFile && /\.html$/i.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const f of files) {
      const raw = await readFileEntry(f);
      if (raw == null) continue;
      const parsed = S.parseSnippet(raw);
      const id = S.slugify(f.name);
      out.push({
        id,
        target,
        title: parsed.title || S.prettify(id),
        params: parsed.params,
        content: parsed.content,
        label: target + "/" + f.name,
      });
    }
  }
  return { entries: out, unavailable: false };
}

async function loadLibrary() {
  const folder = await discoverFolderSnippets();
  const merged = [];
  const seen = new Set();
  for (const entry of folder.entries) {
    let id = entry.id;
    let n = 2;
    while (seen.has(pkey(entry.target, id))) {
      id = entry.id + "-" + n++;
    }
    seen.add(pkey(entry.target, id));
    merged.push(Object.assign({}, entry, { id }));
  }
  LIBRARY = merged;
  return folder.unavailable;
}

// ---------------------------------------------------------------------------
// Popup-side orchestration
// ---------------------------------------------------------------------------

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isSupported(url) {
  try {
    return new URL(url).hostname.endsWith("specialdistrict.org");
  } catch (e) {
    return false;
  }
}

async function runInPage(func, args) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args: args || [],
  });
  return res && res.result;
}

// Preview must reach the frame that actually renders the public site. On the
// admin view the site is inside an iframe (#amplify-frame), while the
// standalone public page has it in the top frame — so we inject into every
// same-origin frame and let the snippet's own selectors match where they can.
//
// world: "MAIN" is essential: a snippet's <script> only executes if it runs in
// the page's own JS context. A content-script (isolated world) inserting an
// inline <script> does NOT reliably execute it, which is why CSS-only snippets
// previewed fine but script-driven ones (the carousel wave) did nothing.
async function runInAllFrames(func, args) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func,
      args: args || [],
    });
    return results.map((r) => r && r.result).filter(Boolean);
  } catch (e) {
    return [{ ok: false, reason: String(e) }];
  }
}

// The default value for a param, normalized to the string that gets
// substituted into the snippet. Multiselect defaults are given as a
// "|"-separated list of option values and joined into a selector list.
function defaultValue(p) {
  if (p.type === "multiselect") {
    const sep = p.separator !== undefined ? p.separator : ", ";
    return String(p.default || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(sep);
  }
  return p.default;
}

// Seed paramValues from the currently-installed snippet (so a recolored wave
// shows its actual color), falling back to declared defaults.
function initParamValues() {
  for (const entry of LIBRARY) {
    const ps = params(entry);
    if (!ps.length) continue;
    const key = pkey(entry.target, entry.id);
    const block = M.getBlock(fields[entry.target], entry.target, entry.id);
    const extracted = block ? P.extractParams(block, entry.content) : {};
    const vals = {};
    for (const p of ps) {
      const v = extracted[p.name];
      vals[p.name] = v != null && v !== "" ? v : defaultValue(p);
    }
    paramValues[key] = vals;
  }
}

function isHex6(v) {
  return /^#[0-9a-fA-F]{6}$/.test(String(v || "").trim());
}

// A comma-separated value string -> Set of trimmed segments, so a multiselect
// option ("h1, h2, h3") is "selected" when all its segments are present.
function segmentSet(str) {
  return new Set(
    String(str || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function optionIsSelected(value, selectedSegs) {
  const segs = String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return segs.length > 0 && segs.every((s) => selectedSegs.has(s));
}

// ---- Font map (the "fontmap" param type) --------------------------------
// A fontmap lets the user assign a Google Font per text-type target (plus an
// "Apply to all" fallback). Its stored value is the *generated* snippet block:
// the <link> imports + CSS, prefixed with a machine-readable JSON comment so
// the picker state can be restored when the snippet is already installed.

// Each fontmap entry is { font, weight }. Older installs stored a bare font
// string, so coerce for backward compatibility.
function coerceFontEntry(v) {
  if (v == null) return { font: "", weight: "" };
  if (typeof v === "string") return { font: v, weight: "" };
  return { font: v.font || "", weight: v.weight || "" };
}

function parseFontmap(value) {
  const m = /<!--\s*amplify-fontmap:([\s\S]*?)-->/.exec(String(value || ""));
  if (m) {
    try {
      const s = JSON.parse(m[1].trim());
      const map = {};
      if (s.map) for (const k of Object.keys(s.map)) map[k] = coerceFontEntry(s.map[k]);
      return { all: coerceFontEntry(s.all), map };
    } catch (e) {
      /* fall through */
    }
  }
  return { all: { font: "", weight: "" }, map: {} };
}

function fontFamilyToHref(family) {
  return family.trim().replace(/\s+/g, "+");
}

function normWeight(w) {
  const s = String(w || "").trim();
  return /^[1-9]00$/.test(s) ? s : "";
}

// Build the head block (imports + CSS) from the current picker state. A target
// can set a font, a weight, or both; a per-target choice overrides "apply to
// all"; a weight applies even with no font (styling the theme's own font).
// options: [{label, value}] where value is the CSS selector(s) for that target.
function generateFontmap(options, state) {
  const comment = "<!-- amplify-fontmap:" + JSON.stringify(state) + " -->";

  const rules = []; // { selector, font, weight }
  const familyWeights = new Map(); // font -> Set(weights)
  for (const t of options) {
    const m = state.map[t.value] || {};
    const font =
      (m.font && m.font.trim()) || (state.all.font && state.all.font.trim()) || "";
    const weight = normWeight(m.weight) || normWeight(state.all.weight) || "";
    if (!font && !weight) continue;
    rules.push({ selector: t.value, font, weight });
    if (font) {
      if (!familyWeights.has(font)) familyWeights.set(font, new Set());
      if (weight) familyWeights.get(font).add(weight);
    }
  }

  if (!rules.length) return "";

  // One <link> import covering each used family, requesting its weights plus a
  // 400/700 baseline so regular + bold are always available.
  let links = "";
  if (familyWeights.size) {
    const families = [];
    for (const [font, weights] of familyWeights) {
      const ws = new Set(weights);
      ws.add("400");
      ws.add("700");
      const sorted = Array.from(ws).sort((a, b) => Number(a) - Number(b));
      families.push("family=" + fontFamilyToHref(font) + ":wght@" + sorted.join(";"));
    }
    links =
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link href="https://fonts.googleapis.com/css2?' +
      families.join("&") +
      '&display=swap" rel="stylesheet">';
  }

  // Group targets that share the same font+weight into one rule.
  const groups = new Map();
  for (const r of rules) {
    const gk = r.font + "|" + r.weight;
    if (!groups.has(gk)) groups.set(gk, { font: r.font, weight: r.weight, selectors: [] });
    groups.get(gk).selectors.push(r.selector);
  }

  let css = "<style>\n";
  for (const g of groups.values()) {
    css += g.selectors.join(",\n") + " {\n";
    if (g.font) css += '  font-family: "' + g.font + '", sans-serif !important;\n';
    if (g.weight) css += "  font-weight: " + g.weight + " !important;\n";
    css += "}\n";
  }
  css += "</style>";

  return comment + "\n" + (links ? links + "\n" : "") + css;
}

const FONT_WEIGHTS = [
  ["", "Weight"],
  ["100", "100 Thin"],
  ["200", "200 Extra Light"],
  ["300", "300 Light"],
  ["400", "400 Regular"],
  ["500", "500 Medium"],
  ["600", "600 Semibold"],
  ["700", "700 Bold"],
  ["800", "800 Extra Bold"],
  ["900", "900 Black"],
];

function buildFontmapControl(key, p) {
  const container = document.createElement("div");
  container.className = "fontmap";

  const listId = "amplify-fonts-" + p.name;
  const datalist = document.createElement("datalist");
  datalist.id = listId;
  for (const f of window.AMPLIFY_GOOGLE_FONTS || []) {
    const o = document.createElement("option");
    o.value = f;
    datalist.appendChild(o);
  }
  container.appendChild(datalist);

  const options = p.options || [];
  const state = parseFontmap(paramValues[key][p.name]);

  const recompute = () => {
    paramValues[key][p.name] = generateFontmap(options, state);
  };

  // acc: { getFont, setFont, getWeight, setWeight } over a state entry.
  const makeRow = (labelText, acc, placeholder, cls) => {
    const row = document.createElement("div");
    row.className = "param-row fontmap-row" + (cls ? " " + cls : "");

    const label = document.createElement("label");
    label.textContent = labelText;
    row.appendChild(label);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "text";
    input.setAttribute("list", listId);
    input.value = acc.getFont() || "";
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener("input", () => {
      acc.setFont(input.value.trim());
      recompute();
    });
    row.appendChild(input);

    const weight = document.createElement("select");
    weight.className = "weight";
    for (const [val, text] of FONT_WEIGHTS) {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = text;
      if (val === acc.getWeight()) o.selected = true;
      weight.appendChild(o);
    }
    weight.addEventListener("change", () => {
      acc.setWeight(weight.value);
      recompute();
    });
    row.appendChild(weight);

    return row;
  };

  const allAcc = {
    getFont: () => state.all.font,
    setFont: (v) => {
      state.all.font = v;
    },
    getWeight: () => state.all.weight,
    setWeight: (v) => {
      state.all.weight = v;
    },
  };

  const targetAcc = (sel) => {
    const ensure = () => {
      if (!state.map[sel]) state.map[sel] = { font: "", weight: "" };
      return state.map[sel];
    };
    const cleanup = () => {
      const e = state.map[sel];
      if (e && !e.font && !e.weight) delete state.map[sel];
    };
    return {
      getFont: () => (state.map[sel] && state.map[sel].font) || "",
      setFont: (v) => {
        ensure().font = v;
        cleanup();
      },
      getWeight: () => (state.map[sel] && state.map[sel].weight) || "",
      setWeight: (v) => {
        ensure().weight = v;
        cleanup();
      },
    };
  };

  container.appendChild(
    makeRow("Apply to all", allAcc, "Search Google Fonts\u2026", "fontmap-all")
  );
  for (const t of options) {
    container.appendChild(makeRow(t.label, targetAcc(t.value), "(uses Apply to all)"));
  }

  return container;
}

function buildParamRow(key, p) {
  const row = document.createElement("div");
  row.className = "param-row";

  const label = document.createElement("label");
  label.textContent = p.label || p.name;
  row.appendChild(label);

  const current = paramValues[key][p.name];
  const set = (v) => {
    paramValues[key][p.name] = v;
  };

  if (p.type === "select") {
    const select = document.createElement("select");
    for (const opt of p.options || []) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === current) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", () => set(select.value));
    row.appendChild(select);
  } else if (p.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "num";
    if (p.min !== undefined) input.min = p.min;
    if (p.max !== undefined) input.max = p.max;
    if (p.step !== undefined) input.step = p.step;
    input.value = current;
    input.addEventListener("input", () => set(input.value));
    row.appendChild(input);
    if (p.unit) {
      const u = document.createElement("span");
      u.className = "unit";
      u.textContent = p.unit;
      row.appendChild(u);
    }
  } else if (p.type === "range") {
    const input = document.createElement("input");
    input.type = "range";
    if (p.min !== undefined) input.min = p.min;
    if (p.max !== undefined) input.max = p.max;
    if (p.step !== undefined) input.step = p.step;
    input.value = current;
    const out = document.createElement("span");
    out.className = "range-val";
    out.textContent = current + (p.unit || "");
    input.addEventListener("input", () => {
      set(input.value);
      out.textContent = input.value + (p.unit || "");
    });
    row.appendChild(input);
    row.appendChild(out);
  } else if (p.type === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "text";
    input.value = current || "";
    if (p.placeholder) input.placeholder = p.placeholder;
    input.addEventListener("input", () => set(input.value));
    row.appendChild(input);
  } else if (p.type === "textarea") {
    row.classList.add("stacked");
    const ta = document.createElement("textarea");
    ta.rows = p.rows ? Number(p.rows) : 3;
    ta.value = current || "";
    if (p.placeholder) ta.placeholder = p.placeholder;
    ta.addEventListener("input", () => set(ta.value));
    row.appendChild(ta);
  } else if (p.type === "multiselect") {
    row.classList.add("stacked");
    const sep = p.separator !== undefined ? p.separator : ", ";
    const box = document.createElement("div");
    box.className = "multiselect";
    const selectedSegs = segmentSet(current);
    const opts = p.options || [];
    const boxes = [];
    opts.forEach((opt) => {
      const optLabel = document.createElement("label");
      optLabel.className = "ms-opt";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = optionIsSelected(opt.value, selectedSegs);
      const span = document.createElement("span");
      span.textContent = opt.label;
      optLabel.appendChild(cb);
      optLabel.appendChild(span);
      cb.addEventListener("change", () => {
        const chosen = opts.filter((_, i) => boxes[i].checked).map((o) => o.value);
        set(chosen.join(sep));
      });
      box.appendChild(optLabel);
      boxes.push(cb);
    });
    row.appendChild(box);
  } else {
    // color (default): swatch picker + exact hex text, kept in sync.
    const swatch = document.createElement("input");
    swatch.type = "color";
    if (isHex6(current)) swatch.value = current;

    const hex = document.createElement("input");
    hex.type = "text";
    hex.className = "hex";
    hex.value = current || "";
    hex.placeholder = "#1978BE";

    swatch.addEventListener("input", () => {
      hex.value = swatch.value;
      set(swatch.value);
    });
    hex.addEventListener("input", () => {
      set(hex.value.trim());
      if (isHex6(hex.value)) swatch.value = hex.value.trim();
    });

    row.appendChild(swatch);
    row.appendChild(hex);
  }

  return row;
}

function buildParamControls(entry) {
  const key = pkey(entry.target, entry.id);
  const wrap = document.createElement("div");
  wrap.className = "params";
  for (const p of params(entry)) {
    wrap.appendChild(
      p.type === "fontmap" ? buildFontmapControl(key, p) : buildParamRow(key, p)
    );
  }
  return wrap;
}

function makeRow({ target, id, title, subtitle, checked, badgeText, badgeClass }) {
  const li = document.createElement("li");

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.id = `cb-${target}-${id}`;
  cb.checked = checked;
  cb.dataset.id = id;
  cb.dataset.target = target;

  const label = document.createElement("label");
  label.htmlFor = cb.id;
  label.innerHTML = `${escapeHtml(title)}<span class="filename">${escapeHtml(
    subtitle
  )}</span>`;

  const actions = document.createElement("span");
  actions.className = "row-actions";

  if (badgeText) {
    const badge = document.createElement("span");
    badge.className = "badge" + (badgeClass ? " " + badgeClass : "");
    badge.textContent = badgeText;
    actions.appendChild(badge);
  }

  li.appendChild(cb);
  li.appendChild(label);
  li.appendChild(actions);

  return { li, cb, label, actions };
}

function renderList(ulEl, target) {
  const entries = LIBRARY.filter((e) => e.target === target);
  ulEl.innerHTML = "";

  const installed = M.installedIds(fields[target], target);
  const knownIds = new Set(entries.map((e) => e.id));
  const unknownInstalled = installed.filter((id) => !knownIds.has(id));

  if (!entries.length && !unknownInstalled.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = `No ${target} snippets yet. Drop .html files into the ${target}/ folder and reopen this popup.`;
    ulEl.appendChild(li);
    return;
  }

  for (const entry of entries) {
    const checked = installed.includes(entry.id);
    const { li, cb, label, actions } = makeRow({
      target,
      id: entry.id,
      title: entry.title,
      subtitle: entry.label,
      checked,
      badgeText: checked ? "installed" : null,
    });

    if (params(entry).length) {
      const key = pkey(target, entry.id);
      const controls = buildParamControls(entry);
      li.appendChild(controls);

      // Chevron collapses the controls without disabling the snippet itself.
      const chevron = document.createElement("button");
      chevron.type = "button";
      chevron.className = "chevron";
      chevron.title = "Show/hide settings";
      actions.appendChild(chevron);

      const syncControls = () => {
        const collapsed = collapsedKeys.has(key);
        controls.hidden = !cb.checked || collapsed;
        chevron.hidden = !cb.checked;
        chevron.textContent = collapsed ? "\u25B8" : "\u25BE";
      };

      const toggleCollapsed = () => {
        if (collapsedKeys.has(key)) {
          collapsedKeys.delete(key);
        } else {
          collapsedKeys.add(key);
        }
        saveCollapsed();
        syncControls();
      };

      chevron.addEventListener("click", toggleCollapsed);

      // For snippets with settings, the row header drives the accordion, not
      // the checkbox: clicking it open auto-enables the snippet; clicking it
      // closed just collapses, leaving enablement untouched. The checkbox
      // itself remains the only enable/disable toggle.
      label.removeAttribute("for");
      label.addEventListener("click", () => {
        const isOpen = cb.checked && !collapsedKeys.has(key);
        if (isOpen) {
          collapsedKeys.add(key);
          saveCollapsed();
          syncControls();
          return;
        }
        collapsedKeys.delete(key);
        saveCollapsed();
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          syncControls();
        }
      });

      cb.addEventListener("change", syncControls);
      syncControls();
    }

    ulEl.appendChild(li);
  }

  // Snippets installed on the site whose id we don't have in the library
  // (deleted file, another staff member's snippet, etc). Keeping them checked
  // preserves them byte-for-byte on save; unchecking removes them.
  for (const id of unknownInstalled) {
    const { li, cb } = makeRow({
      target,
      id,
      title: S.prettify(id),
      subtitle: "installed on site, not in your library",
      checked: true,
      badgeText: "not in library",
      badgeClass: "unknown",
    });
    cb.dataset.unknown = "1";
    ulEl.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function render() {
  renderList(els.listHead, "head");
  renderList(els.listBody, "body");
  els.content.hidden = false;
  els.previewRow.hidden = false;
  els.save.disabled = false;
}

// Rendered content of the checked *library* snippets for a target, joined for
// injection. Unknown/coworker snippets are skipped — they're already on the
// page from the saved state, so re-injecting them would double up.
function previewContentFor(target) {
  const boxes = Array.from(
    document.querySelectorAll(`input[type="checkbox"][data-target="${target}"]`)
  );
  const parts = [];
  for (const b of boxes) {
    if (!b.checked || b.dataset.unknown === "1") continue;
    const entry = LIBRARY.find((e) => e.target === target && e.id === b.dataset.id);
    if (!entry) continue;
    parts.push(
      params(entry).length
        ? P.applyParams(entry.content, paramValues[pkey(target, entry.id)])
        : entry.content
    );
  }
  return parts.join("\n\n");
}

async function applyPreview() {
  if (!tabId) return null;
  const headHtml = previewContentFor("head");
  const bodyHtml = previewContentFor("body");
  const results = await runInAllFrames(pagePreviewApply, [headHtml, bodyHtml]);
  // Succeed if any frame accepted the injection; surface an error otherwise.
  const ok = results.find((r) => r && r.ok);
  return ok || results[0] || { ok: false, reason: "No frames responded." };
}

// How many checked library snippets are *already* installed on the site. Those
// are already rendered on the page, so previewing them shows no visible delta —
// we call that out so a re-toggle never looks like a silent no-op.
function checkedCounts() {
  let checked = 0;
  let alreadyInstalled = 0;
  for (const target of ["head", "body"]) {
    const installed = new Set(M.installedIds(fields[target], target));
    const boxes = document.querySelectorAll(
      `input[type="checkbox"][data-target="${target}"]`
    );
    for (const b of boxes) {
      if (!b.checked || b.dataset.unknown === "1") continue;
      checked++;
      if (installed.has(b.dataset.id)) alreadyInstalled++;
    }
  }
  return { checked, alreadyInstalled };
}

async function refreshPreview() {
  const res = await applyPreview();
  if (!res || !res.ok) {
    if (res && res.reason) setStatus("Live preview error: " + res.reason, "err");
    return;
  }
  const { checked, alreadyInstalled } = checkedCounts();
  if (!checked) {
    setStatus("Live preview on. Check a snippet to preview it on the page.", "info");
  } else if (checked === alreadyInstalled) {
    setStatus(
      "Live preview on. These snippets are already saved (already visible) \u2014 adjust a value, e.g. a color, to see it change live.",
      "info"
    );
  } else {
    setStatus("Live preview on \u2014 showing pending changes (not saved yet).", "info");
  }
}

function schedulePreview() {
  if (!previewOn) return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 60);
}

async function onPreviewToggle() {
  previewOn = els.previewToggle.checked;
  if (previewOn) {
    await refreshPreview();
  } else {
    await runInAllFrames(pagePreviewClear);
    setStatus(
      "Live preview off. Reload the page if a snippet's script left something behind.",
      "info"
    );
  }
  schedulePersist();
}

// ---------------------------------------------------------------------------
// Pending-state persistence. Anything applied only via live preview (checkbox
// toggles, adjusted values, the preview switch) is stored per-site for the
// browser session, so closing and reopening the popup picks up right where you
// left off. Save makes the pending state real (and clears it); refreshing the
// page discards it (the stored state is tied to the page load via pageToken).
// ---------------------------------------------------------------------------

function pendingStore() {
  if (!chrome.storage) return null;
  return chrome.storage.session || chrome.storage.local || null;
}

async function loadPending() {
  const store = pendingStore();
  if (!store || !siteKey) return null;
  try {
    const data = await store.get(siteKey);
    const pending = data[siteKey] || null;
    // Tied to a specific page load: if the page was refreshed since these
    // tweaks were made, the user chose to start over — discard them.
    if (pending && pending.pageToken !== pageToken) {
      await clearPending();
      return null;
    }
    return pending;
  } catch (e) {
    return null;
  }
}

async function persistPending() {
  const store = pendingStore();
  if (!store || !siteKey) return;
  const checks = {};
  for (const b of document.querySelectorAll('input[type="checkbox"][data-target]')) {
    checks[pkey(b.dataset.target, b.dataset.id)] = b.checked;
  }
  try {
    await store.set({
      [siteKey]: { checks, params: paramValues, previewOn, pageToken },
    });
  } catch (e) {
    // Non-fatal: worst case the pending state doesn't survive a popup close.
  }
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistPending, 150);
}

async function clearPending() {
  const store = pendingStore();
  if (!store || !siteKey) return;
  try {
    await store.remove(siteKey);
  } catch (e) {
    // ignore
  }
}

// Reapply stored checkbox states after render. Param values are merged into
// paramValues before render, so controls already show the restored values.
function applyPendingChecks(pending) {
  let changed = 0;
  for (const key of Object.keys(pending.checks || {})) {
    const idx = key.indexOf(":");
    if (idx === -1) continue;
    const target = key.slice(0, idx);
    const id = key.slice(idx + 1);
    const cb = document.getElementById(`cb-${target}-${id}`);
    if (cb && cb.checked !== pending.checks[key]) {
      cb.checked = pending.checks[key];
      cb.dispatchEvent(new Event("change", { bubbles: true }));
      changed++;
    }
  }
  return changed;
}

function collectSelections(target) {
  const boxes = Array.from(
    document.querySelectorAll(`input[type="checkbox"][data-target="${target}"]`)
  );
  const selections = [];
  for (const b of boxes) {
    if (!b.checked) continue;
    if (b.dataset.unknown === "1") {
      // Preserve unknown snippets exactly as they are on the site.
      const block = M.getBlock(fields[target], target, b.dataset.id);
      if (block != null) selections.push({ id: b.dataset.id, content: block });
      continue;
    }
    const entry = LIBRARY.find((e) => e.target === target && e.id === b.dataset.id);
    if (!entry) continue;
    const content = params(entry).length
      ? P.applyParams(entry.content, paramValues[pkey(target, entry.id)])
      : entry.content;
    selections.push({ id: entry.id, content });
  }
  return selections;
}

async function loadFields() {
  setStatus("Reading current settings\u2026", "info");
  const res = await runInPage(pageReadFields);
  if (!res || !res.ok) {
    setStatus((res && res.reason) || "Failed to read the page.", "err");
    els.content.hidden = true;
    els.save.disabled = true;
    return false;
  }
  fields = { head: res.head, body: res.body };
  pageToken = res.pageToken != null ? res.pageToken : null;
  initParamValues();
  return true;
}

async function init() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    setStatus("No active tab.", "err");
    return;
  }
  tabId = tab.id;

  if (!isSupported(tab.url || "")) {
    setStatus(
      "Open your Streamline site (a *.specialdistrict.org tab) and reopen this popup.",
      "warn"
    );
    return;
  }
  siteKey = "pending:" + new URL(tab.url).hostname;

  await loadCollapsed();
  const discoveryUnavailable = await loadLibrary();
  const ok = await loadFields();
  if (!ok) return;

  // Restore unsaved tweaks from a previous popup session: merge stored param
  // values before render (so controls show them), then reapply checkbox state.
  const pending = await loadPending();
  if (pending && pending.params) {
    for (const k of Object.keys(pending.params)) {
      paramValues[k] = Object.assign({}, paramValues[k] || {}, pending.params[k]);
    }
  }

  render();

  let restored = 0;
  if (pending) {
    restored = applyPendingChecks(pending);
  }

  if (discoveryUnavailable) {
    setStatus("Folder discovery unavailable \u2014 load the extension unpacked.", "warn");
    return;
  }

  // Live preview is on by default (or whatever it was last session).
  previewOn = pending && typeof pending.previewOn === "boolean" ? pending.previewOn : true;
  els.previewToggle.checked = previewOn;
  if (previewOn) {
    await refreshPreview();
  }
  if (pending) {
    setStatus(
      "Restored your unsaved tweaks" +
        (restored ? ` (${restored} toggle${restored === 1 ? "" : "s"})` : "") +
        " \u2014 hit Save to apply them for real, or refresh the page to start over.",
      "info"
    );
  }
}

async function onSave() {
  els.save.disabled = true;
  setStatus("Applying changes\u2026", "info");

  const newHead = M.buildField(fields.head, "head", collectSelections("head"));
  const newBody = M.buildField(fields.body, "body", collectSelections("body"));

  const res = await runInPage(pageApplyFields, [newHead, newBody]);
  if (!res || !res.ok) {
    setStatus((res && res.reason) || "Failed to apply changes.", "err");
    els.save.disabled = false;
    return;
  }

  fields = { head: res.head, body: res.body };
  initParamValues();
  await clearPending();
  render();
  if (previewOn) await applyPreview();
  setStatus("Saved. Reload the public site to see the changes.", "ok");
}

els.save.addEventListener("click", onSave);
els.previewToggle.addEventListener("change", onPreviewToggle);

// Any checkbox toggle or param edit inside the lists refreshes the live
// preview (debounced) and persists the pending state so it survives the popup
// closing.
for (const list of [els.listHead, els.listBody]) {
  const onEdit = () => {
    schedulePreview();
    schedulePersist();
  };
  list.addEventListener("change", onEdit);
  list.addEventListener("input", onEdit);
}

// ---------------------------------------------------------------------------
// Popup resizing: Chrome sizes the popup window to fit the document, so a drag
// handle that adjusts the body's dimensions effectively resizes the popup
// (Chrome caps popups around 800x600). The chosen size is remembered across
// sessions; double-click the handle to reset to the default size.
// ---------------------------------------------------------------------------

function applyPopupSize(w, h) {
  document.body.classList.add("resized");
  document.body.style.width = w + "px";
  document.body.style.height = h + "px";
}

function resetPopupSize() {
  document.body.classList.remove("resized");
  document.body.style.width = "";
  document.body.style.height = "";
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.remove("popupSize");
  }
}

(function initResize() {
  const handle = document.getElementById("resize-handle");
  let drag = null;

  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    drag = {
      x: e.screenX,
      y: e.screenY,
      w: document.body.offsetWidth,
      h: document.body.offsetHeight,
    };
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!drag) return;
    // Bottom-left handle: dragging left widens, dragging down heightens.
    // screen coordinates are used because the popup window itself shifts as
    // its width grows.
    const w = Math.min(790, Math.max(320, drag.w + (drag.x - e.screenX)));
    const h = Math.min(590, Math.max(260, drag.h + (e.screenY - drag.y)));
    applyPopupSize(w, h);
  });

  handle.addEventListener("pointerup", () => {
    if (!drag) return;
    drag = null;
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        popupSize: { w: document.body.offsetWidth, h: document.body.offsetHeight },
      });
    }
  });

  handle.addEventListener("dblclick", resetPopupSize);

  // Restore the last chosen size.
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("popupSize").then(({ popupSize }) => {
      if (popupSize && popupSize.w && popupSize.h) {
        applyPopupSize(popupSize.w, popupSize.h);
      }
    });
  }
})();

document.addEventListener("DOMContentLoaded", init);
