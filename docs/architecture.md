# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

- Presentation tier decision: Keep page rendering and user interaction in React components. Use the shared API client for relative `/api` requests, and give each capability explicit loading, accessible error, empty, and populated states.
- Logic tier decision: Keep HTTP concerns in Express routes and behavior in `octofitService.ts`. Validate request data and references before persistence, return deliberate 4xx responses for invalid or unknown resources, and do not expose database cast errors as 500 responses.
- Data tier decision: Use Mongoose schemas to enforce required fields, references, and defaults. Keep seed data representative and idempotent without deleting unrelated records.
- Activity tracking approach: Accept `userId`, `teamId`, `type`, and `minutes`; validate ID shape and that both records exist. Persist the resolved user and team references, compute points on the server, and set `occurredAt` when creating the activity.
- Team management approach: Require a non-empty name, preserve the submitted name and mascot, and store the requested member references. Return created and listed teams using the same API shape.
- Leaderboard approach: Aggregate activity points by team, sort by total points descending, and assign ranks starting at 1. Return the contract fields `teamName`, `totalPoints`, and `rank`.
- Workout suggestions approach: Resolve the user by email, then use their fitness goal and recent activity to choose relevant workouts. Include a human-readable reason with each recommendation and return a deliberate 4xx response when the user does not exist.

## Test plan

- **Baseline before implementation**: `npm test --prefix octofit-tracker/backend` reported 8 failed and 1 passed. Four model-validation tests failed because required fields were not enforced; four API tests failed for activity creation, team creation, leaderboard aggregation, and workout recommendation reasons. The seed/idempotency test passed. `npm test --prefix octofit-tracker/frontend` reported 15 failed: feature views were still pending and did not fetch or display the required data and UI states.
- **Data tier**: `npm run test:data --prefix octofit-tracker/backend` checks required model fields/defaults and repeatable, non-destructive seeding. Failures indicate schema or seed behavior does not match the data contract.
- **API logic**: `npm run test:api --prefix octofit-tracker/backend` checks request validation, persistence, response shapes, aggregation, recommendations, and deliberate 4xx handling. Failures indicate a route/service behavior or API contract mismatch.
- **Presentation**: `npm test --prefix octofit-tracker/frontend` checks API-driven rendering, user-specific workout requests, loading states, useful empty states, and accessible API errors. Failures indicate a component, API-client integration, or accessibility mismatch.
- **Backend typecheck**: `npm run build --prefix octofit-tracker/backend` must pass before integration; failures indicate TypeScript errors in backend models, services, or routes.
- **Frontend typecheck and bundle**: `npm run build --prefix octofit-tracker/frontend` must pass before integration; failures indicate frontend TypeScript or Vite build errors.
