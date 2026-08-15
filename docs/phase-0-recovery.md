# Phase 0 recovery record

## Source of truth

The original root deployment is preserved unchanged. `index.html` loads `assets/index-Dbj87c_d.js` and `assets/index-DF9LG9jk.css`. The active JavaScript passed `node --check` before recovery.

`reference-manifest.sha256` records the preserved root artifact for rollback/integrity checks.

The reconstructed source was derived from that active bundle. Orphaned hashed JavaScript files were not treated as authoritative.

React Router was patched from the recovered bundle's 7.13.1 to 7.18.2 after the package audit identified high-severity advisories affecting the older version. The public browser-routing API used by this site is unchanged.

Vite was likewise patched within version 7 to 7.3.6 to clear development-server advisories reported during Phase 0 verification.

## Preserved behavior

- Routes: `/`, `/about`, `/services`, `/contact`, `/appointment`.
- Existing content, layout classes, responsive breakpoints, navigation, transitions, and images.
- Contact and appointment forms retain their temporary client-side success states.
- Appointment fields remain service, date, time, and patient information; no doctor selection was introduced.

## Deliberate Phase 0 boundaries

- No API calls.
- No authentication or authorization.
- No database or ORM.
- No admin/staff dashboard.
- No notifications or email.
- No real appointment or contact persistence.

## Styling recovery

The exact compiled Tailwind CSS 4.2.1 artifact was copied to `frontend/src/styles/recovered.css`. This freezes the deployed visual language during source recovery and prevents a Tailwind regeneration from silently changing the UI. A future deliberate styling-tool migration requires its own visual review and is not part of Phase 0.

## Parity method

`scripts/serve-static.mjs` serves both the immutable root deployment and `frontend/dist` with identical SPA fallback behavior. Phase 0 route checks and fixed-size browser screenshots use these two servers as the comparison targets.

The deployed bundle uses hash routing (`/#/about`), despite the conceptual routes being listed as `/about`. The recovered frontend uses clean browser routes and its static server provides SPA fallback. Visual checks compare equivalent route states.

All five routes produced exact screenshot hashes against the deployed reference at both 1440×900 and 390×844 after reconstruction.

## Final verification

- `npm run check`: passed with no ESLint findings.
- `npm run build`: passed with Vite 7.3.6; 2,095 modules transformed.
- Output: 0.40 kB HTML, 40.06 kB CSS, and 400.88 kB JavaScript before gzip.
- `npm audit`: zero known vulnerabilities after non-breaking dependency patches.
- Reference integrity: every preserved root artifact matches `reference-manifest.sha256`.
- Boundary scan: no frontend API calls and no doctor-selection field.
