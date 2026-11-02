import { toast } from 'sonner';
import type { FilesAddResult } from '../../api/types';

export function filesAddedToast(result: FilesAddResult): void {
  if (result.failed.length) {
    toast.warning(`已添加 ${result.added.length} 个，${result.failed.length} 个失败`, {
      duration: 10000,
      description: <details className="mt-2 max-w-sm text-sm"><summary className="cursor-pointer text-primary">查看失败文件与原因</summary><ul className="mt-2 max-h-48 space-y-2 overflow-auto">{result.failed.map((file, index) => <li key={`${file.name}:${index}`}><strong className="break-all">{file.name}</strong><p className="text-fg-2">{file.message}</p></li>)}</ul></details>,
    });
  } else if (result.added.length) toast.success(`已添加 ${result.added.length} 个文件`);
}
