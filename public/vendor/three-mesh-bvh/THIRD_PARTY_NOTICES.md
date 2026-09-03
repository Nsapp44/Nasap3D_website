# Third-party notice for `index.module.js`

`index.module.js` is [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) v0.9.14's own
bundled ESM build (`https://unpkg.com/three-mesh-bvh@0.9.14/build/index.module.js`, MIT — see
`LICENSE.md`), fetched and vendored here verbatim except for one patch: its `import ... from
'three'` (a bare specifier, unresolvable by a browser with no bundler/import map) was rewritten to
the absolute path of this project's own vendored three.js, `/vendor/three/three.module.min.js` —
same reasoning as the path patches documented in `public/vendor/kiri/THIRD_PARTY_NOTICES.md`.

Used to accelerate the thin-wall check (`src/hooks/useQuoteWizard.ts`'s `checkThinWalls`) with a
real BVH instead of brute-force per-triangle raycasting, letting it test far more of a mesh (up to
the whole thing) in the same time budget that used to only cover a sparse sample.
