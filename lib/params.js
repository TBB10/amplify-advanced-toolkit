// Snippet parameter substitution + extraction.
//
// A snippet template can contain {{name}} placeholders. The popup swaps in the
// user's chosen values on save (applyParams). To show the CURRENT value of an
// installed snippet, we reverse the process (extractParams): the only thing
// that differs between the template and the installed block is the substituted
// values, so we turn the template's literal segments into an anchored regex and
// capture whatever sits in each placeholder slot. This is why a recolored
// snippet (e.g. a yellow wave instead of blue) is still recognized and its
// current color is read back correctly.
(function () {
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

  function applyParams(template, values) {
    var s = splitTemplate(template);
    var out = s.literals[0];
    for (var i = 0; i < s.names.length; i++) {
      var has = values && Object.prototype.hasOwnProperty.call(values, s.names[i]);
      var v = has ? values[s.names[i]] : '';
      out += (v == null ? '' : v) + s.literals[i + 1];
    }
    return out;
  }

  function extractParams(content, template) {
    var s = splitTemplate(template);
    var values = {};
    if (!s.names.length || content == null) return values;
    var pattern = '^';
    for (var i = 0; i < s.literals.length; i++) {
      pattern += escapeRegex(s.literals[i]);
      if (i < s.names.length) pattern += '([\\s\\S]*?)';
    }
    pattern += '$';
    var m = null;
    try {
      m = new RegExp(pattern).exec(content);
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

  var api = {
    splitTemplate: splitTemplate,
    applyParams: applyParams,
    extractParams: extractParams,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.AmplifyParams = api;
  }
})();
