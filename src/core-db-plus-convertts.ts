#!/usr/bin/env ts-node

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

// Interfaces to represent our type structure
interface TypeField {
  name: string;
  type: TypeInfo;
  optional: boolean;
  decorators?: string[];
  comments?: string[];
}

interface TypeInfo {
  kind:
    | "primitive"
    | "array"
    | "reference"
    | "generic"
    | "union"
    | "intersection";
  value: string | GenericTypeInfo | Array<TypeInfo> | null;
}

interface GenericTypeInfo {
  name: string;
  typeArguments: TypeInfo[];
}

interface TypeDefinition {
  name: string;
  fields: TypeField[];
  comments?: string[];
}

interface Relationship {
  fromTable: string;
  toTable: string;
  fromField: string;
  toField: string;
  type: "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany";
}

interface RelationshipType {
  type: "manyToOne" | "oneToMany" | "oneToOne" | "manyToMany";
  targetTable: string;
}

// Function to process command line arguments
function processArgs(): {
  filePaths: string[];
  outputDir?: string;
  outputFile?: string;
} {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Please provide at least one TypeScript file path or string");
    process.exit(1);
  }

  const filePaths: string[] = [];
  let outputDir: string | undefined;
  let outputFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--output-dir" || arg === "-o") {
      outputDir = args[++i];
    } else if (arg === "--output-file" || arg === "-f") {
      outputFile = args[++i];
    } else if (fs.existsSync(arg)) {
      // It's a file path
      filePaths.push(arg);
    } else {
      // It might be a glob pattern
      try {
        const matches = require("glob").sync(arg);
        if (matches.length > 0) {
          filePaths.push(...matches);
        } else {
          console.warn(`Warning: '${arg}' doesn't match any files`);
        }
      } catch (e) {
        console.warn(
          `Warning: Treating '${arg}' as a string containing TypeScript code`
        );
        // Create a temporary file
        const tempFile = path.join(process.cwd(), `temp_${Date.now()}.ts`);
        fs.writeFileSync(tempFile, arg);
        filePaths.push(tempFile);
      }
    }
  }

  return { filePaths, outputDir, outputFile };
}

// Function to parse a TypeScript file and extract type definitions
function parseTypeScript(filePath: string): {
  typeDefinitions: TypeDefinition[];
  relationships: Relationship[];
} {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const typeDefinitions: TypeDefinition[] = [];
  const relationships: Relationship[] = [];

  // Function to process nodes recursively
  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      const typeDef: TypeDefinition = {
        name: node.name.text,
        fields: [],
        comments: [],
      };

      // Set current type name
      currentTypeName = node.name.text;

      // Extract JSDoc comments
      const jsDoc = ts.getJSDocTags(node);
      if (jsDoc.length > 0) {
        typeDef.comments = jsDoc.map((tag) => {
          const text = tag.comment
            ? typeof tag.comment === "string"
              ? tag.comment
              : tag.comment.map((c) => c.text).join(" ")
            : "";
          return text;
        });
      }

      // For interfaces
      if (ts.isInterfaceDeclaration(node) && node.members) {
        node.members.forEach((member) => {
          if (ts.isPropertySignature(member) && member.name) {
            const field = processPropertySignature(member);
            if (field) {
              typeDef.fields.push(field);
            }
          }
        });
      }
      // For type aliases
      else if (
        ts.isTypeAliasDeclaration(node) &&
        ts.isTypeLiteralNode(node.type)
      ) {
        node.type.members.forEach((member) => {
          if (ts.isPropertySignature(member) && member.name) {
            const field = processPropertySignature(member);
            if (field) {
              typeDef.fields.push(field);
            }
          }
        });
      }

      typeDefinitions.push(typeDef);

      // Reset current type name
      currentTypeName = "";
    }

    ts.forEachChild(node, visit);
  }

  // Process property signatures to extract field information
  function processPropertySignature(
    member: ts.PropertySignature
  ): TypeField | null {
    if (!member.name) return null;

    const fieldName = member.name.getText();
    let fieldType = member.type ? member.type.getText() : "any";
    let relationship: RelationshipType | undefined;

    // Check for ManyToOne type
    // if (fieldType.startsWith("ManyToOne<")) {
    //   const typeArgs = fieldType.slice(10, -1).split(",");
    //   if (typeArgs.length >= 2) {
    //     const targetTable = typeArgs[1]
    //       .trim()
    //       .replace(/["']/g, "")
    //       .toLowerCase();
    //     relationship = {
    //       type: "manyToOne",
    //       targetTable,
    //     };
    //     fieldType = "Text"; // Store foreign key as text
    //   }
    // }
    // // Check for array types
    // else
    if (fieldType.startsWith("Array<") || fieldType.endsWith("[]")) {
      const baseType = fieldType.startsWith("Array<")
        ? fieldType.slice(6, -1)
        : fieldType.slice(0, -2);
      relationship = {
        type: "manyToOne",
        targetTable: baseType.toLowerCase(),
      };
      // TODO: this makes no sense, fix later
      fieldType = "Text"; // Store foreign key as text
    } else if (fieldType.includes("<")) {
      const i = fieldType.indexOf("<");
      const j = fieldType.indexOf(">");
      const type = fieldType.slice(i + 1, j);
      let relation = fieldType.slice(0, i);
      relation = relation[0].toLowerCase() + relation.slice(1);
      if (
        ["manyToOne", "oneToMany", "oneToOne", "manyToMany"].includes(relation)
      ) {
        relationship = {
          type: relation as
            | "manyToOne"
            | "oneToMany"
            | "oneToOne"
            | "manyToMany",
          targetTable: type,
        };
      }

      // fieldType = "Text"; // Store foreign key as text
    }
    // Check for direct type references that could be relationships
    // This makes no sense , at all;
    // else if (fieldType.match(/^[A-Z][a-zA-Z]*$/)) {
    //   relationship = {
    //     type: "manyToOne",
    //     targetTable: fieldType.toLowerCase(),
    //   };
    //   fieldType = "Text"; // Store foreign key as text
    // }

    // Map TypeScript types to CoreDBPlus types
    const coreDBType = mapToCoreDBType(fieldType);

    // Check for decorators from JSDoc comments
    const jsDocTags = ts.getJSDocTags(member);
    const isPrimaryKey = fieldType.startsWith("PrimaryKey<");
    const isIndexed =
      fieldType.startsWith("Indexed<") || fieldType.startsWith("Unique<");

    const field: TypeField = {
      name: fieldName,
      type: {
        kind: relationship ? "reference" : "primitive",
        value: coreDBType,
      },
      optional: member.questionToken !== undefined,
      decorators: [],
      comments: [],
    };

    if (relationship) {
      field.decorators = [relationship.type, "Indexed"];
      relationships.push({
        fromTable: getCurrentTypeName(),
        toTable: relationship.targetTable,
        fromField: fieldName,
        toField: "id",
        type: relationship.type,
      });
    }

    if (isPrimaryKey) {
      if (!field.decorators) {
        field.decorators = [];
      }
      field.decorators.push("PrimaryKey");
      const i = fieldType.indexOf("<");
      const j = fieldType.indexOf(">");
      const type = fieldType.slice(i + 1, j);
      const index = fieldType.slice(0, i);
      field.type.value = type;
    }

    if (isIndexed) {
      if (!field.decorators) {
        field.decorators = [];
      }
      const i = fieldType.indexOf("<");
      const j = fieldType.indexOf(">");
      const type = fieldType.slice(i + 1, j);
      const index =
        fieldType.slice(0, i).toLowerCase() === "unique" ? "Unique" : "Default";
      field.decorators.push(index);
      field.type.value = type;
    }

    return field;
  }

  function mapToCoreDBType(tsType: string): string {
    // switch (tsType.toLowerCase()) {
    //   case "string":
    //     return "Text";
    //   case "number":
    //     return "Number";
    //   case "boolean":
    //     return "Boolean";
    //   case "date":
    //     return "DateTime";
    //   case "text":
    //     return "Text";
    //   default:
    //     return "Text"; // Default to Text for unknown or relationship types
    // }
    return tsType;
  }

  // Get the current type name being processed
  let currentTypeName = "";
  function getCurrentTypeName(): string {
    return currentTypeName;
  }

  // Process type nodes to extract type information
  function processTypeNode(typeNode: ts.TypeNode): TypeInfo {
    if (ts.SyntaxKind[typeNode.kind].toLowerCase().includes("keyword")) {
      return {
        kind: "primitive",
        value: ts.SyntaxKind[typeNode.kind]
          .toLowerCase()
          .replace("keyword", ""),
      };
    } else if (ts.isArrayTypeNode(typeNode)) {
      const elementTypeInfo = processTypeNode(typeNode.elementType);
      return {
        kind: "array",
        value: elementTypeInfo as any, // Using any here since we know the structure is compatible
      };
    } else if (ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText(sourceFile);

      if (typeNode.typeArguments && typeNode.typeArguments.length > 0) {
        // It's a generic type
        return {
          kind: "generic",
          value: {
            name: typeName,
            typeArguments: typeNode.typeArguments.map((arg) =>
              processTypeNode(arg)
            ),
          },
        };
      } else {
        // It's a non-generic type reference
        return {
          kind: "reference",
          value: typeName,
        };
      }
    } else if (ts.isUnionTypeNode(typeNode)) {
      return {
        kind: "union",
        value: typeNode.types.map((t) => processTypeNode(t)),
      };
    } else if (ts.isIntersectionTypeNode(typeNode)) {
      return {
        kind: "intersection",
        value: typeNode.types.map((t) => processTypeNode(t)),
      };
    } else if (ts.isLiteralTypeNode(typeNode)) {
      return {
        kind: "primitive",
        value: typeNode.literal.getText(sourceFile),
      };
    } else if (ts.isParenthesizedTypeNode(typeNode)) {
      return processTypeNode(typeNode.type);
    } else {
      // For types we don't explicitly handle, we store the text representation
      return {
        kind: "primitive",
        value: typeNode.getText(sourceFile),
      };
    }
  }

  // Extract related entity from type info
  function extractRelatedEntity(typeInfo: TypeInfo): string | null {
    if (typeInfo.kind === "generic" && typeInfo.value) {
      const genericInfo = typeInfo.value as GenericTypeInfo;
      if (genericInfo.typeArguments.length > 0) {
        const firstArg = genericInfo.typeArguments[0];
        if (
          firstArg.kind === "primitive" &&
          typeof firstArg.value === "string"
        ) {
          return firstArg.value;
        } else if (
          firstArg.kind === "reference" &&
          typeof firstArg.value === "string"
        ) {
          return firstArg.value;
        }
      }
    } else if (
      typeInfo.kind === "reference" &&
      typeof typeInfo.value === "string"
    ) {
      return typeInfo.value;
    }
    return null;
  }

  // Start traversing the AST
  visit(sourceFile);
  return { typeDefinitions, relationships };
}

// Convert type definitions to CoreDBPlus table definitions
function convertToCoreDBPlusDefinitions(
  typeDefinitions: TypeDefinition[],
  relationships: Relationship[]
): string {
  let output = 'import { CoreDBPlus } from "typepersist";\n\n';
  output += "// Initialize database\n";
  output += 'const db = new CoreDBPlus("path/to/database.sqlite");\n\n';
  output += "// Create tables\n";

  // Create tables
  for (const typeDef of typeDefinitions) {
    output += `// ${typeDef.comments?.join("\n// ") || ""}\n`;
    output += `await db.createTable({\n`;
    output += `  name: "${typeDef.name.toLowerCase()}",\n`;
    output += `  fields: [\n`;

    for (const field of typeDef.fields) {
      if (field.type.kind === "reference") continue;
      const fieldType = getFieldType(field);
      const isRequired = !field.optional;
      const isIndexed =
        field.decorators?.includes("Default") ||
        field.decorators?.includes("Unique");

      const isPrimaryKey =
        field.name.toLowerCase() === "id" ||
        field.decorators?.includes("PrimaryKey") ||
        false;

      if (isPrimaryKey) continue;

      output += `    { name: "${
        field.name
      }", type: "${fieldType}", required: ${isRequired}${
        isIndexed ? `, indexed: "${field.decorators![0]}"` : ""
      }${isPrimaryKey ? ", primaryKey: true" : ""} },\n`;
    }

    output += `  ],\n`;
    output += `});\n\n`;
  }

  // Create relationships
  // TODO: oneToOne should be a lookup field, but as they are actually the same, it doesn't
  // really matter

  if (relationships.length > 0) {
    const p = new Map<string, string>();
    output += "// Create relationships\n";
    for (const rel of relationships) {
      const x = [rel.toTable.toLowerCase(), rel.fromTable.toLowerCase()]
        .sort()
        .join("_");
      if (p.has(x)) {
        continue;
      }
      p.set(x, x);
      if (rel.type === "manyToOne") {
        output += `await db.schemaConnect("${rel.toTable.toLowerCase()}", "${rel.fromTable.toLowerCase()}");\n`;
      } else {
        output += `await db.schemaConnect("${rel.fromTable.toLowerCase()}", "${rel.toTable.toLowerCase()}");\n`;
      }
    }
  }

  return output;
}

// Get the appropriate field type for CoreDBPlus
function getFieldType(field: TypeField): string {
  // console.log("xxxx", field.name, field.type);
  if (field.decorators?.includes("PrimaryKey")) {
    return "ID";
  }

  if (field.type.kind === "primitive") {
    const value = field.type.value;
    if (typeof value === "string") {
      const _value = value.toLowerCase();
      if (_value === "string") return "Text";
      if (_value === "number") return "Integer";
      if (_value === "boolean") return "Boolean";
      if (_value === "date") return "Datetime"; // TODO: need to figure something out here, with some Generic
      if (_value === "datetime") return "Datetime";
      if (_value === "time") return "Time";
      if (_value === "binary") return "Binary";
      if (_value === "uuid") return "UUID";
      if (_value === "password") return "Password";
      if (_value === "currency") return "Currency";
      if (_value === "float") return "Float";
      if (_value === "double") return "Double";
      if (_value === "decimal") return "Decimal";
      if (_value === "createdat") return "CreatedAt";
      if (_value === "updatedat") return "UpdatedAt";
      if (_value === "enum") return "Enum";
    }
  } else if (field.type.kind === "reference") {
    const value = field.type.value;
    if (typeof value === "string") {
      if (field.decorators?.includes("ManyToOne")) return "ReferenceManyToOne";
      if (field.decorators?.includes("OneToOne")) return "ReferenceOneToOne";
      if (field.decorators?.includes("OneToMany")) return "ReferenceOneToMany";
      if (field.decorators?.includes("ManyToMany"))
        return "ReferenceManyToMany";
    }
  }

  // Default to Text for unknown types
  const notFound = field.type.value as string;
  if (!notFound) {
    throw new Error(
      `Unknown field type: ${field.type} for field ${field.name}`
    );
  }
  return notFound;
}

// Main function
function main() {
  const { filePaths, outputDir, outputFile } = processArgs();

  const allTypeDefinitions: TypeDefinition[] = [];
  const allRelationships: Relationship[] = [];

  for (const filePath of filePaths) {
    try {
      const { typeDefinitions, relationships } = parseTypeScript(filePath);
      allTypeDefinitions.push(...typeDefinitions);
      allRelationships.push(...relationships);
      console.log(
        `Processed ${typeDefinitions.length} type definitions from ${filePath}`
      );
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  // Convert to CoreDBPlus definitions
  const coreDBPlusDefinitions = convertToCoreDBPlusDefinitions(
    allTypeDefinitions,
    allRelationships
  );

  // Determine output location
  let outputPath: string;
  if (outputFile) {
    outputPath = outputFile;
  } else if (outputDir) {
    outputPath = path.join(outputDir, "schema.ts");
  } else {
    outputPath = path.join(process.cwd(), "schema.ts");
  }

  // Ensure directory exists
  const outputDirPath = path.dirname(outputPath);
  if (!fs.existsSync(outputDirPath)) {
    fs.mkdirSync(outputDirPath, { recursive: true });
  }

  // Write to file
  fs.writeFileSync(outputPath, coreDBPlusDefinitions);
  console.log(`\nSchema definitions saved to ${outputPath}`);
}

// Run the main function
main();
