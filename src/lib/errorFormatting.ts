import {
  FIELD_NAME_ERROR_TEMPLATE,
  ARGUMENT_ERROR_TEMPLATE,
  TYPE_ERROR_TEMPLATE,
  FILTER_ERROR_TEMPLATE,
} from "../agents/prompts/retryValidation.js";

interface ValidationContext {
  validationContext: string;
  additionalInstructions: string;
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
      return suggestionMatch ? suggestionMatch[1] : null;
    })
    .filter(Boolean);

  let validationContext = "";
  let additionalInstructions = "";

  if (fieldNameErrors.length > 0) {
    validationContext += FIELD_NAME_ERROR_TEMPLATE.replace(
      "{fieldErrors}",
      fieldNameErrors.map((error) => `- ${error}`).join("\n"),
    ).replace(
      "{fieldSuggestions}",
      fieldSuggestions.length > 0
        ? `\nSuggested field names to use:\n${fieldSuggestions.map((s) => `- ${s}`).join("\n")}`
        : "",
    );
  }

  if (argumentErrors.length > 0) {
    validationContext +=
      "\n\n" +
      ARGUMENT_ERROR_TEMPLATE.replace(
        "{argumentErrors}",
        argumentErrors.map((error) => `- ${error}`).join("\n"),
      );
  }

  if (typeErrors.length > 0) {
    validationContext +=
      "\n\n" +
      TYPE_ERROR_TEMPLATE.replace(
        "{typeErrors}",
        typeErrors.map((error) => `- ${error}`).join("\n"),
      );
  }

  if (filterErrors.length > 0) {
    validationContext +=
      "\n\n" +
      FILTER_ERROR_TEMPLATE.replace(
        "{filterErrors}",
        filterErrors.map((error) => `- ${error}`).join("\n"),
      );
  }

  if (fieldSuggestions.length > 0) {
    additionalInstructions += `\n7. Uses the suggested field names where applicable
8. Replaces any incorrect field names with their correct versions from the schema`;
  }

  if (filterErrors.length > 0) {
    additionalInstructions += `\n9. Uses the correct filter codes and structures
10. Follows the filter guidelines for continents, countries, and languages`;
  }

  return { validationContext, additionalInstructions };
}
