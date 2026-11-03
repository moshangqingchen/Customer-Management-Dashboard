import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (value: string, successMessage = '已复制'): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(value);
      clearTimeout(timer.current);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1200);
      toast.success(successMessage);
      return true;
    } catch {
      toast.error('复制失败，请重试');
      return false;
    }
  }, []);
  return { copy, copied };
}
