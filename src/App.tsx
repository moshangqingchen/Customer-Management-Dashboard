import { Component, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLibraryStatus } from './hooks/queries';
import { applyTheme, useUI } from './stores/ui';
import { Button, Skeleton, ToastProvider } from './components/ui';
import { AppShell } from './components/layout/AppShell';
import { Onboarding } from './pages/Onboarding';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) return <main className="flex min-h-dvh items-center justify-center bg-app"><div className="space-y-4 text-center"><h1 className="text-xl font-semibold">暂时无法显示工作空间</h1><p className="text-fg-2">请重新加载页面后继续。</p><Button onClick={() => location.reload()}>重新加载</Button></div></main>;
    return this.props.children;
  }
}
export function App() {
  const theme = useUI(s => s.theme); const library = useLibraryStatus(); const queryClient = useQueryClient();
  useEffect(() => {
    const resetMock = () => { void queryClient.resetQueries(); };
    window.addEventListener('mock-reset', resetMock);
    return () => window.removeEventListener('mock-reset', resetMock);
  }, [queryClient]);
  useEffect(() => {
    applyTheme(theme); const media = matchMedia('(prefers-color-scheme: dark)'); const update = () => applyTheme(theme);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, [theme]);
  return <ErrorBoundary>
    {library.isPending ? <main className="space-y-5 p-10"><Skeleton className="h-9 w-48" /><Skeleton className="h-72 w-full" /></main> : library.isError ? <main className="flex min-h-dvh items-center justify-center"><div className="space-y-4 text-center"><h1 className="text-xl font-semibold">文件库状态读取失败</h1><p className="text-fg-2">{library.error.message}</p><Button onClick={() => void library.refetch()}>重新连接</Button></div></main> : library.data.state === 'notConfigured' ? <Onboarding /> : <AppShell />}
    <ToastProvider />
  </ErrorBoundary>;
}
