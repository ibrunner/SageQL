import { ERROR_TEMPLATES } from "../../agents/prompts/retryValidation.js";

interface ValidationContext {
  validationContext: string;
  hasFieldSuggestions: boolean;
  hasFilterErrors: boolean;
}

export function formatValidationErrors(errors: string[]): ValidationContext {
  const fieldNameErrors = errors.filter(
    (error) =>
      error.includes("Cannot query field") || error.includes("Did you mean"),
  );
  const argumentErrors = errors.filter(
    (error) => error.includes("argument") || error.includes("Unknown argument"),
  );
  const typeErrors = errors.filter(
    (error) => error.includes("type") && !error.includes("field"),
  );
  const filterErrors = errors.filter(
    (error) => error.includes("filter") || error.includes("input"),
  );

  const fieldSuggestions = fieldNameErrors
    .map((error) => {
      const suggestionMatch = error.match(/Did you mean "([^"]+)"\?/);
      return suggestionMatch ? `- ${suggestionMatch[1]}` : null;
    })
    .filter(Boolean);

  // Format each error section using the templates
  const sections = [
    {
      template: ERROR_TEMPLATES.fieldName,
      variables: {
        fieldErrors: fieldNameErrors.map((error) => `- ${error}`).join("\n"),
        fieldSuggestions: fieldSuggestions.join("\n"),
      },
      hasErrors: fieldNameErrors.length > 0,
    },
    {
      template: ERROR_TEMPLATES.argument,
      variables: {
        argumentErrors: argumentErrors.map((error) => `- ${error}`).join("\n"),
      },
      hasErrors: argumentErrors.length > 0,
    },
    {
      template: ERROR_TEMPLATES.type,
      variables: {
        typeErrors: typeErrors.map((error) => `- ${error}`).join("\n"),
      },
      hasErrors: typeErrors.length > 0,
    },
    {
      template: ERROR_TEMPLATES.filter,
      variables: {
        filterErrors: filterErrors.map((error) => `- ${error}`).join("\n"),
      },
      hasErrors: filterErrors.length > 0,
    },
  ];

  // Build validation context by applying templates
  const validationContext = sections
    .filter((section) => section.hasErrors)
    .map((section) => {
      const template = section.template;
      return Object.entries(section.variables).reduce(
        (acc, [key, value]) => acc.replace(`{${key}}`, value),
        template,
      );
    })
    .join("\n\n")
    .trim();

  return {
    validationContext,
    hasFieldSuggestions: fieldSuggestions.length > 0,
    hasFilterErrors: filterErrors.length > 0,
  };
}
