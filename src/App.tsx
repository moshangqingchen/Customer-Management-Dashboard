import { useEffect, useRef, useState } from "react";
import { Bell, Command, Plus, RefreshCw, Search, Sparkles, X } from "lucide-react";

import { CustomerForm } from "./components/CustomerForm";
import { OrderForm } from "./components/OrderForm";
import { Sidebar } from "./components/Sidebar";
import { UpdateDialog, type UpdateInstallStatus } from "./components/UpdateDialog";
import { Button, Modal } from "./components/ui";
import { api } from "./lib/api";
import { orderProjectNames } from "./lib/orders";
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
  SourceFactoryProject,
  SourceQuote,
  StorageHealth,
} from "./lib/types";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FactoriesPage } from "./pages/FactoriesPage";
import { FilesPage } from "./pages/FilesPage";
import { ImportExportPage } from "./pages/ImportExportPage";
import { Onboarding } from "./pages/Onboarding";
import { OrdersPage } from "./pages/OrdersPage";
import { QuickRepliesPage } from "./pages/QuickRepliesPage";
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

const supportedPages: PageId[] = [
  "dashboard", "customers", "orders", "quickReplies", "factories", "files", "import", "settings",
];

function requestedPage() {
  const requested = new URLSearchParams(window.location.search).get("page") as PageId | null;
  if (requested === "vip") return { page: "customers" as PageId, vipOnly: true };
  return { page: requested && supportedPages.includes(requested) ? requested : "dashboard", vipOnly: false };
}

export default function App() {
  const initialPage = useRef(requestedPage()).current;
  const [page, setPage] = useState<PageId>(initialPage.page);
  const [customerVipOnly, setCustomerVipOnly] = useState(initialPage.vipOnly);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [sourceFactories, setSourceFactories] = useState<SourceFactory[]>([]);
  const [sourceFactoryProjects, setSourceFactoryProjects] = useState<SourceFactoryProject[]>([]);
  const [sourceQuotes, setSourceQuotes] = useState<SourceQuote[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [fileRefreshKey, setFileRefreshKey] = useState(0);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateInstallStatus>("available");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState("");
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [customerModal, setCustomerModal] = useState<Customer | "new" | null>(null);
  const [orderModal, setOrderModal] = useState<Order | "new" | null>(null);
  const [createdCustomerPrompt, setCreatedCustomerPrompt] = useState<Customer | null>(null);
  const [initialOrderCustomerId, setInitialOrderCustomerId] = useState<string | null>(null);
  const [ordersInitialStatus, setOrdersInitialStatus] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchRequestRef = useRef(0);
  const updateCheckedRef = useRef(false);

  const load = async (initial = false) => {
    if (initial) setLoading(true);
    setError("");
    setSettingsError("");
    try {
      const nextSettings = await api.getSettings();
      setSettings(nextSettings);

      try {
        setStorageHealth(await api.getStorageHealth());
      } catch (reason) {
        setStorageHealth({
          status: nextSettings.libraryRoot ? "error" : "notConfigured",
          path: nextSettings.libraryRoot ?? null,
          writable: false,
          freeBytes: null,
          message: `无法检查文件库状态：${String(reason)}`,
        });
      }

      if (!nextSettings.libraryRoot) return;
      const failures: string[] = [];
      async function capture<T>(label: string, promise: Promise<T>, apply: (value: T) => void) {
        try {
          apply(await promise);
        } catch (reason) {
          failures.push(`${label}：${String(reason)}`);
        }
      }
      await Promise.all([
        capture("客户", api.listCustomers(), setCustomers),
        capture("订单", api.listOrders(), setOrders),
        capture("文件", api.listFiles(), setFiles),
        capture("工作台摘要", api.dashboard(), setDashboard),
        capture("厂家", api.listSourceFactories(), setSourceFactories),
        capture("厂家项目", api.listSourceFactoryProjects(), setSourceFactoryProjects),
        capture("厂家报价", api.listSourceQuotes(), setSourceQuotes),
      ]);
      if (failures.length) setError(`部分数据暂时无法读取。${failures.join("；")}`);
    } catch (reason) {
      setSettingsError(String(reason));
    } finally {
      if (initial) setLoading(false);
    }
  };

  const navigate = (nextPage: PageId) => {
    if (nextPage === "vip") {
      setCustomerVipOnly(true);
      setPage("customers");
      return;
    }
    if (nextPage === "customers") setCustomerVipOnly(false);
    if (nextPage === "orders") setOrdersInitialStatus(null);
    setPage(nextPage);
  };

  const openOrders = (status: string | null = null) => {
    setOrdersInitialStatus(status);
    setSelectedOrderId(null);
    setPage("orders");
  };

  const refreshFromDisk = async () => {
    setRefreshing(true);
    setError("");
    try {
      await api.syncManagedLibrary();
      setFileRefreshKey((value) => value + 1);
      await load();
    } catch (reason) {
      setError(`刷新文件库失败：${String(reason)}`);
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

  useEffect(() => { void load(true); }, []);
  useEffect(() => {
    if (loading || settingsError || updateCheckedRef.current) return;
    updateCheckedRef.current = true;
    void checkUpdates(false);
  }, [loading, settingsError]);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    const closeSearch = (event: MouseEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    window.addEventListener("keydown", focusSearch);
    document.addEventListener("mousedown", closeSearch);
    return () => {
      window.removeEventListener("keydown", focusSearch);
      document.removeEventListener("mousedown", closeSearch);
    };
  }, []);
  useEffect(() => {
    const trimmed = query.trim();
    const requestId = ++searchRequestRef.current;
    setActiveSearchIndex(-1);
    if (!trimmed) {
      setSearchHits([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }
    setSearchLoading(true);
    setSearchError("");
    const timeout = window.setTimeout(() => {
      api.search(trimmed)
        .then((hits) => {
          if (requestId !== searchRequestRef.current) return;
          setSearchHits(hits);
        })
        .catch((reason) => {
          if (requestId !== searchRequestRef.current) return;
          setSearchHits([]);
          setSearchError(String(reason));
        })
        .finally(() => {
          if (requestId === searchRequestRef.current) setSearchLoading(false);
        });
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const selectSearchHit = (hit: SearchHit) => {
    if (hit.entityType === "order") {
      setOrdersInitialStatus(null);
      setSelectedOrderId(hit.entityId);
      setPage("orders");
    } else if (hit.entityType === "factory") {
      setSelectedFactoryId(hit.entityId);
      setPage("factories");
    } else {
      setCustomerVipOnly(false);
      setSelectedCustomerId(hit.entityId);
      setPage("customers");
    }
    setQuery("");
    setSearchOpen(false);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setSearchOpen(false);
      return;
    }
    if (!searchHits.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSearchIndex((index) => (index + 1) % searchHits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSearchIndex((index) => (index <= 0 ? searchHits.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeSearchIndex >= 0) {
      event.preventDefault();
      selectSearchHit(searchHits[activeSearchIndex]);
    }
  };

  const newOrder = () => {
    setInitialOrderCustomerId(null);
    if (customers.length === 0) setCustomerModal("new");
    else setOrderModal("new");
  };

  const deleteOrder = async (order: Order) => {
    if (!window.confirm(`确定删除订单「${order.externalOrderNo || orderProjectNames(order)}」吗？\n\n删除后不会在订单列表显示，相关文件不会被直接清空。`)) return;
    try {
      await api.deleteOrder(order.id);
      if (selectedOrderId === order.id) setSelectedOrderId(null);
      await load();
    } catch (reason) {
      setError(`删除订单失败：${String(reason)}`);
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    if (!window.confirm(`确定删除客户「${customer.name}」吗？\n\n该客户的订单也会从当前列表隐藏，建议删除前先确认已备份。`)) return;
    try {
      await api.deleteCustomer(customer.id);
      if (selectedCustomerId === customer.id) setSelectedCustomerId(null);
      if (orders.some((order) => order.customerId === customer.id && order.id === selectedOrderId)) setSelectedOrderId(null);
      await load();
    } catch (reason) {
      setError(`删除客户失败：${String(reason)}`);
    }
  };

  if (loading) {
    return <main className="loading-screen"><div className="brand-mark"><Sparkles size={23} /></div><strong>正在打开创业客户管理工作台</strong><span>整理今天要做的事情…</span></main>;
  }

  const updateSurface = <>
    {updateMessage && <div className="update-toast" role="status">{updateMessage}<button onClick={() => setUpdateMessage("")}>知道了</button></div>}
    {pendingUpdate && <UpdateDialog update={pendingUpdate} status={updateStatus} progress={updateProgress} error={updateError} onDismiss={dismissPendingUpdate} onInstall={installPendingUpdate} />}
  </>;

  if (settingsError || !settings) {
    return (
      <main className="loading-screen startup-error" role="alert">
        <div className="brand-mark"><Sparkles size={23} /></div>
        <strong>工作台设置读取失败</strong>
        <span>{settingsError || "未能读取应用设置。数据库和文件不会因此被更改。"}</span>
        <Button onClick={() => void load(true)}>重新读取</Button>
        {updateSurface}
      </main>
    );
  }

  if (!settings.libraryRoot) return <>
    <Onboarding onReady={async (nextPage) => { if (nextPage) setPage(nextPage); await load(true); }} />
    {updateSurface}
  </>;

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={navigate} libraryRoot={settings.libraryRoot} storageHealth={storageHealth} />
      <main className="workspace">
        <header className="topbar">
          <div className="global-search" ref={searchContainerRef}>
            <Search size={18} aria-hidden="true" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
              onFocus={() => { if (query.trim()) setSearchOpen(true); }}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索客户、订单号、电话、快递单号…"
              aria-label="全局搜索"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={Boolean(query && searchOpen)}
              aria-controls="global-search-results"
              aria-activedescendant={activeSearchIndex >= 0 ? `global-search-result-${activeSearchIndex}` : undefined}
            />
            <kbd><Command size={12} /> K</kbd>
            {query && <button onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="清空搜索"><X size={15} /></button>}
            {query && searchOpen && (
              <div className="search-popover" id="global-search-results" role="listbox" aria-label="搜索结果">
                <div className="search-popover-title">
                  <span>全局搜索</span>
                  <small>{searchLoading ? "搜索中…" : `${searchHits.length} 条结果`}</small>
                </div>
                {searchError
                  ? <p role="alert">搜索失败：{searchError}</p>
                  : searchLoading
                    ? <p role="status">正在搜索…</p>
                    : searchHits.length === 0
                      ? <p>没有找到匹配内容</p>
                      : searchHits.map((hit, index) => (
                        <button
                          key={`${hit.entityType}-${hit.entityId}`}
                          id={`global-search-result-${index}`}
                          role="option"
                          aria-selected={activeSearchIndex === index}
                          className={activeSearchIndex === index ? "active" : ""}
                          onMouseEnter={() => setActiveSearchIndex(index)}
                          onClick={() => selectSearchHit(hit)}
                        >
                          <i>{hit.entityType === "order" ? "订单" : hit.entityType === "factory" ? "厂家" : "客户"}</i>
                          <span><b>{hit.title}</b><small>{hit.subtitle}</small></span>
                        </button>
                      ))}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            {api.isDemo && <span className="demo-pill">界面演示模式</span>}
            <Button onClick={newOrder}><Plus size={16} />新建订单</Button>
            <Button variant="secondary" onClick={refreshFromDisk} disabled={refreshing} aria-label={refreshing ? "正在刷新文件库" : "刷新"}>
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />{refreshing ? "刷新中" : "刷新"}
            </Button>
            <button className="icon-button notification" onClick={() => openOrders("逾期")} aria-label={`查看逾期订单，共 ${dashboard.overdue} 个`} title="查看逾期订单">
              <Bell size={18} />{dashboard.overdue > 0 && <i>{dashboard.overdue}</i>}
            </button>
          </div>
        </header>
        {updateSurface}
        {createdCustomerPrompt && (
          <div className="update-toast created-customer-toast" role="status">
            已创建客户“{createdCustomerPrompt.name}”
            <button onClick={() => {
              setInitialOrderCustomerId(createdCustomerPrompt.id);
              setCreatedCustomerPrompt(null);
              setOrderModal("new");
            }}>继续新建订单</button>
            <button onClick={() => setCreatedCustomerPrompt(null)} aria-label="关闭提示">稍后</button>
          </div>
        )}
        {error && <div className="fatal-banner" role="alert">{error}<button onClick={() => void load()}>重试</button></div>}
        {page === "dashboard" && <DashboardPage summary={dashboard} onNewCustomer={() => setCustomerModal("new")} onNavigate={navigate} onOpenOrders={openOrders} onSelectOrder={(order) => { setOrdersInitialStatus(null); setSelectedOrderId(order.id); setPage("orders"); }} />}
        {page === "customers" && <CustomersPage customers={customers} orders={orders} selectedCustomerId={selectedCustomerId} vipOnly={customerVipOnly} onSelect={(customer) => setSelectedCustomerId(customer.id)} onSelectOrder={(order) => { setSelectedCustomerId(order.customerId); setOrdersInitialStatus(null); setSelectedOrderId(order.id); setPage("orders"); }} onNew={() => setCustomerModal("new")} onEdit={setCustomerModal} onDelete={deleteCustomer} />}
        {page === "orders" && <OrdersPage orders={orders} customers={customers} files={files} libraryRoot={settings.libraryRoot} selectedOrderId={selectedOrderId} initialStatus={ordersInitialStatus} folderRefreshKey={fileRefreshKey} onNew={newOrder} onSelect={(order) => setSelectedOrderId(order.id)} onClearSelection={() => setSelectedOrderId(null)} onEdit={setOrderModal} onDelete={deleteOrder} onChanged={() => void load()} />}
        {page === "quickReplies" && <QuickRepliesPage />}
        {page === "factories" && <FactoriesPage factories={sourceFactories} factoryProjects={sourceFactoryProjects} quotes={sourceQuotes} selectedFactoryId={selectedFactoryId} onSelect={(factory) => setSelectedFactoryId(factory.id)} onClearSelection={() => setSelectedFactoryId(null)} onChanged={() => void load()} />}
        {page === "files" && <FilesPage files={files} libraryRoot={settings.libraryRoot} onChanged={() => void load()} />}
        {page === "import" && <ImportExportPage customers={customers} onChanged={() => void load()} />}
        {page === "settings" && <SettingsPage settings={settings} onChanged={() => void load()} onCheckUpdates={() => checkUpdates(true)} checkingUpdate={checkingUpdate} />}
      </main>

      {customerModal && (
        <Modal title={customerModal === "new" ? "新建客户" : "编辑客户档案"} subtitle="客户可以关联多个平台身份，首笔订单保存后才会自动创建文件夹。" onClose={() => setCustomerModal(null)} wide>
          <CustomerForm
            customer={customerModal === "new" ? undefined : customerModal}
            onCancel={() => setCustomerModal(null)}
            onSaved={async (savedCustomer) => {
              const wasNew = customerModal === "new";
              setCustomerModal(null);
              if (wasNew && savedCustomer) {
                setSelectedCustomerId(savedCustomer.id);
                setInitialOrderCustomerId(savedCustomer.id);
                setCreatedCustomerPrompt(savedCustomer);
              }
              await load();
            }}
          />
        </Modal>
      )}
      {orderModal && (
        <Modal title={orderModal === "new" ? "新建订单" : "编辑订单"} subtitle={orderModal === "new" ? "保存后立即生成客户与订单文件夹。" : "修改订单信息不会自动重命名已创建的文件夹。"} onClose={() => setOrderModal(null)} wide>
          <OrderForm
            customers={customers}
            sourceQuotes={sourceQuotes}
            order={orderModal === "new" ? undefined : orderModal}
            initialCustomerId={orderModal === "new" ? initialOrderCustomerId : null}
            onCancel={() => setOrderModal(null)}
            onSaved={async (savedOrder) => {
              setOrderModal(null);
              setInitialOrderCustomerId(null);
              setOrdersInitialStatus(null);
              setSelectedOrderId(savedOrder.id);
              await load();
              setPage("orders");
            }}
          />
        </Modal>
      )}
    </div>
  );
}
