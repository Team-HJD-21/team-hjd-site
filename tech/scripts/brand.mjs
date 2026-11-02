import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Composition only: the rocket is the original TeamHJD PNG, with original pixels.
// Nested SVG viewports select the rocket without redrawing or modifying the source.
export async function buildBrand(project, destination) {
  const original = (await readFile(join(project, 'assets/brand/teamhjd-original.png'))).toString('base64');
  const lettering = (await readFile(join(project, 'assets/brand/notes-lettering.png'))).toString('base64');
  const rocket = `<image width="652" height="652" href="data:image/png;base64,${original}"/>`;
  await writeFile(join(destination, 'gambungi-wordmark.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="180" viewBox="0 0 720 180" role="img" aria-label="겜붕이의 노트 by TeamHJD"><title>겜붕이의 노트 by TeamHJD</title><svg x="0" y="4" width="140" height="172" viewBox="205 85 255 285">${rocket}</svg><svg x="146" y="13" width="570" height="161" viewBox="40 110 2100 595"><image width="2172" height="724" href="data:image/png;base64,${lettering}"/></svg></svg>`);
  await writeFile(join(destination, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><title>겜붕이의 노트</title><rect width="32" height="32" rx="6" fill="#10191b"/><svg x="1" y="1" width="30" height="30" viewBox="205 85 255 285">${rocket}</svg></svg>`);
}
