import { registerTenantAdminAiPromptRoutes } from './ai-prompts-routes.js';
import { registerTenantAdminAiRoutes } from './ai-routes.js';
import { registerTenantAdminAnalyticsRoutes } from './analytics-routes.js';
import { registerTenantAdminQuestionnaireRoutes } from './questionnaire-routes.js';

export function registerTenantAdminApiRoutes(app, deps) {
  registerTenantAdminQuestionnaireRoutes(app, deps);
  registerTenantAdminAnalyticsRoutes(app, deps);
  registerTenantAdminAiRoutes(app, deps);
  registerTenantAdminAiPromptRoutes(app, deps);
}
