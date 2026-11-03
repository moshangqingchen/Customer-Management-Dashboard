import { FolderOpen, ArrowRight, Check } from 'lucide-react';
import { useAppInfo, usePickFolder, useSetLibraryRoot } from '../hooks/queries';
import { Button, BitmapIllustration } from '../components/ui';
import { Brand } from '../components/layout/Brand';

export function Onboarding() {
  const app = useAppInfo(); const pick = usePickFolder(); const setRoot = useSetLibraryRoot();
  const suggestedRoot = app.data?.portable ? app.data.suggestedLibraryRoot : null;
  const pending = pick.isPending || setRoot.isPending;
  async function choose() { const path = await pick.mutateAsync(undefined); if (path) await setRoot.mutateAsync(path); }
  return <main className="flex min-h-dvh items-center justify-center bg-app p-8" style={{ backgroundImage: 'var(--bg-glow)', backgroundAttachment: 'fixed' }}>
    <div className="grid w-full max-w-[1040px] overflow-hidden rounded-[28px] border border-line/60 bg-surface shadow-lg md:grid-cols-2">
      <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-accent-soft p-8">
        <BitmapIllustration name="welcome" alt="设计师与橘猫团子一起整理作品" className="h-full max-h-[580px] w-full object-contain" />
        <span className="absolute right-9 bottom-20 flex size-12 items-center justify-center rounded-xl bg-success-bg text-success-fg shadow-sm"><Check size={28} /></span>
        <p className="absolute bottom-7 left-0 w-full text-center text-sm text-fg-2">给灵感一个家，给每一单一份安心。</p>
      </div>
      <div className="flex flex-col justify-center p-10 lg:p-12">
        <Brand /><p className="mb-3 mt-10 text-sm font-medium text-accent">欢迎来到你的创意工作空间</p>
        <h1 className="text-[32px] leading-[44px] font-bold tracking-tight">把每一份用心，<br />好好归档。</h1>
        <p className="mb-6 mt-4 text-[15px] leading-6 text-fg-2">客户、项目、文件与收款，都在这里从容照顾。先为你的作品选择一个文件库位置。</p>
        <div className="mb-7 flex items-start gap-3 rounded-lg bg-subtle p-4 text-fg-2"><FolderOpen size={22} className="mt-0.5 shrink-0 text-accent" /><div className="min-w-0"><p className="break-all text-sm font-medium">建议位置：{suggestedRoot ?? '文档\\客户工作台'}</p><p className="mt-2 text-xs leading-5">设计稿保存在你能看见的文件夹中，随时可以在资源管理器里打开。</p></div></div>
        <Button variant="primary" size="lg" className="w-full" disabled={pending || app.isPending} onClick={() => void (suggestedRoot ? setRoot.mutateAsync(suggestedRoot) : choose()).catch(() => undefined)}>
          {pending ? '正在设置文件库…' : suggestedRoot ? '使用这个位置' : '选择文件库位置'}<ArrowRight size={18} />
        </Button>
        {suggestedRoot && <Button variant="ghost" className="mt-3 w-full" disabled={pending} onClick={() => void choose().catch(() => undefined)}>选择其他位置</Button>}
        <p className="mt-4 text-center text-xs text-fg-3">所有数据都保存在本机，安心开始。</p>
      </div>
    </div>
  </main>;
}
