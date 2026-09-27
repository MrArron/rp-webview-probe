# RP Probe

Throwaway Pebble Time 2 app for testing what the Pebble app's settings WebView
allows on the owner's Android phone. Will be deleted after the tests.

**Round 1 (2026-09-26)** tested saving files, sharing, copying large text, the
internet and page size, to decide how Royal Pebble's usage log gets off the phone.
Its results are in Royal Pebble's `docs/PROJECT_BRIEF.md` (Export design).

**Round 2 (Royal Pebble Phase 4)** tests two things before building on them:

1. **Big result back.** How large a result the settings page can send back to the
   phone script through `pebblejs://close#`, which is how a pasted cruise bundle
   is saved. The page sends a made-up bundle of a chosen size (64 KB to 1 MB) and
   the phone script checks that it arrived whole.
2. **Royal sign-in.** Whether Royal accepts a sign-in from the phone script (not
   blocked with a 403), and whether a password with special characters survives
   the close URL. The phone script signs in once and can fetch the bookings list.
   Results hold only status codes, timings, a booking count and yes/no checks;
   the email, password, token and Royal's replies are never saved or logged.

Keep RP Probe open on the watch while testing, open its settings in the Pebble
app, and reopen the page after each test to read the result at the top.
