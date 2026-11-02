import { useEffect, useState } from 'react';
import tokens from '../../styles/tokens.css?raw';
import { useUI } from '../../stores/ui';
import { BitmapIllustration, illustrationNames } from '../ui/Illustration';
import { Card, Section } from '../ui';

const tokenNames = [...new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]))];
export function TokenGallery() {
  const theme = useUI(s => s.theme); const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const update = () => { const styles = getComputedStyle(document.documentElement); setValues(Object.fromEntries(tokenNames.map(name => [name, styles.getPropertyValue(name).trim()]))); };
    const frame = requestAnimationFrame(update); const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [theme]);
  return <div className="space-y-8">
    <Section title="全部设计变量"><Card className="overflow-hidden"><dl className="divide-y divide-line">{tokenNames.map(name => <div key={name} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[200px_minmax(0,1fr)]"><dt className="font-medium">{name}</dt><dd className="break-all text-fg-2">{values[name] || '正在读取…'}</dd></div>)}</dl></Card></Section>
    <Section title="正式插画资源"><div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{illustrationNames.map(name => <Card key={name} className="flex min-w-0 flex-col items-center gap-3 p-5"><BitmapIllustration name={name} className={name.startsWith('hero-') ? 'h-32 w-full rounded-lg' : 'size-40'} /><p className="break-all text-xs text-fg-2">{name}</p></Card>)}</div></Section>
    <Section title="圆角、阴影与字号"><Card className="flex flex-wrap items-end gap-6 p-6">{['sm', 'md', 'lg', 'xl', '2xl'].map(size => <div key={size} className="flex size-20 items-center justify-center border border-line bg-primary-soft text-xs text-accent" style={{ borderRadius: `var(--r-${size})`, boxShadow: 'var(--shadow-sm)' }}>{size}</div>)}<p className="text-page font-semibold">页面标题 26</p><p className="text-stat font-bold">统计数字 32</p><p className="text-hero font-bold">问候 40</p></Card></Section>
  </div>;
}
