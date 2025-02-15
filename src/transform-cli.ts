#!/usr/bin/env node
import { createTransformerProgram } from './transformer';
import path from 'path';

const configPath = process.argv[2] || 'tsconfig.json';
const fullConfigPath = path.resolve(process.cwd(), configPath);

try {
  createTransformerProgram(fullConfigPath);
  console.log('Successfully transformed TypeScript files');
} catch (error) {
  console.error('Error transforming files:', error);
  process.exit(1);
}
