[![make.fun](https://make.fun/badge/news-image-20261117.svg)](https://make.fun/bounty/news-image-20261117)
[![rank](https://make.fun/badge/news-image-20261117/leoether/news-image-20261117/rank.svg)](https://make.fun/bounty/news-image-20261117)
[![reward](https://make.fun/badge/news-image-20261117/leoether/news-image-20261117/reward.svg)](https://make.fun/bounty/news-image-20261117)

# The World in One Day — 17 November 2026

A [make.fun](https://make.fun/bounty/news-image-20261117) entry for
`news-image-20261117`: a Node 22, standard-library-only program that draws one
1024×1024 PNG summing up the real world news of Tuesday, 17 November 2026 and
writes it to `/output/entry.png`.

## The day's news in the image

1. **Kerch Bridge span falls** — a Ukrainian strike collapses a road section
   of the bridge to Crimea; Russian missiles hit Kyiv's bridges the same day.
2. **Tankers hit by mines** — two oil tankers catch fire near the Strait of
   Hormuz.
3. **Xi, Trump, Putin to meet** — a first three-way meeting is confirmed for
   Thursday in Shenzhen, on the APEC sidelines.
4. **Japan scrambles jets** — suspected Russian aircraft violate Japanese
   airspace; Tokyo protests strongly.
5. **JPMorgan outage hits banking** — a software bug slows online banking and
   Zelle payments.
6. **Rocket fails, 40 satellites lost** — a ULA Vulcan failure destroys Amazon
   satellites.

Also noted in the footer: Depardieu admits a sexual-assault charge, Mongolia's
president says he will resign, the US loses measles-elimination status, and 17
people are killed in two shootings in South Africa.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

No network, no randomness, no clock: two runs write byte-identical PNGs.
The image is drawn entirely in code (a small built-in rasterizer and a 5×7
bitmap font) — no copied photographs or artwork.

## License

MIT — see [LICENSE](LICENSE).
