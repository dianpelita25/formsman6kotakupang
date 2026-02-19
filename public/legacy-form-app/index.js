import { initCardReveal } from './animations.js';
import { getLegacyFormDomRefs } from './dom-refs.js';
import { renderField } from './field-renderers.js';
import { loadSchema } from './schema-loader.js';
import { setDashboardLinkEnabled, setStatus } from './status.js';
import { attachSubmitHandler } from './submit-handler.js';

const refs = getLegacyFormDomRefs();
const { statusMessage, viewDashboardBtn } = refs;

attachSubmitHandler({ refs, setStatus, setDashboardLinkEnabled });

loadSchema({ refs, renderField, initCardReveal }).catch((error) => {
  setStatus(statusMessage, error.message || 'Gagal memuat form.', 'error');
  setDashboardLinkEnabled(viewDashboardBtn, false);
});

setDashboardLinkEnabled(viewDashboardBtn, false);
