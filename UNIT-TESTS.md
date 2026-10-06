# Unit Test Notes

## Purpose

This PR adds unit-test coverage for the Nest.js backend without changing production runtime behavior.

## Scope

Included:

- auth service unit tests
- user service unit tests
- dataset service unit tests
- microtask service unit tests
- auth, user, dataset, and microtask controller unit tests
- guard, interceptor, and exception filter unit tests
- existing app, email, and health spec improvements
- Jest path alias support for `src/...` imports in `package.json`

Not included:

- production logic changes
- infrastructure-backed integration tests
- E2E tests in this PR

## Main Files Covered

- `src/auth/service/auth.service.spec.ts`
- `src/auth/service/User.service.spec.ts`
- `src/data_set/service/DataSet.service.spec.ts`
- `src/data_set/service/MicroTask.service.spec.ts`
- `src/auth/controller/auth.controller.spec.ts`
- `src/auth/controller/user.controller.spec.ts`
- `src/data_set/controller/DataSet.controller.spec.ts`
- `src/data_set/controller/MicroTask.controller.spec.ts`
- `src/auth/guard/role.guard.spec.ts`
- `src/auth/guard/permission.guard.spec.ts`
- `src/common/interceptors/global-response.interceptor.spec.ts`
- `src/common/filters/http-exception.filter.spec.ts`

## Verification

Run:

```bash
npm test -- --runInBand
```

Current result at time of change:

- `16` test suites passed
- `119` tests passed

## Notes For Reviewers

- The test additions use mocks for external dependencies such as storage, JWT signing, mail, SMS, repositories, and transactional infrastructure.
- The Jest `moduleNameMapper` addition is required so the test runner can resolve existing `src/...` imports used by the codebase.
- The goal of this PR is to establish meaningful unit coverage around high-risk business logic and request-to-service contracts first.
