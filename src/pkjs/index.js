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
  // Copies of a set size, made in the page, to find the clipboard's limit.
  function sized(kb) {
    var out = [];
    var len = 0;
    for (var i = 0; len < kb * 1024; i++) {
      var line = '2026-09-26 14:03:12  D3 14:03  button  entry ' + i + ': up, down, select';
      out.push(line);
      len += line.length + 1;
    }
    return out.join(String.fromCharCode(10)).slice(0, kb * 1024);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-copykb]'), function(b) {
    b.onclick = function() {
      var kb = +b.getAttribute('data-copykb');
      tryExecCopy('Copy ' + kb + ' KB', sized(kb));
    };
  });
  $('pasteClear').onclick = function() {
    $('pasteBox').value = '';
    $('pasteLen').textContent = '';
  };
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
    document.location = 'pebblejs://close#' + encodeURIComponent(JSON.stringify({
      results: results, next: next, storageTest: $('storageTest').checked
    }));
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
        '<p>Copy a set size:</p>' + [32, 64, 128, 256, 384, 512].map(function(kb) {
          return '<button data-copykb="' + kb + '">' + kb + ' KB</button>';
        }).join('') +
        '<p>Long-press here and Paste after each copy:</p><textarea id="pasteBox"></textarea>' +
        '<p id="pasteLen"></p><button id="pasteRec">Record pasted length</button><button id="pasteClear">Clear box</button>') +
    '<h2>Internet</h2>' +
    row('<button id="net">Try to reach Google from the page</button>') +
    '<h2>Finish</h2>' +
    '<label>Padding for the next open: <select id="nextKB"><option value="0">none</option>' +
    '<option value="256">256 KB</option><option value="512">512 KB</option><option value="1024">1 MB</option>' +
    '<option value="1152">1.125 MB</option><option value="1280">1.25 MB</option>' +
    '<option value="1536">1.5 MB</option><option value="2048">2 MB</option><option value="4096">4 MB</option></select></label><br>' +
    '<label><input type="checkbox" id="storageTest"> Test phone storage after closing ' +
    '(takes up to a minute; keep the app open on the watch, then open this page again)</label><br>' +
    '<button id="copyResults">Copy results</button><button id="close">Save results and close</button>' +
    '<h2>Earlier runs</h2><div id="runs"></div>' +
    '<textarea id="pad" readonly>' + pad + '</textarea>' +
    '<script>(' + pageMain.toString() + ')(' + json + ');</script></body></html>';
}

// The open in progress: {sizeKB, urlKB}. Still set at the next open means the
// page never came back (it didn't load), so that open drops the padding.
var STORE_PENDING = 'probePending';

function addRun(sizeKB, returnKB, results) {
  var runs = load(STORE_RUNS, []);
  var d = new Date();
  runs.push({
    at: d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(),
    sizeKB: sizeKB,
    returnKB: returnKB,
    results: results
  });
  save(STORE_RUNS, runs.slice(-8));
}

// Phone storage quota test. Royal Pebble's usage log (up to 768 KB of text)
// lives in the phone script's localStorage beside the cruise bundle, so this
// finds how much that storage takes: one key growing to 8 MB, then 512 KB keys
// adding up to 16 MB. Sizes are in K characters (JS strings; a store may count
// 2 bytes each). Every test key is removed afterwards. Progress is saved after
// each step, so a script that gets stopped part way still leaves a result.
var STORE_QUOTA = 'probeQuotaProgress'; // [text] while the test runs
var QUOTA_KEY = 'probeQuotaTest';
var QUOTA_MULTI = 'probeQuotaMulti';

function quotaBlock(kb) {
  var s = padText(64).slice(0, 64 * 1024);
  while (s.length < kb * 1024) {
    s += s;
  }
  return s.slice(0, kb * 1024);
}

function trySet(key, value) {
  try {
    localStorage.setItem(key, value);
    var back = localStorage.getItem(key);
    return back !== null && back.length === value.length ? 'ok' : 'read back ' + (back ? back.length : 'nothing');
  } catch (e) {
    return 'error: ' + e;
  }
}

function existingUsage() {
  var chars = 0;
  var keys = 0;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      var v = localStorage.getItem(k);
      chars += k.length + (v ? v.length : 0);
      keys++;
    }
  } catch (e) {
    return 'could not count: ' + e;
  }
  return keys + ' keys, ' + Math.round(chars / 1024) + ' K chars';
}

function runStorageTest() {
  var out = [];
  function note(text) {
    out.push(text);
    try { save(STORE_QUOTA, out); } catch (e) {} // storage may be full right now
    console.log('Storage test: ' + text);
  }
  note('Storage before test: ' + existingUsage());

  // 1. One key, growing.
  var best = 0;
  [256, 512, 768, 1024, 2048, 3072, 4096, 6144, 8192].some(function(kb) {
    var t0 = Date.now();
    var r = trySet(QUOTA_KEY, quotaBlock(kb));
    note('One key ' + kb + ' K: ' + r + ' (' + (Date.now() - t0) + ' ms)');
    if (r !== 'ok') {
      return true;
    }
    best = kb;
    return false;
  });
  try { localStorage.removeItem(QUOTA_KEY); } catch (e) {}
  note('Largest single value saved: ' + best + ' K chars');

  // 2. Log-sized save and load timing (the log is saved after new entries).
  var log = JSON.stringify([quotaBlock(768)]);
  var t1 = Date.now();
  var r768 = trySet(QUOTA_KEY, log);
  var t2 = Date.now();
  var parsed = null;
  try { parsed = JSON.parse(localStorage.getItem(QUOTA_KEY)); } catch (e) {}
  note('768 K log as JSON: save ' + r768 + ' in ' + (t2 - t1) + ' ms, load and parse ' +
       (parsed ? 'ok' : 'failed') + ' in ' + (Date.now() - t2) + ' ms');
  try { localStorage.removeItem(QUOTA_KEY); } catch (e) {}

  // 3. Many 512 K keys, adding up (the quota may be for all keys together).
  var block = quotaBlock(512);
  var n = 0;
  for (; n < 32; n++) {
    var r = trySet(QUOTA_MULTI + n, block);
    if (r !== 'ok') {
      note('Key ' + (n + 1) + ' of 512 K: ' + r);
      break;
    }
    if ((n + 1) % 4 === 0) {
      note('Total so far: ' + ((n + 1) * 512) + ' K chars');
    }
  }
  note('Total saved across keys: ' + (n * 512) + ' K chars' + (n === 32 ? ' (test limit, no error)' : ''));
  for (var i = 0; i <= n && i < 32; i++) {
    try { localStorage.removeItem(QUOTA_MULTI + i); } catch (e) {}
  }
  note('Storage after cleanup: ' + existingUsage());

  save(STORE_QUOTA, null);
  addRun(0, 0, ['Phone storage test'].concat(out));
}

Pebble.addEventListener('showConfiguration', function() {
  var stopped = load(STORE_QUOTA, null);
  if (stopped) {
    // The test never finished: record how far it got and clean up.
    save(STORE_QUOTA, null);
    try { localStorage.removeItem(QUOTA_KEY); } catch (e) {}
    for (var q = 0; q < 32; q++) {
      try { localStorage.removeItem(QUOTA_MULTI + q); } catch (e) {}
    }
    addRun(0, 0, ['Phone storage test STOPPED part way (last step below)'].concat(stopped));
  }
  var pending = load(STORE_PENDING, null);
  if (pending) {
    addRun(pending.sizeKB, 0, ['Phone built a ' + pending.urlKB + ' KB page URL',
                               'FAILED: that page never came back, so this open has no padding']);
    save(STORE_NEXT, 0);
  }
  var sizeKB = load(STORE_NEXT, 0);
  var pad = sizeKB ? padText(sizeKB) : '';
  var state = {sizeKB: sizeKB, padChars: pad.length, runs: load(STORE_RUNS, [])};
  var url = 'data:text/html;charset=utf-8,' + encodeURIComponent(buildPage(state, pad));
  var urlKB = Math.round(url.length / 1024);
  save(STORE_PENDING, {sizeKB: sizeKB, urlKB: urlKB});
  console.log('Opening probe page: ' + urlKB + ' KB URL, padding ' + sizeKB + ' KB');
  Pebble.openURL(url);
});

Pebble.addEventListener('webviewclosed', function(e) {
  var pending = load(STORE_PENDING, null) || {sizeKB: 0, urlKB: 0};
  save(STORE_PENDING, null);
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
  addRun(pending.sizeKB, Math.round(text.length / 1024), ['Phone built a ' + pending.urlKB + ' KB page URL'].concat(
    r && r.results ? r.results : ['Closed without results (' + text.length + ' chars back); next open has no padding']));
  // Backing out of a blank page lands here too, so start small again.
  save(STORE_NEXT, r && typeof r.next === 'number' ? r.next : 0);
  if (r && r.storageTest) {
    runStorageTest();
  }
});

Pebble.addEventListener('ready', function() {
  console.log('RP Probe ready');
});
