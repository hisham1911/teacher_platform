# ADR 012 — Persistent student portal identity and activity binding

**Status:** Accepted  
**Date:** 2026-09-01

## Context

English Spark originally supported anonymous/guest activity participation through a session `JoinCode` and an HttpOnly guest cookie. A later managed-student roster introduced a tenant-scoped `StudentCode`, but that code was designed to bind a known student to an activity participant; it was not a standalone platform login credential.

As the product evolved from a quiz tool into a multi-tenant learning platform, students needed a persistent surface that exists independently of any one activity. Reusing either `JoinCode` or the legacy `StudentCode` as the portal credential would mix activity routing with identity and would make the product harder to reason about and secure.

## Decision

English Spark has four distinct user surfaces:

- `/` — public/marketing surface.
- `/student` and `/student/home` — persistent student portal.
- `/join` — quick activity join using an activity/session code or link.
- `/dashboard` — teacher/academy Studio.

A persistent student is authenticated by a dedicated `StudentPortalCredential`; portal browser continuity is represented by `StudentPortalSession`.

### Student access credential

The raw student access code is generated with cryptographically secure randomness and is shown only when created or rotated.

The database stores:

- a deterministic lookup digest used to locate the credential without storing the raw code;
- a password-style verifier hash used to verify the supplied code;
- a short non-secret suffix for teacher-side identification;
- lifecycle metadata such as creation/revocation timestamps.

The raw access code is never persisted. If it is lost, the teacher rotates it rather than retrieving it.

The portal access code is separate from the legacy tenant-scoped `StudentCode`. The legacy code remains for backwards compatibility with the existing managed-join flow.

### Portal session

Successful portal login creates an opaque random session token. Only its hash is persisted. The browser receives the opaque token in an HttpOnly cookie.

Portal sessions are revoked when:

- the student logs out;
- the portal access credential is rotated or revoked;
- the student is deactivated;
- the session expires.

### Activity binding

A portal login does not itself create an activity participant or attempt.

When a logged-in student opens `/play/{joinCode}`, the player first preserves the existing guest-resume behavior. If no guest participant is already bound, it may call the managed portal join endpoint. The server resolves the portal session, verifies that the student and activity belong to the same tenant, and then delegates to the same managed-student join service used by the legacy `StudentCode` path.

This keeps scoring, attempts, resume semantics, and participant ownership in one implementation instead of creating a second player engine for portal users.

Cross-tenant portal binding is returned as not found/unauthorized without exposing another tenant's student or session data.

### Quick join and guest compatibility

`/join` is only an activity-entry surface. It must not ask for a student portal credential.

Anonymous guests remain supported. A browser without a valid student portal session can still join an active session using a display name and receives the existing HttpOnly guest cookie. Existing guest resume, SelfPaced, Progressive, and Live behavior must remain regression-covered.

## Consequences

### Positive

- Student identity is no longer coupled to one activity.
- `Activity JoinCode`, legacy `StudentCode`, and `Student Portal Access Code` have explicit, non-overlapping responsibilities.
- The product can add assignments/classes later without replacing the player engine.
- Portal credentials can be rotated/revoked without changing historical student results.
- Tenant boundaries are enforced at the server during activity binding.

### Trade-offs

- There are temporarily two managed-student code concepts while the legacy `StudentCode` remains supported.
- The teacher UI must explain that the legacy activity-linking code and the portal access code are different.
- Portal login requires additional credential/session tables and lifecycle cleanup.

## Security invariants

1. Never persist or log the raw portal access code or raw portal session token.
2. Never use a client-supplied tenant id to authorize a portal identity.
3. A portal student may only bind to activities in the student's tenant.
4. Rotating/revoking access invalidates existing portal sessions.
5. Deactivated students cannot establish or continue portal access.
6. Portal login is rate-limited.
7. The existing server-authoritative scoring and attempt rules remain unchanged.
8. Guest participation remains isolated from portal authentication and continues to use the existing guest security model documented in ADR 007.

## Follow-up boundary

Classes and Assignments are intentionally not part of this ADR or Phase 1. Phase 1 establishes identity, student home, activity auto-binding, and compatibility. Assignment delivery will build on this identity layer in the next product phase rather than being emulated with session history.
