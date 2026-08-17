# E2E Happy Path Report

**Generated:** 2026-08-17T01:59:56.297Z
**API Base URL:** http://localhost:3000/api
**Test Email:** e2e-test-1786931993818@repuestito.test

## Summary

| Metric | Value |
|--------|-------|
| Total steps | 28 |
| ✅ PASS | 27 |
| ❌ FAIL | 0 |
| ⏭ SKIP | 1 |
| Total latency | 2446ms |
| Average latency | 87ms |

## Results

| # | Step | Method | Path | HTTP Status | Latency | Result | Detail |
|---|------|--------|------|-------------|---------|--------|--------|
| 1 | GET countries (unauthenticated) | `GET` | `/countries` | 401 | 25ms | ⏭ SKIP | Requires auth — will retry after login (step 05b) |
| 2 | POST register | `POST` | `/auth/register` | 201 | 945ms | ✅ PASS | email=e2e-test-1786931993818@repuestito.test |
| 3 | READ verificationCode from DB | `DB` | `users.verificationCode` | N/A | 45ms | ✅ PASS | code=****** (6 digits) |
| 4 | POST verify-email | `POST` | `/auth/verify-email` | 201 | 11ms | ✅ PASS | Correo verificado correctamente |
| 5 | POST login | `POST` | `/auth/login` | 201 | 111ms | ✅ PASS | userId=f0cbe907-4ed6-4eac-a895-c6152d1bc22e, role=MODERATOR |
| 6 | GET countries (authenticated) | `GET` | `/countries` | 200 | 5ms | ✅ PASS | countryCode=AR, total=2 |
| 7 | GET auth/me | `GET` | `/auth/me` | 200 | 3ms | ✅ PASS | email=e2e-test-1786931993818@repuestito.test, role=MODERATOR |
| 8 | GET brand-replacements | `GET` | `/brand-replacements` | 200 | 5ms | ✅ PASS | total=140, first.name=ACDelco |
| 07b | READ brandId from DB | `DB` | `brand_replacements.id` | N/A | 31ms | ✅ PASS | brandId=1 |
| 9 | POST auth/login (GOD) | `POST` | `/auth/login` | 201 | 80ms | ✅ PASS | role=? |
| 10 | POST tenants | `POST` | `/tenants` | 201 | 46ms | ✅ PASS | tenantId=500b8fec-1f83-4170-b3cd-267c5c6a889c |
| 10 | POST branches | `POST` | `/branches` | 201 | 6ms | ✅ PASS | branchId=null |
| 11 | GET users | `GET` | `/users` | 200 | 3ms | ✅ PASS | total=9 |
| 12 | POST replacements | `POST` | `/replacements` | 201 | 17ms | ✅ PASS | replacementId=4e8d4749-6a14-4205-8237-e235e3919dbb |
| 13 | GET replacements | `GET` | `/replacements` | 200 | 10ms | ✅ PASS | total=203, page=1 |
| 14 | PATCH replacements/:id | `PATCH` | `/replacements/4e8d4749-6a14-4205-8237-e235e3919dbb` | 200 | 9ms | ✅ PASS | stock=50 |
| 15 | GET replacements/:id | `GET` | `/replacements/4e8d4749-6a14-4205-8237-e235e3919dbb` | 200 | 5ms | ✅ PASS | stock=50 (expected 50) |
| 16 | GET vehicle-brands | `GET` | `/vehicle-brands` | 200 | 4ms | ✅ PASS | total=55 |
| 17 | GET vehicle-models | `GET` | `/vehicle-models` | 200 | 20ms | ✅ PASS | total=672 |
| 18 | GET vehicle-versions | `GET` | `/vehicle-versions` | 200 | 133ms | ✅ PASS | total=8211 |
| 19 | GET customers | `GET` | `/customers` | 200 | 3ms | ✅ PASS | total=0 |
| 20 | POST customers | `POST` | `/customers` | 201 | 3ms | ✅ PASS | customerId=f8622a31-0c66-4090-9049-85df60f11255 |
| 21 | POST orders | `POST` | `/orders` | 201 | 6ms | ✅ PASS | orderId=833b029f-0fe3-4b5d-bf2b-ee708c1f59da, total=51.98 |
| 22 | PATCH orders/:id/confirm | `PATCH` | `/orders/833b029f-0fe3-4b5d-bf2b-ee708c1f59da/confirm` | 200 | 2ms | ✅ PASS | status=confirmed |
| 23 | POST orders/:id/fulfill | `POST` | `/orders/833b029f-0fe3-4b5d-bf2b-ee708c1f59da/fulfill` | 201 | 5ms | ✅ PASS | status=fulfilled |
| 24 | GET invoices | `GET` | `/invoices` | 200 | 2ms | ✅ PASS | total=1 |
| 25 | POST auth/forgot-password | `POST` | `/auth/forgot-password` | 201 | 907ms | ✅ PASS | Si el correo existe, recibirás instrucciones |
| 26 | POST auth/logout | `POST` | `/auth/logout` | 201 | 4ms | ✅ PASS | Sesión cerrada |

## Notes

- Steps marked **SKIP** either require a higher role (GOD) than the test user (MODERATOR default), or depend on a skipped prerequisite.
- `POST /api/tenants` requires **GOD** role — if skipped, subsequent tenant-dependent steps use an existing tenant from the DB.
- `POST /api/auth/register` does not return the `verificationCode` in the response; the script reads it directly from PostgreSQL via `psql`.
- Countries endpoint (`GET /api/countries`) requires authentication (class-level `@UseGuards(JwtAuthGuard)`).

## Role Access Matrix

| Endpoint | Required Role | Test User Role | Expected |
|----------|--------------|----------------|----------|
| POST /api/tenants | GOD | MODERATOR | 403 → SKIP |
| DELETE /api/tenants/:id | GOD | MODERATOR | 403 → SKIP |
| POST /api/auth/invite | GOD | MODERATOR | 403 → SKIP |
| POST /api/vehicle-brands | GOD | MODERATOR | 403 → SKIP |
| POST /api/branches | GOD, MODERATOR | MODERATOR | 201 → PASS |
| POST /api/replacements | GOD, MODERATOR | MODERATOR | 201 → PASS |
| GET /api/users | GOD, MODERATOR | MODERATOR | 200 → PASS |
| POST /api/customers | GOD, MODERATOR | MODERATOR | 201 → PASS |
| POST /api/orders | GOD, MODERATOR | MODERATOR | 201 → PASS |
| POST /api/invoices | GOD, MODERATOR | MODERATOR | 201 → PASS |
