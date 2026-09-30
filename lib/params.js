// Snippet parameter substitution + extraction.
//
// A snippet template can contain {{name}} placeholders. The popup swaps in the
// user's chosen values on save (applyParams) and also records the exact chosen
// values in a machine-readable comment at the top of the installed block:
//
//   <!-- amplify-params:<url-encoded JSON> -->
//
// Reading the current values back (extractParams) prefers that comment, which
// stays correct even if the snippet template is edited later. Snippets that
// were installed before this comment existed fall back to reverse-matching the
// template: its literal segments become an anchored regex and whatever sits in
// each placeholder slot is captured.
(function () {
  var META_RE = /<!--\s*amplify-params:([^\s]*?)\s*-->/;
  var META_RE_ALL = /<!--\s*amplify-params:[^\s]*?\s*-->\s*/g;

  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // template = literals[0] + {{names[0]}} + literals[1] + {{names[1]}} + ...
  function splitTemplate(template) {
    var re = /\{\{\s*([\w-]+)\s*\}\}/g;
    var literals = [];
    var names = [];
    var last = 0;
    var m;
    while ((m = re.exec(template))) {
      literals.push(template.slice(last, m.index));
      names.push(m[1]);
      last = m.index + m[0].length;
    }
    literals.push(template.slice(last));
    return { literals: literals, names: names };
  }

  // ---- metadata comment ----------------------------------------------------

  function metadataComment(values) {
    var encoded = '';
    try {
      encoded = encodeURIComponent(JSON.stringify(values || {}));
    } catch (e) {
      encoded = '';
    }
    return '<!-- amplify-params:' + encoded + ' -->';
  }

  function extractMetadata(content) {
    if (content == null) return null;
    var m = META_RE.exec(String(content));
    if (!m) return null;
    try {
      var parsed = JSON.parse(decodeURIComponent(m[1]));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      /* fall through */
    }
    return null;
  }

  function stripMetadata(content) {
    return String(content == null ? '' : content).replace(META_RE_ALL, '');
  }

  // ---- apply ---------------------------------------------------------------

  function applyParams(template, values) {
    var s = splitTemplate(template);
    var out = s.literals[0];
    for (var i = 0; i < s.names.length; i++) {
      var has = values && Object.prototype.hasOwnProperty.call(values, s.names[i]);
      var v = has ? values[s.names[i]] : '';
      out += (v == null ? '' : v) + s.literals[i + 1];
    }
    // The comment lives inside the managed marker block, so removing the
    // snippet removes its metadata too.
    return metadataComment(values) + '\n' + out;
  }

  // ---- extract -------------------------------------------------------------

  function extractLegacyParams(content, template) {
    var s = splitTemplate(template);
    var values = {};
    if (!s.names.length || content == null) return values;
    var clean = stripMetadata(content);
    var pattern = '^';
    for (var i = 0; i < s.literals.length; i++) {
      pattern += escapeRegex(s.literals[i]);
      if (i < s.names.length) pattern += '([\\s\\S]*?)';
    }
    pattern += '$';
    var m = null;
    try {
      m = new RegExp(pattern).exec(clean);
    } catch (e) {
      m = null;
    }
    if (m) {
      for (var j = 0; j < s.names.length; j++) {
        if (!Object.prototype.hasOwnProperty.call(values, s.names[j])) {
          values[s.names[j]] = m[j + 1];
        }
      }
    }
    return values;
  }

  function extractParams(content, template) {
    var stored = extractMetadata(content);
    if (stored) return stored;
    return extractLegacyParams(content, template);
  }

  var api = {
    splitTemplate: splitTemplate,
    applyParams: applyParams,
    extractParams: extractParams,
    extractMetadata: extractMetadata,
    stripMetadata: stripMetadata,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.AmplifyParams = api;
  }
})();
