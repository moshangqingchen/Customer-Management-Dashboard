import {
  Archive,
  ContactRound,
  FileArchive,
  Factory,
  FolderOpen,
  LayoutDashboard,
  MessageCircle,
  PackageCheck,
  Settings,
  Sparkles,
} from "lucide-react";

import type { PageId, StorageHealth } from "../lib/types";

type NavigationItem = {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
  accent: string;
};

const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  {
    label: "日常工作",
    items: [
      { id: "dashboard", label: "工作台", icon: LayoutDashboard, accent: "teal" },
      { id: "customers", label: "客户管理", icon: ContactRound, accent: "coral" },
      { id: "orders", label: "订单管理", icon: PackageCheck, accent: "purple" },
      { id: "quickReplies", label: "客服快捷语", icon: MessageCircle, accent: "blue" },
    ],
  },
  {
    label: "资源",
    items: [
      { id: "factories", label: "源头厂家", icon: Factory, accent: "teal" },
      { id: "files", label: "文件中心", icon: FolderOpen, accent: "blue" },
    ],
  },
  {
    label: "数据与系统",
    items: [
      { id: "import", label: "数据与备份", icon: Archive, accent: "orange" },
      { id: "settings", label: "设置", icon: Settings, accent: "gray" },
    ],
  },
];

const storageLabels: Record<StorageHealth["status"], string> = {
  ready: "已连接，可正常读写",
  notConfigured: "尚未设置",
  missing: "目录或磁盘暂不可用",
  notDirectory: "路径不是文件夹",
  readOnly: "当前目录不可写",
  error: "状态检查失败",
};

export function Sidebar({
  page,
  onNavigate,
  libraryRoot,
  storageHealth,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  libraryRoot?: string | null;
  storageHealth?: StorageHealth | null;
}) {
  const healthStatus = storageHealth?.status ?? (libraryRoot ? "error" : "notConfigured");
  const healthLabel = storageHealth?.message || storageLabels[healthStatus];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Sparkles size={20} /></div>
        <div><strong>创业客户</strong><span>管理工作台</span></div>
      </div>
      <nav aria-label="主导航">
        {navigationGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <span className="nav-group-label">{group.label}</span>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={page === item.id ? "active" : ""}
                  onClick={() => onNavigate(item.id)}
                  aria-current={page === item.id ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                >
                  <span className={`nav-icon nav-${item.accent}`}><Icon size={18} /></span>
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button
          className="storage-card storage-card-button"
          onClick={() => onNavigate("settings")}
          title={storageHealth?.path || libraryRoot || healthLabel}
          aria-label={`文件库状态：${healthLabel}，打开设置`}
        >
          <span className="storage-icon"><FileArchive size={18} /></span>
          <span>
            <strong>本地文件库</strong>
            <small>{healthLabel}</small>
          </span>
          <i className={healthStatus === "ready" ? "online" : "offline"} aria-hidden="true" />
        </button>
        <p>离线优先 · 数据保存在你的电脑</p>
      </div>
    </aside>
  );
}
