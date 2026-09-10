// Snippet file parsing shared by folder discovery and the paste-in form.
//
// A snippet is plain HTML with optional leading metadata comments:
//   <!-- title: My Nice Title -->
//   <!-- param: color type=color label="Wave color" default=#1978BE -->
// Metadata lines are stripped from the content that gets installed.
(function () {
  // Filenames can contain anything; marker ids must be [\w.-] only.
  function slugify(s) {
    return (
      String(s)
        .trim()
        .replace(/\.html$/i, '')
        .replace(/[^\w.-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '') || 'snippet'
    );
  }

  function prettify(id) {
    return String(id)
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  // Options are "|"-separated. Each entry is either "value" or "Label:value"
  // (split on the FIRST colon, so values may contain colons or commas).
  function parseOptions(val) {
    return String(val)
      .split('|')
      .map(function (part) {
        var s = part.trim();
        if (!s) return null;
        var idx = s.indexOf(':');
        if (idx === -1) return { label: s, value: s };
        return { label: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
      })
      .filter(Boolean);
  }

  function parseParamSpec(str) {
    var nameMatch = /^([\w-]+)\s*(.*)$/.exec(str.trim());
    if (!nameMatch) return null;
    var spec = { name: nameMatch[1], type: 'color', label: null, default: '' };
    var attrRe = /([\w-]+)\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/g;
    var m;
    while ((m = attrRe.exec(nameMatch[2]))) {
      var key = m[1];
      var val = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
      if (key === 'type') spec.type = val;
      else if (key === 'label') spec.label = val;
      else if (key === 'default') spec.default = val;
      else if (key === 'unit') spec.unit = val;
      else if (key === 'min') spec.min = val;
      else if (key === 'max') spec.max = val;
      else if (key === 'step') spec.step = val;
      else if (key === 'rows') spec.rows = val;
      else if (key === 'placeholder') spec.placeholder = val;
      else if (key === 'separator') spec.separator = val;
      else if (key === 'options') spec.options = parseOptions(val);
    }
    if (!spec.label) spec.label = prettify(spec.name);
    return spec;
  }

  function parseSnippet(raw) {
    var lines = String(raw).split(/\r?\n/);
    var titleRe = /^\s*<!--\s*title:\s*(.+?)\s*-->\s*$/;
    var paramRe = /^\s*<!--\s*param:\s*(.+?)\s*-->\s*$/;
    var title = null;
    var params = [];
    var i = 0;
    for (; i < lines.length; i++) {
      var m;
      if ((m = titleRe.exec(lines[i]))) {
        title = m[1];
        continue;
      }
      if ((m = paramRe.exec(lines[i]))) {
        var spec = parseParamSpec(m[1]);
        if (spec) params.push(spec);
        continue;
      }
      if (lines[i].trim() === '') continue;
      break;
    }
    var content = lines.slice(i).join('\n').trim();
    return { title: title, params: params, content: content };
  }

  var api = {
    slugify: slugify,
    prettify: prettify,
    parseParamSpec: parseParamSpec,
    parseSnippet: parseSnippet,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.AmplifySnippets = api;
  }
})();
