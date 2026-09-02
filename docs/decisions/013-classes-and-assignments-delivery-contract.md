# ADR 013 — Classes and Assignments delivery contract

- Status: Accepted
- Date: 2026-09-02
- Scope: Phase 2 — Classes + Assignments

## Context

English Spark already separates reusable quiz/activity content, concrete sessions, participants, attempts and results. Phase 1 added persistent Student Portal identity without changing the Player engine. Phase 2 needs grouping and durable delivery without collapsing those concepts.

The governing invariant remains:

`Activity != Assignment != Session != Attempt != Result`

## Decision

1. `Classroom` is a tenant-scoped grouping primitive only. It is not attendance, timetable or an LMS course.
2. `ClassroomStudent` is a unique tenant-scoped membership `(ClassroomId, StudentId)`.
3. `Assignment` pins exactly one immutable **published `QuizVersionId`**. Publishing a newer version never mutates an existing assignment.
4. Classroom delivery is snapshotted at creation into effective `AssignmentRecipient` rows (one per student). `SourceClassroomId` records provenance. Later class membership changes do not silently add/remove recipients from old assignments.
5. A direct-student and class-derived recipient that resolve to the same student collapse to one recipient. Direct selection wins provenance when both are supplied.
6. `AvailableAt` is a hard start gate. `null` means immediately available. `DueAt` is a visible deadline; it must be later than `AvailableAt` when both exist, and later than creation time when `AvailableAt` is null. Passing `DueAt` does not erase results or force-finish an already-started attempt.
7. Every assignment owns one dedicated active SelfPaced `QuizSession`. The assignment is still a separate delivery contract; the session exists only to reuse the current Participant/Attempt/Player pipeline.
8. Assignment-created sessions are managed-only. Public Guest Quick Join must not create a participant in them. Starting from Student Portal first proves recipient access, then delegates participant/token creation to `ManagedStudentJoinService`.
9. Student task state is derived, not duplicated: future availability => Upcoming; no attempt => New; active attempt => InProgress; completed attempt => Completed.
10. Tenant identity is always server-derived. Classroom, Student, QuizVersion, Assignment and recipient lookups must fail closed across tenants without revealing existence.

## Consequences

- Existing Quick Join, Student Portal login, scoring and cross-device resume remain the only player engine.
- Reports can link a result to an assignment through its dedicated SessionId without Phase 3 report consolidation.
- The schema change is additive and follows `Expand -> Activate -> Migrate -> Contract`.
