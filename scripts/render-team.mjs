import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {members, projects} from '../data/team.mjs';
import {renderProfilePage, renderRoster, renderStudioLeadership} from './team-template.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function generateTeamPages() {
  const homePath = path.join(root, 'index.html');
  let home = readFileSync(homePath, 'utf8');
  const project = projects.find(project => project.id === 'the-developer');
  home = home.replace(/<!-- team-roster:start -->[\s\S]*?<!-- team-roster:end -->/, `<!-- team-roster:start -->\n${renderRoster(project)}\n      <!-- team-roster:end -->`);
  home = home.replace(/<!-- studio-leadership:start -->[\s\S]*?<!-- studio-leadership:end -->/, `<!-- studio-leadership:start -->\n${renderStudioLeadership()}\n        <!-- studio-leadership:end -->`);
  if (home !== readFileSync(homePath, 'utf8')) writeFileSync(homePath, home);
  const pages = [];
  for (const member of members.filter(member => member.profileEnabled)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(member.slug)) throw new Error('Invalid profile slug');
    const page = `team/${member.slug}/index.html`;
    const filename = path.join(root, page);
    mkdirSync(path.dirname(filename), {recursive: true});
    writeFileSync(filename, renderProfilePage(member, home));
    pages.push(page);
  }
  return pages;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log('Generated team profiles:', generateTeamPages().join(', '));
