// Kept as the stable registration module for backend/server/index.ts.
// The implementation lives in a project-scoped service module so job
// orchestration can be tested without widening the public route surface.
export { registerCustomerAutoOnboardRoutes } from "./customer-auto-onboard-project-routes.js";
