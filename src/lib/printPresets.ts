export type PrintPreset = {
  materialLabel?: string;
  materials: string[];
  paperWeights: string[];
  sizes: string[];
  finishes: string[];
  quantities: number[];
  quantityUnit: string;
  paperWeightLabel?: string;
  sizeUnit?: "mm" | "cm";
};

export type PrintProjectGroup = {
  categoryName: string;
  projectNames: string[];
};

export const printQuantityPresets = [500, 1000, 2000, 3000, 5000, 10000];

export const printProjectGroups: PrintProjectGroup[] = [
  { categoryName: "名片", projectNames: ["普通名片", "PVC卡", "特种纸名片"] },
  { categoryName: "不干胶", projectNames: ["不干胶"] },
  { categoryName: "宣传单", projectNames: ["宣传单"] },
  { categoryName: "扇子", projectNames: ["扇子"] },
  { categoryName: "联单", projectNames: ["联单"] },
  { categoryName: "海报", projectNames: ["海报"] },
  { categoryName: "易拉宝", projectNames: ["易拉宝"] },
  { categoryName: "写真", projectNames: ["室内写真", "室外写真", "写真裱板"] },
  { categoryName: "画册", projectNames: ["画册"] },
  { categoryName: "其他印刷", projectNames: ["其他印刷"] },
];

export const printTopLevelCategories = printProjectGroups.map((group) => group.categoryName);
export const printProjectNames = printProjectGroups.flatMap((group) => group.projectNames);
export const defaultPrintProjectName = printProjectGroups[0]?.projectNames[0] ?? "";

const commonBusinessCardSizes = [
  "90×54毫米",
  "90×50毫米",
  "180×54毫米",
  "110×90毫米",
  "140×100毫米",
  "160×54毫米",
];

const photoPrintSizes = [
  "自定义宽高",
  "30×40cm",
  "40×60cm",
  "60×90cm",
  "80×120cm",
  "100×150cm",
  "120×240cm",
];

const photoLaminationOptions = ["不覆膜", "亮膜", "哑膜", "磨砂地板膜", "斜纹地板膜"];
const photoFinishes = ["不裁切", "裁单张", "异型裁切（不拼大张裁小块）", "打扣", "裁单张 / 打扣"];
const photoQuantities = [1, 2, 5, 10, 20, 50, 100];

export const printProjectPresets: Record<string, PrintPreset> = {
  普通名片: {
    materials: ["铜版纸", "哑粉纸", "白卡纸"],
    paperWeights: ["250g", "300g", "350g", "400g"],
    sizes: commonBusinessCardSizes,
    finishes: ["不选工艺", "覆膜", "哑膜", "亮膜", "圆角", "覆膜 / 圆角", "烫金", "烫银", "UV", "击凸", "模切"],
    quantities: printQuantityPresets,
    quantityUnit: "张",
  },
  PVC卡: {
    materials: ["PVC", "透明PVC", "磨砂PVC", "白卡PVC"],
    paperWeights: ["0.38mm", "0.5mm", "0.76mm"],
    sizes: ["85.5×54毫米", "90×54毫米", "90×50毫米"],
    finishes: ["不选工艺", "圆角", "磨砂", "透明", "哑膜", "亮膜", "烫金", "UV"],
    quantities: printQuantityPresets,
    quantityUnit: "张",
    paperWeightLabel: "厚度",
  },
  特种纸名片: {
    materials: ["特种纸", "珠光纸", "棉纸", "牛皮纸", "刚古纸"],
    paperWeights: ["250g", "300g", "350g", "400g"],
    sizes: commonBusinessCardSizes,
    finishes: ["不选工艺", "圆角", "烫金", "烫银", "UV", "击凸", "模切"],
    quantities: printQuantityPresets,
    quantityUnit: "张",
  },
  不干胶: {
    materials: ["铜版不干胶", "透明不干胶", "牛皮纸不干胶", "PVC不干胶", "易碎纸"],
    paperWeights: ["80g", "120g", "157g"],
    sizes: ["50×30mm", "60×40mm", "70×50mm", "A4 210×297mm"],
    finishes: ["不选工艺", "覆膜", "哑膜", "亮膜", "模切", "异形模切", "覆膜 / 模切"],
    quantities: printQuantityPresets,
    quantityUnit: "张",
  },
  宣传单: {
    materials: ["铜版纸", "哑粉纸", "双胶纸", "书纸"],
    paperWeights: ["128g", "157g", "200g", "250g"],
    sizes: ["A4 210×297mm", "A5 148×210mm", "16开 210×285mm", "210×285mm"],
    finishes: ["不选工艺", "覆膜", "哑膜", "亮膜", "折页", "压痕", "裁切"],
    quantities: printQuantityPresets,
    quantityUnit: "张",
  },
  扇子: {
    materials: ["PP塑料", "PVC", "纸质", "竹柄纸扇", "无纺布"],
    paperWeights: ["单层", "双层", "0.35mm", "0.5mm", "0.8mm"],
    sizes: ["17×17cm", "19×19cm", "21×21cm", "七寸", "八寸"],
    finishes: ["不选工艺", "模切", "异形模切", "装柄", "覆膜", "UV", "烫金"],
    quantities: printQuantityPresets,
    quantityUnit: "把",
    paperWeightLabel: "厚度/规格",
  },
  联单: {
    materials: ["无碳复写纸", "双胶纸", "收据纸", "牛皮纸封面", "白红黄三联纸"],
    paperWeights: ["二联", "三联", "四联", "50组/本", "100组/本"],
    sizes: ["大32开 130×190mm", "A5 148×210mm", "16开 185×260mm", "A4 210×297mm"],
    finishes: ["不选工艺", "胶头", "包本", "打码", "撕线", "打孔", "封面", "垫板"],
    quantities: printQuantityPresets,
    quantityUnit: "本",
    paperWeightLabel: "联数/每本",
  },
  海报: {
    materials: ["铜版纸", "哑粉纸", "相纸", "PP背胶", "PVC"],
    paperWeights: ["157g", "200g", "250g", "背胶", "户外背胶"],
    sizes: ["A4 210×297mm", "A3 297×420mm", "A2 420×594mm", "50×70cm", "60×90cm"],
    finishes: ["不选工艺", "覆膜", "哑膜", "亮膜", "裁切", "裱板"],
    quantities: [1, 5, 10, 20, 50, 100],
    quantityUnit: "张",
  },
  易拉宝: {
    materials: ["PVC画面 + 铝合金架", "PP画面 + 铝合金架", "加厚架", "经济架"],
    paperWeights: ["80×200cm", "85×200cm", "加厚画面", "普通画面"],
    sizes: ["80×200cm", "85×200cm", "100×200cm"],
    finishes: ["不选工艺", "含架", "纸箱包装", "换画面", "覆膜"],
    quantities: [1, 2, 5, 10, 20, 50],
    quantityUnit: "套",
    paperWeightLabel: "画面/架子",
  },
  室内写真: {
    materialLabel: "材质/产品种类",
    materials: ["室内PP背胶", "室内相纸", "室内灯片", "室内PP合成纸", "室内可移背胶", "透明背胶", "写真布", "油画布", "KT板写真", "冷裱板写真"],
    paperWeights: photoLaminationOptions,
    sizes: photoPrintSizes,
    finishes: photoFinishes,
    quantities: photoQuantities,
    quantityUnit: "块",
    paperWeightLabel: "覆膜工艺",
    sizeUnit: "cm",
  },
  室外写真: {
    materialLabel: "材质/产品种类",
    materials: ["户外pp背胶", "白胶车贴", "黑胶车贴", "灰胶可移车贴", "黑胶可移车贴", "白胶可移车贴", "透明车贴", "磁性车贴面磁", "户外晶彩格反光贴", "户外平面反光贴", "户外PVC硬片", "户外单透", "户外PP合成纸", "户外灯片"],
    paperWeights: photoLaminationOptions,
    sizes: photoPrintSizes,
    finishes: photoFinishes,
    quantities: photoQuantities,
    quantityUnit: "块",
    paperWeightLabel: "覆膜工艺",
    sizeUnit: "cm",
  },
  写真裱板: {
    materialLabel: "材质/产品种类",
    materials: ["KT板写真", "冷裱板写真", "PVC板写真", "雪弗板写真", "安迪板写真", "室内PP背胶裱板", "户外背胶裱板"],
    paperWeights: ["不覆膜", "亮膜", "哑膜"],
    sizes: photoPrintSizes,
    finishes: ["不裁切", "裁单张", "异型裁切（不拼大张裁小块）", "包边", "打扣", "裁单张 / 打扣"],
    quantities: photoQuantities,
    quantityUnit: "块",
    paperWeightLabel: "覆膜工艺",
    sizeUnit: "cm",
  },
  画册: {
    materials: ["铜版纸", "哑粉纸", "双胶纸", "封面特种纸"],
    paperWeights: ["封面250g/内页157g", "封面300g/内页157g", "封面250g/内页128g"],
    sizes: ["A4 210×297mm", "A5 148×210mm", "方形 210×210mm"],
    finishes: ["不选工艺", "骑马钉", "胶装", "覆膜", "压痕", "UV"],
    quantities: [10, 20, 50, 100, 200, 500],
    quantityUnit: "本",
    paperWeightLabel: "纸张搭配",
  },
  其他印刷: {
    materials: ["铜版纸", "PVC", "PP", "特种纸", "牛皮纸"],
    paperWeights: ["128g", "157g", "250g", "300g", "0.5mm"],
    sizes: ["A4 210×297mm", "A5 148×210mm", "90×54mm", "自定义尺寸"],
    finishes: ["不选工艺", "覆膜", "哑膜", "亮膜", "模切", "压痕", "UV"],
    quantities: printQuantityPresets,
    quantityUnit: "张",
  },
};

export const fallbackPrintPreset = printProjectPresets["其他印刷"];

const printProjectAliases = [
  { projectName: "普通名片", keywords: ["名片", "普通名片", "铜版名片", "标准名片"] },
  { projectName: "PVC卡", keywords: ["PVC卡", "PVC名片", "pvc卡", "pvc名片", "会员卡"] },
  { projectName: "特种纸名片", keywords: ["特种纸名片", "特种纸", "珠光纸名片", "牛皮纸名片"] },
  { projectName: "扇子", keywords: ["扇子", "广告扇", "团扇", "pp扇", "pvc扇", "纸扇"] },
  { projectName: "联单", keywords: ["联单", "无碳联单", "收据联单", "送货单", "销货单", "二联", "三联", "四联"] },
  { projectName: "不干胶", keywords: ["不干胶", "贴纸", "标签", "包装贴纸"] },
  { projectName: "宣传单", keywords: ["宣传单", "传单", "单页", "折页", "A4双面彩印", "A4彩印", "双面彩印", "彩印"] },
  { projectName: "易拉宝", keywords: ["易拉宝", "展架"] },
  { projectName: "写真裱板", keywords: ["写真裱板", "裱板写真", "kt板写真", "冷裱板写真"] },
  { projectName: "室外写真", keywords: ["室外写真", "户外写真", "室外背胶", "户外背胶", "室外车贴", "户外车贴", "户外灯片", "户外单透", "反光贴"] },
  { projectName: "室内写真", keywords: ["写真", "室内写真", "户内写真", "室内背胶", "室内相纸", "室内灯片", "油画布"] },
];

export const printProjectSuggestions = Array.from(new Set([
  ...printTopLevelCategories,
  "广告扇",
  "无碳联单",
  "送货单",
].filter(Boolean)));

export function uniquePrintValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function normalizePrintName(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export function printSpecValue(value?: string | number | null) {
  return String(value ?? "")
    .trim()
    .replace(/毫米/g, "mm")
    .replace(/厘米/g, "cm")
    .replace(/(\d)\s*[xX*]\s*(\d)/g, "$1×$2")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function matchingPrintPresetValue(value: string, options: string[]) {
  const normalized = printSpecValue(value);
  return options.find((option) => printSpecValue(option) === normalized || normalized.includes(printSpecValue(option))) ?? "";
}

export function canonicalPrintProjectName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return defaultPrintProjectName;
  if (printProjectPresets[trimmed]) return trimmed;
  const directGroup = printProjectGroups.find((group) => group.categoryName === trimmed);
  if (directGroup) return directGroup.projectNames[0] ?? trimmed;
  const normalized = normalizePrintName(trimmed);
  const alias = printProjectAliases.find((item) =>
    item.keywords.some((keyword) => normalized.includes(normalizePrintName(keyword)))
  );
  return alias?.projectName ?? trimmed;
}

export function printCategoryName(value: string) {
  const canonical = canonicalPrintProjectName(value);
  return printProjectGroups.find((group) => group.projectNames.includes(canonical))?.categoryName ?? canonical;
}

export function childPrintProjectNames(categoryName: string) {
  const group = printProjectGroups.find((item) => item.categoryName === categoryName);
  return group?.projectNames ?? [canonicalPrintProjectName(categoryName)];
}

export function defaultPrintProjectForCategory(categoryName: string) {
  return childPrintProjectNames(categoryName)[0] ?? canonicalPrintProjectName(categoryName);
}

export function printProjectHasSubcategories(categoryName: string) {
  return childPrintProjectNames(categoryName).length > 1;
}

export function printPresetForProject(projectName: string) {
  const canonical = canonicalPrintProjectName(projectName);
  return printProjectPresets[canonical] ?? fallbackPrintPreset;
}
