import { addMonths, format, parseISO } from 'date-fns';
import type * as T from '../types';
import type { MockData, StoredClient, StoredProject } from './store';
import { dateOffset, today } from '../../lib/dates';
import { designAssetId, designImageForPath } from './designAssets';

const names = ['林女士', '山野咖啡', '陈先生', '青木花店', '小满烘焙', '周小雨', '拾光摄影', '鹿鸣书店', '王可', '半岛民宿', '许先生', '森屿家居', '阿橙', '方寸工作室'];
const titles = ['秋日新品海报', '品牌视觉升级', '双十一活动主图', '门店开业物料', '礼盒包装设计', '个人名片设计', '春季画册排版', '阅读日宣传海报', '社交媒体封面', '民宿导览手册', '产品详情页', '家具新品折页', '婚礼邀请函', '年度品牌提案', '咖啡挂耳包装', '花束养护卡', '烘焙价目表', '摄影作品集', '新书发布物料', '店铺首页改版', '节日问候贺卡', '夏季促销海报', '活动场地导视', '联名帆布袋', '小程序启动页', '茶饮菜单设计', '商标精修', '展会易拉宝', '会员礼券', '产品拍摄修图', '周年庆主视觉', '季度宣传长图'];
export { names as seedClientNames, titles as seedProjectTitles };
const tagNames = ['老客户', '餐饮', '品牌设计', '电商', '急单', '长期合作', '包装', '文创', '摄影', '新客户'];
const tagColors: T.TagColor[] = ['orange', 'amber', 'violet', 'blue', 'red', 'green', 'pink', 'teal', 'cyan', 'gray'];
const platforms = ['淘宝', '闲鱼', '小红书', '微信', '抖音', '转介绍', '其他'];
const methods = ['微信', '支付宝', '淘宝', '闲鱼', '银行转账', '现金', '其他'];
const statuses: T.ProjectStatus[] = ['active', 'review', 'lead', 'active', 'review', 'delivered', 'done', 'cancelled'];
const timestamp = (value: string) => `${value}T08:30:00.000Z`;

export function createSeed(base = today()): MockData {
  const clients: StoredClient[] = names.map((name, index) => {
    const createdAt = timestamp(dateOffset(-365 + index * 9, base));
    return { id: `client-${index + 1}`, name, company: index % 3 === 1 ? `${name}有限公司` : '',
      phone: index % 4 === 0 ? '' : `1380013${String(8000 + index)}`, wechat: `design_${index + 1}`, email: index % 3 === 0 ? `client${index + 1}@example.com` : '',
      address: index % 4 === 1 ? '杭州市西湖区文三路' : '',
      accounts: index % 3 === 1 ? [{ platform: '淘宝', handle: `${name}官方店` }, { platform: '小红书', handle: name }] : [{ platform: platforms[index % platforms.length], handle: name }],
      rating: index % 6, pinned: index === 0 || index === 3, notes: index % 2 === 0 ? '喜欢简洁的设计，沟通前先确认交付尺寸。' : '确认需求后开始，成品与源文件分别交付。',
      folder: null, tagIds: [`tag-${index % 10 + 1}`, `tag-${(index + 3) % 10 + 1}`], createdAt, updatedAt: createdAt, deletedAt: null,
      projectCount: 0, openProjectCount: 0, billedCents: 0, receivedCents: 0, outstandingCents: 0, firstProjectAt: null, lastActivityAt: createdAt };
  });
  const projects: StoredProject[] = titles.map((title, index) => {
    const client = clients[index % clients.length];
    const historical = index >= 8;
    const created = historical ? format(addMonths(parseISO(base), -((index - 8) % 11 + 1)), 'yyyy-MM-05') : dateOffset(-15 - index, base);
    const createdAt = timestamp(created);
    const status = historical ? (index % 9 === 0 ? 'cancelled' : index % 5 === 0 ? 'delivered' : 'done') : statuses[index];
    return { id: `project-${index + 1}`, clientId: client.id, clientName: client.name, title, status, pinned: index === 1 || index === 5,
      brief: '请保持画面简洁，突出核心信息。交付高清成品与可编辑源文件，包含两轮修改。', sourcePlatform: platforms[index % platforms.length], sourceOrderNo: index % 3 === 0 ? `TB2026${String(10000 + index)}` : '',
      startDate: created, dueDate: index < 3 ? dateOffset(-index - 1, base) : index < 5 ? dateOffset(1, base) : index % 4 === 0 || historical && status === 'delivered' ? null : historical || ['done', 'cancelled'].includes(status) ? dateOffset(7, created) : dateOffset(5 + index, base),
      deliveredAt: ['delivered', 'done'].includes(status) ? dateOffset(5, created) : null, completedAt: status === 'done' ? dateOffset(7, created) : null,
      priceCents: [128000, 360000, 68000, 240000, 96000, 48000, 180000, 280000][index % 8], costCents: index % 3 === 0 ? 20000 + index * 500 : 0,
      tagIds: [`tag-${index % 10 + 1}`, `tag-${(index + 2) % 10 + 1}`], folder: null, createdAt, updatedAt: timestamp(dateOffset(historical ? 7 : 1, created)),
      receivedCents: 0, paymentCount: 0, fileCount: 0, coverPath: null, deletedAt: null, deletedWithClient: false };
  });
  const payments: T.Payment[] = projects.filter(p => p.status !== 'lead').map((project, index) => ({
    id: `payment-${index + 1}`, projectId: project.id, kind: 'income', amountCents: ['done', 'delivered'].includes(project.status) ? project.priceCents : Math.floor(project.priceCents / 2),
    paidAt: dateOffset(2, project.startDate ?? base), method: methods[index % methods.length], note: project.status === 'done' ? '已结清' : '首付款', createdAt: timestamp(dateOffset(2, project.startDate ?? base)) }));
  for (let index = 0; payments.length < 38; index++) {
    const project = projects[index % 7];
    payments.push({ id: `payment-${payments.length + 1}`, projectId: project.id, kind: 'income', amountCents: 5000 + index * 1000,
      paidAt: dateOffset(-index, base), method: methods[index % methods.length], note: '阶段款', createdAt: timestamp(dateOffset(-index, base)) });
  }
  payments.push(...[5, 11].map((projectIndex, index): T.Payment => ({ id: `refund-${index + 1}`, projectId: projects[projectIndex].id, kind: 'refund', amountCents: 12000 + index * 8000,
    paidAt: dateOffset(6, projects[projectIndex].startDate ?? base), method: '微信', note: '取消部分设计内容，退回差额', createdAt: timestamp(dateOffset(6, projects[projectIndex].startDate ?? base)) })));
  const activities: T.Activity[] = projects.flatMap(project => ([
    { id: `activity-${project.id}-created`, clientId: project.clientId, projectId: project.id, projectTitle: project.title, clientName: project.clientName, kind: 'created', body: '创建了项目', meta: {}, createdAt: project.createdAt },
    { id: `activity-${project.id}-note`, clientId: project.clientId, projectId: project.id, projectTitle: project.title, clientName: project.clientName, kind: 'note', body: '已确认尺寸与交付格式，按约定时间提供初稿。', meta: {}, createdAt: timestamp(dateOffset(1, project.startDate ?? base)) },
  ] satisfies T.Activity[]));
  payments.forEach(payment => {
    const project = projects.find(p => p.id === payment.projectId)!;
    activities.push({ id: `activity-${payment.id}`, clientId: project.clientId, projectId: project.id, projectTitle: project.title, clientName: project.clientName,
      kind: 'payment', body: payment.kind === 'refund' ? '记录了退款' : '记录了收款', meta: { kind: payment.kind, amountCents: payment.amountCents, method: payment.method }, createdAt: payment.createdAt });
  });
  const recentTime = base === today() ? new Date() : parseISO(`${base}T12:00:00`);
  const recentEvents: Pick<T.Activity, 'kind' | 'body' | 'meta'>[] = [
    { kind: 'file', body: '添加了 3 个文件', meta: { names: ['初稿.webp', '源文件.psd', '参考图.jpg'] } },
    { kind: 'status', body: '更新了项目状态', meta: { from: 'active', to: 'review' } },
    { kind: 'note', body: '客户确认了配色，明天发送第二版。', meta: {} },
    { kind: 'payment', body: '记录了收款', meta: { kind: 'income', amountCents: 5000, method: '微信' } },
    { kind: 'created', body: '创建了项目', meta: {} },
  ];
  recentEvents.forEach((event, index) => {
    const project = projects[index];
    activities.push({ ...event, id: `activity-recent-${index}`, clientId: project.clientId, projectId: project.id, projectTitle: project.title, clientName: project.clientName, createdAt: new Date(recentTime.getTime() - (index + 1) * 60000).toISOString() });
  });
  const files: T.FileEntry[] = [];
  const fileAssets: Record<string, string> = {};
  const coverProjects = projects.filter((_, index) => index % 5 < 3);
  for (let index = 0; index < coverProjects.length + 4; index++) {
    const image = index < coverProjects.length;
    const project = image ? coverProjects[index] : projects[index - coverProjects.length];
    const client = clients.find(c => c.id === project.clientId)!;
    client.folder = client.name;
    project.folder = `${client.folder}/${project.createdAt.slice(0, 7)} ${project.title}`;
    const ext = image ? 'webp' : ['psd', 'ai', 'pdf', 'zip'][index - coverProjects.length];
    const name = `${project.title}${image ? '·方案' : '·源文件'}.${ext}`;
    const relPath = `${project.folder}/交付成品/${name}`;
    const path = `D:/客户工作台/${relPath}`;
    if (image) project.coverPath = designImageForPath(path);
    if (image) fileAssets[path] = designAssetId(path);
    files.push({ path, relPath, name, ext, kind: image ? 'image' : index < coverProjects.length + 2 ? 'design' : index === coverProjects.length + 2 ? 'pdf' : 'archive',
      sizeBytes: image ? 48000 + index * 210 : 4120000 + index * 45000, modifiedAt: timestamp(dateOffset(-index, base)), folderGroup: '交付成品', clientId: client.id, projectId: project.id });
  }
  const groupNames = ['接单沟通', '进度与修改', '交付与收款'];
  const snippetTitles = ['首次问候', '确认需求', '报价说明', '排期确认', '初稿已发送', '修改意见整理', '进度同步', '追加修改', '成品交付', '尾款提醒', '确认收款', '感谢合作'];
  const bodies = ['您好，很高兴为您服务！请问需要设计什么内容？\n可以先发一下尺寸、用途和参考风格。', '我整理一下本次需求：尺寸、文案、风格、交付日期。\n请确认后我们开始。', '本次报价包含设计与两轮修改，交付高清成品及源文件。', '已为您安排制作，预计约定时间提供初稿。', '初稿已发送，请您查收。\n有调整意见可以集中整理发给我。', '收到您的意见，我先整理后逐项调整。', '项目正在按计划推进，完成后第一时间发您确认。', '这部分超出原定范围，我会先说明补充费用与时间。', '最终文件已整理好，包含成品和源文件，请及时下载备份。', '本次设计已完成交付，方便时请安排剩余款项，谢谢。', '款项已收到，谢谢！有问题随时联系。', '感谢信任与支持，期待下次合作！'];
  return { version: 1, clients, projects, payments, activities, files, fileAssets, assetVersion: 1, libraryRoot: null,
    tags: tagNames.map((name, index) => ({ id: `tag-${index + 1}`, name, color: tagColors[index], sort: index, clientCount: 0, projectCount: 0 })),
    groups: groupNames.map((name, index) => ({ id: `group-${index + 1}`, name, sort: index })),
    snippets: snippetTitles.map((title, index) => ({ id: `snippet-${index + 1}`, groupId: `group-${Math.floor(index / 4) + 1}`, title, body: bodies[index], sort: index % 4, useCount: index * 3, updatedAt: timestamp(dateOffset(-index, base)) })),
    settings: { theme: 'system', subfolderTemplate: ['参考资料', '过程稿', '交付成品'], paymentMethods: methods, sourcePlatforms: platforms, lastPaymentMethod: '微信' }, backups: [], backupSnapshots: {} };
}
