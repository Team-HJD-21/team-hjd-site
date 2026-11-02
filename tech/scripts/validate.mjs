import { fileURLToPath } from 'node:url';
import { loadContent } from './content.mjs';
const project = fileURLToPath(new URL('../', import.meta.url));
const { allIssues, issues } = await loadContent(project);
console.log(`Validated ${allIssues.length} issue(s); ${issues.length} public. Dates use Asia/Seoul.`);
