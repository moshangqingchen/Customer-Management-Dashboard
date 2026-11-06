import { useEffect, useState } from 'react';
import type { FileEntry } from '../../api/types';
import { useFileVersions, useReplaceFileVersion, useSaveFileVersion } from '../../hooks/fileHistory';
import { Button, Dialog, Input, Skeleton, toast } from '../ui';
import { FileVersionList } from './FileVersionList';

export function FileVersionDialog({ file, onClose }: { file: FileEntry | null; onClose: () => void }) {
  const versions = useFileVersions(file?.path, !!file); const save = useSaveFileVersion(); const replace = useReplaceFileVersion(); const [note, setNote] = useState('');
  useEffect(() => setNote(''), [file?.path]);
  return <Dialog open={!!file} onOpenChange={value => { if (!value) onClose(); }} title={`文件版本${file ? ` · ${file.name}` : ''}`} description="在这里主动保存快照或上传新版本。外部软件直接保存的每一次改动不会自动生成快照。">
    <div className="space-y-4">
      <Input aria-label="当前文件版本备注" placeholder="给当前版本写备注（可选）" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} />
      <div className="flex flex-wrap gap-2"><Button variant="primary" disabled={!file || save.isPending || replace.isPending} onClick={() => { if (file) save.mutate({ path: file.path, note }, { onSuccess: () => { setNote(''); toast.success('当前版本已保存'); } }); }}>保存当前版本</Button>
        <Button disabled={!file || save.isPending || replace.isPending} onClick={() => { if (file) replace.mutate({ path: file.path, note }, { onSuccess: result => { if (result) { setNote(''); toast.success('新版本已替换，原内容已保存为历史版本'); } } }); }}>上传新版本</Button></div>
      <p className="text-xs text-fg-2">上传新版本会先保留当前内容，再替换原文件。新文件需使用相同扩展名。</p>
      {versions.isPending ? <Skeleton className="h-32" /> : versions.isError ? <div role="alert"><p className="text-sm text-danger-fg">{versions.error.message}</p><Button onClick={() => void versions.refetch()}>重试读取版本</Button></div>
        : versions.data.length ? <FileVersionList versions={versions.data} /> : <p className="py-6 text-center text-sm text-fg-2">还没有保存的历史版本。</p>}
    </div>
  </Dialog>;
}
