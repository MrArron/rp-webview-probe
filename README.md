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

**Round 3 (Royal Pebble Phase 5, voice)** tests whether dictation works with no
internet. The watch app now starts a dictation session on Select and shows the
status, how long it took and the text it heard. The confirm screen and the
firmware's error dialogs are off, so every failure shows its real status
(`CONNECTIVITY error` is the one that means "needs the internet").

1. In the Pebble app, set speech recognition to local and download the local
   package.
2. With the phone online, press Select and say the phrase on screen (Up/Down pick
   one of seven, including a made-up cabin number). This checks the app works.
3. Airplane mode on, Bluetooth back on. Repeat each phrase. **Pass = text comes
   back.**
4. Try a noisy room (TV or music on) and a few phrases away from the phone.

Hold Select for the history (last 8 results, kept after closing the app). Report
the counts and any heard text that went wrong; the history holds no personal data.

Rounds 1-2: keep RP Probe open on the watch while testing, open its settings in the Pebble
app, and reopen the page after each test to read the result at the top.
