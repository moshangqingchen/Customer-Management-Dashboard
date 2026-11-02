import type { HTMLAttributes } from 'react';
import { BitmapIllustration } from '../ui/Illustration';

export type IllustrationKind = 'today' | 'projects' | 'clients' | 'files' | 'snippets' | 'search' | 'offline';
type Props = HTMLAttributes<HTMLDivElement>;
export function Illustration({ kind, ...props }: Props & { kind: IllustrationKind }) { return <BitmapIllustration name={kind === 'offline' ? 'library-offline' : `empty-${kind}`} {...props} />; }
export function TodayIllustration(props: Props) { return <Illustration kind="today" {...props} />; }
export function ProjectsIllustration(props: Props) { return <Illustration kind="projects" {...props} />; }
export function ClientsIllustration(props: Props) { return <Illustration kind="clients" {...props} />; }
export function FilesIllustration(props: Props) { return <Illustration kind="files" {...props} />; }
export function SnippetsIllustration(props: Props) { return <Illustration kind="snippets" {...props} />; }
export function SearchIllustration(props: Props) { return <Illustration kind="search" {...props} />; }
export function OfflineIllustration(props: Props) { return <Illustration kind="offline" {...props} />; }
