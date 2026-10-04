# Google Play artwork sources

| Source | Output in `mobile/fastlane/metadata/android/en-US/images/` | Play's requirement |
|---|---|---|
| [`icon.svg`](icon.svg) | `icon.png` | 512 × 512, 32-bit PNG, full-bleed square |
| [`feature-graphic.html`](feature-graphic.html) | `featureGraphic.png` | 1024 × 500, 24-bit PNG without alpha |

The icon is the adaptive launcher icon flattened to a square: the paths come from `mobile/android/app/src/main/res/drawable/ic_launcher_foreground.xml` on the `#FF5A1F` launcher background. The feature graphic uses the fonts bundled with the app (`mobile/android/app/src/main/assets/fonts`).

To regenerate both after editing a source (needs Python 3.10+ with Pillow, and Chrome, Edge or Chromium):

```bash
python -m pip install pillow
python docs/play-store/assets-src/render.py
```

The script renders each source with a headless browser, writes the PNGs and checks their size, mode and file size against Play's limits. Set `CHROME` to the browser's executable if it isn't found.

## Phone screenshots

`images/phoneScreenshots/*.png` are real screenshots of the release build (1080 × 1920, saved as 24-bit PNG without alpha), taken on an Android 16 emulator with a demo account and a clean status bar. Play shows them in file-name order. When the UI changes, retake them the same way: keep 9:16, at least 1080 px wide, and no more than 8 per device type.
