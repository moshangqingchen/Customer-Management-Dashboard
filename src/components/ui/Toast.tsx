import { Check, CircleAlert, Info, LoaderCircle, X } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useUI } from '../../stores/ui';
export { toast };
export function ToastProvider() {
  const theme = useUI(state => state.theme);
  return <Toaster position="bottom-right" theme={theme} containerAriaLabel="通知" closeButton duration={5000} icons={{ success: <Check size={20} className="text-success-fg" />, error: <X size={20} className="text-danger-fg" />, info: <Info size={20} className="text-fg-2" />, warning: <CircleAlert size={20} className="text-warning-fg" />, loading: <LoaderCircle size={20} className="animate-spin text-fg-2" /> }} toastOptions={{ closeButtonAriaLabel: '关闭通知', classNames: { toast: '!gap-3 !rounded-lg !border !border-line !bg-surface !p-4 !text-fg !shadow-md', icon: '!size-5 !shrink-0', title: '!font-medium', description: '!text-fg-2', actionButton: '!rounded-sm !bg-primary-soft !text-primary', cancelButton: '!bg-subtle !text-fg-2', closeButton: '!border-line !bg-surface !text-fg-2' } }} />;
}
export function undoToast(message: string, undo: () => void | Promise<unknown>) { return toast(message, { icon: <Info size={20} className="text-fg-2" />, duration: 5000, action: { label: '撤销', onClick: () => { void Promise.resolve().then(undo).catch(error => toast.error(error instanceof Error ? error.message : '撤销失败')); } } }); }
