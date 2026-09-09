# Blinker

Designed by Dalton Maag. Licensed under the **SIL Open Font License 1.1**
(<https://openfontlicense.org/>), which permits redistribution and embedding in
a website.

The `.woff2` files here were taken from the Google Fonts CSS API and are
self-hosted rather than linked, so the site has no third-party font request on
the critical path and renders identically offline. The `unicode-range` values in
`src/styles/fonts.css` are copied verbatim from that API response, so a visitor
only downloads the `latin-ext` subset if the page actually needs it.

To refresh: request
`https://fonts.googleapis.com/css2?family=Blinker:wght@200;400;600;800`
with a modern browser user-agent, download the `woff2` URLs it returns, and
update `src/styles/fonts.css` to match.
