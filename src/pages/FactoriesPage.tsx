import { ArrowLeft, Check, ClipboardList, Copy, Edit3, ExternalLink, Factory, PackagePlus, Plus, Search, Tag, Trash2, Truck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "../lib/api";
import { formatCents, shortDate } from "../lib/format";
import {
  buildGroupedPrintFinish,
  canonicalPrintProjectName,
  childPrintProjectNames,
  defaultGroupedPrintFinish,
  formatPrintSize,
  printCategoryName,
  printFinishGroupsForProject,
  printPaperWeightOptionsForMaterial,
  printTopLevelCategories,
  printPresetForProject,
  printSpecValue,
  splitGroupedPrintFinish,
  splitLegacyPrintMaterial,
  uniquePrintValues,
  ungroupedPrintFinish,
} from "../lib/printPresets";
import type { SourceFactory, SourceFactoryInput, SourceFactoryProject, SourceQuote, SourceQuoteInput } from "../lib/types";
import { Button, EmptyState, Modal, PageHeader, SearchableSelect } from "../components/ui";

const CUSTOM_SIZE_VALUE = "__custom_size__";
const CUSTOM_MATERIAL_VALUE = "__custom_material__";
const CUSTOM_PAPER_WEIGHT_VALUE = "__custom_paper_weight__";
const CUSTOM_FINISH_VALUE = "__custom_finish__";

const emptyFactory: SourceFactoryInput = {
  name: "",
  contactName: "",
  phone: "",
  wechat: "",
  qq: "",
  orderUrl: "",
  address: "",
  tags: [],
  shippingNotes: "",
  notes: "",
};

async function copyText(value: string) {
  if (!value.trim()) return false;
  await navigator.clipboard?.writeText(value);
  return true;
}

type FactoryProjectGroup = {
  projectName: string;
  categoryName: string;
  itemType: string;
  quotes: SourceQuote[];
  updatedAt: string;
  projectRecordId?: string;
};

type FactoryProjectCategory = {
  categoryName: string;
  projects: FactoryProjectGroup[];
  categoryRecordId?: string;
};

type ProjectContextMenu =
  | {
      kind: "category";
      x: number;
      y: number;
      category: FactoryProjectCategory;
      canDelete: boolean;
    }
  | {
      kind: "project";
      x: number;
      y: number;
      project: FactoryProjectGroup;
      canDelete: boolean;
    };

function emptyQuote(factoryId: string, itemName = ""): SourceQuoteInput {
  const projectName = canonicalPrintProjectName(itemName);
  const material = materialOptionsForProject(projectName)[0] ?? "";
  return {
    factoryId,
    itemType: "印刷",
    itemName: projectName,
    quantity: quantityPresetsForProject(projectName)[0] ?? 1000,
    size: sizeOptionsForProject(projectName)[0] ?? "",
    material,
    paperWeight: paperWeightOptionsForProject(projectName, material)[0] ?? "",
    sides: sideOptionsForProject(projectName)[0] ?? "双面",
    color: colorOptionsForProject(projectName)[0] ?? "彩色",
    finish: defaultGroupedPrintFinish(projectName),
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
    qq: factory.qq,
    orderUrl: factory.orderUrl ?? "",
    address: factory.address,
    tags: factory.tags,
    shippingNotes: factory.shippingNotes,
    notes: factory.notes,
  };
}

function quoteToInput(quote: SourceQuote): SourceQuoteInput {
  const itemName = canonicalPrintProjectName(quote.itemName);
  const materialSpec = splitLegacyPrintMaterial(itemName, quote.material, quote.paperWeight);
  return {
    factoryId: quote.factoryId,
    itemType: quote.itemType,
    itemName,
    quantity: quote.quantity,
    size: formatPrintSize(quote.size),
    material: materialSpec.material,
    paperWeight: materialSpec.paperWeight,
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
  return [formatPrintSize(quote.size), [quote.material, quote.paperWeight].filter(Boolean).join(" "), quote.sides, quote.color, quote.finish]
    .filter(Boolean)
    .join(" / ");
}

function unique(values: string[]) {
  return uniquePrintValues(values);
}

function compareUpdatedAt(left?: string, right?: string) {
  return (right ?? "").localeCompare(left ?? "");
}

function groupQuotesByProject(quotes: SourceQuote[], projectRecords: SourceFactoryProject[] = []): FactoryProjectGroup[] {
  const groups = new Map<string, SourceQuote[]>();
  for (const quote of quotes) {
    const projectName = canonicalPrintProjectName(quote.itemName.trim() || "未命名项目");
    groups.set(projectName, [...(groups.get(projectName) ?? []), quote]);
  }
  const projectRecordByName = new Map(
    projectRecords
      .filter((record) => record.projectName.trim())
      .map((record) => [canonicalPrintProjectName(record.projectName), record])
  );

  const projectNames = unique([
    ...projectRecords
      .map((record) => record.projectName.trim())
      .filter(Boolean)
      .map((projectName) => canonicalPrintProjectName(projectName)),
    ...quotes.map((quote) => canonicalPrintProjectName(quote.itemName.trim() || "未命名项目")),
  ]);

  return projectNames
    .map((projectName) => {
      const projectQuotes = groups.get(projectName) ?? [];
      const sortedQuotes = [...projectQuotes].sort((left, right) => compareUpdatedAt(left.updatedAt, right.updatedAt));
      const latestQuote = sortedQuotes[0];
      const projectRecord = projectRecordByName.get(projectName);
      return {
        projectName,
        categoryName: projectRecord?.categoryName || printCategoryName(projectName),
        itemType: latestQuote?.itemType || "印刷",
        quotes: sortedQuotes,
        updatedAt: latestQuote?.updatedAt ?? "",
        projectRecordId: projectRecord?.id,
      };
    });
}

function groupProjectsByCategory(projects: FactoryProjectGroup[], projectRecords: SourceFactoryProject[] = []): FactoryProjectCategory[] {
  const categoryRecordByName = new Map(
    projectRecords
      .filter((record) => !record.projectName.trim())
      .map((record) => [record.categoryName, record])
  );
  const categoryNames = unique([
    ...projectRecords.map((record) => record.categoryName),
    ...projects.map((project) => project.categoryName),
  ]);
  return categoryNames
    .map((categoryName) => ({
      categoryName,
      projects: projects.filter((project) => project.categoryName === categoryName),
      categoryRecordId: categoryRecordByName.get(categoryName)?.id,
    }))
    .filter((group) => group.categoryRecordId || group.projects.length > 0);
}

function quoteSearchText(quote: SourceQuote) {
  return [quote.itemType, quote.itemName, canonicalPrintProjectName(quote.itemName), printCategoryName(quote.itemName), quote.quantity, quoteSpec(quote), quote.productionCostCents, quote.shippingCostCents, quote.leadTime, quote.notes]
    .join(" ")
    .toLowerCase();
}

function specPresetForProject(projectName: string) {
  return printPresetForProject(projectName);
}

function materialOptionsForProject(projectName: string) {
  return specPresetForProject(projectName).materials;
}

function paperWeightOptionsForProject(projectName: string, material = "") {
  return printPaperWeightOptionsForMaterial(projectName, material);
}

function sizeOptionsForProject(projectName: string) {
  return specPresetForProject(projectName).sizes;
}

function finishOptionsForProject(projectName: string) {
  return specPresetForProject(projectName).finishes;
}

function quantityPresetsForProject(projectName: string) {
  return specPresetForProject(projectName).quantities;
}

function colorOptionsForProject(projectName: string) {
  return specPresetForProject(projectName).colors ?? ["彩色", "黑白", "专色"];
}

function colorLabelForProject(projectName: string) {
  return specPresetForProject(projectName).colorLabel ?? "印色";
}

function sideOptionsForProject(projectName: string) {
  return specPresetForProject(projectName).sideOptions ?? ["双面", "单面"];
}

function sideLabelForProject(projectName: string) {
  return specPresetForProject(projectName).sideLabel ?? "印面";
}

function quantityUnitForProject(projectName: string) {
  return specPresetForProject(projectName).quantityUnit ?? "张";
}

function paperWeightLabelForProject(projectName: string) {
  return specPresetForProject(projectName).paperWeightLabel ?? "克重/厚度";
}

function materialLabelForProject(projectName: string) {
  return specPresetForProject(projectName).materialLabel ?? "材质";
}

function sizeUnitForProject(projectName: string) {
  return specPresetForProject(projectName).sizeUnit ?? "mm";
}

function optionsWithCurrent(options: string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : options;
}

function parseSize(value: string) {
  const match = value.match(/(?:(\d+(?:\.\d+)?)\s*)?[×xX*]\s*(?:(\d+(?:\.\d+)?)\s*)?/);
  return { width: match?.[1] ?? "", height: match?.[2] ?? "" };
}

function formatCustomSize(width: string, height: string, unit = "mm") {
  return width || height ? `${width || ""}×${height || ""}${unit}` : "";
}

function specValue(value: string) {
  return printSpecValue(value);
}

function quoteSpecKey(quote: SourceQuote | SourceQuoteInput) {
  const itemName = canonicalPrintProjectName(quote.itemName);
  const materialSpec = splitLegacyPrintMaterial(itemName, quote.material, quote.paperWeight);
  return [
    quote.itemType,
    itemName,
    formatPrintSize(quote.size),
    materialSpec.material,
    materialSpec.paperWeight,
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
          <label><span>QQ号</span><input value={form.qq} onChange={(event) => setForm({ ...form, qq: event.target.value })} placeholder="常用 QQ 号" /></label>
          <label><span>下单网址</span><input value={form.orderUrl} onChange={(event) => setForm({ ...form, orderUrl: event.target.value })} placeholder="例如：www.example.com/order" /></label>
        </div>
        <div className="form-grid two">
          <label><span>地址</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="厂家地址或所在市场" /></label>
          <label><span>标签</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="名片，写真，发货快" /></label>
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
    setCustomPaperWeightMode(Boolean(nextForm.paperWeight && !paperWeightOptionsForProject(nextForm.itemName, nextForm.material).includes(nextForm.paperWeight)));
    setCustomSizeMode(Boolean(nextForm.size && !sizeOptionsForProject(nextForm.itemName).includes(nextForm.size)));
    setCustomFinishMode(Boolean(
      printFinishGroupsForProject(nextForm.itemName).length
        ? ungroupedPrintFinish(nextForm.itemName, nextForm.finish)
        : nextForm.finish && !finishOptionsForProject(nextForm.itemName).includes(nextForm.finish)
    ));
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
  const paperWeightOptions = paperWeightOptionsForProject(projectName, form.material);
  const sizeOptions = sizeOptionsForProject(projectName);
  const finishOptions = finishOptionsForProject(projectName);
  const finishGroups = printFinishGroupsForProject(projectName);
  const hasFinishGroups = finishGroups.length > 0;
  const groupedFinishValues = splitGroupedPrintFinish(projectName, form.finish);
  const customGroupedFinish = ungroupedPrintFinish(projectName, form.finish);
  const colorOptions = colorOptionsForProject(projectName);
  const colorLabel = colorLabelForProject(projectName);
  const sideOptions = sideOptionsForProject(projectName);
  const sideLabel = sideLabelForProject(projectName);
  const quantityPresets = quantityPresetsForProject(projectName);
  const quantityUnit = quantityUnitForProject(projectName);
  const paperWeightLabel = paperWeightLabelForProject(projectName);
  const materialLabel = materialLabelForProject(projectName);
  const sizeUnit = sizeUnitForProject(projectName);
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
    const nextPaperWeights = paperWeightOptionsForProject(projectName, value);
    applySpecPatch({ material: value, paperWeight: nextPaperWeights.includes(form.paperWeight) ? form.paperWeight : nextPaperWeights[0] ?? "" });
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

  const selectGroupedFinish = (groupKey: string, value: string) => {
    applySpecPatch({
      finish: buildGroupedPrintFinish(projectName, { ...groupedFinishValues, [groupKey]: value }, customGroupedFinish),
    });
  };

  const setCustomGroupedFinish = (value: string) => {
    setCustomFinishMode(Boolean(value.trim()));
    applySpecPatch({ finish: buildGroupedPrintFinish(projectName, groupedFinishValues, value) });
  };

  const setCustomSizePart = (part: "width" | "height", value: string) => {
    const nextSize = formatCustomSize(
      part === "width" ? value : parsedCustomSize.width,
      part === "height" ? value : parsedCustomSize.height,
      sizeUnit,
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
      const input = { ...form, factoryId: factory.id, itemName: canonicalPrintProjectName(form.itemName), itemType: form.itemType.trim() || "印刷", size: formatPrintSize(form.size) };
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
          <div className="config-label">{materialLabel}</div>
          <div className="config-control field-pair">
            <label>
              <span>{materialLabel}</span>
              <SearchableSelect
                ariaLabel={materialLabel}
                value={customMaterialMode ? CUSTOM_MATERIAL_VALUE : form.material}
                options={[...materialSelectOptions, { value: CUSTOM_MATERIAL_VALUE, label: "自定义" }]}
                onChange={selectMaterial}
              />
            </label>
            {customMaterialMode && <label><span>自定义{materialLabel}</span><input aria-label={`自定义${materialLabel}`} value={form.material} onChange={(event) => applySpecPatch({ material: event.target.value })} placeholder="输入厂家实际材质" /></label>}
            <label>
              <span>{paperWeightLabel}</span>
              <SearchableSelect
                ariaLabel={paperWeightLabel}
                value={customPaperWeightMode ? CUSTOM_PAPER_WEIGHT_VALUE : form.paperWeight}
                options={[...paperWeightSelectOptions, { value: CUSTOM_PAPER_WEIGHT_VALUE, label: "自定义" }]}
                onChange={selectPaperWeight}
              />
            </label>
            {customPaperWeightMode && <label><span>自定义{paperWeightLabel}</span><input aria-label={`自定义${paperWeightLabel}`} value={form.paperWeight} onChange={(event) => applySpecPatch({ paperWeight: event.target.value })} placeholder="例如 260g / 0.18mm / 双层" /></label>}
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">成品尺寸</div>
          <div className="config-control">
            <label className="size-select-field">
              <span>尺寸</span>
              <SearchableSelect
                ariaLabel="尺寸"
                value={sizeSelectValue}
                options={[...sizeOptions, { value: CUSTOM_SIZE_VALUE, label: "自定义" }]}
                onChange={selectSize}
              />
            </label>
            {isCustomSize && (
              <div className="custom-size-fields" aria-label="自定义尺寸">
                <label><span>长（{sizeUnit}）</span><input aria-label="自定义尺寸长" type="number" min="0" step="0.1" value={parsedCustomSize.width} onChange={(event) => setCustomSizePart("width", event.target.value)} /></label>
                <b>×</b>
                <label><span>宽（{sizeUnit}）</span><input aria-label="自定义尺寸宽" type="number" min="0" step="0.1" value={parsedCustomSize.height} onChange={(event) => setCustomSizePart("height", event.target.value)} /></label>
              </div>
            )}
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">{sideLabel}</div>
          <div className="config-control segmented-options">
            {optionsWithCurrent(sideOptions, form.sides).map((side) => <button type="button" className={form.sides === side ? "active" : ""} key={side} onClick={() => applySpecPatch({ sides: side })}>{side}</button>)}
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">{colorLabel}</div>
          <div className="config-control segmented-options">
            {optionsWithCurrent(colorOptions, form.color).map((color) => <button type="button" className={form.color === color ? "active" : ""} key={color} onClick={() => applySpecPatch({ color })}>{color}</button>)}
          </div>
        </div>

        <div className="quote-config-row">
          <div className="config-label">{hasFinishGroups ? "后道工艺" : "工艺"}</div>
          <div className="config-control finish-group-control">
            {hasFinishGroups ? (
              <>
                {finishGroups.map((group) => {
                  const groupValue = groupedFinishValues[group.key] ?? group.emptyOption ?? "";
                  const groupOptions = optionsWithCurrent(group.options, groupValue);
                  return (
                    <label className="finish-select-field" key={group.key}>
                      <span>{group.label}</span>
                      <SearchableSelect
                        ariaLabel={group.label}
                        value={groupValue}
                        options={groupOptions}
                        onChange={(value) => selectGroupedFinish(group.key, value)}
                      />
                    </label>
                  );
                })}
                <label className="custom-finish-field">
                  <span>其他工艺</span>
                  <input aria-label="其他工艺" value={customGroupedFinish} onChange={(event) => setCustomGroupedFinish(event.target.value)} placeholder="无" />
                </label>
              </>
            ) : (
              <>
                <label className="finish-select-field">
                  <span>工艺</span>
                  <SearchableSelect
                    ariaLabel="工艺"
                    value={customFinishMode ? CUSTOM_FINISH_VALUE : form.finish}
                    options={[{ value: "", label: "不选工艺" }, ...finishSelectOptions, { value: CUSTOM_FINISH_VALUE, label: "自定义" }]}
                    onChange={selectFinish}
                  />
                </label>
                {customFinishMode && <label className="custom-finish-field"><span>自定义工艺</span><input aria-label="自定义工艺" value={form.finish} onChange={(event) => applySpecPatch({ finish: event.target.value })} placeholder="输入厂家实际工艺" /></label>}
              </>
            )}
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
  factoryProjects,
  quotes,
  selectedFactoryId,
  onSelect,
  onChanged,
}: {
  factories: SourceFactory[];
  factoryProjects?: SourceFactoryProject[];
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
  const [expandedProjectCategories, setExpandedProjectCategories] = useState<Record<string, boolean>>({});
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingProjectCategory, setAddingProjectCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [projectError, setProjectError] = useState("");
  const [projectContextMenu, setProjectContextMenu] = useState<ProjectContextMenu | null>(null);
  const [localFactoryProjects, setLocalFactoryProjects] = useState<SourceFactoryProject[]>([]);
  const [draftKey, setDraftKey] = useState(0);
  const [factoryModal, setFactoryModal] = useState<SourceFactory | "new" | null>(null);
  const [copiedFactoryField, setCopiedFactoryField] = useState("");
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
  const mergedFactoryProjects = useMemo(() => {
    const merged = new Map<string, SourceFactoryProject>();
    for (const project of factoryProjects ?? []) merged.set(project.id, project);
    for (const project of localFactoryProjects) merged.set(project.id, project);
    return Array.from(merged.values());
  }, [factoryProjects, localFactoryProjects]);
  const activeFactoryProjects = useMemo(() => activeFactory ? mergedFactoryProjects.filter((project) => project.factoryId === activeFactory.id) : [], [activeFactory, mergedFactoryProjects]);
  const projectGroups = useMemo(() => groupQuotesByProject(activeFactoryQuotes, activeFactoryProjects), [activeFactoryQuotes, activeFactoryProjects]);
  const filteredProjectGroups = useMemo(() => projectGroups.filter((project) => {
    const search = projectQuery.toLowerCase();
    return !search || project.projectName.toLowerCase().includes(search) || project.categoryName.toLowerCase().includes(search) || project.itemType.toLowerCase().includes(search) || project.quotes.some((quote) => quoteSearchText(quote).includes(search));
  }), [projectGroups, projectQuery]);
  const visibleFactoryProjects = useMemo(() => {
    if (!projectQuery.trim()) return activeFactoryProjects;
    const visibleCategoryNames = new Set(filteredProjectGroups.map((project) => project.categoryName));
    const visibleProjectNames = new Set(filteredProjectGroups.map((project) => project.projectName));
    return activeFactoryProjects.filter((project) =>
      visibleCategoryNames.has(project.categoryName) ||
      (project.projectName && visibleProjectNames.has(canonicalPrintProjectName(project.projectName)))
    );
  }, [activeFactoryProjects, filteredProjectGroups, projectQuery]);
  const filteredProjectCategories = useMemo(() => groupProjectsByCategory(filteredProjectGroups, visibleFactoryProjects), [filteredProjectGroups, visibleFactoryProjects]);
  const activeProject = projectGroups.find((project) => project.projectName === activeProjectName);
  const selectedQuote = activeFactoryQuotes.find((quote) => quote.id === activeQuoteId);

  useEffect(() => {
    setProjectQuery("");
    setActiveProjectName(null);
    setActiveQuoteId(null);
    setAddingCategory(false);
    setAddingProjectCategory(null);
    setNewCategoryName("");
    setNewProjectName("");
    setProjectError("");
    setCopiedFactoryField("");
    setDraftKey((value) => value + 1);
  }, [activeFactoryId]);

  useEffect(() => {
    if (!projectContextMenu) return;
    const close = () => setProjectContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [projectContextMenu]);

  useEffect(() => {
    if (!activeFactory) return;
    if (activeProjectName && projectGroups.some((project) => project.projectName === activeProjectName)) return;
    const firstProject = projectGroups[0];
    setActiveProjectName(firstProject?.projectName ?? null);
    setActiveQuoteId(firstProject?.quotes[0]?.id ?? null);
    if (firstProject) {
      setExpandedProjectCategories((current) => ({ ...current, [firstProject.categoryName]: true }));
    }
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
    setExpandedProjectCategories((current) => ({ ...current, [project.categoryName]: true }));
    setAddingCategory(false);
    setAddingProjectCategory(null);
    setProjectError("");
    setDraftKey((value) => value + 1);
  };

  const startAddProject = (categoryName: string) => {
    setExpandedProjectCategories((current) => ({ ...current, [categoryName]: true }));
    setAddingProjectCategory(categoryName);
    setNewProjectName("");
    setProjectError("");
    setProjectContextMenu(null);
  };

  const toggleProjectCategory = (categoryName: string) => {
    setExpandedProjectCategories((current) => ({ ...current, [categoryName]: !current[categoryName] }));
  };

  const addCategory = async () => {
    if (!activeFactory) return;
    const categoryName = newCategoryName.trim();
    if (!categoryName) return;
    try {
      setProjectError("");
      const created = await api.createSourceFactoryProject({ factoryId: activeFactory.id, categoryName, projectName: "" });
      setLocalFactoryProjects((current) => [...current.filter((project) => project.id !== created.id), created]);
      setExpandedProjectCategories((current) => ({ ...current, [categoryName]: true }));
      setProjectQuery("");
      setNewCategoryName("");
      setAddingCategory(false);
      onChanged();
    } catch (reason) {
      setProjectError(String(reason));
    }
  };

  const addProject = async (categoryName: string) => {
    if (!activeFactory) return;
    const rawProjectName = newProjectName.trim();
    const projectName = canonicalPrintProjectName(rawProjectName);
    if (!projectName) return;
    try {
      setProjectError("");
      const created = await api.createSourceFactoryProject({ factoryId: activeFactory.id, categoryName, projectName });
      setLocalFactoryProjects((current) => [...current.filter((project) => project.id !== created.id), created]);
      setProjectQuery("");
      setActiveProjectName(projectName);
      setActiveQuoteId(null);
      setExpandedProjectCategories((current) => ({ ...current, [categoryName]: true }));
      setNewProjectName("");
      setAddingProjectCategory(null);
      setDraftKey((value) => value + 1);
      onChanged();
    } catch (reason) {
      setProjectError(String(reason));
    }
  };

  const deleteProjectRecord = async (project: FactoryProjectGroup) => {
    if (!project.projectRecordId || project.quotes.length > 0) return;
    try {
      setProjectError("");
      await api.deleteSourceFactoryProject(project.projectRecordId);
      setLocalFactoryProjects((current) => current.filter((item) => item.id !== project.projectRecordId));
      if (activeProjectName === project.projectName) {
        const fallbackProject = projectGroups.find((item) => item.projectName !== project.projectName);
        setActiveProjectName(fallbackProject?.projectName ?? null);
        setActiveQuoteId(fallbackProject?.quotes[0]?.id ?? null);
      }
      onChanged();
    } catch (reason) {
      setProjectError(String(reason));
    }
  };

  const deleteCategoryRecord = async (category: FactoryProjectCategory) => {
    if (!category.categoryRecordId) return;
    try {
      setProjectError("");
      await api.deleteSourceFactoryProject(category.categoryRecordId);
      setLocalFactoryProjects((current) => current.filter((item) => item.categoryName !== category.categoryName));
      if (category.projects.some((project) => project.projectName === activeProjectName)) {
        const fallbackProject = projectGroups.find((item) => item.categoryName !== category.categoryName);
        setActiveProjectName(fallbackProject?.projectName ?? null);
        setActiveQuoteId(fallbackProject?.quotes[0]?.id ?? null);
      }
      onChanged();
    } catch (reason) {
      setProjectError(String(reason));
    }
  };

  const cancelAddCategory = () => {
    setAddingCategory(false);
    setNewCategoryName("");
  };

  const cancelAddProject = () => {
    setAddingProjectCategory(null);
    setNewProjectName("");
  };

  const menuLeft = projectContextMenu ? Math.min(projectContextMenu.x, Math.max(8, window.innerWidth - 188)) : 0;
  const menuTop = projectContextMenu ? Math.min(projectContextMenu.y, Math.max(8, window.innerHeight - 118)) : 0;

  const deleteFactory = async (factory: SourceFactory) => {
    if (!window.confirm(`确定删除厂家「${factory.name}」吗？历史订单中的成本快照不会受影响。`)) return;
    await api.deleteSourceFactory(factory.id);
    setActiveFactoryId(null);
    onChanged();
  };

  const openFactoryOrderUrl = async (url: string) => {
    try {
      await api.openExternalUrl(url);
    } catch (reason) {
      window.alert(`无法打开下单网址：${String(reason)}`);
    }
  };

  const copyFactoryField = async (label: string, value: string) => {
    if (await copyText(value)) {
      setCopiedFactoryField(label);
      window.setTimeout(() => setCopiedFactoryField((current) => current === label ? "" : current), 1400);
    }
  };

  const onQuoteSaved = (quote: SourceQuote) => {
    setActiveProjectName(canonicalPrintProjectName(quote.itemName));
    setActiveQuoteId(quote.id);
    onChanged();
  };

  const onQuoteDeleted = (quote: SourceQuote) => {
    const deletedProjectName = canonicalPrintProjectName(quote.itemName);
    const remaining = activeFactoryQuotes.filter((item) => item.id !== quote.id && canonicalPrintProjectName(item.itemName) === deletedProjectName);
    setActiveQuoteId(remaining[0]?.id ?? null);
    setActiveProjectName(deletedProjectName);
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
            <p>{activeFactory.contactName || "未填联系人"} · {activeFactory.phone || activeFactory.wechat || activeFactory.qq || "未填联系方式"}</p>
          </div>
          <div className="panel-actions">
            <button className="icon-button" onClick={() => setFactoryModal(activeFactory)} aria-label="修改厂家"><Edit3 size={16} /></button>
            <button className="icon-button danger" onClick={() => deleteFactory(activeFactory)} aria-label="删除厂家"><Trash2 size={16} /></button>
          </div>
        </div>

        <section className="factory-contact-strip">
          <div>
            <Truck size={16} /><span>电话</span>
            <strong>{activeFactory.phone || "未填写"}</strong>
            {activeFactory.phone && <button type="button" className="factory-copy-button" onClick={() => void copyFactoryField("电话", activeFactory.phone)} aria-label="复制电话"><Copy size={13} /></button>}
          </div>
          <div>
            <span>微信</span>
            <strong>{activeFactory.wechat || "未填写"}</strong>
            {activeFactory.wechat && <button type="button" className="factory-copy-button" onClick={() => void copyFactoryField("微信", activeFactory.wechat)} aria-label="复制微信"><Copy size={13} /></button>}
          </div>
          <div>
            <span>QQ号</span>
            <strong>{activeFactory.qq || "未填写"}</strong>
            {activeFactory.qq && <button type="button" className="factory-copy-button" onClick={() => void copyFactoryField("QQ号", activeFactory.qq)} aria-label="复制QQ号"><Copy size={13} /></button>}
          </div>
          <div>
            <span>下单网址</span>
            {activeFactory.orderUrl ? (
              <div className="factory-url-actions">
                <button type="button" className="factory-url-button" onClick={() => void openFactoryOrderUrl(activeFactory.orderUrl)}><span>打开下单网址</span><ExternalLink size={14} /></button>
                <button type="button" className="factory-copy-button" onClick={() => void copyFactoryField("下单网址", activeFactory.orderUrl)} aria-label="复制下单网址"><Copy size={13} /></button>
              </div>
            ) : <strong>未填写</strong>}
          </div>
          <div>
            <span>地址</span>
            <strong>{activeFactory.address || "未填写"}</strong>
            {activeFactory.address && <button type="button" className="factory-copy-button" onClick={() => void copyFactoryField("地址", activeFactory.address)} aria-label="复制地址"><Copy size={13} /></button>}
          </div>
          <div><span>更新</span><strong>{shortDate(activeFactory.updatedAt)}</strong></div>
          {copiedFactoryField && <small className="factory-copy-toast">已复制{copiedFactoryField}</small>}
          {(activeFactory.shippingNotes || activeFactory.notes) && <p>{activeFactory.shippingNotes || activeFactory.notes}</p>}
        </section>

        <div className="factory-project-layout">
          <aside className="project-sidebar">
            <div className="project-sidebar-head">
              <div><span className="eyebrow">项目</span><h2>厂家项目</h2></div>
              <button type="button" className="icon-button" onClick={() => setAddingCategory(true)} aria-label="添加大类"><Plus size={16} /></button>
            </div>
            {addingCategory && (
              <div className="project-add-form">
                <input
                  autoFocus
                  aria-label="新增大类名称"
                  list={`project-category-suggestions-${activeFactory.id}`}
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void addCategory();
                    if (event.key === "Escape") cancelAddCategory();
                  }}
                  placeholder="例如：名片、写真、包装"
                />
                <button type="button" className="icon-button" onClick={() => void addCategory()} aria-label="确认添加大类" disabled={!newCategoryName.trim()}><Check size={16} /></button>
                <button type="button" className="icon-button" onClick={cancelAddCategory} aria-label="取消添加大类"><X size={16} /></button>
                <datalist id={`project-category-suggestions-${activeFactory.id}`}>
                  {printTopLevelCategories.map((name) => <option value={name} key={name} />)}
                </datalist>
              </div>
            )}
            {projectError && <div className="form-error">{projectError}</div>}
            <label className="search-field project-search"><Search size={17} /><input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="搜索项目、材质、数量或工艺…" /></label>
            {filteredProjectCategories.length === 0 ? (
              <EmptyState
                icon={<PackagePlus size={25} />}
                title={projectGroups.length === 0 ? "还没有项目" : "没有匹配的项目"}
                description={projectGroups.length === 0 ? "点击上方加号添加大类，再在大类里添加小类。" : "清空搜索后可继续录价，或添加一个新的印刷项目。"}
              />
            ) : (
              <div className="project-list project-category-list">
                {filteredProjectCategories.map((category) => {
                  const hasChildren = category.projects.length > 0;
                  const expanded = projectQuery ? true : Boolean(expandedProjectCategories[category.categoryName]);
                  const activeInCategory = category.projects.some((project) => project.projectName === activeProjectName);
                  const canDeleteCategory = Boolean(category.categoryRecordId) && category.projects.every((project) => project.quotes.length === 0);
                  return (
                    <div className={`project-category ${expanded ? "expanded" : ""}`} key={category.categoryName}>
                      <button
                        type="button"
                        className={`project-card project-category-card ${activeInCategory ? "active-parent" : ""}`}
                        aria-expanded={expanded}
                        aria-label={category.categoryName}
                        onClick={() => toggleProjectCategory(category.categoryName)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setProjectContextMenu({
                            kind: "category",
                            x: event.clientX,
                            y: event.clientY,
                            category,
                            canDelete: canDeleteCategory,
                          });
                        }}
                      >
                        <div><strong>{category.categoryName}</strong></div>
                        <small>{expanded ? "收起" : "展开"}</small>
                      </button>
                      {expanded && (
                        <div className="project-sub-list">
                          {category.projects.map((project) => (
                            <button
                              type="button"
                              className={`project-card project-sub-card ${activeProjectName === project.projectName ? "active" : ""}`}
                              key={project.projectName}
                              aria-label={project.projectName}
                              onClick={() => selectProject(project)}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setProjectContextMenu({
                                  kind: "project",
                                  x: event.clientX,
                                  y: event.clientY,
                                  project,
                                  canDelete: Boolean(project.projectRecordId) && project.quotes.length === 0,
                                });
                              }}
                            >
                              <div><strong>{project.projectName}</strong></div>
                            </button>
                          ))}
                          {addingProjectCategory === category.categoryName && (
                            <div className="project-add-form project-sub-add-form">
                              <input
                                autoFocus
                                aria-label="新增小类名称"
                                list={`project-name-suggestions-${activeFactory.id}-${category.categoryName}`}
                                value={newProjectName}
                                onChange={(event) => setNewProjectName(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") void addProject(category.categoryName);
                                  if (event.key === "Escape") cancelAddProject();
                                }}
                                placeholder="例如：普通名片、室内写真"
                              />
                              <button type="button" className="icon-button" onClick={() => void addProject(category.categoryName)} aria-label="确认添加小类" disabled={!newProjectName.trim()}><Check size={16} /></button>
                              <button type="button" className="icon-button" onClick={cancelAddProject} aria-label="取消添加小类"><X size={16} /></button>
                              <datalist id={`project-name-suggestions-${activeFactory.id}-${category.categoryName}`}>
                                {unique(childPrintProjectNames(category.categoryName)).map((name) => <option value={name} key={name} />)}
                              </datalist>
                            </div>
                          )}
                          {!hasChildren && addingProjectCategory !== category.categoryName && (
                            <div className="project-sub-empty">暂无小类</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {projectContextMenu && (
              <div
                className="project-context-menu"
                role="menu"
                style={{ left: menuLeft, top: menuTop }}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
              >
                {projectContextMenu.kind === "category" ? (
                  <>
                    <button type="button" role="menuitem" onClick={() => startAddProject(projectContextMenu.category.categoryName)}>新增小类</button>
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      disabled={!projectContextMenu.canDelete}
                      onClick={() => {
                        if (projectContextMenu.kind !== "category" || !projectContextMenu.canDelete) return;
                        const category = projectContextMenu.category;
                        setProjectContextMenu(null);
                        void deleteCategoryRecord(category);
                      }}
                    >
                      {projectContextMenu.canDelete ? "删除大类" : "已有报价不可删除"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    disabled={!projectContextMenu.canDelete}
                    onClick={() => {
                      if (projectContextMenu.kind !== "project" || !projectContextMenu.canDelete) return;
                      const project = projectContextMenu.project;
                      setProjectContextMenu(null);
                      void deleteProjectRecord(project);
                    }}
                  >
                    {projectContextMenu.canDelete ? "删除小类" : "已有报价不可删除"}
                  </button>
                )}
              </div>
            )}
          </aside>

          {activeProject ? (
            <PriceConfigurator
              factory={activeFactory}
              project={activeProject}
              selectedQuote={selectedQuote}
              draftKey={draftKey}
              onSaved={onQuoteSaved}
              onDeleted={onQuoteDeleted}
            />
          ) : (
            <section className="project-detail-panel empty-project-panel" aria-label="规格价格详情">
              <EmptyState icon={<PackagePlus size={28} />} title="先添加项目" description="这个厂家还没有项目。添加名片、宣传单、写真等项目后，再录入对应规格和价格。" />
            </section>
          )}
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
                  <div className="factory-title">
                    <h3>{factory.name}</h3>
                    <span>
                      {factory.contactName || "未填联系人"} · {factory.phone || factory.wechat || factory.qq || "未填联系方式"}
                      {factory.orderUrl && (
                        <>
                          {" · "}
                          <button
                            type="button"
                            className="factory-inline-url"
                            onClick={(event) => {
                              event.stopPropagation();
                              void openFactoryOrderUrl(factory.orderUrl);
                            }}
                          >
                            下单网址
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                  <button className="icon-button" onClick={(event) => { event.stopPropagation(); setFactoryModal(factory); }} aria-label={`编辑${factory.name}`}><Edit3 size={16} /></button>
                </div>
                <p className="factory-note">{factory.notes || factory.shippingNotes || "暂无厂家备注"}</p>
                <div className="tag-list">{factory.tags.map((tag) => <span key={tag}><Tag size={12} />{tag}</span>)}</div>
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
