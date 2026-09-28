// RP Probe, round 3: offline dictation test for Royal Pebble Phase 5 (voice).
// Select starts a dictation session and the screen shows what came back: the
// status, how long it took and the text. Run it with the phone in airplane mode
// (Bluetooth on) to see whether the Pebble app transcribes on the phone.
// Up/Down pick a test phrase to say; hold Select opens the saved history.
// The last results are kept in persistent storage so they survive closing the app.
// No strlen()/strtol(): both faulted on real Pebble Time 2 hardware.

#include <pebble.h>

#define TEXT_MAX 96
#define HIST_MAX 8
#define KEY_HIST 1
#define KEY_COUNT 2
#define KEY_PHRASE 3

typedef struct {
  uint8_t status;       // DictationSessionStatus
  uint8_t phrase;       // index into s_phrases
  uint8_t phone;        // 1 if the Pebble app was connected at the start
  uint8_t pad;
  uint32_t ms;          // start to callback
  char text[TEXT_MAX];  // heard text (cut to fit), empty on failure
} Result;

typedef struct {
  uint8_t n;            // results saved (up to HIST_MAX), newest first
  Result r[HIST_MAX];
} History;

static const char *s_phrases[] = {
  "How do I get to the Windjammer",
  "Royal Promenade to my cabin",
  "Closest restroom",
  "I'm at Studio B",
  "I'm in cabin 8123",
  "Boardwalk to the Solarium",
  "(say anything)",
};
#define PHRASE_COUNT ((int)(sizeof(s_phrases) / sizeof(s_phrases[0])))

static Window *s_window;
static TextLayer *s_head, *s_say, *s_result, *s_hint;
static Window *s_hist_window;
static ScrollLayer *s_hist_scroll;
static TextLayer *s_hist_text;

static DictationSession *s_session;
static History s_hist;
static int s_attempts;
static int s_phrase;
static uint64_t s_started;
static bool s_started_phone;

static char s_head_buf[48];
static char s_say_buf[80];
static char s_result_buf[200];
static char s_hist_buf[HIST_MAX * 190 + 32];

static const char *status_name(int st) {
  switch (st) {
    case DictationSessionStatusSuccess: return "OK";
    case DictationSessionStatusFailureTranscriptionRejected: return "Cancelled";
    case DictationSessionStatusFailureTranscriptionRejectedWithError: return "Cancelled after error";
    case DictationSessionStatusFailureSystemAborted: return "System aborted";
    case DictationSessionStatusFailureNoSpeechDetected: return "No speech detected";
    case DictationSessionStatusFailureConnectivityError: return "CONNECTIVITY error";
    case DictationSessionStatusFailureDisabled: return "Dictation disabled";
    case DictationSessionStatusFailureInternalError: return "Internal error";
    case DictationSessionStatusFailureRecognizerError: return "RECOGNIZER error";
    default: return "Unknown status";
  }
}

static uint64_t now_ms(void) {
  time_t s;
  uint16_t ms;
  time_ms(&s, &ms);
  return (uint64_t)s * 1000 + ms;
}

// Copies up to max-1 chars and always terminates (no strlen/strncpy).
static void copy_text(char *dst, const char *src, int max) {
  int i = 0;
  if (src) {
    while (i < max - 1 && src[i]) { dst[i] = src[i]; i++; }
  }
  dst[i] = 0;
}

static bool phone_connected(void) {
  return connection_service_peek_pebble_app_connection();
}

static void update_head(void) {
  int ok = 0;
  for (int i = 0; i < s_hist.n; i++) {
    if (s_hist.r[i].status == DictationSessionStatusSuccess) ok++;
  }
  snprintf(s_head_buf, sizeof(s_head_buf), "Voice test  %d/%d OK\nPhone: %s",
           ok, s_hist.n, phone_connected() ? "connected" : "AWAY");
  text_layer_set_text(s_head, s_head_buf);
}

static void update_say(void) {
  snprintf(s_say_buf, sizeof(s_say_buf), "SAY (%d/%d)\n%s",
           s_phrase + 1, PHRASE_COUNT, s_phrases[s_phrase]);
  text_layer_set_text(s_say, s_say_buf);
}

static void show_result(const Result *r) {
  if (r->status == DictationSessionStatusSuccess) {
    snprintf(s_result_buf, sizeof(s_result_buf), "OK in %lu.%lus\nHEARD: %s",
             (unsigned long)(r->ms / 1000), (unsigned long)(r->ms % 1000 / 100), r->text);
  } else {
    snprintf(s_result_buf, sizeof(s_result_buf), "%s (%d)\nafter %lu.%lus",
             status_name(r->status), r->status,
             (unsigned long)(r->ms / 1000), (unsigned long)(r->ms % 1000 / 100));
  }
  text_layer_set_text(s_result, s_result_buf);
}

static void save_history(void) {
  persist_write_data(KEY_HIST, &s_hist, sizeof(s_hist));
  persist_write_int(KEY_COUNT, s_attempts);
}

static void add_result(const Result *r) {
  int n = s_hist.n < HIST_MAX ? s_hist.n + 1 : HIST_MAX;
  for (int i = n - 1; i > 0; i--) s_hist.r[i] = s_hist.r[i - 1];
  s_hist.r[0] = *r;
  s_hist.n = n;
  s_attempts++;
  save_history();
}

static void dictation_cb(DictationSession *session, DictationSessionStatus status,
                         char *transcription, void *context) {
  Result r;
  memset(&r, 0, sizeof(r));
  r.status = (uint8_t)status;
  r.phrase = (uint8_t)s_phrase;
  r.phone = s_started_phone ? 1 : 0;
  r.ms = (uint32_t)(now_ms() - s_started);
  if (status == DictationSessionStatusSuccess) copy_text(r.text, transcription, TEXT_MAX);
  APP_LOG(APP_LOG_LEVEL_INFO, "dictation status=%d ms=%lu phone=%d",
          (int)status, (unsigned long)r.ms, r.phone);
  add_result(&r);
  show_result(&r);
  update_head();
  vibes_short_pulse();
}

static void start_dictation(void) {
  if (!s_session) {
    text_layer_set_text(s_result, "This watch has no dictation (no microphone?).");
    return;
  }
  s_started_phone = phone_connected();
  s_started = now_ms();
  text_layer_set_text(s_result, "Listening...");
  dictation_session_start(s_session);
}

// ---- History window ----

static void build_history_text(void) {
  int len = 0;
  int cap = (int)sizeof(s_hist_buf);
  len += snprintf(s_hist_buf + len, cap - len, "%d tries in total, newest first\n\n", s_attempts);
  for (int i = 0; i < s_hist.n && len < cap - 1; i++) {
    const Result *r = &s_hist.r[i];
    len += snprintf(s_hist_buf + len, cap - len, "%d. %s, %lu.%lus, phone %s\nSaid: %s\n%s%s\n\n",
                    i + 1, status_name(r->status),
                    (unsigned long)(r->ms / 1000), (unsigned long)(r->ms % 1000 / 100),
                    r->phone ? "on" : "away",
                    s_phrases[r->phrase < PHRASE_COUNT ? r->phrase : 0],
                    r->status == DictationSessionStatusSuccess ? "Heard: " : "",
                    r->text);
  }
  if (s_hist.n == 0) {
    snprintf(s_hist_buf + len, cap - len, "No results yet.");
  }
}

static void hist_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect b = layer_get_bounds(root);
  s_hist_scroll = scroll_layer_create(b);
  scroll_layer_set_click_config_onto_window(s_hist_scroll, window);
  build_history_text();
  s_hist_text = text_layer_create(GRect(6, 4, b.size.w - 12, 2000));
  text_layer_set_font(s_hist_text, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text(s_hist_text, s_hist_buf);
  GSize sz = text_layer_get_content_size(s_hist_text);
  text_layer_set_size(s_hist_text, GSize(b.size.w - 12, sz.h + 8));
  scroll_layer_set_content_size(s_hist_scroll, GSize(b.size.w, sz.h + 16));
  scroll_layer_add_child(s_hist_scroll, text_layer_get_layer(s_hist_text));
  layer_add_child(root, scroll_layer_get_layer(s_hist_scroll));
}

static void hist_unload(Window *window) {
  text_layer_destroy(s_hist_text);
  scroll_layer_destroy(s_hist_scroll);
  window_destroy(s_hist_window);
  s_hist_window = NULL;
}

static void show_history(void) {
  s_hist_window = window_create();
  window_set_window_handlers(s_hist_window, (WindowHandlers) {
    .load = hist_load,
    .unload = hist_unload
  });
  window_stack_push(s_hist_window, true);
}

// ---- Main window ----

static void select_click(ClickRecognizerRef rec, void *ctx) { start_dictation(); }
static void select_long(ClickRecognizerRef rec, void *ctx) { show_history(); }

static void up_click(ClickRecognizerRef rec, void *ctx) {
  s_phrase = (s_phrase + PHRASE_COUNT - 1) % PHRASE_COUNT;
  persist_write_int(KEY_PHRASE, s_phrase);
  update_say();
}

static void down_click(ClickRecognizerRef rec, void *ctx) {
  s_phrase = (s_phrase + 1) % PHRASE_COUNT;
  persist_write_int(KEY_PHRASE, s_phrase);
  update_say();
}

static void click_config(void *ctx) {
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click);
  window_long_click_subscribe(BUTTON_ID_SELECT, 700, select_long, NULL);
  window_single_click_subscribe(BUTTON_ID_UP, up_click);
  window_single_click_subscribe(BUTTON_ID_DOWN, down_click);
}

static TextLayer *make_text(Layer *root, GRect f, const char *font, GColor fg) {
  TextLayer *t = text_layer_create(f);
  text_layer_set_font(t, fonts_get_system_font(font));
  text_layer_set_text_color(t, fg);
  text_layer_set_background_color(t, GColorClear);
  text_layer_set_overflow_mode(t, GTextOverflowModeTrailingEllipsis);
  layer_add_child(root, text_layer_get_layer(t));
  return t;
}

static void app_connection_handler(bool connected) { update_head(); }

static void window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect b = layer_get_bounds(root);
  int w = b.size.w - 12;
  s_head = make_text(root, GRect(6, 0, w, 44), FONT_KEY_GOTHIC_18_BOLD, GColorBlack);
  s_say = make_text(root, GRect(6, 44, w, 56), FONT_KEY_GOTHIC_18, GColorCobaltBlue);
  s_result = make_text(root, GRect(6, 100, w, 104), FONT_KEY_GOTHIC_18_BOLD, GColorBlack);
  s_hint = make_text(root, GRect(6, b.size.h - 24, w, 22), FONT_KEY_GOTHIC_14, GColorDarkGray);
  text_layer_set_text(s_hint, "Select: speak  Up/Down: phrase  Hold: list");
  update_head();
  update_say();
  if (s_hist.n > 0) {
    show_result(&s_hist.r[0]);
  } else {
    text_layer_set_text(s_result, "Press Select and say the phrase.");
  }
}

static void window_unload(Window *window) {
  text_layer_destroy(s_head);
  text_layer_destroy(s_say);
  text_layer_destroy(s_result);
  text_layer_destroy(s_hint);
}

int main(void) {
  memset(&s_hist, 0, sizeof(s_hist));
  if (persist_exists(KEY_HIST) && persist_get_size(KEY_HIST) == (int)sizeof(s_hist)) {
    persist_read_data(KEY_HIST, &s_hist, sizeof(s_hist));
    if (s_hist.n > HIST_MAX) s_hist.n = 0;
  }
  s_attempts = persist_exists(KEY_COUNT) ? persist_read_int(KEY_COUNT) : 0;
  s_phrase = persist_exists(KEY_PHRASE) ? persist_read_int(KEY_PHRASE) : 0;
  if (s_phrase < 0 || s_phrase >= PHRASE_COUNT) s_phrase = 0;

  // The confirm screen stays off (Royal Pebble shows its own Heard/Matched step)
  // and so do the firmware's error dialogs, so every failure reaches the callback
  // with its real status.
  s_session = dictation_session_create(512, dictation_cb, NULL);
  if (s_session) {
    dictation_session_enable_confirmation(s_session, false);
    dictation_session_enable_error_dialogs(s_session, false);
  }

  connection_service_subscribe((ConnectionHandlers) {
    .pebble_app_connection_handler = app_connection_handler
  });

  s_window = window_create();
  window_set_click_config_provider(s_window, click_config);
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload
  });
  window_stack_push(s_window, true);
  app_event_loop();
  connection_service_unsubscribe();
  if (s_session) dictation_session_destroy(s_session);
  window_destroy(s_window);
}
