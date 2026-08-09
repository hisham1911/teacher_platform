\set ON_ERROR_STOP on

-- Run with: psql "$DATABASE_URL" -v admin_email='owner@example.com' -f scripts/grant-platform-admin.sql
BEGIN;

INSERT INTO "AspNetRoles" ("Id", "Name", "NormalizedName", "ConcurrencyStamp")
SELECT gen_random_uuid(), 'PlatformAdmin', 'PLATFORMADMIN', gen_random_uuid()::text
WHERE NOT EXISTS (
  SELECT 1 FROM "AspNetRoles" WHERE "NormalizedName" = 'PLATFORMADMIN'
);

INSERT INTO "AspNetUserRoles" ("UserId", "RoleId")
SELECT user_account."Id", role."Id"
FROM "AspNetUsers" AS user_account
CROSS JOIN "AspNetRoles" AS role
WHERE user_account."NormalizedEmail" = upper(:'admin_email')
  AND role."NormalizedName" = 'PLATFORMADMIN'
ON CONFLICT DO NOTHING;

SELECT EXISTS (
  SELECT 1
  FROM "AspNetUsers" AS user_account
  JOIN "AspNetUserRoles" AS user_role ON user_role."UserId" = user_account."Id"
  JOIN "AspNetRoles" AS role ON role."Id" = user_role."RoleId"
  WHERE user_account."NormalizedEmail" = upper(:'admin_email')
    AND role."NormalizedName" = 'PLATFORMADMIN'
) AS role_granted \gset

\if :role_granted
  COMMIT;
\else
  ROLLBACK;
  \echo 'Confirmed user not found or role grant failed.'
  \quit 3
\endif
