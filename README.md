# 🧪 Trylledrik

Kombucha fermentation tracker — *trylledrik* is Danish for "magic potion".

**App:** https://nichlaes.github.io/trylledrik/ — open on your iPhone and
"Add to Home Screen".

Tracks batches through first fermentation (F1, jar) and second fermentation
(F2, bottles). At each stage it generates an `.ics` calendar file — tap it,
"Add All", and your calendar reminds you to bottle, burp bottles daily during
F2, and move them to the fridge. Flavorings, tasting notes, and ratings are
kept in History so you learn which brews work.

All data lives in your browser's localStorage (Settings → Export for backups).
No server, no accounts, no dependencies.

## Development

    python3 -m http.server 8000   # serve locally
    npm test                      # unit tests (Node ≥ 18)

Deploys automatically via GitHub Pages on push to `main`. When changing any
cached asset, bump `CACHE` in `sw.js`.
