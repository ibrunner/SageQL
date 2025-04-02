import { ERROR_TEMPLATES } from "../../agents/prompts/retry-validation.js";

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
        validationContext: "",
        failedQuery: "",
        schemaContext: "",
        fieldErrors:
          fieldNameErrors.length > 0
            ? fieldNameErrors.map((error) => `- ${error}`).join("\n")
            : undefined,
        fieldSuggestions:
          fieldSuggestions.length > 0 ? fieldSuggestions.join("\n") : undefined,
      },
      hasErrors: fieldNameErrors.length > 0,
    },
    {
      template: ERROR_TEMPLATES.argument,
      variables: {
        validationContext: "",
        failedQuery: "",
        schemaContext: "",
        argumentErrors:
          argumentErrors.length > 0
            ? argumentErrors.map((error) => `- ${error}`).join("\n")
            : undefined,
      },
      hasErrors: argumentErrors.length > 0,
    },
    {
      template: ERROR_TEMPLATES.type,
      variables: {
        validationContext: "",
        failedQuery: "",
        schemaContext: "",
        typeErrors:
          typeErrors.length > 0
            ? typeErrors.map((error) => `- ${error}`).join("\n")
            : undefined,
      },
      hasErrors: typeErrors.length > 0,
    },
    {
      template: ERROR_TEMPLATES.filter,
      variables: {
        validationContext: "",
        failedQuery: "",
        schemaContext: "",
        filterErrors:
          filterErrors.length > 0
            ? filterErrors.map((error) => `- ${error}`).join("\n")
            : undefined,
      },
      hasErrors: filterErrors.length > 0,
    },
  ];

  // Build validation context by applying templates
  const validationContext = sections
    .filter((section) => section.hasErrors)
    .map((section) => section.template(section.variables))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return {
    validationContext,
    hasFieldSuggestions: fieldSuggestions.length > 0,
    hasFilterErrors: filterErrors.length > 0,
  };
}
