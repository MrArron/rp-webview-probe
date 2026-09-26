// RP Probe: a throwaway watch app whose only job is to open a test settings
// page in the Pebble app, to find out what its WebView allows (files, sharing,
// clipboard, page size). See tools/webview-probe/README.md.

#include <pebble.h>

static Window *s_window;
static TextLayer *s_text;

static void window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect b = layer_get_bounds(root);
  s_text = text_layer_create(GRect(8, 40, b.size.w - 16, b.size.h - 48));
  text_layer_set_font(s_text, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_text_alignment(s_text, GTextAlignmentCenter);
  text_layer_set_text(s_text, "RP Probe\n\nOpen this app's settings in the Pebble app on your phone.");
  layer_add_child(root, text_layer_get_layer(s_text));
}

static void window_unload(Window *window) {
  text_layer_destroy(s_text);
}

int main(void) {
  s_window = window_create();
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload
  });
  window_stack_push(s_window, true);
  app_event_loop();
  window_destroy(s_window);
}
