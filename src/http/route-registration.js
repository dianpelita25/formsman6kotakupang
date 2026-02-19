import { registerAdminApiDomainRoutes } from './route-registration/admin-api-domain.js';
import { registerAdminPagesDomainRoutes } from './route-registration/admin-pages-domain.js';
import { registerPublicFormDomainRoutes } from './route-registration/public-form-domain.js';
import { registerPublicDomainRoutes } from './route-registration/public-domain.js';
import { registerSchoolAdminDomainRoutes } from './route-registration/school-admin-domain.js';
import { registerTenantAdminDomainRoutes } from './route-registration/tenant-admin-domain.js';

export function registerHttpRoutes(app, deps) {
  registerPublicDomainRoutes(app, deps);
  registerAdminApiDomainRoutes(app, deps);
  registerTenantAdminDomainRoutes(app, deps);
  registerAdminPagesDomainRoutes(app, deps);
  registerPublicFormDomainRoutes(app, deps);
  registerSchoolAdminDomainRoutes(app, deps);
}
