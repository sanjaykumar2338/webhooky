import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesPath = path.join(__dirname, '..', 'messages', 'templates.json');

export const loadTemplates = async () => {
  const data = await fs.readFile(templatesPath, 'utf8');
  return JSON.parse(data);
};

export const saveTemplates = async (templates) => {
  const serialized = `${JSON.stringify(templates, null, 2)}\n`;
  await fs.writeFile(templatesPath, serialized, 'utf8');
};

export default {
  loadTemplates,
  saveTemplates,
};
