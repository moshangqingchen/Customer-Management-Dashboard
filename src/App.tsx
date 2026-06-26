import { useEffect, useRef, useState } from "react";
import { Bell, Command, DownloadCloud, Plus, RefreshCw, Search, Sparkles, X } from "lucide-react";

import { CustomerForm } from "./components/CustomerForm";
import { OrderForm } from "./components/OrderForm";
import { Sidebar } from "./components/Sidebar";
import { UpdateDialog, type UpdateInstallStatus } from "./components/UpdateDialog";
import { Button, Modal } from "./components/ui";
import { api } from "./lib/api";
import { checkForAppUpdate, closePendingUpdate, installAppUpdate, type PendingUpdate } from "./lib/updater";
import type {
  AppSettings,
  Customer,
  DashboardSummary,
  FileRecord,
  Order,
  PageId,
  SearchHit,
  SourceFactory,
  SourceQuote,
} from "./lib/types";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FactoriesPage } from "./pages/FactoriesPage";
import { FilesPage } from "./pages/FilesPage";
import { ImportExportPage } from "./pages/ImportExportPage";
import { Onboarding } from "./pages/Onboarding";
import { OrdersPage } from "./pages/OrdersPage";
import { SettingsPage } from "./pages/SettingsPage";

const emptyDashboard: DashboardSummary = {
  pendingDesign: 0,
  dueSoon: 0,
  overdue: 0,
  pendingShipment: 0,
  unpaidCents: 0,
  monthRevenueCents: 0,
  todoOrders: [],
  recentOrders: [],
  recentFiles: [],
};

export default function App() {
  const [page, setPage] = useState<PageId>(() => {
    const requested = new URLSearchParams(window.location.search).get("page");
    return ["dashboard", "customers", "orders", "factories", "vip", "files", "import", "settings"].includes(requested ?? "")
      ? requested as PageId
      : "dashboard";
  });
  const [settings, setSettings] = useState<AppSettings>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [sourceFactories, setSourceFactories] = useState<SourceFactory[]>([]);
  const [sourceQuotes, setSourceQuotes] = useState<SourceQuote[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fileRefreshKey, setFileRefreshKey] = useState(0);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [error, setError] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateInstallStatus>("available");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState("");
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [customerModal, setCustomerModal] = useState<Customer | "new" | null>(null);
  const [orderModal, setOrderModal] = useState<Order | "new" | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const updateCheckedRef = useRef(false);

  const load = async (initial = false) => {
    if (initial) setLoading(true);
    setError("");
    try {
      const [nextSettings, nextCustomers, nextOrders, nextFiles, nextDashboard, nextFactories, nextQuotes] = await Promise.all([
        api.getSettings(),
        api.listCustomers(),
        api.listOrders(),
        api.listFiles(),
        api.dashboard(),
        api.listSourceFactories(),
        api.listSourceQuotes(),
      ]);
      setSettings(nextSettings);
      setCustomers(nextCustomers);
      setOrders(nextOrders);
      setFiles(nextFiles);
      setDashboard(nextDashboard);
      setSourceFactories(nextFactories);
      setSourceQuotes(nextQuotes);
    } catch (reason) {
      setError(String(reason));
    } finally {
      if (initial) setLoading(false);
    }
  };

  const refreshFromDisk = async () => {
    setRefreshing(true);
    setError("");
    try {
      await api.syncManagedLibrary();
      setFileRefreshKey((value) => value + 1);
      await load();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setRefreshing(false);
    }
  };

  const checkUpdates = async (manual = false) => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    setUpdateError("");
    if (manual) setUpdateMessage("");
    try {
      const update = await checkForAppUpdate();
      if (update) {
        setPendingUpdate(update);
        setUpdateStatus("available");
        setUpdateProgress(0);
        setUpdateMessage("");
      } else if (manual) {
        setUpdateMessage("当前已经是最新版本。");
      }
    } catch (reason) {
      const message = String(reason);
      if (manual) setUpdateMessage(`检查更新失败：${message}`);
      else console.warn("Automatic update check failed", reason);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const dismissPendingUpdate = async () => {
    if (pendingUpdate) await closePendingUpdate(pendingUpdate);
    setPendingUpdate(null);
    setUpdateStatus("available");
    setUpdateProgress(0);
    setUpdateError("");
  };

  const installPendingUpdate = async () => {
    if (!pendingUpdate || updateStatus === "installing") return;

    setUpdateStatus("installing");
    setUpdateProgress(0);
    setUpdateError("");
    try {
      await installAppUpdate(pendingUpdate, setUpdateProgress);
      await api.restartApp();
    } catch (reason) {
      setUpdateStatus("error");
      setUpdateError(String(reason));
    }
  };

  useEffect(() => { load(true); }, []);
  useEffect(() => {
    if (loading || updateCheckedRef.current) return;
    updateCheckedRef.current = true;
    void checkUpdates(false);
  }, [loading]);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (query.trim()) setSearchHits(await api.search(query));
      else setSearchHits([]);
    }, 180);
    return () => clearTimeout(timeout);
  }, [query]);

  const newOrder = () => {
    if (customers.length === 0) setCustomerModal("new");
    else setOrderModal("new");
  };

  const deleteOrder = async (order: Order) => {
    if (!window.confirm(`确定删除订单「${order.externalOrderNo || order.customerName}」吗？删除后不会在订单列表显示。`)) return;
    await api.deleteOrder(order.id);
    if (selectedOrderId === order.id) setSelectedOrderId(null);
    await load();
  };

  const deleteCustomer = async (customer: Customer) => {
    if (!window.confirm(`确定删除客户「${customer.name}」吗？该客户的订单也会从当前列表隐藏。`)) return;
    await api.deleteCustomer(customer.id);
    if (selectedCustomerId === customer.id) setSelectedCustomerId(null);
    if (orders.some((order) => order.customerId === customer.id && order.id === selectedOrderId)) setSelectedOrderId(null);
    await load();
  };

  if (loading) {
    return <main className="loading-screen"><div className="brand-mark"><Sparkles size={23} /></div><strong>正在打开创业客户管理工作台</strong><span>整理今天要做的事情…</span></main>;
  }
  const updateSurface = <>
    {updateMessage && <div className="update-toast" role="status">{updateMessage}<button onClick={() => setUpdateMessage("")}>知道了</button></div>}
    {pendingUpdate && <UpdateDialog update={pendingUpdate} status={updateStatus} progress={updateProgress} error={updateError} onDismiss={dismissPendingUpdate} onInstall={installPendingUpdate} />}
  </>;

  if (!settings.libraryRoot) return <>
    <Onboarding onReady={() => load(true)} />
    {updateSurface}
  </>;

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={setPage} libraryRoot={settings.libraryRoot} />
      <main className="workspace">
        <header className="topbar">
          <div className="global-search">
            <Search size={18} />
            <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户、订单号、电话、快递单号…" />
            <kbd><Command size={12} /> K</kbd>
            {query && <button onClick={() => setQuery("")}><X size={15} /></button>}
            {query && <div className="search-popover">
              <div className="search-popover-title"><span>全局搜索</span><small>{searchHits.length} 条结果</small></div>
              {searchHits.length === 0 ? <p>没有找到匹配内容</p> : searchHits.map((hit) => <button key={`${hit.entityType}-${hit.entityId}`} onClick={() => {
                if (hit.entityType === "order") { setPage("orders"); setSelectedOrderId(hit.entityId); }
                else if (hit.entityType === "factory") { setPage("factories"); setSelectedFactoryId(hit.entityId); }
                else { setPage("customers"); setSelectedCustomerId(hit.entityId); }
                setQuery("");
              }}><i>{hit.entityType === "order" ? "订单" : hit.entityType === "factory" ? "厂家" : "客户"}</i><span><b>{hit.title}</b><small>{hit.subtitle}</small></span></button>)}
            </div>}
          </div>
          <div className="topbar-actions">
            {api.isDemo && <span className="demo-pill">界面演示模式</span>}
            <Button variant="secondary" onClick={() => checkUpdates(true)} disabled={checkingUpdate}>
              <DownloadCloud size={16} className={checkingUpdate ? "spin" : ""} />{checkingUpdate ? "检查中" : "检查更新"}
            </Button>
            <Button variant="secondary" onClick={refreshFromDisk} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />{refreshing ? "刷新中" : "刷新"}
            </Button>
            <button className="icon-button notification"><Bell size={18} />{dashboard.overdue > 0 && <i>{dashboard.overdue}</i>}</button>
            <Button onClick={newOrder}><Plus size={17} />新建订单</Button>
          </div>
        </header>
        {updateSurface}
        {error && <div className="fatal-banner">{error}<button onClick={() => load()}>重试</button></div>}
        {page === "dashboard" && <DashboardPage summary={dashboard} onNewOrder={newOrder} onNewCustomer={() => setCustomerModal("new")} onNavigate={setPage} onSelectOrder={(order) => { setSelectedOrderId(order.id); setPage("orders"); }} />}
        {page === "customers" && <CustomersPage customers={customers} orders={orders} selectedCustomerId={selectedCustomerId} onSelect={(customer) => setSelectedCustomerId(customer.id)} onSelectOrder={(order) => { setSelectedCustomerId(order.customerId); setSelectedOrderId(order.id); setPage("orders"); }} onNew={() => setCustomerModal("new")} onEdit={setCustomerModal} onDelete={deleteCustomer} />}
        {page === "vip" && <CustomersPage customers={customers} orders={orders} selectedCustomerId={selectedCustomerId} vipOnly onSelect={(customer) => setSelectedCustomerId(customer.id)} onSelectOrder={(order) => { setSelectedCustomerId(order.customerId); setSelectedOrderId(order.id); setPage("orders"); }} onNew={() => setCustomerModal("new")} onEdit={setCustomerModal} onDelete={deleteCustomer} />}
        {page === "orders" && <OrdersPage orders={orders} customers={customers} files={files} libraryRoot={settings.libraryRoot} selectedOrderId={selectedOrderId} folderRefreshKey={fileRefreshKey} onNew={newOrder} onSelect={(order) => setSelectedOrderId(order.id)} onEdit={setOrderModal} onDelete={deleteOrder} onChanged={() => load()} />}
        {page === "factories" && <FactoriesPage factories={sourceFactories} quotes={sourceQuotes} selectedFactoryId={selectedFactoryId} onSelect={(factory) => setSelectedFactoryId(factory.id)} onChanged={() => load()} />}
        {page === "files" && <FilesPage files={files} libraryRoot={settings.libraryRoot} onChanged={() => load()} />}
        {page === "import" && <ImportExportPage onChanged={() => load()} />}
        {page === "settings" && <SettingsPage settings={settings} onChanged={() => load()} />}
      </main>

      {customerModal && <Modal title={customerModal === "new" ? "新建客户" : "编辑客户档案"} subtitle="客户可以关联多个平台身份，首笔订单保存后才会自动创建文件夹。" onClose={() => setCustomerModal(null)} wide>
        <CustomerForm customer={customerModal === "new" ? undefined : customerModal} onCancel={() => setCustomerModal(null)} onSaved={async () => { setCustomerModal(null); await load(); }} />
      </Modal>}
      {orderModal && <Modal title={orderModal === "new" ? "新建订单" : "编辑订单"} subtitle={orderModal === "new" ? "保存后立即生成客户与订单文件夹。" : "修改订单信息不会自动重命名已创建的文件夹。"} onClose={() => setOrderModal(null)} wide>
        <OrderForm customers={customers} sourceQuotes={sourceQuotes} order={orderModal === "new" ? undefined : orderModal} onCancel={() => setOrderModal(null)} onSaved={async (savedOrder) => { setOrderModal(null); setSelectedOrderId(savedOrder.id); await load(); setPage("orders"); }} />
      </Modal>}
    </div>
  );
}
