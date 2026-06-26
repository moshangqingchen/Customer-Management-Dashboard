import { ArrowLeft, Check, ClipboardList, Edit3, Factory, PackagePlus, Plus, Search, Tag, Trash2, Truck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "../lib/api";
import { formatCents, shortDate } from "../lib/format";
import type { SourceFactory, SourceFactoryInput, SourceQuote, SourceQuoteInput } from "../lib/types";
import { Button, EmptyState, Modal, PageHeader } from "../components/ui";

const itemPresets = ["名片", "不干胶", "宣传单"];
const defaultQuantityPresets = [100, 200, 500, 1000, 2000, 3000, 5000, 10000];
const CUSTOM_SIZE_VALUE = "__custom_size__";
const CUSTOM_MATERIAL_VALUE = "__custom_material__";
const CUSTOM_PAPER_WEIGHT_VALUE = "__custom_paper_weight__";
const CUSTOM_FINISH_VALUE = "__custom_finish__";

type ProjectSpecPreset = {
  materials: string[];
  paperWeights: string[];
  sizes: string[];
  finishes: string[];
  quantities?: number[];
  quantityUnit?: string;
  paperWeightLabel?: string;
};

const projectSpecPresets: Record<string, ProjectSpecPreset> = {
  名片: {
    materials: ["铜版纸", "特种纸", "珠光纸", "PVC", "牛皮纸"],
    paperWeights: ["250g", "300g", "350g", "400g"],
    sizes: ["90×54mm", "90×50mm", "85×54mm"],
    finishes: ["覆膜", "哑膜", "亮膜", "圆角", "覆膜 / 圆角", "烫金", "烫银", "UV", "击凸", "模切"],
  },
  不干胶: {
    materials: ["铜版不干胶", "透明不干胶", "牛皮纸不干胶", "PVC不干胶", "易碎纸"],
    paperWeights: ["80g", "120g", "157g"],
    sizes: ["50×30mm", "60×40mm", "70×50mm", "A4 210×297mm"],
    finishes: ["覆膜", "哑膜", "亮膜", "模切", "异形模切", "覆膜 / 模切"],
  },
  宣传单: {
    materials: ["铜版纸", "哑粉纸", "双胶纸", "书纸"],
    paperWeights: ["128g", "157g", "200g", "250g"],
    sizes: ["A4 210×297mm", "A5 148×210mm", "16开 210×285mm", "210×285mm"],
    finishes: ["覆膜", "哑膜", "亮膜", "折页", "压痕", "裁切"],
  },
  扇子: {
    materials: ["PP塑料", "PVC", "纸质", "竹柄纸扇", "无纺布"],
    paperWeights: ["单层", "双层", "0.35mm", "0.5mm", "0.8mm"],
    sizes: ["17×17cm", "19×19cm", "21×21cm", "七寸", "八寸"],
    finishes: ["模切", "异形模切", "装柄", "覆膜", "UV", "烫金"],
    quantities: [100, 300, 500, 1000, 2000, 5000],
    quantityUnit: "把",
    paperWeightLabel: "厚度/规格",
  },
  联单: {
    materials: ["无碳复写纸", "双胶纸", "收据纸", "牛皮纸封面", "白红黄三联纸"],
    paperWeights: ["二联", "三联", "四联", "50组/本", "100组/本"],
    sizes: ["大32开 130×190mm", "A5 148×210mm", "16开 185×260mm", "A4 210×297mm"],
    finishes: ["胶头", "包本", "打码", "撕线", "打孔", "封面", "垫板"],
    quantities: [10, 20, 50, 100, 200, 500],
    quantityUnit: "本",
    paperWeightLabel: "联数/每本",
  },
};

const projectPresetAliases = [
  { presetName: "扇子", keywords: ["扇子", "广告扇", "团扇", "pp扇", "pvc扇", "纸扇"] },
  { presetName: "联单", keywords: ["联单", "无碳联单", "收据联单", "送货单", "销货单", "二联", "三联", "四联"] },
];

const projectNameSuggestions = unique([
  ...Object.keys(projectSpecPresets),
  "广告扇",
  "无碳联单",
  "送货单",
]);

const fallbackProjectSpecPreset: ProjectSpecPreset = {
  materials: ["铜版纸", "PVC", "PP", "特种纸", "牛皮纸"],
  paperWeights: ["128g", "157g", "250g", "300g", "0.5mm"],
  sizes: ["A4 210×297mm", "A5 148×210mm", "90×54mm"],
  finishes: ["覆膜", "哑膜", "亮膜", "模切", "压痕", "UV"],
};

const emptyFactory: SourceFactoryInput = {
  name: "",
  contactName: "",
  phone: "",
  wechat: "",
  address: "",
  tags: [],
  shippingNotes: "",
  notes: "",
};

type FactoryProjectGroup = {
  projectName: string;
  itemType: string;
  quotes: SourceQuote[];
  updatedAt: string;
};

function emptyQuote(factoryId: string, itemName = ""): SourceQuoteInput {
  return {
    factoryId,
    itemType: "印刷",
    itemName,
    quantity: quantityPresetsForProject(itemName)[0] ?? 1000,
    size: sizeOptionsForProject(itemName)[0] ?? "",
    material: materialOptionsForProject(itemName)[0] ?? "",
    paperWeight: paperWeightOptionsForProject(itemName)[0] ?? "",
    sides: "双面",
    color: "彩色",
    finish: "",
    productionCostCents: 0,
    shippingCostCents: 0,
    leadTime: "",
    notes: "",
  };
}

function factoryToInput(factory: SourceFactory): SourceFactoryInput {
  return {
    name: factory.name,
    contactName: factory.contactName,
    phone: factory.phone,
    wechat: factory.wechat,
    address: factory.address,
    tags: factory.tags,
    shippingNotes: factory.shippingNotes,
    notes: factory.notes,
  };
}

function quoteToInput(quote: SourceQuote): SourceQuoteInput {
  return {
    factoryId: quote.factoryId,
    itemType: quote.itemType,
    itemName: quote.itemName,
    quantity: quote.quantity,
    size: quote.size,
    material: quote.material,
    paperWeight: quote.paperWeight,
    sides: quote.sides,
    color: quote.color,
    finish: quote.finish,
    productionCostCents: quote.productionCostCents,
    shippingCostCents: quote.shippingCostCents,
    leadTime: quote.leadTime,
    notes: quote.notes,
  };
}

function quoteSpec(quote: SourceQuote | SourceQuoteInput) {
  return [quote.size, [quote.material, quote.paperWeight].filter(Boolean).join(" "), quote.sides, quote.color, quote.finish]
    .filter(Boolean)
    .join(" / ");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function compareUpdatedAt(left?: string, right?: string) {
  return (right ?? "").localeCompare(left ?? "");
}

function groupQuotesByProject(quotes: SourceQuote[], extraProjectNames: string[] = []): FactoryProjectGroup[] {
  const groups = new Map<string, SourceQuote[]>();
  for (const quote of quotes) {
    const projectName = quote.itemName.trim() || "未命名项目";
    groups.set(projectName, [...(groups.get(projectName) ?? []), quote]);
  }

  const projectNames = unique([
    ...itemPresets,
    ...extraProjectNames,
    ...quotes.map((quote) => quote.itemName.trim() || "未命名项目"),
  ]);

  return projectNames
    .map((projectName) => {
      const projectQuotes = groups.get(projectName) ?? [];
      const sortedQuotes = [...projectQuotes].sort((left, right) => compareUpdatedAt(left.updatedAt, right.updatedAt));
      const latestQuote = sortedQuotes[0];
      return {
        projectName,
        itemType: latestQuote?.itemType || "印刷",
        quotes: sortedQuotes,
        updatedAt: latestQuote?.updatedAt ?? "",
      };
    });
}

function quoteSearchText(quote: SourceQuote) {
  return [quote.itemType, quote.itemName, quote.quantity, quoteSpec(quote), quote.productionCostCents, quote.shippingCostCents, quote.leadTime, quote.notes]
    .join(" ")
    .toLowerCase();
}

function normalizeProjectName(projectName: string) {
  return projectName.trim().replace(/\s+/g, "").toLowerCase();
}

function specPresetForProject(projectName: string) {
  const directPreset = projectSpecPresets[projectName.trim()];
  if (directPreset) return directPreset;

  const normalized = normalizeProjectName(projectName);
  const alias = projectPresetAliases.find((item) =>
    item.keywords.some((keyword) => normalized.includes(normalizeProjectName(keyword)))
  );
  return alias ? projectSpecPresets[alias.presetName] : fallbackProjectSpecPreset;
}

function materialOptionsForProject(projectName: string) {
  return specPresetForProject(projectName).materials;
}

function paperWeightOptionsForProject(projectName: string) {
  return specPresetForProject(projectName).paperWeights;
}

function sizeOptionsForProject(projectName: string) {
  return specPresetForProject(projectName).sizes;
}

function finishOptionsForProject(projectName: string) {
  return specPresetForProject(projectName).finishes;
}

function quantityPresetsForProject(projectName: string) {
  return specPresetForProject(projectName).quantities ?? defaultQuantityPresets;
}

function quantityUnitForProject(projectName: string) {
  return specPresetForProject(projectName).quantityUnit ?? "张";
}

function paperWeightLabelForProject(projectName: string) {
  return specPresetForProject(projectName).paperWeightLabel ?? "克重/厚度";
}

function optionsWithCurrent(options: string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : options;
}

function parseSize(value: string) {
  const match = value.match(/(?:(\d+(?:\.\d+)?)\s*)?[×xX*]\s*(?:(\d+(?:\.\d+)?)\s*)?/);
  return { width: match?.[1] ?? "", height: match?.[2] ?? "" };
}

function formatCustomSize(width: string, height: string) {
  return width || height ? `${width || ""}×${height || ""}mm` : "";
}

function specValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function quoteSpecKey(quote: SourceQuote | SourceQuoteInput) {
  return [
    quote.itemType,
    quote.itemName,
    quote.size,
    quote.material,
    quote.paperWeight,
    quote.sides,
    quote.color,
    quote.finish,
  ].map(specValue).join("|");
}

function findMatchingQuote(quotes: SourceQuote[], form: SourceQuoteInput, quantity = form.quantity) {
  const key = quoteSpecKey({ ...form, quantity });
  return quotes.find((quote) => quote.quantity === quantity && quoteSpecKey(quote) === key);
}

function FactoryForm({ factory, onSaved, onCancel }: { factory?: SourceFactory; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<SourceFactoryInput>(factory ? factoryToInput(factory) : emptyFactory);
  const [tags, setTags] = useState(form.tags.join("，"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name.trim()) return setError("请填写厂家名称");
    setSaving(true);
    setError("");
    try {
      const input = { ...form, tags: tags.split(/[,，;；]/).map((tag) => tag.trim()).filter(Boolean) };
      if (factory) await api.updateSourceFactory(factory.id, input);
      else await api.createSourceFactory(input);
      onSaved();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-stack">
      <section className="form-section">
        <div className="section-title"><Factory size={18} /><div><h3>厂家资料</h3><p>联系人、联系方式和常用备注</p></div></div>
        <div className="form-grid three">
          <label><span>厂家名称 *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：华彩印刷源头厂" /></label>
          <label><span>联系人</span><input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} placeholder="陈经理" /></label>
          <label><span>电话</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="手机号或座机" /></label>
        </div>
        <div className="form-grid three">
          <label><span>微信</span><input value={form.wechat} onChange={(event) => setForm({ ...form, wechat: event.target.value })} placeholder="常用微信号" /></label>
          <label><span>标签</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="名片，写真，发货快" /></label>
          <label><span>地址</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="厂家地址或所在市场" /></label>
        </div>
        <label><span>运费备注</span><textarea value={form.shippingNotes} onChange={(event) => setForm({ ...form, shippingNotes: event.target.value })} placeholder="例如：广东省内 8 元起，易拉宝按件计费。" /></label>
        <label><span>厂家备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="质量、交期、适合做什么、注意事项…" /></label>
      </section>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions"><Button variant="secondary" onClick={onCancel}>取消</Button><Button onClick={submit} disabled={saving}>{saving ? "保存中…" : factory ? "保存厂家" : "添加厂家"}</Button></div>
    </div>
  );
}

function PriceConfigurator({
  factory,
  project,
  selectedQuote,
  draftKey,
  onSaved,
  onDeleted,
}: {
  factory: SourceFactory;
  project?: FactoryProjectGroup;
  selectedQuote?: SourceQuote;
  draftKey: number;
  onSaved: (quote: SourceQuote) => void;
  onDeleted: (quote: SourceQuote) => void;
}) {
  const [form, setForm] = useState<SourceQuoteInput>(() => selectedQuote ? quoteToInput(selectedQuote) : emptyQuote(factory.id, project?.projectName ?? ""));
  const [editingQuote, setEditingQuote] = useState<SourceQuote | undefined>(selectedQuote);
  const [customMaterialMode, setCustomMaterialMode] = useState(false);
  const [customPaperWeightMode, setCustomPaperWeightMode] = useState(false);
  const [customSizeMode, setCustomSizeMode] = useState(false);
  const [customFinishMode, setCustomFinishMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editingExisting = Boolean(editingQuote);
  const idSuffix = editingQuote?.id ?? `new-${factory.id}-${draftKey}`;
  const projectQuotes = project?.quotes ?? [];

  useEffect(() => {
    setError("");
    setEditingQuote(selectedQuote);
    const nextForm = selectedQuote ? quoteToInput(selectedQuote) : emptyQuote(factory.id, project?.projectName ?? "");
    setForm(nextForm);
    setCustomMaterialMode(Boolean(nextForm.material && !materialOptionsForProject(nextForm.itemName).includes(nextForm.material)));
    setCustomPaperWeightMode(Boolean(nextForm.paperWeight && !paperWeightOptionsForProject(nextForm.itemName).includes(nextForm.paperWeight)));
    setCustomSizeMode(Boolean(nextForm.size && !sizeOptionsForProject(nextForm.itemName).includes(nextForm.size)));
    setCustomFinishMode(Boolean(nextForm.finish && !finishOptionsForProject(nextForm.itemName).includes(nextForm.finish)));
  }, [draftKey, factory.id, project?.projectName, selectedQuote?.id]);

  const setMoney = (field: "productionCostCents" | "shippingCostCents", value: string) => {
    setForm((current) => ({ ...current, [field]: Math.round(Number(value) * 100) }));
  };

  const applySpecPatch = (patch: Partial<SourceQuoteInput>) => {
    const next = { ...form, ...patch, factoryId: factory.id };
    const match = findMatchingQuote(projectQuotes, next);
    setEditingQuote(match);
    setForm(match ? quoteToInput(match) : { ...next, productionCostCents: 0, shippingCostCents: 0 });
  };

  const selectQuantity = (quantity: number) => {
    const next = { ...form, quantity, factoryId: factory.id };
    const match = findMatchingQuote(projectQuotes, next, quantity);
    setEditingQuote(match);
    setForm(match ? quoteToInput(match) : { ...next, productionCostCents: 0, shippingCostCents: 0 });
  };

  const quantityPriceLabel = (quantity: number) => {
    const match = findMatchingQuote(projectQuotes, form, quantity);
    if (match) return formatCents(match.productionCostCents);
    if (form.quantity === quantity && form.productionCostCents > 0) return formatCents(form.productionCostCents);
    return "点击报价";
  };

  const projectName = form.itemName || project?.projectName || "";
  const materialOptions = materialOptionsForProject(projectName);
  const paperWeightOptions = paperWeightOptionsForProject(projectName);
  const sizeOptions = sizeOptionsForProject(projectName);
  const finishOptions = finishOptionsForProject(projectName);
  const quantityPresets = quantityPresetsForProject(projectName);
  const quantityUnit = quantityUnitForProject(projectName);
  const paperWeightLabel = paperWeightLabelForProject(projectName);
  const materialSelectOptions = optionsWithCurrent(materialOptions, form.material);
  const paperWeightSelectOptions = optionsWithCurrent(paperWeightOptions, form.paperWeight);
  const finishSelectOptions = finishOptions;
  const isCustomSize = customSizeMode || Boolean(form.size && !sizeOptions.includes(form.size));
  const sizeSelectValue = isCustomSize ? CUSTOM_SIZE_VALUE : form.size;
  const parsedCustomSize = parseSize(form.size);

  const selectMaterial = (value: string) => {
    if (value === CUSTOM_MATERIAL_VALUE) {
      setCustomMaterialMode(true);
      return;
    }
    setCustomMaterialMode(false);
    applySpecPatch({ material: value });
  };

  const selectPaperWeight = (value: string) => {
    if (value === CUSTOM_PAPER_WEIGHT_VALUE) {
      setCustomPaperWeightMode(true);
      return;
    }
    setCustomPaperWeightMode(false);
    applySpecPatch({ paperWeight: value });
  };

  const selectSize = (value: string) => {
    if (value === CUSTOM_SIZE_VALUE) {
      setCustomSizeMode(true);
      return;
    }
    setCustomSizeMode(false);
    applySpecPatch({ size: value });
  };

  const selectFinish = (value: string) => {
    if (value === CUSTOM_FINISH_VALUE) {
      setCustomFinishMode(true);
      return;
    }
    setCustomFinishMode(false);
    applySpecPatch({ finish: value });
  };

  const setCustomSizePart = (part: "width" | "height", value: string) => {
    const nextSize = formatCustomSize(
      part === "width" ? value : parsedCustomSize.width,
      part === "height" ? value : parsedCustomSize.height,
    );
    applySpecPatch({ size: nextSize });
  };

  const submit = async () => {
    if (!form.itemName.trim()) return setError("请填写项目名称，例如名片或宣传单");
    if (form.quantity <= 0) return setError("成品数量必须大于 0");
    if (form.productionCostCents < 0 || form.shippingCostCents < 0) return setError("厂家价格和运费不能为负数");
    setSaving(true);
    setError("");
    try {
      const input = { ...form, factoryId: factory.id, itemName: form.itemName.trim(), itemType: form.itemType.trim() || "印刷" };
      const saved = editingQuote ? await api.updateSourceQuote(editingQuote.id, input) : await api.createSourceQuote(input);
      setEditingQuote(saved);
      setForm(quoteToInput(saved));
      onSaved(saved);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrent = async () => {
    if (!editingQuote) return;
    if (!window.confirm(`确定删除报价「${editingQuote.itemName} ${editingQuote.quantity}」吗？历史订单中的成本快照不会受影响。`)) return;
    await api.deleteSourceQuote(editingQuote.id);
    setEditingQuote(undefined);
    setForm((current) => ({ ...current, productionCostCents: 0, shippingCostCents: 0 }));
    onDeleted(editingQuote);
  };

  return (
    <section className="project-detail-panel" aria-label="规格价格详情">
      <div className="quote-editor-topline">
        <div>
          <span className="eyebrow">规格 / 价格</span>
          <h3>{form.itemName || project?.projectName || "新项目报价"}</h3>
          <p>{quoteSpec(form) || "左边选项目，右边定材质尺寸工艺；点下面数量后填写并保存价格。"}</p>
        </div>
      </div>

      <div className="quote-config-card">
        <div className="quote-config-row">
          <div className="config-label">材质</div>
          <div className="config-control field-pair">
            <label>
              <span>材质</span>
              <select aria-label="材质" value={customMaterialMode ? CUSTOM_MATERIAL_VALUE : form.material} onChange={(event) => selectMaterial(event.target.value)}>
                {materialSelectOptions.map((material) => <option value={material} key={material}>{material}</option>)}
                <option value={CUSTOM_MATERIAL_VALUE}>自定义</option>
              </select>
            </label>
            {customMaterialMode && <label><span>自定义材质</span><input aria-label="自定义材质" value={form.material} onChange={(event) => applySpecPatch({ material: event.target.value })} placeholder="输入厂家实际材质" /></label>}
            <label>
              <span>{paperWeightLabel}</span>
              <select aria-label="克重/厚度" value={customPaperWeightMode ? CUSTOM_PAPER_WEIGHT_VALUE : form.paperWeight} onChange={(event) => selectPaperWeight(event.target.value)}>
                {paperWeightSelectOptions.map((paper) => <option value={paper} key={paper}>{paper}</option>)}
                <option value={CUSTOM_PAPER_WEIGHT_VALUE}>自定义</option>
              </select>
            </label>
            {customPaperWeightMode && <label><span>自定义{paperWeightLabel}</span><input aria-label="自定义克重/厚度" value={form.paperWeight} onChange={(event) => applySpecPatch({ paperWeight: event.target.value })} placeholder="例如 260g / 0.18mm / 双层" /></label>}
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">成品尺寸</div>
          <div className="config-control">
            <label className="size-select-field">
              <span>尺寸</span>
              <select aria-label="尺寸" value={sizeSelectValue} onChange={(event) => selectSize(event.target.value)}>
                {sizeOptions.map((size) => <option value={size} key={size}>{size}</option>)}
                <option value={CUSTOM_SIZE_VALUE}>自定义</option>
              </select>
            </label>
            {isCustomSize && (
              <div className="custom-size-fields" aria-label="自定义尺寸">
                <label><span>长（mm）</span><input aria-label="自定义尺寸长" type="number" min="0" step="0.1" value={parsedCustomSize.width} onChange={(event) => setCustomSizePart("width", event.target.value)} /></label>
                <b>×</b>
                <label><span>宽（mm）</span><input aria-label="自定义尺寸宽" type="number" min="0" step="0.1" value={parsedCustomSize.height} onChange={(event) => setCustomSizePart("height", event.target.value)} /></label>
              </div>
            )}
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">印面</div>
          <div className="config-control segmented-options">
            {["双面", "单面"].map((side) => <button type="button" className={form.sides === side ? "active" : ""} key={side} onClick={() => applySpecPatch({ sides: side })}>{side}</button>)}
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">印色</div>
          <div className="config-control segmented-options">
            {["彩色", "黑白", "专色"].map((color) => <button type="button" className={form.color === color ? "active" : ""} key={color} onClick={() => applySpecPatch({ color })}>{color}</button>)}
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">工艺</div>
          <div className="config-control">
            <label className="finish-select-field">
              <span>工艺</span>
              <select aria-label="工艺" value={customFinishMode ? CUSTOM_FINISH_VALUE : form.finish} onChange={(event) => selectFinish(event.target.value)}>
                <option value="">不选工艺</option>
                {finishSelectOptions.map((finish) => <option value={finish} key={finish}>{finish}</option>)}
                <option value={CUSTOM_FINISH_VALUE}>自定义</option>
              </select>
            </label>
            {customFinishMode && <label className="custom-finish-field"><span>自定义工艺</span><input aria-label="自定义工艺" value={form.finish} onChange={(event) => applySpecPatch({ finish: event.target.value })} placeholder="输入厂家实际工艺" /></label>}
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">款数</div>
          <div className="config-control compact-number">
            <button type="button" disabled>-</button>
            <input aria-label="款数" type="number" min="1" value={1} readOnly />
            <button type="button" disabled>+</button>
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">成品数量</div>
          <div className="config-control quantity-choice-list">
            {quantityPresets.map((quantity) => (
              <button type="button" className={`quantity-choice ${form.quantity === quantity ? "active" : ""}`} key={quantity} onClick={() => selectQuantity(quantity)}>
                <strong>{quantity} {quantityUnit}</strong>
                <span>{quantityPriceLabel(quantity)}</span>
              </button>
            ))}
            <label className="custom-quantity"><span>自定义数量</span><input list={`quantity-presets-${idSuffix}`} aria-label="数量" type="number" min="1" value={form.quantity} onChange={(event) => selectQuantity(Number(event.target.value))} /></label>
            <datalist id={`quantity-presets-${idSuffix}`}>{quantityPresets.map((quantity) => <option value={quantity} key={quantity}>{quantity}</option>)}</datalist>
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">价格</div>
          <div className="config-control field-pair">
            <label><span>厂家整批价</span><div className="money-input"><span>¥</span><input aria-label="厂家整批价" type="number" min="0" step="0.01" value={(form.productionCostCents / 100).toString()} onChange={(event) => setMoney("productionCostCents", event.target.value)} /></div></label>
            <label><span>该报价运费</span><div className="money-input"><span>¥</span><input aria-label="该报价运费" type="number" min="0" step="0.01" value={(form.shippingCostCents / 100).toString()} onChange={(event) => setMoney("shippingCostCents", event.target.value)} /></div></label>
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">补充</div>
          <div className="config-control field-pair">
            <label><span>工期</span><input value={form.leadTime} onChange={(event) => setForm({ ...form, leadTime: event.target.value })} placeholder="1-2 天 / 当天出" /></label>
            <label><span>报价备注</span><input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="包装、起订量、特殊说明" /></label>
          </div>
        </div>
      </div>

      <div className="quote-editor-summary">
        <span>当前报价</span>
        <strong>{formatCents(form.productionCostCents)}</strong>
        <span>运费 {formatCents(form.shippingCostCents)}</span>
        {form.quantity > 0 && form.productionCostCents > 0 && <span>约 {formatCents(Math.round(form.productionCostCents / form.quantity))} / {quantityUnit}</span>}
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="quote-editor-actions">
        {editingExisting && <Button variant="danger" onClick={deleteCurrent} disabled={saving}><Trash2 size={16} />删除这个数量价格</Button>}
        <Button onClick={submit} disabled={saving}>{saving ? "保存中…" : editingExisting ? "保存这个数量价格" : "保存新价格"}</Button>
      </div>
    </section>
  );
}

export function FactoriesPage({
  factories,
  quotes,
  selectedFactoryId,
  onSelect,
  onChanged,
}: {
  factories: SourceFactory[];
  quotes: SourceQuote[];
  selectedFactoryId?: string | null;
  onSelect?: (factory: SourceFactory) => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState("全部");
  const [projectQuery, setProjectQuery] = useState("");
  const [activeFactoryId, setActiveFactoryId] = useState<string | null>(() => selectedFactoryId ?? null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [draftProjectNamesByFactory, setDraftProjectNamesByFactory] = useState<Record<string, string[]>>({});
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [draftKey, setDraftKey] = useState(0);
  const [factoryModal, setFactoryModal] = useState<SourceFactory | "new" | null>(null);
  const lastSelectedFactoryId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (selectedFactoryId && selectedFactoryId !== lastSelectedFactoryId.current) {
      setActiveFactoryId(selectedFactoryId);
      lastSelectedFactoryId.current = selectedFactoryId;
    }
  }, [selectedFactoryId]);

  useEffect(() => {
    if (activeFactoryId && !factories.some((factory) => factory.id === activeFactoryId)) {
      setActiveFactoryId(null);
      setActiveProjectName(null);
      setActiveQuoteId(null);
    }
  }, [activeFactoryId, factories]);

  const itemTypes = useMemo(() => ["全部", ...unique(quotes.map((quote) => quote.itemType || quote.itemName))], [quotes]);
  const filtered = useMemo(() => factories.filter((factory) => {
    const factoryQuotes = quotes.filter((quote) => quote.factoryId === factory.id);
    const matchesQuery = JSON.stringify({ factory, factoryQuotes }).toLowerCase().includes(query.toLowerCase());
    const matchesType = itemType === "全部" || factoryQuotes.some((quote) => quote.itemType === itemType || quote.itemName === itemType);
    return matchesQuery && matchesType;
  }), [factories, itemType, query, quotes]);

  const activeFactory = factories.find((factory) => factory.id === activeFactoryId) ?? null;
  const activeFactoryQuotes = useMemo(() => activeFactory ? quotes.filter((quote) => quote.factoryId === activeFactory.id) : [], [activeFactory, quotes]);
  const activeDraftProjectNames = activeFactory ? draftProjectNamesByFactory[activeFactory.id] ?? [] : [];
  const projectGroups = useMemo(() => groupQuotesByProject(activeFactoryQuotes, activeDraftProjectNames), [activeFactoryQuotes, activeDraftProjectNames]);
  const filteredProjectGroups = useMemo(() => projectGroups.filter((project) => {
    const search = projectQuery.toLowerCase();
    return !search || project.projectName.toLowerCase().includes(search) || project.itemType.toLowerCase().includes(search) || project.quotes.some((quote) => quoteSearchText(quote).includes(search));
  }), [projectGroups, projectQuery]);
  const activeProject = projectGroups.find((project) => project.projectName === activeProjectName);
  const selectedQuote = activeFactoryQuotes.find((quote) => quote.id === activeQuoteId);

  useEffect(() => {
    setProjectQuery("");
    setActiveProjectName(null);
    setActiveQuoteId(null);
    setAddingProject(false);
    setNewProjectName("");
    setDraftKey((value) => value + 1);
  }, [activeFactoryId]);

  useEffect(() => {
    if (!activeFactory) return;
    if (activeProjectName && projectGroups.some((project) => project.projectName === activeProjectName)) return;
    const firstProject = projectGroups[0];
    setActiveProjectName(firstProject?.projectName ?? null);
    setActiveQuoteId(firstProject?.quotes[0]?.id ?? null);
  }, [activeFactory, activeProjectName, projectGroups]);

  const enterFactory = (factory: SourceFactory) => {
    setActiveFactoryId(factory.id);
    onSelect?.(factory);
  };

  const backToFactories = () => {
    setActiveFactoryId(null);
    setProjectQuery("");
    setActiveProjectName(null);
    setActiveQuoteId(null);
  };

  const selectProject = (project: FactoryProjectGroup) => {
    setActiveProjectName(project.projectName);
    setActiveQuoteId(project.quotes[0]?.id ?? null);
    setAddingProject(false);
    setDraftKey((value) => value + 1);
  };

  const addProject = () => {
    if (!activeFactory) return;
    const projectName = newProjectName.trim();
    if (!projectName) return;
    setDraftProjectNamesByFactory((current) => ({
      ...current,
      [activeFactory.id]: unique([...(current[activeFactory.id] ?? []), projectName]),
    }));
    setProjectQuery("");
    setActiveProjectName(projectName);
    setActiveQuoteId(null);
    setNewProjectName("");
    setAddingProject(false);
    setDraftKey((value) => value + 1);
  };

  const cancelAddProject = () => {
    setAddingProject(false);
    setNewProjectName("");
  };

  const deleteFactory = async (factory: SourceFactory) => {
    if (!window.confirm(`确定删除厂家「${factory.name}」吗？历史订单中的成本快照不会受影响。`)) return;
    await api.deleteSourceFactory(factory.id);
    setActiveFactoryId(null);
    onChanged();
  };

  const onQuoteSaved = (quote: SourceQuote) => {
    setActiveProjectName(quote.itemName);
    setActiveQuoteId(quote.id);
    onChanged();
  };

  const onQuoteDeleted = (quote: SourceQuote) => {
    const remaining = activeFactoryQuotes.filter((item) => item.id !== quote.id && item.itemName === quote.itemName);
    setActiveQuoteId(remaining[0]?.id ?? null);
    setActiveProjectName(quote.itemName);
    setDraftKey((value) => value + 1);
    onChanged();
  };

  if (activeFactory) {
    return (
      <div className="page-content">
        <div className="factory-workspace-header">
          <button className="factory-back-button" onClick={backToFactories}><ArrowLeft size={17} />全部厂家</button>
          <div className="factory-workspace-title">
            <span className="eyebrow">厂家项目报价</span>
            <h1>{activeFactory.name}</h1>
            <p>{activeFactory.contactName || "未填联系人"} · {activeFactory.phone || activeFactory.wechat || "未填联系方式"}</p>
          </div>
          <div className="panel-actions">
            <button className="icon-button" onClick={() => setFactoryModal(activeFactory)} aria-label="修改厂家"><Edit3 size={16} /></button>
            <button className="icon-button danger" onClick={() => deleteFactory(activeFactory)} aria-label="删除厂家"><Trash2 size={16} /></button>
          </div>
        </div>

        <section className="factory-contact-strip">
          <div><Truck size={16} /><span>电话</span><strong>{activeFactory.phone || "未填写"}</strong></div>
          <div><span>微信</span><strong>{activeFactory.wechat || "未填写"}</strong></div>
          <div><span>地址</span><strong>{activeFactory.address || "未填写"}</strong></div>
          <div><span>更新</span><strong>{shortDate(activeFactory.updatedAt)}</strong></div>
          {(activeFactory.shippingNotes || activeFactory.notes) && <p>{activeFactory.shippingNotes || activeFactory.notes}</p>}
        </section>

        <div className="factory-project-layout">
          <aside className="project-sidebar">
            <div className="project-sidebar-head">
              <div><span className="eyebrow">项目</span><h2>厂家项目</h2></div>
              <button type="button" className="icon-button" onClick={() => setAddingProject(true)} aria-label="添加项目"><Plus size={16} /></button>
            </div>
            {addingProject && (
              <div className="project-add-form">
                <input
                  autoFocus
                  aria-label="新增项目名称"
                  list={`project-name-suggestions-${activeFactory.id}`}
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addProject();
                    if (event.key === "Escape") cancelAddProject();
                  }}
                  placeholder="例如：扇子、联单、画册"
                />
                <button type="button" className="icon-button" onClick={addProject} aria-label="确认添加项目" disabled={!newProjectName.trim()}><Check size={16} /></button>
                <button type="button" className="icon-button" onClick={cancelAddProject} aria-label="取消添加项目"><X size={16} /></button>
                <datalist id={`project-name-suggestions-${activeFactory.id}`}>
                  {projectNameSuggestions.map((name) => <option value={name} key={name} />)}
                </datalist>
              </div>
            )}
            <label className="search-field project-search"><Search size={17} /><input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="搜索项目、材质、数量或工艺…" /></label>
            {filteredProjectGroups.length === 0 ? (
              <EmptyState icon={<PackagePlus size={25} />} title="没有匹配的项目" description="当前只保留名片、不干胶、宣传单三个大类；清空搜索后可继续录价。" />
            ) : (
              <div className="project-list">
                {filteredProjectGroups.map((project) => (
                  <button
                    type="button"
                    className={`project-card ${activeProjectName === project.projectName ? "active" : ""}`}
                    key={project.projectName}
                    aria-label={project.projectName}
                    onClick={() => selectProject(project)}
                  >
                    <div><strong>{project.projectName}</strong></div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <PriceConfigurator
            factory={activeFactory}
            project={activeProject}
            selectedQuote={selectedQuote}
            draftKey={draftKey}
            onSaved={onQuoteSaved}
            onDeleted={onQuoteDeleted}
          />
        </div>

        {factoryModal && <Modal title={factoryModal === "new" ? "添加源头厂家" : "编辑源头厂家"} subtitle="厂家资料用于查价和订单成本记录。" onClose={() => setFactoryModal(null)} wide>
          <FactoryForm factory={factoryModal === "new" ? undefined : factoryModal} onCancel={() => setFactoryModal(null)} onSaved={() => { setFactoryModal(null); onChanged(); }} />
        </Modal>}
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="成本与对价"
        title="源头厂家"
        description="先选厂家，再进入项目列表录入名片、宣传单、写真等规格和价格。"
        actions={<Button onClick={() => setFactoryModal("new")}><Plus size={17} />添加厂家</Button>}
      />
      <div className="toolbar">
        <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索厂家、联系人、项目、材质或工艺…" /></label>
        <label className="filter-select"><ClipboardList size={16} /><select value={itemType} onChange={(event) => setItemType(event.target.value)}>{itemTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <span className="result-count">{filtered.length} 家厂家</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Factory size={28} />} title="还没有源头厂家" description="先添加常用厂家，再录入名片、单页、写真等报价。" action={<Button onClick={() => setFactoryModal("new")}><Plus size={16} />添加厂家</Button>} />
      ) : (
        <div className="factory-grid-panel">
          {filtered.map((factory) => {
            const factoryQuotes = quotes
              .filter((quote) => quote.factoryId === factory.id)
              .sort((left, right) => compareUpdatedAt(left.updatedAt, right.updatedAt));
            const latestProjectName = factoryQuotes[0]?.itemName || "待录入";
            return (
              <article
                className="factory-card"
                key={factory.id}
                role="button"
                tabIndex={0}
                aria-label={`进入${factory.name}`}
                onClick={() => enterFactory(factory)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") enterFactory(factory); }}
              >
                <div className="factory-card-top">
                  <div className="factory-mark"><Factory size={18} /></div>
                  <div className="factory-title"><h3>{factory.name}</h3><span>{factory.contactName || "未填联系人"} · {factory.phone || factory.wechat || "未填联系方式"}</span></div>
                  <button className="icon-button" onClick={(event) => { event.stopPropagation(); setFactoryModal(factory); }} aria-label={`编辑${factory.name}`}><Edit3 size={16} /></button>
                </div>
                <p className="factory-note">{factory.notes || factory.shippingNotes || "暂无厂家备注"}</p>
                <div className="tag-list">{factory.tags.map((tag) => <span key={tag}><Tag size={12} />{tag}</span>)}</div>
                <div className="factory-stats">
                  <span><b>{factoryQuotes.length}</b></span>
                  <span><b>{latestProjectName}</b></span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {factoryModal && <Modal title={factoryModal === "new" ? "添加源头厂家" : "编辑源头厂家"} subtitle="厂家资料用于查价和订单成本记录。" onClose={() => setFactoryModal(null)} wide>
        <FactoryForm factory={factoryModal === "new" ? undefined : factoryModal} onCancel={() => setFactoryModal(null)} onSaved={() => { setFactoryModal(null); onChanged(); }} />
      </Modal>}
    </div>
  );
}
