/* Luna chat filter - works in the browser (window.LunaFilter) and in Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LunaFilter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '(': 'c' };

  // Matched anywhere inside text (even with spaces/symbols between letters)
  var STRICT = ['fuck', 'shit', 'bitch', 'nigg', 'faggot', 'whore', 'pussy', 'asshole', 'bastard', 'retard',
    'porn', 'cocksucker', 'motherfucker', 'dumbass', 'blowjob', 'handjob', 'dildo', 'molest', 'pedophile', 'hitler'];
  // Only matched as whole words (avoids blocking "class", "peninsula", "document"...)
  var WORD = ['ass', 'arse', 'sex', 'dick', 'cock', 'cunt', 'penis', 'vagina', 'boob', 'boobs', 'tits', 'cum', 'jizz',
    'nazi', 'rape', 'raped', 'rapist', 'kys', 'fag', 'fags', 'slut', 'tard', 'nude', 'nudes', 'milf', 'horny'];

  function collapse(s) { return s.replace(/(.)\1+/g, '$1'); }
  var STRICT_C = STRICT.map(collapse);
  var WORD_SET = {};
  WORD.forEach(function (w) { WORD_SET[collapse(w)] = 1; });

  function normWord(t) {
    var o = '';
    t = t.toLowerCase();
    for (var i = 0; i < t.length; i++) {
      var c = LEET[t[i]] || t[i];
      if (/[a-z]/.test(c)) o += c;
    }
    return collapse(o);
  }

  function maskStrict(text) {
    var stripped = '', map = [], i, c;
    var low = text.toLowerCase();
    for (i = 0; i < low.length; i++) {
      c = LEET[low[i]] || low[i];
      if (!/[a-z]/.test(c)) continue;
      if (stripped.length && stripped[stripped.length - 1] === c) continue;
      stripped += c; map.push(i);
    }
    var chars = text.split('');
    STRICT_C.forEach(function (w) {
      var from = 0, idx;
      while ((idx = stripped.indexOf(w, from)) !== -1) {
        var a = map[idx], b = map[idx + w.length - 1];
        while (b + 1 < low.length && low[b + 1] === low[b]) b++;
        for (var k = a; k <= b; k++) if (/[A-Za-z0-9@$!|+()]/.test(chars[k])) chars[k] = '#';
        from = idx + w.length;
      }
    });
    return chars.join('');
  }

  function maskWords(text) {
    return text.replace(/[A-Za-z0-9@$!|+()]+/g, function (tok) {
      if (/^#+$/.test(tok)) return tok;
      if (WORD_SET[normWord(tok)]) return new Array(tok.length + 1).join('#');
      var t2 = tok.replace(/[^A-Za-z0-9]+$/, '');
      if (t2 && t2 !== tok && WORD_SET[normWord(t2)]) return new Array(t2.length + 1).join('#') + tok.slice(t2.length);
      return tok;
    });
  }

  function maskPII(text) {
    return text
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, function (m) { return new Array(m.length + 1).join('#'); })
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, function (m) { return new Array(m.length + 1).join('#'); })
      .replace(/\b[\w-]+\.(?:com|net|org|gg|io|xyz|ru|tk|ly|me|co|info|biz)\b(?:\/\S*)?/gi, function (m) { return new Array(m.length + 1).join('#'); })
      .replace(/(?:\+?\d[\s\-.()]?){7,}/g, function (m) { return new Array(m.length + 1).join('#'); });
  }

  function filter(text) {
    text = String(text == null ? '' : text);
    return maskWords(maskStrict(maskPII(text)));
  }

  return { filter: filter, isClean: function (t) { return filter(t) === String(t); } };
});
