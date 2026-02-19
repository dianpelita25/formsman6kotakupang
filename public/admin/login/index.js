import { bindRuntimeErrorHandlers } from '/forms-static/shared/ux.js';
import { createStatusController } from './status.js';
import { bindLoginSubmit } from './submit-handler.js';

const loginForm = document.getElementById('login-form');
const statusEl = document.getElementById('status');
const errorDebugEl = document.getElementById('error-debug');
const { setStatus } = createStatusController(statusEl, errorDebugEl);

bindRuntimeErrorHandlers((normalized, originalError) => {
  setStatus(normalized.message, 'error', originalError);
});

bindLoginSubmit({ loginForm, setStatus });
