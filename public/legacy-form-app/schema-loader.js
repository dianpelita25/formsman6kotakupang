export async function loadSchema({ refs, renderField, initCardReveal }) {
  const response = await fetch('./api/form-schema');
  if (!response.ok) throw new Error('Gagal memuat schema form.');

  const data = await response.json();
  const { formTitle, greetingTitle, greetingText, fieldsContainer } = refs;

  formTitle.textContent = data.meta.title;
  greetingTitle.textContent = data.meta.greetingTitle;
  greetingText.textContent = data.meta.greetingText;

  data.fields.forEach((field, index) => {
    fieldsContainer.append(renderField(field, index));
  });

  initCardReveal();
}
