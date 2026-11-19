# Verification

Fresh browser evidence is generated under ignored `test-results/`. The README includes the revised title and gameplay captures.

```sh
npm ci
npm test
npm run build
npm run test:oracle
npm run validate:asset
npm run test:browser
```

The browser suite uses installed Google Chrome and the production build. It covers gameplay and numeric input, penalty/deadline ordering, real timeout/failure and explicit reveal, fullscreen and teacher controls, repeated rematches, loading recovery, audio playback/cancellation/silence, puzzle selection, projector layouts, live LCD resets and reduced-motion lighting.

Model validation currently inherits three warnings from the source; see [asset maintenance](ASSET_INSPECTION.md). Physical projector readability, teacher listening, classroom hardware performance, screen-reader use and browsers other than Chrome still need human acceptance testing.
