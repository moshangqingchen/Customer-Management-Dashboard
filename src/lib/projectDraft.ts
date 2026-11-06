import type { Project, ProjectInput } from '../api/types';
import { validDate } from './dates';

export type ProjectDraft = Required<Pick<ProjectInput, 'clientId' | 'title' | 'status' | 'brief' | 'sourcePlatform' | 'sourceOrderNo' | 'startDate' | 'dueDate' | 'priceCents' | 'tagIds'>>;

export function emptyProjectDraft(clientId = ''): ProjectDraft {
  return { clientId, title: '', status: 'active', brief: '', sourcePlatform: '', sourceOrderNo: '', startDate: null, dueDate: null, priceCents: 0, tagIds: [] };
}

export function projectDraftFrom(project: Project): ProjectDraft {
  return { ...emptyProjectDraft(project.clientId), title: `${project.title}（新单）`, brief: project.brief,
    sourcePlatform: project.sourcePlatform, priceCents: project.priceCents, tagIds: [...project.tagIds] };
}

export function projectDateError(startDate: string | null, dueDate: string | null): string | null {
  if ((startDate && !validDate(startDate)) || (dueDate && !validDate(dueDate))) return '请填写有效的项目日期';
  return startDate && dueDate && dueDate < startDate ? '截止日不能早于开始日期，请调整项目日期。' : null;
}

export const briefTemplates = [
  { name: '海报设计', body: '项目目标：\n使用场景：\n尺寸与方向：\n主标题与文案：\n品牌颜色与参考：\n客户提供的素材：\n交付格式与数量：\n确认事项：' },
  { name: '品牌设计', body: '品牌名称与定位：\n目标受众：\n品牌关键词：\n设计范围：\n已有品牌资产：\n风格参考与禁忌：\n应用场景：\n交付文件与规范：\n确认事项：' },
  { name: '电商详情页', body: '产品名称与卖点：\n目标平台与人群：\n页面尺寸与屏数：\n内容顺序与文案：\n产品图片与素材：\n风格参考：\n交付格式：\n确认事项：' },
] as const;
