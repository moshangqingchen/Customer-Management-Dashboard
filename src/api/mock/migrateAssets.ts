import type { FileEntry } from '../types';
import type { MockData, StoredProject } from './store';
import { designAssetId, designAssetNames } from './designAssets';
import { seedClientNames, seedProjectTitles } from './seed';

const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

/** Upgrade only recognizable demo artwork; never replace business records or user files. */
export function migrateMockAssets(data: MockData): void {
  data.fileAssets ??= {};
  if (data.assetVersion === 1) return;
  const presets = data.projects.flatMap(project => {
    const index = Number(project.id.replace(/^project-/, '')) - 1;
    const clientIndex = index % seedClientNames.length;
    const client = data.clients.find(value => value.id === project.clientId);
    return project.id === `project-${index + 1}` && project.title === seedProjectTitles[index]
      && project.clientId === `client-${clientIndex + 1}` && client?.name === seedClientNames[clientIndex]
      && !project.deletedAt && !client.deletedAt ? [{ project, index, client }] : [];
  });
  const legacy = data.files.flatMap(file => {
    const preset = presets.find(value => value.index < 8 && value.project.id === file.projectId);
    const root = (data.libraryRoot ?? 'D:/客户工作台').replace(/\\/g, '/').replace(/\/+$/, '');
    return preset && file.kind === 'image' && file.ext === 'svg' && file.folderGroup === '交付成品'
      && file.name === `${preset.project.title}·方案.svg` && file.clientId === preset.client.id
      && file.sizeBytes === 1800 + preset.index * 210
      && file.path.replace(/\\/g, '/').toLowerCase() === `${root}/${file.relPath}`.toLowerCase()
      && file.relPath === `${preset.project.folder}/交付成品/${file.name}` ? [{ file, preset }] : [];
  });
  for (const { file, preset } of legacy) {
    const oldPath = file.path;
    const directory = file.relPath.slice(0, -file.name.length);
    const name = availableFileName(data, directory, `${preset.project.title}·方案`);
    file.path = oldPath.slice(0, -file.name.length) + name;
    file.name = name; file.ext = 'webp'; file.relPath = directory + name;
    data.fileAssets[file.path] = data.fileAssets[oldPath] ?? designAssetNames[preset.index % designAssetNames.length];
    delete data.fileAssets[oldPath];
  }
  // Older seeds had artwork only on projects 1–8. Do not recreate a deleted or renamed one there.
  if (legacy.length > 0) {
    const covered = new Set(data.files.filter(file => imageExtensions.includes(file.ext.toLowerCase()) && file.sizeBytes <= 25 * 1024 * 1024).map(file => file.projectId));
    const target = Math.ceil(presets.length * 0.6);
    const presetIds = new Set(presets.map(value => value.project.id));
    let count = [...covered].filter(id => id && presetIds.has(id)).length;
    for (const { project, index, client } of presets) {
      if (count >= target) break;
      if (index < 8 || covered.has(project.id) || data.files.some(file => file.projectId === project.id && file.kind === 'image')) continue;
      const clientFolder = client.folder ?? availableFolder(data, client.name, client.id);
      const projectFolder = project.folder ?? availableFolder(data, `${clientFolder}/${project.createdAt.slice(0, 7)} ${project.title}`, project.id);
      const file = sampleFile(data, project, index, projectFolder);
      data.files.push(file); data.fileAssets[file.path] = designAssetNames[index % designAssetNames.length];
      covered.add(project.id); count++;
    }
  }
  for (const file of data.files) {
    if (file.kind === 'image') data.fileAssets[file.path] ??= designAssetId(file.path);
  }
  data.assetVersion = 1;
}

function availableFileName(data: MockData, directory: string, stem: string): string {
  let name = `${stem}.webp`; let suffix = 2;
  while (data.files.some(file => file.relPath.toLowerCase() === `${directory}${name}`.toLowerCase())) name = `${stem} (${suffix++}).webp`;
  return name;
}

function availableFolder(data: MockData, proposed: string, except: string): string {
  const occupied = [...data.clients, ...data.projects].filter(record => record.id !== except).map(record => record.folder?.toLowerCase());
  let folder = proposed; let suffix = 2;
  while (occupied.includes(folder.toLowerCase())) folder = `${proposed} (${suffix++})`;
  return folder;
}

function sampleFile(data: MockData, project: StoredProject, index: number, folder: string): FileEntry {
  const directory = `${folder}/交付成品/`;
  const name = availableFileName(data, directory, `${project.title}·方案`);
  const relPath = directory + name;
  const root = (data.libraryRoot ?? 'D:/客户工作台').replace(/\\/g, '/').replace(/\/+$/, '');
  return { path: `${root}/${relPath}`, relPath, name, ext: 'webp', kind: 'image', sizeBytes: 48000 + index * 210,
    modifiedAt: project.updatedAt, folderGroup: '交付成品', clientId: project.clientId, projectId: project.id };
}
