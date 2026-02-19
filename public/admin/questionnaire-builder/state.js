export function createBuilderState() {
  return {
    tenantSlug: '',
    questionnaireSlug: '',
    questionnaireName: '',
    questionnaireId: '',
    meta: {
      title: '',
      greetingTitle: '',
      greetingText: '',
    },
    fields: [],
    loadedSnapshot: [],
    hasResponses: false,
    isPublishing: false,
  };
}

export function cloneBuilderField(field) {
  return JSON.parse(JSON.stringify(field));
}
