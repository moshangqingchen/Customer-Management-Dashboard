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
  Star,
} from "lucide-react";

import type { PageId } from "../lib/types";

const navigation: { id: PageId; label: string; icon: typeof LayoutDashboard; accent: string }[] = [
  { id: "dashboard", label: "工作台", icon: LayoutDashboard, accent: "teal" },
  { id: "customers", label: "客户管理", icon: ContactRound, accent: "coral" },
  { id: "orders", label: "订单管理", icon: PackageCheck, accent: "purple" },
  { id: "quickReplies", label: "客服快捷语", icon: MessageCircle, accent: "blue" },
  { id: "factories", label: "源头厂家", icon: Factory, accent: "teal" },
  { id: "vip", label: "星级 VIP", icon: Star, accent: "yellow" },
  { id: "files", label: "文件中心", icon: FolderOpen, accent: "blue" },
  { id: "import", label: "导入与导出", icon: Archive, accent: "orange" },
  { id: "settings", label: "设置", icon: Settings, accent: "gray" },
];

export function Sidebar({ page, onNavigate, libraryRoot }: { page: PageId; onNavigate: (page: PageId) => void; libraryRoot?: string | null }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Sparkles size={20} />
        </div>
        <div>
          <strong>创业客户</strong>
          <span>管理工作台</span>
        </div>
      </div>
      <nav>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              title={item.label}
            >
              <span className={`nav-icon nav-${item.accent}`}><Icon size={18} /></span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="storage-card">
          <div className="storage-icon"><FileArchive size={18} /></div>
          <div>
            <strong>本地文件库</strong>
            <span>{libraryRoot ? "已连接并自动管理" : "尚未设置"}</span>
          </div>
          <i className={libraryRoot ? "online" : "offline"} />
        </div>
        <p>离线优先 · 数据保存在你的电脑</p>
      </div>
    </aside>
  );
}
