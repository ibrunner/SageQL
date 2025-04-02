interface CompressionOptions {
  removeDescriptions?: boolean;
  preserveEssentialDescriptions?: boolean;
  removeDeprecated?: boolean;
  removeIntrospectionTypes?: boolean;
  removeEmptyNodes?: boolean;
  removeCommonScalars?: boolean;
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

interface GraphQLDirective {
  name: string;
  description?: string;
  args?: any[];
  locations?: string[];
  onOperation?: boolean;
  onFragment?: boolean;
  onField?: boolean;
}

const schemaCompressor = (schema: any, options: CompressionOptions = {}) => {
  const {
    removeDescriptions = false,
    preserveEssentialDescriptions = true,
    removeDeprecated = true,
    removeIntrospectionTypes = true,
    removeEmptyNodes = true,
    removeCommonScalars = true,
  } = options;

  // Common scalar types that are well-known and don't need documentation
  const COMMON_SCALAR_TYPES = new Set([
    "String",
    "Int",
    "Float",
    "Boolean",
    "ID",
    // Common extended scalars
    "Date",
    "DateTime",
    "Time",
    "JSON",
    "BigInt",
    "Decimal",
    "UUID",
    "URL",
    "EmailAddress",
    "PhoneNumber",
  ]);

  // Helper function to check if a type is a common scalar
  const isCommonScalar = (type: GraphQLType): boolean => {
    return (
      type.kind === "SCALAR" &&
      type.name !== undefined &&
      COMMON_SCALAR_TYPES.has(type.name)
    );
  };

  // Helper function to check if a value is empty
  const isEmpty = (value: any): boolean => {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  };

  // Helper function to deeply clean empty nodes
  const cleanEmptyNodes = (obj: any): any => {
    if (!removeEmptyNodes) return obj;
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      const cleaned = obj
        .map((item) => cleanEmptyNodes(item))
        .filter((item) => !isEmpty(item));
      return cleaned.length ? cleaned : undefined;
    }

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanEmptyNodes(value);
      if (!isEmpty(cleanedValue)) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length ? cleaned : undefined;
  };

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

  // Helper function to check if a type is an introspection type
  const isIntrospectionType = (typeName: string): boolean => {
    return typeName.startsWith("__");
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

          // Handle field directives
          if (field.directives?.length > 0) {
            compressedField.directives = field.directives.map(
              (directive: any) => ({
                name: directive.name,
                args:
                  directive.args?.length > 0
                    ? directive.args.map((arg: any) => ({
                        name: arg.name,
                        type: normalizeTypeReference(arg.type),
                        ...(arg.defaultValue && { default: arg.defaultValue }),
                      }))
                    : undefined,
              }),
            );
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

    // Clean empty nodes if enabled
    return removeEmptyNodes ? cleanEmptyNodes(compressed) : compressed;
  };

  // Helper function to compress a directive
  const compressDirective = (directive: GraphQLDirective): any => {
    if (!directive) return null;

    const compressed: any = {
      name: directive.name,
    };

    // Handle description if needed
    if (!removeDescriptions && directive.description) {
      compressed.description = directive.description;
    }

    // Handle arguments if they exist and aren't empty
    if (Array.isArray(directive.args) && directive.args.length > 0) {
      compressed.args = directive.args.map((arg: any) => ({
        name: arg.name,
        type: normalizeTypeReference(arg.type),
        ...(arg.defaultValue && { default: arg.defaultValue }),
      }));
    }

    // Handle locations if they exist and aren't empty
    if (Array.isArray(directive.locations) && directive.locations.length > 0) {
      compressed.locations = directive.locations;
    }

    // Clean empty nodes if enabled
    return removeEmptyNodes ? cleanEmptyNodes(compressed) : compressed;
  };

  // Ensure we have a valid schema with __schema property
  if (!schema.__schema) {
    throw new Error("Invalid schema: missing __schema property");
  }

  const schemaData = schema.__schema;

  // Process all types in the schema
  const compressedTypes = Object.entries(schemaData.types || {}).reduce(
    (acc: any, [_, typeValue]: [string, any]) => {
      // Skip common scalars if removeCommonScalars is true
      if (removeCommonScalars && isCommonScalar(typeValue)) {
        return acc;
      }

      const compressed = compressType(typeValue);
      if (compressed) {
        // Skip introspection types if removeIntrospectionTypes is true
        if (removeIntrospectionTypes && isIntrospectionType(compressed.name)) {
          return acc;
        }
        acc[compressed.name] = compressed;
      }
      return acc;
    },
    {},
  );

  // Build the compressed schema structure
  const compressedSchema = {
    // Include root operation types if they exist
    ...(schemaData.queryType && {
      queryType: schemaData.queryType.name,
    }),
    ...(schemaData.mutationType && {
      mutationType: schemaData.mutationType.name,
    }),
    ...(schemaData.subscriptionType && {
      subscriptionType: schemaData.subscriptionType.name,
    }),
    // Include compressed types
    types: compressedTypes,
  };

  // Include directives if they exist and aren't introspection directives
  if (
    Array.isArray(schemaData.directives) &&
    schemaData.directives.length > 0
  ) {
    compressedSchema.directives = schemaData.directives
      .map(compressDirective)
      .filter((directive: GraphQLDirective | null) => {
        if (!directive) return false;
        // Remove introspection directives
        if (removeIntrospectionTypes && isIntrospectionType(directive.name)) {
          return false;
        }
        // Remove @deprecated directive if we're removing deprecated items
        if (removeDeprecated && directive.name === "deprecated") {
          return false;
        }
        return true;
      });
  }

  // Final cleanup of empty nodes
  return removeEmptyNodes
    ? cleanEmptyNodes(compressedSchema)
    : compressedSchema;
};

export default schemaCompressor;
