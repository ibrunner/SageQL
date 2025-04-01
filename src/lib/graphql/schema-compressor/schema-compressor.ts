interface CompressionOptions {
  removeDescriptions?: boolean;
  preserveEssentialDescriptions?: boolean;
  removeDeprecated?: boolean;
}

interface GraphQLType {
  __typename?: string;
  kind?: string;
  name?: string;
  description?: string;
  fields: any[] | null | undefined;
  inputFields?: any[] | null;
  interfaces?: any[] | null;
  enumValues?: any[] | null;
  possibleTypes?: any[] | null;
  directives?: any[] | null;
  ofType?: any;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

const schemaCompressor = (schema: any, options: CompressionOptions = {}) => {
  const {
    removeDescriptions = false,
    preserveEssentialDescriptions = true,
    removeDeprecated = true,
  } = options;

  // Helper function to normalize type references into string notation
  const normalizeTypeReference = (typeRef: any): string => {
    if (!typeRef) return "";

    if (typeRef.kind === "NON_NULL") {
      return `${normalizeTypeReference(typeRef.ofType)}!`;
    }
    if (typeRef.kind === "LIST") {
      return `[${normalizeTypeReference(typeRef.ofType)}]`;
    }
    return typeRef.name;
  };

  // Helper function to compress a single type
  const compressType = (type: GraphQLType): any => {
    if (!type) return null;

    const compressed: any = {
      kind: type.kind,
      name: type.name,
    };

    // Step 1: Description Handling
    // Determine if this type should preserve its description based on configuration
    const isObjectType = type.kind === "OBJECT";
    const hasDescription = Boolean(type.description);

    // If removeDescriptions is false, we keep all descriptions
    const keepAllDescriptions = !removeDescriptions;

    // If preserveEssentialDescriptions is true, we keep descriptions for OBJECT types
    // even if removeDescriptions is true
    const keepEssentialDescription =
      preserveEssentialDescriptions && isObjectType;

    // Final decision on whether to keep the description
    const shouldKeepDescription =
      keepAllDescriptions || keepEssentialDescription;

    // Add description to compressed output if we should keep it and it exists
    if (shouldKeepDescription && hasDescription) {
      compressed.description = type.description;
    }

    // Step 2: Deprecation Pruning
    if (removeDeprecated && type.isDeprecated) {
      return null;
    }

    // Step 3: Empty/Null Field Pruning
    // Remove empty arrays and null values
    if (Array.isArray(type.fields) && type.fields.length > 0) {
      compressed.fields = type.fields
        .map((field) => {
          // Skip deprecated fields if removeDeprecated is true
          if (removeDeprecated && field.isDeprecated) {
            return null;
          }

          const compressedField: any = {
            name: field.name,
          };

          // Handle field descriptions - always remove if removeDescriptions is true
          if (!removeDescriptions && field.description) {
            compressedField.description = field.description;
          }

          // Step 4: Type Reference Normalization
          // Convert complex nested type references into string notation
          compressedField.type = normalizeTypeReference(field.type);

          // Only include args if they exist and aren't empty
          if (field.args?.length > 0) {
            compressedField.args = field.args.map((arg: any) => ({
              name: arg.name,
              type: normalizeTypeReference(arg.type),
              ...(arg.defaultValue && { default: arg.defaultValue }),
            }));
          }

          return compressedField;
        })
        .filter(Boolean); // Remove null entries
    }

    // Step 5: Directives Handling
    if (Array.isArray(type.directives) && type.directives.length > 0) {
      compressed.directives = type.directives.map((directive: any) => ({
        name: directive.name,
        args:
          directive.args?.length > 0
            ? directive.args.map((arg: any) => ({
                name: arg.name,
                type: normalizeTypeReference(arg.type),
                ...(arg.defaultValue && { default: arg.defaultValue }),
              }))
            : undefined,
      }));
    }

    // Remove null or empty array fields
    Object.keys(compressed).forEach((key) => {
      if (
        compressed[key] === null ||
        (Array.isArray(compressed[key]) && compressed[key].length === 0)
      ) {
        delete compressed[key];
      }
    });

    return compressed;
  };

  // Process all types in the schema
  const compressedTypes = Object.entries(schema.types || {}).reduce(
    (acc: any, [typeName, typeValue]: [string, any]) => {
      const compressed = compressType(typeValue);
      if (compressed) {
        acc[typeName] = compressed;
      }
      return acc;
    },
    {},
  );

  return {
    types: compressedTypes,
  };
};

export default schemaCompressor;
