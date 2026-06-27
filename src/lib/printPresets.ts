export type PrintPreset = {
  materialLabel?: string;
  materials: string[];
  paperWeights: string[];
  paperWeightsByMaterial?: Record<string, string[]>;
  sizes: string[];
  finishes: string[];
  finishGroups?: PrintFinishGroup[];
  colors?: string[];
  colorLabel?: string;
  sideOptions?: string[];
  sideLabel?: string;
  quantities: number[];
  quantityUnit: string;
  paperWeightLabel?: string;
  sizeUnit?: "mm" | "cm";
};

export type PrintFinishGroup = {
  key: string;
  label: string;
  options: string[];
  emptyOption?: string;
};

export type PrintProjectGroup = {
  categoryName: string;
  projectNames: string[];
};

export const printQuantityPresets = [500, 1000, 2000, 3000, 5000, 10000];

export const printProjectGroups: PrintProjectGroup[] = [
  { categoryName: "名片", projectNames: ["普通名片", "PVC卡", "特种纸名片"] },
  { categoryName: "不干胶", projectNames: ["不干胶"] },
  { categoryName: "宣传单", projectNames: ["合版宣传单", "专版宣传单"] },
  { categoryName: "扇子", projectNames: ["扇子"] },
  { categoryName: "联单", projectNames: ["联单"] },
  { categoryName: "海报", projectNames: ["海报"] },
  { categoryName: "易拉宝", projectNames: ["易拉宝"] },
  { categoryName: "写真", projectNames: ["室内写真", "室外写真", "写真裱板"] },
  { categoryName: "画册", projectNames: ["专版画册", "特惠画册"] },
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
const specialBusinessCardPapers = [
  "300克荷兰白卡",
  "300克冰白珠光",
  "300克莱妮卡",
  "300克蛋壳纹",
  "300克安格卡",
  "300克钢骨纸",
  "300g映画纸",
];
const combinedFlyerPapers = ["铜版纸", "双胶纸"];
const combinedFlyerWeightsByPaper: Record<string, string[]> = {
  铜版纸: ["行标157g", "A级157g", "行标200g", "250g", "105g"],
  双胶纸: ["100g"],
};
const combinedFlyerWeights = uniquePrintValues(Object.values(combinedFlyerWeightsByPaper).flat());
const combinedFlyerSizes = ["16开210×285mm", "32开210×140mm", "8开420×285mm", "4开420×570mm"];
const flyerFoldOptions = ["无", "对折两页", "三折页滚折", "三折页风琴", "四折页滚折", "四折页风琴", "五折页风琴", "关门折"];
const combinedFlyerCutOptions = ["无", "压痕", "压点线", "压痕+压点线"];
const combinedFlyerFinishes = ["不选工艺", ...combinedFlyerCutOptions.filter((option) => option !== "无"), ...flyerFoldOptions.filter((option) => option !== "无")];
const combinedFlyerFinishGroups: PrintFinishGroup[] = [
  { key: "fold", label: "折页", options: flyerFoldOptions, emptyOption: "无" },
  { key: "cut", label: "通用模切", options: combinedFlyerCutOptions, emptyOption: "无" },
];
const dedicatedFlyerPapers = ["铜版纸", "高档铜版纸", "铜版卡", "哑粉纸", "高档哑粉纸", "双胶纸", "米白双胶纸", "米黄双胶纸", "白卡纸", "高白超感纸", "米白超感纸", "高阶映画纸", "珠光纸", "纯质纸", "轻型纸", "白牛皮纸", "黄牛皮纸", "白底白版纸", "灰底白版纸", "轻涂纸", "新闻纸"];
const dedicatedFlyerWeights = ["80g", "105g", "128g", "157g", "180g", "200g", "250g", "300g", "350g"];
const dedicatedFlyerSizes = [
  "16开(285×210)A4",
  "32开(210×140)A5",
  "8开(420×285)A3",
  "4开(420×580)A2",
  "2开(860×580)A1",
  "正度32开(185×125)",
  "正度16开(260×185)",
  "正度8开(260×380)",
  "正度4开(530×380)",
  "正度2开(530×760)",
];
const dedicatedFlyerFinishGroups: PrintFinishGroup[] = [
  { key: "lamination", label: "通用覆膜", options: ["无", "单面哑膜", "单面光膜", "双面哑膜", "双面光膜"], emptyOption: "无" },
  { key: "fold", label: "折页", options: flyerFoldOptions, emptyOption: "无" },
  { key: "cut", label: "通用模切", options: ["无", "压痕", "压点线", "压痕+压点线", "简单模切", "复杂模切"], emptyOption: "无" },
  { key: "hotGold", label: "烫金", options: ["无", "烫金"], emptyOption: "无" },
  { key: "hotSilver", label: "烫银", options: ["无", "烫银"], emptyOption: "无" },
  { key: "uv", label: "UV", options: ["无", "局部UV"], emptyOption: "无" },
  { key: "emboss", label: "凹凸", options: ["无", "击凹", "击凸"], emptyOption: "无" },
  { key: "oil", label: "过油", options: ["无", "单面光油", "双面光油"], emptyOption: "无" },
  { key: "texture", label: "压纹", options: ["无", "压纹"], emptyOption: "无" },
  { key: "numbering", label: "打号码", options: ["无", "打单联号(下单备注打码要求)", "打双联号(下单备注打码要求)"], emptyOption: "无" },
];
const dedicatedFlyerFinishes = uniquePrintValues(["不选工艺", ...dedicatedFlyerFinishGroups.flatMap((group) => group.options.filter((option) => option !== group.emptyOption))]);
const receiptColorSequences = ["白粉", "白黄", "白绿", "白蓝", "白粉黄", "白粉蓝", "白粉绿", "白粉黄蓝", "白粉蓝黄绿"];
const receiptFinishGroups: PrintFinishGroup[] = [
  { key: "numbering", label: "打码", options: ["无", "打单联号(下单备注打几号/颜色)"], emptyOption: "无" },
  { key: "cover", label: "裹皮", options: ["无", "加裹皮"], emptyOption: "无" },
  { key: "backing", label: "垫板", options: ["无", "加垫片"], emptyOption: "无" },
];
const receiptFinishes = uniquePrintValues(["不选工艺", ...receiptFinishGroups.flatMap((group) => group.options.filter((option) => option !== group.emptyOption))]);
const bookletSizes = [
  "大度16开(285×210)A4",
  "正度16开(260×185)",
  "大度32开(210×140)A5",
  "正度32开(185×125)",
  "大度64开(140×105)A6",
  "大度8开(420×285)A3",
  "正度8开(370×260)",
];
const bookletPapers = [
  "铜版纸",
  "高档铜版纸",
  "铜版卡",
  "哑粉纸",
  "高档哑粉纸",
  "双胶纸",
  "米白双胶纸",
  "米黄双胶纸",
  "白卡纸",
  "高白超感纸",
  "米白超感纸",
  "高阶映画纸",
  "珠光纸",
  "纯质纸",
  "轻型纸",
  "白牛皮纸",
  "黄牛皮纸",
  "轻涂纸",
];
const bookletWeights = ["80g", "105g", "128g", "157g", "180g", "200g", "250g", "300g", "350g"];
const bookletCoverWeights = ["250g", "300g", "200g", "157g"];
const bookletBindingOptions = ["骑马钉", "无线胶装", "锁线胶装", "硬壳精装", "铁圈装"];
const bookletCoverFinishGroups: PrintFinishGroup[] = [
  { key: "pageCount", label: "内页P数", options: ["16P", "4P", "8P", "12P", "20P", "24P", "28P", "32P", "40P", "48P", "64P", "80P", "96P"] },
  { key: "innerPaper", label: "内页纸张", options: bookletPapers },
  { key: "innerWeight", label: "内页克重", options: ["157g", ...bookletWeights.filter((weight) => weight !== "157g")] },
  { key: "innerColor", label: "内页颜色", options: ["彩色", "单色", "彩色+专色", "UV"] },
  { key: "lamination", label: "通用覆膜", options: ["无", "单面哑膜", "单面光膜", "双面哑膜", "双面光膜", "单面防刮膜"], emptyOption: "无" },
  { key: "hotGold", label: "烫金", options: ["无", "烫金"], emptyOption: "无" },
  { key: "hotSilver", label: "烫银", options: ["无", "烫银"], emptyOption: "无" },
  { key: "uv", label: "UV", options: ["无", "局部UV"], emptyOption: "无" },
  { key: "emboss", label: "凹凸", options: ["无", "击凹", "击凸"], emptyOption: "无" },
  { key: "oil", label: "过油", options: ["无", "单面光油", "双面光油"], emptyOption: "无" },
  { key: "texture", label: "压纹", options: ["无", "压纹"], emptyOption: "无" },
  { key: "windowCut", label: "画册勒口", options: ["无", "勒口"], emptyOption: "无" },
  { key: "seal", label: "塑封", options: ["无", "塑封"], emptyOption: "无" },
  { key: "ribbon", label: "粘书签带", options: ["无", "粘1条", "粘2条", "粘3条"], emptyOption: "无" },
  { key: "binding", label: "装订方式", options: bookletBindingOptions },
];
const bookletFinishes = uniquePrintValues([
  "不选工艺",
  ...bookletCoverFinishGroups.flatMap((group) => group.options.filter((option) => option && option !== group.emptyOption)),
]);
const budgetBookletSizes = ["210×285mm（16开）", "140×210mm（32开）"];
const budgetBookletCoverPapers = ["双铜250克", "双铜300克", "双铜200克", "双铜157克"];
const budgetBookletInnerPapers = ["双铜157克", "双铜200克"];
const budgetBookletFinishGroups: PrintFinishGroup[] = [
  { key: "innerPaper", label: "内页材质", options: budgetBookletInnerPapers },
  { key: "innerColor", label: "内页印色", options: ["彩色", "单色"] },
  { key: "pageCount", label: "内页P数", options: ["4P", "8P", "12P", "16P", "20P", "24P", "28P", "32P"] },
  { key: "copies", label: "款数", options: ["1款", "2款", "3款", "5款"] },
  { key: "binding", label: "装订方式", options: ["骑马装订", "无线胶装"] },
  { key: "coverFilm", label: "封面覆膜", options: ["无", "封面覆膜"], emptyOption: "无" },
  { key: "crease", label: "压纹", options: ["无", "压纹"], emptyOption: "无" },
  { key: "emboss", label: "击凸", options: ["无", "击凸"], emptyOption: "无" },
  { key: "hotGold", label: "烫金", options: ["无", "烫金"], emptyOption: "无" },
  { key: "uv", label: "局部UV", options: ["无", "局部UV"], emptyOption: "无" },
];
const budgetBookletFinishes = uniquePrintValues([
  "不选工艺",
  ...budgetBookletFinishGroups.flatMap((group) => group.options.filter((option) => option && option !== group.emptyOption)),
]);

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
    materials: specialBusinessCardPapers,
    paperWeights: ["300g"],
    sizes: commonBusinessCardSizes,
    finishes: ["不选工艺", "圆角", "烫金", "烫银", "UV", "击凸", "模切"],
    quantities: printQuantityPresets,
    quantityUnit: "张",
    materialLabel: "纸张",
  },
  不干胶: {
    materials: ["铜版不干胶", "透明不干胶", "牛皮纸不干胶", "PVC不干胶", "易碎纸"],
    paperWeights: ["80g", "120g", "157g"],
    sizes: ["50×30mm", "60×40mm", "70×50mm", "A4 210×297mm"],
    finishes: ["不选工艺", "覆膜", "哑膜", "亮膜", "模切", "异形模切", "覆膜 / 模切"],
    quantities: printQuantityPresets,
    quantityUnit: "张",
  },
  合版宣传单: {
    materials: combinedFlyerPapers,
    paperWeights: combinedFlyerWeights,
    paperWeightsByMaterial: combinedFlyerWeightsByPaper,
    sizes: combinedFlyerSizes,
    finishes: combinedFlyerFinishes,
    finishGroups: combinedFlyerFinishGroups,
    quantities: printQuantityPresets,
    quantityUnit: "张",
    materialLabel: "纸张",
    paperWeightLabel: "克重",
  },
  专版宣传单: {
    materials: dedicatedFlyerPapers,
    paperWeights: dedicatedFlyerWeights,
    sizes: dedicatedFlyerSizes,
    finishes: dedicatedFlyerFinishes,
    finishGroups: dedicatedFlyerFinishGroups,
    colors: ["彩色", "单色", "彩色+专色", "UV"],
    quantities: printQuantityPresets,
    quantityUnit: "张",
    materialLabel: "纸张",
    paperWeightLabel: "克重",
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
    materials: ["不换版（单面单黑）", "换版（客服报价）"],
    paperWeights: ["2联（50组/本）", "3联（30组/本）", "4联（25组/本）", "5联（20组/本）"],
    sizes: ["210×290mm", "210×145mm", "210×95mm", "265×190mm", "190×130mm", "190×85mm"],
    finishes: receiptFinishes,
    finishGroups: receiptFinishGroups,
    colors: receiptColorSequences,
    colorLabel: "色序",
    sideOptions: ["单面"],
    sideLabel: "印面",
    quantities: [100, 200, 300, 500, 1000],
    quantityUnit: "本",
    materialLabel: "印刷",
    paperWeightLabel: "纸张",
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
  专版画册: {
    materials: bookletPapers,
    paperWeights: bookletCoverWeights,
    sizes: bookletSizes,
    finishes: bookletFinishes,
    finishGroups: bookletCoverFinishGroups,
    colors: ["彩色", "单色", "彩色+专色", "UV"],
    sideOptions: ["竖版", "横版"],
    sideLabel: "版式",
    quantities: [500, 1000, 2000, 3000, 5000],
    quantityUnit: "本",
    materialLabel: "封面纸张",
    paperWeightLabel: "封面克重",
    colorLabel: "封面颜色",
  },
  特惠画册: {
    materials: budgetBookletCoverPapers,
    paperWeights: ["封面"],
    sizes: budgetBookletSizes,
    finishes: budgetBookletFinishes,
    finishGroups: budgetBookletFinishGroups,
    colors: ["彩色", "单色"],
    sideOptions: ["竖版", "横版"],
    sideLabel: "版式",
    quantities: [500, 1000, 2000, 3000, 5000],
    quantityUnit: "本",
    materialLabel: "封面材质",
    paperWeightLabel: "封面规格",
    colorLabel: "封面印色",
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
  { projectName: "特种纸名片", keywords: ["特种纸名片", "特种纸", "珠光纸名片", "牛皮纸名片", "荷兰白卡", "冰白珠光", "莱妮卡", "蛋壳纹", "安格卡", "钢骨纸", "映画纸"] },
  { projectName: "扇子", keywords: ["扇子", "广告扇", "团扇", "pp扇", "pvc扇", "纸扇"] },
  { projectName: "联单", keywords: ["联单", "无碳联单", "收据联单", "送货单", "销货单", "二联", "三联", "四联"] },
  { projectName: "不干胶", keywords: ["不干胶", "贴纸", "标签", "包装贴纸"] },
  { projectName: "专版宣传单", keywords: ["专版宣传单", "专版单页", "专版彩页"] },
  { projectName: "合版宣传单", keywords: ["合版宣传单", "宣传单", "传单", "单页", "折页", "A4双面彩印", "A4彩印", "双面彩印", "彩印"] },
  { projectName: "易拉宝", keywords: ["易拉宝", "展架"] },
  { projectName: "写真裱板", keywords: ["写真裱板", "裱板写真", "kt板写真", "冷裱板写真"] },
  { projectName: "室外写真", keywords: ["室外写真", "户外写真", "室外背胶", "户外背胶", "室外车贴", "户外车贴", "户外灯片", "户外单透", "反光贴"] },
  { projectName: "室内写真", keywords: ["写真", "室内写真", "户内写真", "室内背胶", "室内相纸", "室内灯片", "油画布"] },
  { projectName: "特惠画册", keywords: ["特惠画册", "特价画册", "优惠画册"] },
  { projectName: "专版画册", keywords: ["画册", "专版画册", "精品画册", "骑马钉画册", "胶装画册"] },
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
  const exact = options.find((option) => printSpecValue(option) === normalized);
  if (exact) return exact;

  return options
    .map((option, index) => {
      const normalizedOption = printSpecValue(option);
      return {
        option,
        index,
        position: normalizedOption ? normalized.lastIndexOf(normalizedOption) : -1,
        length: normalizedOption.length,
      };
    })
    .filter((match) => match.position >= 0)
    .sort((left, right) =>
      right.length - left.length ||
      right.position - left.position ||
      left.index - right.index
    )[0]?.option ?? "";
}

export function printPaperWeightOptionsForMaterial(projectName: string, material: string) {
  const preset = printPresetForProject(projectName);
  if (!preset.paperWeightsByMaterial) return preset.paperWeights;
  const direct = preset.paperWeightsByMaterial[material];
  if (direct?.length) return direct;
  const normalizedMaterial = printSpecValue(material);
  const matchedKey = Object.keys(preset.paperWeightsByMaterial).find((key) => printSpecValue(key) === normalizedMaterial);
  return matchedKey ? preset.paperWeightsByMaterial[matchedKey] : preset.paperWeights;
}

export function splitLegacyPrintMaterial(projectName: string, material: string, paperWeight = "") {
  const preset = printPresetForProject(projectName);
  const combined = [material, paperWeight].filter(Boolean).join(" ");
  const matchedMaterial = matchingPrintPresetValue(combined, preset.materials);
  const weightOptions = matchedMaterial ? printPaperWeightOptionsForMaterial(projectName, matchedMaterial) : preset.paperWeights;
  const explicitWeight = matchingPrintPresetValue(paperWeight, weightOptions);
  const matchedWeight = matchingPrintPresetValue(combined, weightOptions);

  return {
    material: matchedMaterial || material,
    paperWeight: explicitWeight || matchedWeight || paperWeight,
  };
}

function splitFinishParts(value: string) {
  return value
    .split(/\s*[\/|]\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => printSpecValue(part) !== printSpecValue("不选工艺") && printSpecValue(part) !== printSpecValue("无"));
}

export function printFinishGroupsForProject(projectName: string) {
  return printPresetForProject(projectName).finishGroups ?? [];
}

export function splitGroupedPrintFinish(projectName: string, finish: string) {
  const groups = printFinishGroupsForProject(projectName);
  const values: Record<string, string> = {};
  if (!groups.length) return values;

  const parts = splitFinishParts(finish);
  const usedPartIndexes = new Set<number>();
  groups.forEach((group) => {
    values[group.key] = group.emptyOption ?? "";
    const matchIndex = parts.findIndex((part, index) => {
      if (usedPartIndexes.has(index)) return false;
      return group.options.some((option) =>
        option !== group.emptyOption && printSpecValue(option) === printSpecValue(part)
      );
    });
    if (matchIndex >= 0) {
      const matched = group.options.find((option) => printSpecValue(option) === printSpecValue(parts[matchIndex]));
      values[group.key] = matched ?? parts[matchIndex];
      usedPartIndexes.add(matchIndex);
    }
  });
  return values;
}

export function ungroupedPrintFinish(projectName: string, finish: string) {
  const groups = printFinishGroupsForProject(projectName);
  if (!groups.length) return finish;
  const groupedValues = splitGroupedPrintFinish(projectName, finish);
  const groupedSpecs = new Set(
    groups
      .map((group) => groupedValues[group.key])
      .filter(Boolean)
      .map((value) => printSpecValue(value))
  );
  return splitFinishParts(finish).find((part) => !groupedSpecs.has(printSpecValue(part))) ?? "";
}

export function buildGroupedPrintFinish(projectName: string, groupValues: Record<string, string>, customFinish = "") {
  const groups = printFinishGroupsForProject(projectName);
  if (!groups.length) return customFinish.trim();
  return uniquePrintValues([
    ...groups.map((group) => {
      const value = groupValues[group.key] ?? "";
      return value && value !== group.emptyOption ? value : "";
    }),
    customFinish.trim(),
  ]).join(" / ");
}

export function defaultGroupedPrintFinish(projectName: string) {
  const groups = printFinishGroupsForProject(projectName);
  if (!groups.length) return "";
  return buildGroupedPrintFinish(
    projectName,
    Object.fromEntries(groups.map((group) => [group.key, group.options[0] ?? group.emptyOption ?? ""])),
  );
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
