// Marker-based management of snippets inside the Advanced settings fields.
//
// Every snippet the extension installs is wrapped in a unique comment pair:
//
//   <!-- amplify-toolkit:body:carousel-wave START -->
//   ...snippet...
//   <!-- amplify-toolkit:body:carousel-wave END -->
//
// This lets us (a) detect exactly which snippets are installed, and
// (b) remove them without ever touching content the user wrote by hand.
// Anything outside our marker pairs is treated as untouchable base content.
(function () {
  var NS = 'amplify-toolkit';

  function esc(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function startMarker(target, id) {
    return '<!-- ' + NS + ':' + target + ':' + id + ' START -->';
  }
  function endMarker(target, id) {
    return '<!-- ' + NS + ':' + target + ':' + id + ' END -->';
  }

  function wrap(target, id, content) {
    return (
      startMarker(target, id) + '\n' + String(content).trim() + '\n' + endMarker(target, id)
    );
  }

  // Matches any managed block regardless of target/id, including a leading
  // run of blank lines so removal doesn't leave gaps behind.
  function managedBlockRegex() {
    return new RegExp(
      '\\n*[\\t ]*<!--\\s*' +
        NS +
        ':[\\w.-]+:[\\w.-]+\\s+START\\s*-->[\\s\\S]*?<!--\\s*' +
        NS +
        ':[\\w.-]+:[\\w.-]+\\s+END\\s*-->[\\t ]*',
      'g'
    );
  }

  // IDs of managed snippets currently present for a given target.
  function installedIds(value, target) {
    var re = new RegExp(
      '<!--\\s*' + NS + ':' + target + ':([\\w.-]+)\\s+START\\s*-->',
      'g'
    );
    var ids = [];
    var m;
    while ((m = re.exec(value || ''))) {
      ids.push(m[1]);
    }
    return ids;
  }

  // Return the inner content of a specific managed block (trimmed), or null.
  // Used to read the currently-applied snippet so we can extract its params
  // (e.g. the color in use) regardless of what that value is.
  function getBlock(value, target, id) {
    var re = new RegExp(
      '<!--\\s*' +
        NS +
        ':' +
        esc(target) +
        ':' +
        esc(id) +
        '\\s+START\\s*-->([\\s\\S]*?)<!--\\s*' +
        NS +
        ':' +
        esc(target) +
        ':' +
        esc(id) +
        '\\s+END\\s*-->'
    );
    var m = re.exec(value || '');
    if (!m) return null;
    return m[1].replace(/^\n/, '').replace(/\n$/, '');
  }

  // Remove every managed block, returning only the hand-authored base content.
  function stripManaged(value) {
    var v = (value || '').replace(managedBlockRegex(), '');
    v = v.replace(/\n{3,}/g, '\n\n');
    return v.replace(/\s+$/, '');
  }

  // Rebuild a field: keep the hand-authored base, then append the currently
  // selected snippets. Unselected snippets simply never get re-added, which
  // is how "uncheck + save" removes them safely.
  // selections: [{ id, content }] in the order they should appear.
  function buildField(value, target, selections) {
    var base = stripManaged(value);
    var blocks = selections.map(function (s) {
      return wrap(target, s.id, s.content);
    });
    if (!blocks.length) {
      return base ? base + '\n' : '';
    }
    var joined = blocks.join('\n\n');
    return base ? base + '\n\n' + joined + '\n' : joined + '\n';
  }

  var api = {
    NS: NS,
    startMarker: startMarker,
    endMarker: endMarker,
    wrap: wrap,
    installedIds: installedIds,
    getBlock: getBlock,
    stripManaged: stripManaged,
    buildField: buildField,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.AmplifyMarkers = api;
  }
})();
