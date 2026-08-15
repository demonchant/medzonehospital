# Medzone Hospital

This workspace contains the recovered Medzone frontend source and the Medzone implementation through Master Roadmap Phase 18.

The deployed files at the repository root are the immutable Phase 0 reference/rollback baseline. The maintainable frontend lives in `frontend/` and connects the existing contact, service-catalog, authentication, availability, and booking presentation to the backend with Phase 17 loading, retry, safe-error, session-expiry, and success states. Phase 18 adds bounded frontend component and contract regression coverage without changing product behavior. The `backend/` runtime includes the PostgreSQL-backed hospital workflows, Phase 12 notification outbox, and Phase 13 SMTP delivery worker. See the phase records in `docs/` for exact boundaries.

## Development

Requirements: Node.js 20.19+ or 22.12+ and npm.

```text
npm install
npm run dev
npm run check
npm run build
npm run backend:dev
npm run backend:test
npm run email:worker
npm run db:status
npm run db:migrate
```

See the phase records in `docs/` for boundaries and verification details.
