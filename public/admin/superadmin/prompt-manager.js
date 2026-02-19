import { createPromptManagerService } from './prompt-manager-service.js';

export function createSuperadminPromptManager(deps) {
  return createPromptManagerService(deps);
}
