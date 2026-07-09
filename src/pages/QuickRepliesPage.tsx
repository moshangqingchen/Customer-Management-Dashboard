import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Check, Copy, Edit3, FolderPlus, MessageCircle, Plus, Search, Trash2 } from "lucide-react";

import { Button, EmptyState, Modal, PageHeader } from "../components/ui";

interface QuickReply {
  id: string;
  title: string;
  content: string;
}

interface QuickReplyScene {
  id: string;
  name: string;
  note: string;
  replies: QuickReply[];
}

interface QuickReplyCategory {
  id: string;
  name: string;
  description: string;
  scenes: QuickReplyScene[];
}

type ContextMenuTarget = "category" | "scene" | "reply";

interface ContextMenuState {
  x: number;
  y: number;
  target: ContextMenuTarget;
  categoryId?: string;
  sceneId?: string;
  replyId?: string;
}

interface EditState {
  target: ContextMenuTarget;
  categoryId: string;
  sceneId?: string;
  replyId?: string;
  primary: string;
  secondary: string;
}

const STORAGE_KEY = "startup-customer-workbench.quickReplyLibrary";

const defaultCategories: QuickReplyCategory[] = [
  {
    id: "hesitation",
    name: "客户犹豫不回",
    description: "适合客户看过报价、方案或样稿后没有回复时跟进。",
    scenes: [
      {
        id: "soft-follow-up",
        name: "温和跟进",
        note: "不催促，先降低客户回复压力。",
        replies: [
          {
            id: "hesitation-soft-1",
            title: "确认是否方便",
            content: "亲，刚刚发您的方案您先慢慢看。我这边主要想确认一下方向是否合适，如果有哪里想调整，您直接跟我说就行。",
          },
          {
            id: "hesitation-soft-2",
            title: "给选择题",
            content: "亲，您看这个方向是更偏向继续优化，还是先按现在这版安排？我这边都可以配合，您回我一个大概方向就行。",
          },
        ],
      },
      {
        id: "price-concern",
        name: "价格犹豫",
        note: "客户可能卡在预算或比价时使用。",
        replies: [
          {
            id: "hesitation-price-1",
            title: "解释价格构成",
            content: "亲，这个价格主要包含设计处理、材料和制作成本。如果您有预算范围，我也可以帮您调整成更合适的方案。",
          },
        ],
      },
    ],
  },
  {
    id: "file-confirm",
    name: "文件确认",
    description: "收到素材、文件不清晰、尺寸需要确认时使用。",
    scenes: [
      {
        id: "received-file",
        name: "已收到文件",
        note: "先让客户安心，再说明后续检查。",
        replies: [
          {
            id: "file-received-1",
            title: "文件收到",
            content: "文件收到啦，我先帮您核对尺寸、清晰度和制作要求，有问题会马上联系您。",
          },
        ],
      },
    ],
  },
  {
    id: "progress",
    name: "进度同步",
    description: "设计、生产、发货节点更新时使用。",
    scenes: [
      {
        id: "rush-progress",
        name: "催进度后回复",
        note: "给客户确定感，同时不承诺不可控时间。",
        replies: [
          {
            id: "progress-rush-1",
            title: "已催进度",
            content: "这边已经帮您催进度了，有新的时间节点我会第一时间同步您。",
          },
        ],
      },
    ],
  },
];

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadCategories() {
  if (typeof window === "undefined") return defaultCategories;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultCategories;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return defaultCategories;
    return parsed as QuickReplyCategory[];
  } catch {
    return defaultCategories;
  }
}

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("copy failed");
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    fallbackCopy(text);
    return;
  }
  fallbackCopy(text);
}

export function QuickRepliesPage() {
  const [categories, setCategories] = useState(loadCategories);
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => loadCategories()[0]?.id ?? "");
  const [selectedSceneId, setSelectedSceneId] = useState(() => loadCategories()[0]?.scenes[0]?.id ?? "");
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [sceneName, setSceneName] = useState("");
  const [sceneNote, setSceneNote] = useState("");
  const [replyTitle, setReplyTitle] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [copyError, setCopyError] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
    } catch {
      // The page remains usable even if persistence is unavailable.
    }
  }, [categories]);
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? categories[0];
  const selectedScene = selectedCategory?.scenes.find((scene) => scene.id === selectedSceneId) ?? selectedCategory?.scenes[0];
  const totalScenes = categories.reduce((sum, category) => sum + category.scenes.length, 0);
  const totalReplies = categories.reduce((sum, category) => sum + category.scenes.reduce((sceneSum, scene) => sceneSum + scene.replies.length, 0), 0);

  const visibleReplies = useMemo(() => {
    if (!selectedScene) return [];
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return selectedScene.replies;
    return selectedScene.replies.filter((reply) => {
      return reply.title.toLowerCase().includes(trimmedQuery) || reply.content.toLowerCase().includes(trimmedQuery);
    });
  }, [query, selectedScene]);

  const createCategory = (name: string, description: string) => {
    if (!name) return;
    const sceneId = createId("scene");
    const nextCategory: QuickReplyCategory = {
      id: createId("category"),
      name,
      description: description || "新的客服沟通主类。",
      scenes: [{ id: sceneId, name: "默认场景", note: "可以改成更具体的客户状态。", replies: [] }],
    };
    setCategories((current) => [nextCategory, ...current]);
    setSelectedCategoryId(nextCategory.id);
    setSelectedSceneId(sceneId);
  };

  const addCategory = () => {
    const name = categoryName.trim();
    if (!name) return;
    createCategory(name, categoryDescription.trim());
    setCategoryName("");
    setCategoryDescription("");
  };

  const createScene = (categoryId: string, name: string, note: string) => {
    if (!categoryId || !name) return;
    const nextScene: QuickReplyScene = { id: createId("scene"), name, note, replies: [] };
    setCategories((current) => current.map((category) => (
      category.id === categoryId ? { ...category, scenes: [...category.scenes, nextScene] } : category
    )));
    setSelectedCategoryId(categoryId);
    setSelectedSceneId(nextScene.id);
  };

  const addScene = () => {
    const name = sceneName.trim();
    if (!selectedCategory || !name) return;
    createScene(selectedCategory.id, name, sceneNote.trim());
    setSceneName("");
    setSceneNote("");
  };

  const createReply = (categoryId: string, sceneId: string, title: string, content: string) => {
    if (!categoryId || !sceneId || !content) return;
    const nextReply: QuickReply = {
      id: createId("reply"),
      title: title || "未命名话术",
      content,
    };
    setCategories((current) => current.map((category) => {
      if (category.id !== categoryId) return category;
      return {
        ...category,
        scenes: category.scenes.map((scene) => (
          scene.id === sceneId ? { ...scene, replies: [nextReply, ...scene.replies] } : scene
        )),
      };
    }));
    setSelectedCategoryId(categoryId);
    setSelectedSceneId(sceneId);
  };

  const addReply = () => {
    const content = replyContent.trim();
    if (!selectedCategory || !selectedScene || !content) return;
    createReply(selectedCategory.id, selectedScene.id, replyTitle.trim(), content);
    setReplyTitle("");
    setReplyContent("");
  };

  const deleteCategory = (categoryId: string) => {
    const nextCategories = categories.filter((category) => category.id !== categoryId);
    setCategories(nextCategories);
    const nextCategory = nextCategories[0];
    setSelectedCategoryId(nextCategory?.id ?? "");
    setSelectedSceneId(nextCategory?.scenes[0]?.id ?? "");
  };

  const deleteScene = (sceneId: string) => {
    if (!selectedCategory) return;
    const nextScenes = selectedCategory.scenes.filter((scene) => scene.id !== sceneId);
    setCategories((current) => current.map((category) => (
      category.id === selectedCategory.id ? { ...category, scenes: nextScenes } : category
    )));
    setSelectedSceneId(nextScenes[0]?.id ?? "");
  };

  const deleteReply = (replyId: string) => {
    if (!selectedCategory || !selectedScene) return;
    setCategories((current) => current.map((category) => {
      if (category.id !== selectedCategory.id) return category;
      return {
        ...category,
        scenes: category.scenes.map((scene) => (
          scene.id === selectedScene.id ? { ...scene, replies: scene.replies.filter((reply) => reply.id !== replyId) } : scene
        )),
      };
    }));
  };

  const copyReply = async (reply: QuickReply) => {
    setCopyError("");
    try {
      await copyText(reply.content);
      setCopiedId(reply.id);
      window.setTimeout(() => setCopiedId((current) => (current === reply.id ? "" : current)), 1300);
    } catch {
      setCopyError("复制失败，请手动选中文字复制。");
    }
  };

  const openContextMenu = (event: MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) => {
    event.preventDefault();
    event.stopPropagation();
    const width = 178;
    const height = 140;
    setContextMenu({
      ...menu,
      x: Math.min(event.clientX, Math.max(8, window.innerWidth - width)),
      y: Math.min(event.clientY, Math.max(8, window.innerHeight - height)),
    });
  };

  const openPanelContextMenu = (event: MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) => {
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,.reply-card")) return;
    openContextMenu(event, menu);
  };

  const promptValue = (message: string, defaultValue = "") => window.prompt(message, defaultValue)?.trim() ?? "";

  const addCategoryFromContext = () => {
    const name = promptValue("输入主类名称", "新主类");
    if (!name) return;
    createCategory(name, promptValue("输入主类说明（可留空）"));
  };

  const addSceneFromContext = (categoryId = selectedCategory?.id) => {
    if (!categoryId) return;
    const name = promptValue("输入小类名称", "新小类");
    if (!name) return;
    createScene(categoryId, name, promptValue("输入小类说明（可留空）"));
  };

  const addReplyFromContext = (categoryId = selectedCategory?.id, sceneId = selectedScene?.id) => {
    if (!categoryId || !sceneId) return;
    const title = promptValue("输入话术标题", "新话术");
    if (!title) return;
    const content = promptValue("输入话术内容");
    if (!content) return;
    createReply(categoryId, sceneId, title, content);
  };

  const runContextAction = (action: () => void) => {
    setContextMenu(null);
    action();
  };

  const contextCategory = categories.find((category) => category.id === contextMenu?.categoryId);
  const contextScene = contextCategory?.scenes.find((scene) => scene.id === contextMenu?.sceneId);
  const contextReply = contextScene?.replies.find((reply) => reply.id === contextMenu?.replyId);

  const editCategory = (category: QuickReplyCategory) => {
    setEditing({
      target: "category",
      categoryId: category.id,
      primary: category.name,
      secondary: category.description,
    });
  };

  const editScene = (categoryId: string, scene: QuickReplyScene) => {
    setEditing({
      target: "scene",
      categoryId,
      sceneId: scene.id,
      primary: scene.name,
      secondary: scene.note,
    });
  };

  const editReply = (categoryId: string, sceneId: string, reply: QuickReply) => {
    setEditing({
      target: "reply",
      categoryId,
      sceneId,
      replyId: reply.id,
      primary: reply.title,
      secondary: reply.content,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const primary = editing.primary.trim();
    const secondary = editing.secondary.trim();
    if (!primary || (editing.target === "reply" && !secondary)) return;

    setCategories((current) => current.map((category) => {
      if (category.id !== editing.categoryId) return category;
      if (editing.target === "category") {
        return { ...category, name: primary, description: secondary };
      }
      return {
        ...category,
        scenes: category.scenes.map((scene) => {
          if (scene.id !== editing.sceneId) return scene;
          if (editing.target === "scene") {
            return { ...scene, name: primary, note: secondary };
          }
          return {
            ...scene,
            replies: scene.replies.map((reply) => (
              reply.id === editing.replyId ? { ...reply, title: primary, content: secondary } : reply
            )),
          };
        }),
      };
    }));
    setEditing(null);
  };

  const editLabel = editing?.target === "category" ? "主类" : editing?.target === "scene" ? "小类" : "话术";
  const primaryLabel = editing?.target === "reply" ? "话术标题" : `${editLabel}名称`;
  const secondaryLabel = editing?.target === "reply" ? "话术内容" : `${editLabel}说明`;
  const editCanSave = Boolean(editing && editing.primary.trim() && (editing.target !== "reply" || editing.secondary.trim()));

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="话术库"
        title="客服快捷语"
        description="按主类和客户场景整理常用回复，沟通时直接复制，减少反复打字。"
        actions={<div className="quick-reply-summary"><span>{categories.length} 个主类</span><span>{totalScenes} 个小类</span><span>{totalReplies} 条话术</span></div>}
      />

      <div className="quick-reply-library">
        <aside className="reply-category-panel" onContextMenu={(event) => openPanelContextMenu(event, { target: "category", categoryId: selectedCategory?.id })}>
          <div className="reply-panel-head">
            <div>
              <span className="eyebrow">主类</span>
              <h2>沟通阶段</h2>
            </div>
            <FolderPlus size={20} />
          </div>
          <div className="reply-add-box">
            <input aria-label="主类名称" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="添加主类，如客户犹豫不回" />
            <textarea aria-label="主类说明" value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} placeholder="这个主类适合什么情况..." />
            <Button variant="secondary" onClick={addCategory} disabled={!categoryName.trim()}><Plus size={15} />添加主类</Button>
          </div>
          <div className="reply-category-list">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={category.id === selectedCategory?.id ? "active" : ""}
                onContextMenu={(event) => {
                  setSelectedCategoryId(category.id);
                  setSelectedSceneId(category.scenes[0]?.id ?? "");
                  openContextMenu(event, { target: "category", categoryId: category.id });
                }}
                onClick={() => {
                  setSelectedCategoryId(category.id);
                  setSelectedSceneId(category.scenes[0]?.id ?? "");
                }}
              >
                <strong>{category.name}</strong>
                <span>{category.description}</span>
                <small>{category.scenes.length} 个小类</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="reply-scene-panel" onContextMenu={(event) => openPanelContextMenu(event, { target: "scene", categoryId: selectedCategory?.id, sceneId: selectedScene?.id })}>
          <div className="reply-panel-head">
            <div>
              <span className="eyebrow">小类</span>
              <h2>{selectedCategory?.name ?? "暂无主类"}</h2>
            </div>
          </div>
          {selectedCategory ? (
            <>
              <div className="reply-add-box">
                <input aria-label="小类名称" value={sceneName} onChange={(event) => setSceneName(event.target.value)} placeholder="添加小类，如温和跟进" />
                <textarea aria-label="小类说明" value={sceneNote} onChange={(event) => setSceneNote(event.target.value)} placeholder="这类话术的使用提醒..." />
                <Button variant="secondary" onClick={addScene} disabled={!sceneName.trim()}><Plus size={15} />添加小类</Button>
              </div>
              <div className="reply-scene-list">
                {selectedCategory.scenes.map((scene) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={scene.id === selectedScene?.id ? "active" : ""}
                    onContextMenu={(event) => {
                      setSelectedSceneId(scene.id);
                      openContextMenu(event, { target: "scene", categoryId: selectedCategory.id, sceneId: scene.id });
                    }}
                    onClick={() => setSelectedSceneId(scene.id)}
                  >
                    <strong>{scene.name}</strong>
                    <span>{scene.note || "暂无说明"}</span>
                    <small>{scene.replies.length} 条话术</small>
                  </button>
                ))}
              </div>
            </>
          ) : <EmptyState icon={<MessageCircle size={28} />} title="还没有主类" description="先添加一个主类，再继续添加小类和话术。" />}
        </section>

        <section className="reply-content-panel" onContextMenu={(event) => openPanelContextMenu(event, { target: "reply", categoryId: selectedCategory?.id, sceneId: selectedScene?.id })}>
          <div className="reply-content-head">
            <div>
              <span className="eyebrow">话术</span>
              <h2>{selectedScene?.name ?? "选择一个小类"}</h2>
              {selectedScene?.note && <p>{selectedScene.note}</p>}
            </div>
          </div>

          {selectedScene ? (
            <>
              <div className="reply-editor">
                <input aria-label="话术标题" value={replyTitle} onChange={(event) => setReplyTitle(event.target.value)} placeholder="话术标题，如确认是否方便" />
                <textarea aria-label="话术内容" value={replyContent} onChange={(event) => setReplyContent(event.target.value)} placeholder="输入要复制给客户的话术..." />
                <div className="reply-editor-actions">
                  <Button onClick={addReply} disabled={!replyContent.trim()}><Plus size={15} />添加话术</Button>
                </div>
              </div>

              <div className="reply-search">
                <Search size={16} />
                <input aria-label="搜索话术" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或内容" />
              </div>
              {copyError && <div className="inline-message" role="status">{copyError}</div>}

              {visibleReplies.length ? (
                <div className="reply-card-list">
                  {visibleReplies.map((reply) => (
                    <article
                      className="reply-card"
                      key={reply.id}
                      onContextMenu={(event) => openContextMenu(event, { target: "reply", categoryId: selectedCategory.id, sceneId: selectedScene.id, replyId: reply.id })}
                    >
                      <div>
                        <h3>{reply.title}</h3>
                        <p>{reply.content}</p>
                      </div>
                      <div className="reply-card-actions">
                        <button type="button" onClick={() => copyReply(reply)} aria-label={`复制话术：${reply.title}`} title="复制话术">
                          {copiedId === reply.id ? <Check size={16} /> : <Copy size={16} />}
                          <span>{copiedId === reply.id ? "已复制" : "复制"}</span>
                        </button>
                        <button type="button" onClick={() => deleteReply(reply.id)} aria-label={`删除话术：${reply.title}`} title="删除话术">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <EmptyState icon={<MessageCircle size={28} />} title="没有匹配的话术" description="可以调整搜索词，或在当前小类下新增一条话术。" />}
            </>
          ) : <EmptyState icon={<MessageCircle size={28} />} title="还没有小类" description="先为当前主类添加一个小类，然后在下面整理话术。" />}
        </section>
      </div>
      {contextMenu && (
        <div className="context-menu quick-reply-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          {contextMenu.target === "category" && (
            <>
              {contextCategory && <button type="button" onClick={() => runContextAction(() => editCategory(contextCategory))}><Edit3 size={15} />更改主类</button>}
              <button type="button" onClick={() => runContextAction(addCategoryFromContext)}><Plus size={15} />新增主类</button>
              <button type="button" onClick={() => runContextAction(() => addSceneFromContext(contextMenu.categoryId))}><Plus size={15} />新增小类</button>
              <button type="button" className="danger" onClick={() => runContextAction(() => contextMenu.categoryId && deleteCategory(contextMenu.categoryId))}><Trash2 size={15} />删除主类</button>
            </>
          )}
          {contextMenu.target === "scene" && (
            <>
              {contextScene && contextMenu.categoryId && <button type="button" onClick={() => runContextAction(() => editScene(contextMenu.categoryId!, contextScene))}><Edit3 size={15} />更改小类</button>}
              <button type="button" onClick={() => runContextAction(() => addSceneFromContext(contextMenu.categoryId))}><Plus size={15} />新增小类</button>
              <button type="button" onClick={() => runContextAction(() => addReplyFromContext(contextMenu.categoryId, contextMenu.sceneId))}><Plus size={15} />新增话术</button>
              <button type="button" className="danger" onClick={() => runContextAction(() => contextMenu.sceneId && deleteScene(contextMenu.sceneId))}><Trash2 size={15} />删除小类</button>
            </>
          )}
          {contextMenu.target === "reply" && (
            <>
              <button type="button" onClick={() => runContextAction(() => addReplyFromContext(contextMenu.categoryId, contextMenu.sceneId))}><Plus size={15} />新增话术</button>
              {contextReply && contextMenu.categoryId && contextMenu.sceneId && <button type="button" onClick={() => runContextAction(() => editReply(contextMenu.categoryId!, contextMenu.sceneId!, contextReply))}><Edit3 size={15} />更改话术</button>}
              {contextReply && <button type="button" onClick={() => runContextAction(() => void copyReply(contextReply))}><Copy size={15} />复制话术</button>}
              {contextReply && <button type="button" className="danger" onClick={() => runContextAction(() => contextMenu.replyId && deleteReply(contextMenu.replyId))}><Trash2 size={15} />删除话术</button>}
            </>
          )}
        </div>
      )}
      {editing && (
        <Modal title={`更改${editLabel}`} subtitle="修改后点击保存，原有分类关系不会改变。" onClose={() => setEditing(null)}>
          <form className="form-stack quick-reply-edit-form" onSubmit={(event) => { event.preventDefault(); saveEdit(); }}>
            <label>
              <span>{primaryLabel}</span>
              <input
                aria-label={`编辑${primaryLabel}`}
                value={editing.primary}
                onChange={(event) => setEditing((current) => current ? { ...current, primary: event.target.value } : current)}
                autoFocus
              />
            </label>
            <label>
              <span>{secondaryLabel}</span>
              <textarea
                aria-label={`编辑${secondaryLabel}`}
                value={editing.secondary}
                onChange={(event) => setEditing((current) => current ? { ...current, secondary: event.target.value } : current)}
                placeholder={editing.target === "reply" ? "输入要复制给客户的话术内容" : "输入使用场景说明"}
              />
            </label>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>取消</Button>
              <Button type="submit" disabled={!editCanSave}>保存更改</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
