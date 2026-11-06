import { useState } from 'react';
import type { FileVersion } from '../../api/fileHistory';
import type { FileEntry } from '../../api/types';
import { useOpenFile, useRevealFile } from '../../hooks/queries';
import { useRestoreFileVersion } from '../../hooks/fileHistory';
import { fileExtension, fileKind, formatFileSize } from '../../lib/files';
import { formatDateTime } from '../../lib/dates';
import { Button, ConfirmDialog, toast } from '../ui';
import { FilePreview } from './FilePreview';

function previewFile(version: FileVersion): FileEntry {
  return { path: version.snapshotPath, relPath: version.snapshotPath, name: version.name, ext: fileExtension(version.name), kind: fileKind(version.name),
    sizeBytes: version.sizeBytes, modifiedAt: version.createdAt, folderGroup: '', clientId: version.clientId, projectId: version.projectId };
}
export function FileVersionList({ versions, showPath = false }: { versions: FileVersion[]; showPath?: boolean }) {
  const open = useOpenFile(); const reveal = useRevealFile(); const restore = useRestoreFileVersion();
  const [selected, setSelected] = useState<FileVersion>(); const [preview, setPreview] = useState<string | null>(null); const [opener, setOpener] = useState<HTMLElement | null>(null);
  return <>
    <div className="space-y-2">{versions.map(version => <div key={version.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0 flex-1"><p className="break-words font-medium">{version.note || '未填写备注'}</p>
        <p className="mt-1 text-xs text-fg-2">{formatDateTime(version.createdAt)} · {formatFileSize(version.sizeBytes)}{!version.available && ' · 快照文件缺失'}</p>
        {showPath && <p className="mt-1 break-all text-xs text-fg-2">{version.originalRelPath}</p>}</div>
      <div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" disabled={!version.available} onClick={event => { setOpener(event.currentTarget); setPreview(version.snapshotPath); }}>预览</Button>
        <Button size="sm" variant="ghost" disabled={!version.available} onClick={() => open.mutate(version.snapshotPath)}>打开</Button>
        <Button size="sm" variant="ghost" disabled={!version.available} onClick={() => reveal.mutate(version.snapshotPath)}>定位</Button>
        <Button size="sm" disabled={!version.available || restore.isPending} onClick={() => setSelected(version)}>恢复此版本</Button></div>
    </div>)}</div>
    <ConfirmDialog open={!!selected} onOpenChange={value => { if (!value) setSelected(undefined); }} title="恢复这个文件版本？" danger={false} confirmLabel="保留当前版本并恢复"
      description={`将恢复到「${selected?.originalRelPath ?? ''}」。如果当前文件存在，会先保存当前版本，再替换内容；其他文件不受影响。`}
      onConfirm={async () => { if (selected) { const file = await restore.mutateAsync(selected.id); setSelected(undefined); toast.success(`版本已恢复：${file.name}`); } }} />
    <FilePreview files={versions.filter(version => version.available).map(previewFile)} path={preview} onPathChange={setPreview} onClose={() => setPreview(null)}
      context={file => versions.find(version => version.snapshotPath === file.path)?.originalRelPath ?? ''} returnFocus={opener} />
  </>;
}
