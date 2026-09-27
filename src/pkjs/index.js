// RP Probe phone script, round 2 (Royal Pebble Phase 4 checks):
//   1. Big result: how much the settings page can send back through
//      pebblejs://close# (a pasted cruise bundle travels that way).
//   2. Royal sign-in: whether Royal accepts a sign-in from the phone script,
//      and whether a password with special characters survives the close URL.
// Results are kept on the phone and shown at the top of the page the next time
// it opens. They never hold the email, password, token or Royal's replies:
// only sizes, yes/no checks, status codes and a booking count.

var STORE_RUNS = 'probeRuns2';    // [{at, lines: [text]}], newest first
var STORE_BUSY = 'probeBusy2';    // set while the sign-in test runs

var APPKEY = 'hyNNqIPHHzaLzVpcICPdAdbFV8yvTsAm';
var API = 'https://aws-prd.api.rccl.com';
var LOGIN_URL = 'https://www.royalcaribbean.com/auth/oauth2/access_token';
// Royal's public web-app client (the same value as Royal Pebble's cruise_sync.py).
var LOGIN_CLIENT = 'Basic ZzlTMDIzdDc0NDczWlVrOTA5Rk42OEYwYjRONjdQU09oOTJvMDR2TDBCUjY1MzdwSTJ5Mmg5NE02QmJVN0Q2SjpX' +
  'NjY4NDZrUFF2MTc1MDk3NW9vZEg1TTh6QzZUYTdtMzBrSDJRNzhsMldtVTUwRkNncXBQMTN3NzczNzdrN0lC';
var TIMEOUT_MS = 30000;

function load(key, fallback) {
  try {
    var text = localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function addRun(lines) {
  var runs = load(STORE_RUNS, []);
  runs.unshift({at: new Date().toString().slice(0, 24), lines: lines});
  save(STORE_RUNS, runs.slice(0, 30));
}

// A short check value of a string, so the phone can tell whether text arrived
// unchanged without anyone seeing it. The page uses the same function.
function checkOf(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return s.length + ':' + h.toString(16);
}

// Text with the characters that can break a URL: # & % + = ? / space, an
// accented letter and an emoji.
function trickyText() {
  return 'a#b&c%d+e=f?g/h i:' + String.fromCharCode(233) + String.fromCharCode(0xD83D, 0xDE00) + '%41%';
}

// ------------------------------------------------------------------ the page

function pageMain(S) {
  var $ = function(id) { return document.getElementById(id); };

  // Earlier runs, newest first.
  var box = $('runs');
  if (S.busy) {
    var b = document.createElement('div');
    b.className = 'run busy';
    b.textContent = 'The sign-in test started at ' + S.busy + ' is still running (or was stopped). ' +
      'Keep RP Probe open on the watch and open this page again in a minute.';
    box.appendChild(b);
  }
  if (!S.runs.length && !S.busy) {
    box.textContent = 'No results yet.';
  }
  S.runs.forEach(function(run) {
    var d = document.createElement('div');
    d.className = 'run';
    d.textContent = run.at + '\n' + run.lines.join('\n');
    box.appendChild(d);
  });

  function checkOf(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    }
    return s.length + ':' + h.toString(16);
  }

  // Made-up bundle-like JSON of about kb * 1024 characters: event rows with
  // quotes and commas, like a real schedule, so the URL grows the same way.
  function fakeBundle(kb) {
    var titles = ['Trivia: Movie Quotes', 'Latin Dance Class', 'Pool Games', 'Karaoke', 'Art Auction Preview',
                  'Voices (18+)', 'Family Shuffleboard', 'Jazz on 4', 'Sip & Paint', 'Ice Show: 365'];
    var venues = ['Royal Promenade', 'Pool Deck', 'Studio B', 'Jazz on 4', 'Vintages', 'Royal Theater'];
    var events = [];
    var len = 0;
    var i = 0;
    while (len < kb * 1024) {
      var e = [titles[i % titles.length] + ' ' + i, 600 + (i * 15) % 1200, 45, i % 6,
               venues[i % venues.length], i % 5 ? null : 3, 'P' + (1000 + i % 400)];
      events.push(e);
      len += JSON.stringify(e).length + 1;
      i++;
    }
    return {format: 'cruise-watch', v: 1, fake: true, schedule: {events: events}, end: 'END'};
  }

  function close(result) {
    result.tricky = S.tricky;
    result.trickyCheck = checkOf(S.tricky);
    document.location = 'pebblejs://close#' + encodeURIComponent(JSON.stringify(result));
  }

  $('sendBig').onclick = function() {
    var kb = parseInt($('bigKB').value, 10);
    var bundle = fakeBundle(kb);
    var text = JSON.stringify(bundle);
    var urlChars = encodeURIComponent(JSON.stringify({test: 'big', kb: kb, bundle: bundle})).length;
    $('bigNote').textContent = 'Sending ' + Math.round(text.length / 1024) + ' KB of JSON (' +
      Math.round(urlChars / 1024) + ' KB in the URL)...';
    close({test: 'big', kb: kb, jsonChars: text.length, urlChars: urlChars, check: checkOf(text), bundle: bundle});
  };

  $('signIn').onclick = function() {
    var email = $('email').value.trim();
    var password = $('password').value;
    if (!email || !password) {
      $('signNote').textContent = 'Type your email and password first.';
      return;
    }
    $('password').value = '';
    close({test: 'login', email: email, password: password, passwordCheck: checkOf(password),
           bookings: $('bookings').checked});
  };

  $('trickyOnly').onclick = function() {
    close({test: 'tricky'});
  };
}

var CSS = 'body{font:16px sans-serif;margin:12px;background:#fff;color:#111}' +
  'h1{font-size:20px}h2{font-size:17px;margin:20px 0 6px}p{margin:6px 0}' +
  'button{display:inline-block;margin:6px 4px 6px 0;padding:10px 12px;font-size:15px;border:1px solid #888;' +
  'border-radius:8px;background:#eef;color:#003}' +
  'input[type=email],input[type=password],select{font-size:16px;padding:8px;width:100%;box-sizing:border-box;margin:4px 0}' +
  '.card{margin:10px 0;padding:10px;border:1px solid #ddd;border-radius:8px}' +
  '.run{white-space:pre-wrap;font:12px monospace;background:#f6f6f6;padding:8px;margin:6px 0;border-radius:6px}' +
  '.busy{background:#fff4d6}.small{font-size:13px;color:#444}';

function buildPage(state) {
  var json = JSON.stringify(state).split('<').join(String.fromCharCode(92) + 'u003c');
  var sizes = [64, 128, 192, 256, 384, 512, 768, 1024];
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>RP Probe</title><style>' + CSS + '</style></head><body>' +
    '<h1>RP Probe 2</h1>' +
    '<p class="small">Keep RP Probe open on the watch while you test: the phone script only runs then. ' +
    'Each button closes this page; open it again to see the result at the top.</p>' +
    '<h2>Results</h2><div id="runs"></div>' +
    '<h2>1. Big result back</h2><div class="card">' +
    '<p>Sends a made-up cruise bundle of this size back to the phone script, the way Save sends a pasted ' +
    'bundle. Start at 128 KB and go up until one fails.</p>' +
    '<select id="bigKB">' + sizes.map(function(kb) {
      return '<option value="' + kb + '"' + (kb === 128 ? ' selected' : '') + '>' + kb + ' KB</option>';
    }).join('') + '</select>' +
    '<button id="sendBig">Send back and close</button><p class="small" id="bigNote"></p></div>' +
    '<h2>2. Royal sign-in</h2><div class="card">' +
    '<p>Signs in to Royal Caribbean once from the phone script, then (if ticked) asks for your bookings ' +
    'list. The result shows only status codes, a booking count and yes/no checks.</p>' +
    '<p class="small">Your email and password go from this page to RP Probe\'s phone script inside the ' +
    'Pebble app, and from there only to Royal Caribbean. Nothing saves or logs them.</p>' +
    '<input type="email" id="email" placeholder="Royal email" autocomplete="off" autocapitalize="off" spellcheck="false">' +
    '<input type="password" id="password" placeholder="Royal password" autocomplete="off">' +
    '<label><input type="checkbox" id="bookings" checked> Also fetch the bookings list</label><br>' +
    '<button id="signIn">Sign in test and close</button><p class="small" id="signNote"></p></div>' +
    '<h2>3. Special characters only</h2><div class="card">' +
    '<p>Sends test text with # &amp; % + = ? / and an emoji back, with no login. (Tests 1 and 2 check it too.)</p>' +
    '<button id="trickyOnly">Send and close</button></div>' +
    '<script>(' + pageMain.toString() + ')(' + json + ');</script></body></html>';
}

// ------------------------------------------------------------- phone script

// The page's result: the Pebble app may hand it over still URL-encoded or
// already decoded, so try both and say which.
function readResponse(text) {
  try {
    return {r: JSON.parse(decodeURIComponent(text)), how: 'URL-encoded'};
  } catch (e) {}
  try {
    return {r: JSON.parse(text), how: 'already decoded'};
  } catch (e2) {}
  return {r: null, how: 'unreadable'};
}

function trickyLine(r) {
  if (typeof r.tricky !== 'string') {
    return 'Special characters: not sent';
  }
  var ok = r.tricky === trickyText() && checkOf(r.tricky) === r.trickyCheck;
  return 'Special characters (# & % + = ? / emoji): ' + (ok ? 'arrived intact' : 'CHANGED on the way');
}

function bigResult(r, rawChars, how) {
  var lines = ['Big result: ' + r.kb + ' KB asked'];
  lines.push('Page sent ' + Math.round(r.jsonChars / 1024) + ' KB of JSON, ' +
             Math.round(r.urlChars / 1024) + ' KB in the URL');
  lines.push('Phone got ' + Math.round(rawChars / 1024) + ' KB (' + how + ')');
  var text = r.bundle ? JSON.stringify(r.bundle) : '';
  var whole = r.bundle && r.bundle.end === 'END' && checkOf(text) === r.check;
  lines.push(whole ? 'OK: the bundle arrived whole' : 'FAILED: the bundle arrived cut or changed');
  lines.push(trickyLine(r));
  addRun(lines);
}

// Reads the account id from the token's middle part (base64url JSON), without
// keeping the token.
function accountOf(token) {
  var part = String(token || '').split('.')[1] || '';
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  var bits = 0;
  var value = 0;
  var out = '';
  for (var i = 0; i < part.length; i++) {
    var n = chars.indexOf(part.charAt(i));
    if (n < 0) {
      continue;
    }
    value = ((value << 6) | n) & 0xFFFFFF;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 255);
    }
  }
  try {
    return JSON.parse(out).sub || null;
  } catch (e) {
    return null;
  }
}

function statusWord(status) {
  if (status === 200) return 'OK';
  if (status === 403) return 'BLOCKED (403)';
  if (status === 400 || status === 401) return 'refused the login (' + status + ': wrong email or password?)';
  if (status === 0) return 'no answer (network error or blocked before reaching Royal)';
  return 'error ' + status;
}

function request(method, url, headers, body, done) {
  var xhr = new XMLHttpRequest();
  var started = Date.now();
  var finished = false;
  function end(status, text, note) {
    if (finished) return;
    finished = true;
    done(status, text, Date.now() - started, note);
  }
  try {
    xhr.open(method, url, true);
    Object.keys(headers).forEach(function(k) {
      xhr.setRequestHeader(k, headers[k]);
    });
    xhr.timeout = TIMEOUT_MS;
    xhr.onload = function() { end(xhr.status, xhr.responseText, ''); };
    xhr.onerror = function() { end(0, '', 'network error'); };
    xhr.ontimeout = function() { end(0, '', 'timed out after ' + TIMEOUT_MS / 1000 + ' s'); };
    xhr.send(body);
  } catch (e) {
    end(0, '', 'could not send: ' + e.message);
  }
}

function loginTest(r, how) {
  var lines = ['Royal sign-in (' + how + ')'];
  var intact = typeof r.password === 'string' && checkOf(r.password) === r.passwordCheck;
  lines.push('Password arrived intact: ' + (intact ? 'yes' : 'NO'));
  lines.push(trickyLine(r));
  var body = 'grant_type=password&username=' + encodeURIComponent(r.email || '') +
    '&password=' + encodeURIComponent(r.password || '') + '&scope=openid+profile+email+vdsid';
  var wantBookings = !!r.bookings;
  r.email = r.password = null;
  save(STORE_BUSY, new Date().toString().slice(16, 24));

  function finish() {
    save(STORE_BUSY, null);
    addRun(lines);
  }

  request('POST', LOGIN_URL, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': LOGIN_CLIENT,
    'Accept': 'application/json'
  }, body, function(status, text, ms, note) {
    body = null;
    lines.push('Sign-in: ' + statusWord(status) + ', ' + ms + ' ms' + (note ? ', ' + note : ''));
    var token = null;
    if (status === 200) {
      try {
        token = JSON.parse(text).access_token || null;
      } catch (e) {}
    }
    text = null;
    var account = token ? accountOf(token) : null;
    if (status === 200) {
      lines.push('Token: ' + (token ? 'received' : 'MISSING') + ', account id ' + (account ? 'read' : 'NOT read'));
    }
    if (!token || !account || !wantBookings) {
      finish();
      return;
    }
    request('GET', API + '/v1/profileBookings/enriched/' + encodeURIComponent(account) +
            '?brand=R&includeCheckin=true', {
      'AppKey': APPKEY,
      'Accept': 'application/json',
      'Access-Token': token,
      'account-id': account,
      'vds-id': account
    }, null, function(status2, text2, ms2, note2) {
      token = account = null;
      lines.push('Bookings list: ' + statusWord(status2) + ', ' + ms2 + ' ms' + (note2 ? ', ' + note2 : ''));
      if (status2 === 200) {
        var count = null;
        try {
          var list = (JSON.parse(text2).payload || {}).profileBookings;
          count = list ? list.length : null;
        } catch (e) {}
        lines.push(count === null ? 'Bookings: reply not readable' : 'Bookings on the account: ' + count);
      }
      text2 = null;
      finish();
    });
  });
}

Pebble.addEventListener('showConfiguration', function() {
  var state = {runs: load(STORE_RUNS, []), busy: load(STORE_BUSY, null), tricky: trickyText()};
  Pebble.openURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildPage(state)));
});

Pebble.addEventListener('webviewclosed', function(e) {
  var text = (e && e.response) || '';
  if (!text) {
    addRun(['Page closed with no result (backed out, or the result was too big to arrive at all)']);
    return;
  }
  var got = readResponse(text);
  var r = got.r;
  if (!r) {
    addRun(['Result not readable: ' + Math.round(text.length / 1024) + ' KB arrived (probably cut short)']);
  } else if (r.test === 'big') {
    bigResult(r, text.length, got.how);
  } else if (r.test === 'login') {
    loginTest(r, got.how);
  } else {
    addRun(['Special characters only (' + got.how + ')', trickyLine(r)]);
  }
});

Pebble.addEventListener('ready', function() {
  console.log('RP Probe 2 ready');
});
