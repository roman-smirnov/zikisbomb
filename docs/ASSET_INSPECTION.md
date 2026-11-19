# Asset maintenance

The runtime model is `public/assets/models/c4-2k.glb`, prepared from `source/C4.glb` inside the selected `bomb-c4-explosive-model-cs2.zip` archive. The original archive is not part of this repository and is unnecessary for normal installation, testing or play.

The prepared model is 11,817,032 bytes (source: 44,077,888), with 17,949 triangles. Body maps are reduced from 4096 to 2048 pixels. Irrelevant hand/root animation clips are removed; geometry, skin bindings, node hierarchy and transforms are preserved. The runtime replaces the separate panel material with a live 512×128 countdown texture and adds independent key highlights.

## Rebuild and compare

Requires Python 3, ImageMagick (`magick`) and your own source archive:

```sh
python3 tools/prepare_asset.py /path/to/bomb-c4-explosive-model-cs2.zip
python3 tools/compare_asset.py /path/to/bomb-c4-explosive-model-cs2.zip
npm run validate:asset
```

Preparation overwrites the runtime GLB and `asset-inspection/prepared.json`. Comparison updates `asset-inspection/preservation.json`. Validation writes its generated report under ignored `test-results/`.

The source normal map has meaningful RGB beneath zero alpha. Preparation disables alpha **before** resampling the body maps so the normal RGB survives. Preserve that safeguard.

The source model has three inherited validator warnings: missing authored tangents and two skinned meshes beneath a non-root node. The original hierarchy is retained; Babylon integration should be checked after any asset changes.

Retained source records:

- [Source GLB structure](asset-inspection/cs2-glb.json)
- [Prepared sizes, texture dimensions and SHA-256 checksums](asset-inspection/prepared.json)
- [Geometry, skin and transform preservation](asset-inspection/preservation.json)
- [Original source validator summary](asset-inspection/source-validation.json)

## Stage reflections

The six `studio-*.png` faces are inputs for baking `studio.env`; normal play loads the baked file. Keep both if maintaining the environment. To regenerate:

```sh
python3 tools/make_stage.py
npm run dev
```

In another terminal, run `node tools/bake-environment.mjs`. The bench texture is generated at runtime by [the garden scene code](../src/gardenBench.ts).

See [asset attribution and redistribution record](../public/assets/ATTRIBUTION.md).
