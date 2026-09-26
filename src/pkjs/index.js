// RP Probe phone script: opens a test page in the Pebble app's WebView (as a
// data: URL, like Royal Pebble's settings page) to find out whether the page
// can save a file, share, copy large text, reach the internet, and how big the
// page can get. Results come back through pebblejs://close# and are shown at
// the top of the page the next time it opens.

var STORE_RUNS = 'probeRuns';   // [{at, sizeKB, urlKB, results: [text]}]
var STORE_NEXT = 'probeNextKB'; // log-like padding to put in the next page

function load(key, fallback) {
  try {
    var text = localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Made-up log lines (no real cabin numbers), about kb * 1024 characters.
function padText(kb) {
  var kinds = ['open', 'setting', 'sync', 'route', 'button', 'screen'];
  var out = [];
  var len = 0;
  var i = 0;
  while (len < kb * 1024) {
    var m = i % 60;
    var line = '2026-09-26 14:' + (m < 10 ? '0' : '') + m + ':12  D3 14:03  ' + kinds[i % kinds.length] +
      '  entry ' + i + ': theme "light" -> dark, cabin 1234, 58 ms';
    out.push(line);
    len += line.length + 1;
    i++;
  }
  return out.join('\n');
}

function pageMain(S) {
  var $ = function(id) { return document.getElementById(id); };
  var results = [];

  function record(name, value) {
    results.push(name + ': ' + value);
    var li = document.createElement('li');
    li.textContent = name + ': ' + value;
    $('now').appendChild(li);
  }

  // Earlier runs, newest first.
  S.runs.slice().reverse().forEach(function(run) {
    var d = document.createElement('div');
    d.className = 'run';
    d.textContent = 'Run ' + run.at + ' (padding ' + run.sizeKB + ' KB, returned ' + run.returnKB + ' KB)\n' +
      run.results.join('\n');
    $('runs').appendChild(d);
  });
  if (!S.runs.length) {
    $('runs').textContent = 'No earlier runs yet.';
  }

  // 1. The page itself.
  var pad = $('pad').value;
  record('Page loaded', 'URL ' + Math.round(location.href.length / 1024) + ' KB, padding ' +
         (pad.length >= S.padChars ? 'complete' : 'CUT OFF at ' + pad.length + ' of ' + S.padChars) +
         ' (' + S.sizeKB + ' KB asked)');
  record('Browser', navigator.userAgent);

  // Automatic checks.
  function tryClipboardApi(name, text) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      record(name, 'no clipboard API');
      return;
    }
    navigator.clipboard.writeText(text).then(function() {
      record(name, 'said OK (' + text.length + ' chars) - paste below to check');
    }, function(e) {
      record(name, 'refused: ' + e);
    });
  }
  function tryExecCopy(name, text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    record(name, (ok ? 'said OK (' : 'failed (') + text.length + ' chars) - paste below to check');
  }

  $('copyApi').onclick = function() { tryClipboardApi('Copy small, clipboard API', 'RP Probe small copy'); };
  $('copyExec').onclick = function() { tryExecCopy('Copy small, execCommand', 'RP Probe small copy (exec)'); };
  $('copyBig').onclick = function() {
    tryExecCopy('Copy padding, execCommand', pad);
  };
  $('copyBigApi').onclick = function() {
    tryClipboardApi('Copy padding, clipboard API', pad);
  };
  $('pasteBox').addEventListener('input', function() {
    $('pasteLen').textContent = 'Pasted ' + $('pasteBox').value.length + ' characters.';
  });
  $('pasteRec').onclick = function() {
    record('Pasted back', $('pasteBox').value.length + ' characters');
  };

  record('Share API', typeof navigator.share === 'function' ?
         'present' + (navigator.canShare ? ', canShare present' : '') : 'missing');

  $('net').onclick = function() {
    record('Internet from page', 'trying...');
    fetch('https://www.google.com/generate_204', {mode: 'no-cors'}).then(function() {
      record('Internet from page', 'reached Google');
    }, function(e) {
      record('Internet from page', 'failed: ' + e);
    });
  };

  // Links the user taps; they say what happened.
  var small = 'Royal Pebble WebView probe test file.\nIf you can read this in a file, saving works.\n';
  $('dlData').href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(small);
  var blob = null;
  var bigBlob = null;
  try {
    blob = new Blob([small], {type: 'text/plain'});
    bigBlob = new Blob([pad || small], {type: 'text/plain'});
    $('dlBlob').href = URL.createObjectURL(blob);
    $('dlBig').href = URL.createObjectURL(bigBlob);
  } catch (e) {
    record('Blob', 'not available: ' + e);
  }
  $('mail').href = 'mailto:?subject=' + encodeURIComponent('RP Probe test') + '&body=' + encodeURIComponent(small);
  $('intent').href = 'intent:#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=' +
    encodeURIComponent(small) + ';end';

  $('shareText').onclick = function() {
    if (typeof navigator.share !== 'function') {
      record('Share text', 'no share API');
      return;
    }
    navigator.share({title: 'RP Probe', text: small}).then(function() {
      record('Share text', 'said OK');
    }, function(e) {
      record('Share text', 'refused: ' + e);
    });
  };
  $('shareFile').onclick = function() {
    if (typeof navigator.share !== 'function' || typeof File !== 'function') {
      record('Share file', 'no share API or File');
      return;
    }
    var f = new File([pad || small], 'royal-pebble-log-test.txt', {type: 'text/plain'});
    if (navigator.canShare && !navigator.canShare({files: [f]})) {
      record('Share file', 'canShare says no');
      return;
    }
    navigator.share({files: [f], title: 'RP Probe'}).then(function() {
      record('Share file', 'said OK');
    }, function(e) {
      record('Share file', 'refused: ' + e);
    });
  };
  $('openBlob').onclick = function() {
    var w = null;
    try {
      w = window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      record('Open as text page', 'error: ' + e);
      return;
    }
    record('Open as text page', w ? 'window.open returned a window' : 'window.open returned nothing');
  };

  // Worked / Didn't buttons beside each manual test.
  Array.prototype.forEach.call(document.querySelectorAll('[data-ask]'), function(row) {
    var name = row.getAttribute('data-ask');
    ['Worked', 'Nothing', 'Error'].forEach(function(label) {
      var b = document.createElement('button');
      b.className = 'small';
      b.textContent = label;
      b.onclick = function() { record(name, 'you said: ' + label); };
      row.appendChild(b);
    });
  });

  $('copyResults').onclick = function() {
    tryExecCopy('Copy results', results.join('\n'));
  };
  $('close').onclick = function() {
    var next = parseInt($('nextKB').value, 10) || 0;
    document.location = 'pebblejs://close#' + encodeURIComponent(JSON.stringify({results: results, next: next}));
  };
  $('nextKB').value = String(S.sizeKB);
}

var CSS = 'body{font:16px sans-serif;margin:12px;background:#fff;color:#111}' +
  'h1{font-size:20px}h2{font-size:17px;margin:18px 0 6px}' +
  'button,a.btn{display:inline-block;margin:4px 4px 4px 0;padding:10px 12px;font-size:15px;border:1px solid #888;' +
  'border-radius:8px;background:#eef;color:#003;text-decoration:none}' +
  'button.small{padding:6px 8px;font-size:13px;background:#f4f4f4}' +
  '.row{margin:8px 0;padding:8px;border:1px solid #ddd;border-radius:8px}' +
  '.run{white-space:pre-wrap;font:12px monospace;background:#f6f6f6;padding:8px;margin:6px 0;border-radius:6px}' +
  '#now li{font:13px monospace;margin:3px 0}textarea{width:100%;height:70px}' +
  '#pad{position:absolute;left:-9999px;width:10px;height:10px}';

function row(inner, ask) {
  return '<div class="row"' + (ask ? ' data-ask="' + ask + '"' : '') + '>' + inner + '<br></div>';
}

function buildPage(state, pad) {
  var json = JSON.stringify(state).replace(/</g, '\\u003c');
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>RP Probe</title><style>' + CSS + '</style></head><body>' +
    '<h1>RP Probe</h1><p>Tap each test. For links, come back to this page and say what happened. ' +
    'Then tap Save results at the bottom.</p>' +
    '<h2>This run</h2><ol id="now"></ol>' +
    '<h2>Save a file</h2>' +
    row('<a class="btn" id="dlData" download="royal-pebble-log-test.txt">Download (data link)</a>',
        'Download data link') +
    row('<a class="btn" id="dlBlob" download="royal-pebble-log-test.txt">Download (blob link)</a>',
        'Download blob link') +
    row('<a class="btn" id="dlBig" download="royal-pebble-log-big.txt">Download padding (blob, ' +
        state.sizeKB + ' KB)</a>', 'Download padding') +
    row('<button id="openBlob">Open as text page</button>', 'Open as text page') +
    '<h2>Share</h2>' +
    row('<button id="shareText">Share text</button>', 'Share text') +
    row('<button id="shareFile">Share as file</button>', 'Share file') +
    row('<a class="btn" id="intent">Android share (intent link)</a>', 'Android intent') +
    row('<a class="btn" id="mail">Email (mailto link)</a>', 'Email link') +
    '<h2>Copy</h2>' +
    row('<button id="copyApi">Copy small (clipboard API)</button><button id="copyExec">Copy small (execCommand)</button>' +
        '<button id="copyBig">Copy padding (execCommand)</button><button id="copyBigApi">Copy padding (clipboard API)</button>' +
        '<p>Long-press here and Paste after each copy:</p><textarea id="pasteBox"></textarea>' +
        '<p id="pasteLen"></p><button id="pasteRec">Record pasted length</button>') +
    '<h2>Internet</h2>' +
    row('<button id="net">Try to reach Google from the page</button>') +
    '<h2>Finish</h2>' +
    '<label>Padding for the next open: <select id="nextKB"><option value="0">none</option>' +
    '<option value="256">256 KB</option><option value="512">512 KB</option><option value="1024">1 MB</option>' +
    '<option value="2048">2 MB</option><option value="4096">4 MB</option></select></label><br>' +
    '<button id="copyResults">Copy results</button><button id="close">Save results and close</button>' +
    '<h2>Earlier runs</h2><div id="runs"></div>' +
    '<textarea id="pad" readonly>' + pad + '</textarea>' +
    '<script>(' + pageMain.toString() + ')(' + json + ');</script></body></html>';
}

var s_lastUrlKB = 0;
var s_lastSizeKB = 0;

Pebble.addEventListener('showConfiguration', function() {
  var sizeKB = load(STORE_NEXT, 0);
  var pad = sizeKB ? padText(sizeKB) : '';
  var state = {sizeKB: sizeKB, padChars: pad.length, runs: load(STORE_RUNS, [])};
  var url = 'data:text/html;charset=utf-8,' + encodeURIComponent(buildPage(state, pad));
  s_lastUrlKB = Math.round(url.length / 1024);
  s_lastSizeKB = sizeKB;
  console.log('Opening probe page: ' + s_lastUrlKB + ' KB URL, padding ' + sizeKB + ' KB');
  Pebble.openURL(url);
});

Pebble.addEventListener('webviewclosed', function(e) {
  var text = (e && e.response) || '';
  var r = null;
  try {
    r = JSON.parse(decodeURIComponent(text));
  } catch (err) {
    try {
      r = JSON.parse(text);
    } catch (err2) {
      r = null;
    }
  }
  var runs = load(STORE_RUNS, []);
  var d = new Date();
  runs.push({
    at: d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(),
    sizeKB: s_lastSizeKB,
    returnKB: Math.round(text.length / 1024),
    results: ['Phone built a ' + s_lastUrlKB + ' KB page URL'].concat(
      r && r.results ? r.results : ['(page closed without results: ' + text.length + ' chars back)'])
  });
  save(STORE_RUNS, runs.slice(-6));
  if (r && typeof r.next === 'number') {
    save(STORE_NEXT, r.next);
  }
});

Pebble.addEventListener('ready', function() {
  console.log('RP Probe ready');
});
