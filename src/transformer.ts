import ts from "typescript";

export function createTransformer(): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext) => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isVariableDeclaration(node) && node.type) {
        if (isDBTypeReference(node.type)) {
          return transformDBDeclaration(node, context);
        }
      }
      return ts.visitEachChild(node, visitor, context);
    };

    return (sourceFile: ts.SourceFile) => {
      return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
    };
  };
}

function isDBTypeReference(node: ts.TypeNode): boolean {
  if (!ts.isTypeReferenceNode(node)) return false;
  if (node.typeName.getText() !== "DB") return false;
  if (!node.typeArguments) return false;
  return node.typeArguments.length === 1;
}

function transformDBDeclaration(
  node: ts.VariableDeclaration,
  context: ts.TransformationContext
): ts.Node {
  const typeRef = node.type as ts.TypeReferenceNode;
  const schemaType = typeRef.typeArguments![0];

  if (ts.isTypeLiteralNode(schemaType)) {
    const zodSchema = generateZodSchema(schemaType);
    const wrapperCode = generateWrapperCode(node.name.getText(), zodSchema);

    return ts.factory.createVariableDeclaration(
      node.name,
      undefined,
      node.type,
      wrapperCode
    );
  }

  return node;
}

function generateZodSchema(typeLiteral: ts.TypeLiteralNode): ts.CallExpression {
  const properties: ts.PropertyAssignment[] = [];

  for (const member of typeLiteral.members) {
    if (ts.isPropertySignature(member) && member.type) {
      const propName = member.name.getText();
      const zodType = generateZodTypeForProperty(member);

      properties.push(
        ts.factory.createPropertyAssignment(
          ts.factory.createStringLiteral(propName),
          zodType
        )
      );
    }
  }

  return ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("z"),
      ts.factory.createIdentifier("object")
    ),
    undefined,
    [ts.factory.createObjectLiteralExpression(properties, true)]
  );
}

function generateZodTypeForProperty(
  prop: ts.PropertySignature
): ts.CallExpression {
  const baseZod = ts.factory.createIdentifier("z");

  if (!prop.type) {
    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        baseZod,
        ts.factory.createIdentifier("any")
      ),
      undefined,
      []
    );
  }

  const baseType = getBaseType(prop.type);
  let zodType = createZodType(baseType);

  // Apply constraints
  zodType = applyTypeConstraints(zodType, prop.type);

  // Make required by default unless explicitly optional
  if (!prop.questionToken) {
    zodType = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        zodType,
        ts.factory.createIdentifier("required")
      ),
      undefined,
      []
    );
  }

  return zodType;
}

function getBaseType(type: ts.TypeNode): ts.TypeNode {
  if (ts.isTypeReferenceNode(type)) {
    const typeName = type.typeName.getText();
    if (
      typeName === "DBUnique" ||
      typeName === "DBRequired" ||
      typeName === "DBDefault" ||
      typeName === "DBForeignKey"
    ) {
      return type.typeArguments![0];
    }
  }
  return type;
}

function createZodType(type: ts.TypeNode): ts.CallExpression {
  const baseZod = ts.factory.createIdentifier("z");

  if (ts.isUnionTypeNode(type)) {
    // Handle union types (enums)
    const literals = type.types.map((t) => {
      if (ts.isLiteralTypeNode(t)) {
        const text = t.literal.getText();
        // Remove quotes from string literals
        return ts.factory.createStringLiteral(text.replace(/['"]/g, ""));
      }
      return ts.factory.createStringLiteral("unknown");
    });

    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        baseZod,
        ts.factory.createIdentifier("enum")
      ),
      undefined,
      [ts.factory.createArrayLiteralExpression(literals, true)]
    );
  }

  // Handle basic types that map to CoreDB field types
  let methodName: string;
  switch (type.kind) {
    case ts.SyntaxKind.StringKeyword:
      methodName = "string";
      break;
    case ts.SyntaxKind.NumberKeyword:
      methodName = "number";
      break;
    case ts.SyntaxKind.BooleanKeyword:
      methodName = "boolean";
      break;
    default:
      if (type.getText() === "Date") {
        methodName = "date";
      } else {
        methodName = "any";
      }
  }

  return ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      baseZod,
      ts.factory.createIdentifier(methodName)
    ),
    undefined,
    []
  );
}

function applyTypeConstraints(
  zodType: ts.CallExpression,
  type: ts.TypeNode
): ts.CallExpression {
  if (!ts.isTypeReferenceNode(type)) return zodType;

  const typeName = type.typeName.getText();
  switch (typeName) {
    case "DBUnique":
      return ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          zodType,
          ts.factory.createIdentifier("refine")
        ),
        undefined,
        [
          ts.factory.createArrowFunction(
            undefined,
            undefined,
            [ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              ts.factory.createIdentifier("val"),
              undefined,
              undefined,
              undefined
            )],
            undefined,
            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            ts.factory.createTrue()
          ),
          ts.factory.createObjectLiteralExpression(
            [
              ts.factory.createPropertyAssignment(
                "message",
                ts.factory.createStringLiteral("Must be unique")
              ),
            ],
            false
          ),
        ]
      );
    case "DBRequired":
      return ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          zodType,
          ts.factory.createIdentifier("required")
        ),
        undefined,
        []
      );
    case "DBForeignKey":
      // First make it an integer
      const intType = ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          zodType,
          ts.factory.createIdentifier("int")
        ),
        undefined,
        []
      );

      // Then add validation for positive IDs
      return ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          intType,
          ts.factory.createIdentifier("refine")
        ),
        undefined,
        [
          ts.factory.createArrowFunction(
            undefined,
            undefined,
            [ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              ts.factory.createIdentifier("val"),
              undefined,
              undefined,
              undefined
            )],
            undefined,
            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            ts.factory.createBinaryExpression(
              ts.factory.createIdentifier("val"),
              ts.factory.createToken(ts.SyntaxKind.GreaterThanToken),
              ts.factory.createNumericLiteral("0")
            )
          ),
          ts.factory.createObjectLiteralExpression(
            [
              ts.factory.createPropertyAssignment(
                "message",
                ts.factory.createStringLiteral("Must be a valid ID")
              ),
            ],
            false
          ),
        ]
      );
    default:
      return zodType;
  }
}

function generateWrapperCode(
  variableName: string,
  zodSchema: ts.CallExpression
): ts.CallExpression {
  return ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createNewExpression(
            ts.factory.createIdentifier("Wrapper"),
            undefined,
            [ts.factory.createIdentifier("db")]
          ),
          ts.factory.createIdentifier("schema")
        ),
        undefined,
        [ts.factory.createStringLiteral(variableName)]
      ),
      ts.factory.createIdentifier("withZodSchema")
    ),
    undefined,
    [zodSchema]
  );
}

export function createTransformerProgram(configPath: string) {
  const program = ts.createProgram([configPath], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
  });

  const transformers: ts.CustomTransformers = {
    before: [createTransformer()],
  };

  const { emitSkipped, diagnostics } = program.emit(
    undefined,
    undefined,
    undefined,
    false,
    transformers
  );

  if (emitSkipped) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => process.cwd(),
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => "\n",
      })
    );
  }
}
