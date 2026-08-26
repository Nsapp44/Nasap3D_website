// Loads an ES module from a plain runtime URL (e.g. a file under public/)
// without Vite trying to statically analyze/bundle it. A literal
// `import(url)` in source — even with /* @vite-ignore */ — is still
// rejected by Vite's dev server for any path under public/ ("Cannot import
// non-asset file ... JS/CSS files inside /public are copied as-is on
// build"). Building the import() call inside a `new Function(...)` body
// hides it from Vite's source-level scanner entirely (it only sees a
// string), so the browser's native dynamic import() handles it as a plain
// runtime module fetch, exactly like every .dc.html page's own
// `import('./viewer3d.js')` did.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- return shape depends entirely on the loaded module
export function dynamicImport(url: string): Promise<any> {
  return new Function("u", "return import(u)")(url);
}
