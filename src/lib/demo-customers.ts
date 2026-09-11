import type { Customer } from "@/lib/types";

/** 与 backend/app/services/demo_data.py 对齐，供后端未醒时首屏立刻可选医生。 */
export const DEMO_CUSTOMERS: Customer[] = [
  {
    id: "liu-min",
    name: "刘敏主任",
    hospital: "复旦大学附属儿科医院",
    title: "皮肤科主任医师",
    product: "达必妥",
    tier: "试用者",
    last_visit: "2026-06-08",
    last_feedback: "认可达必妥长期安全性数据，但对稳控效果仍有疑虑，希望补充中度 AD 合并 2 型炎症共病的循证方案。",
    open_task: "确认 11 月 14 日中国医师协会皮肤科医师分会年会参会意向",
    last_material: "中度 AD 心血管共病",
    meeting: "11 月 14 日中国医师协会皮肤科医师分会年会",
    interactions: [
      { date: "2026/05/03", type: "面对面拜访", detail: "拜访材料：使用者及以上（中度 AD 2 型炎症共病）；医生反馈：对“心血管共病”不认可。" },
      { date: "2026/05/03", type: "企业文章推送", detail: "推送《循证为帆·真实世界新证》；阅读状态：未打开。" },
      { date: "2026/04/05", type: "会议参与", detail: "参加 2026 中国医师协会皮肤科医师分会年会；参会角色：听者。" },
    ],
    interaction_stats: { 面对面拜访: 3, 资料投递: 1, 参会次数: 1 },
    perception_ladder: [
      { dimension: "长期安全", level: "中立" },
      { dimension: "维稳", level: "中立" },
    ],
    institution: { formulary: "正常", coverage_trend: "近 90 天稳定", supply_risk: "无" },
  },
  {
    id: "song-wen",
    name: "宋雯医生",
    hospital: "复旦大学附属儿科医院",
    title: "皮肤科主治医师",
    product: "达必妥",
    tier: "使用者",
    last_visit: "2026-06-17",
    last_feedback: "关注青少年及儿童患者的长期治疗模式与生长发育影响，希望获得真实世界研究资料。",
    open_task: "发送青少年长期治疗真实世界研究并确认科室会时间",
    last_material: "青少年长期治疗模式",
    meeting: "11 月 14 日中国医师协会皮肤科医师分会年会",
    interactions: [
      { date: "2026/06/17", type: "面对面拜访", detail: "讨论青少年长期维持治疗；医生反馈积极。" },
      { date: "2026/05/20", type: "科室会", detail: "达必妥真实世界研究科室分享；到场 12 人。" },
    ],
    interaction_stats: { 面对面拜访: 4, 资料投递: 2, 参会次数: 2 },
    perception_ladder: [
      { dimension: "长期安全", level: "认可且推荐" },
      { dimension: "维稳", level: "认可" },
    ],
    institution: { formulary: "正常", coverage_trend: "近 90 天提升", supply_risk: "低" },
  },
  {
    id: "bian-xiaoyan",
    name: "卞小燕主任",
    hospital: "复旦大学附属儿科医院",
    title: "皮肤科副主任医师",
    product: "达必妥",
    tier: "待启动",
    last_visit: "2026-06-24",
    last_feedback: "希望先了解院内目录准入进度与患者教育材料的可用情况。",
    open_task: "确认首例患者教育支持与院内准入流程",
    last_material: "患者教育与院内准入",
    meeting: "11 月 14 日中国医师协会皮肤科医师分会年会",
    interactions: [
      { date: "2026/06/24", type: "面对面拜访", detail: "沟通院内准入与患者教育材料需求。" },
    ],
    interaction_stats: { 面对面拜访: 1, 资料投递: 0, 参会次数: 0 },
    perception_ladder: [
      { dimension: "长期安全", level: "中立" },
      { dimension: "维稳", level: "中立" },
    ],
    institution: { formulary: "准入推进中", coverage_trend: "近 90 天待启动", supply_risk: "需关注" },
  },
];
