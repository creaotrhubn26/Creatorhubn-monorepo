// Stable registration entrypoint. The implementation is isolated in a
// project-scoped module so delivery/status flows share one ACL boundary.
export { registerDeliveryPlaybookRoutes } from "./delivery-playbook-project-routes.js";
