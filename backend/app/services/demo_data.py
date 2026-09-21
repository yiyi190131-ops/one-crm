"""达必妥（度普利尤单抗）演示域数据。

所有客户、观念阶梯、手卡、证据与推荐文章都在这里集中定义，供只读工具取用。
业务主线：多院皮肤科达必妥-AD 开方医生 HCP360（对齐 CRM API 字段形态）。
"""

# 观念阶梯等级（由低到高），用于访前展示与访后抽取校验。
LADDER_LEVELS = ["中立", "认可", "认可且推荐"]

# 客户阶段（整体观念阶梯）。
CUSTOMER_STAGES = ["待启动", "试用者", "使用者", "推荐者"]

# CRM 关键信息 / 优势点可选等级（前端展示；访后抽取仍用 LADDER_LEVELS）。
KNOWLEDGE_LEVELS = ["未知", "不确定", "认可", "认可且推荐"]

KNOWLEDGE_DIMENSIONS = ["发病机制", "疾病负担", "治疗目标", "治疗策略"]
ADVANTAGE_TAGS = ["一线", "DOT", "速效", "稳控", "对因治疗", "长期安全", "区隔JAK", "区隔CM310"]

TARGET_PATIENT_POOL = [
    "局部控制不佳重度AD",
    "传统用药可控制不佳",
    "青少年患者",
    "儿童患者",
    "中度AD合并共病",
    "中度AD合并瘙痒失眠",
    "中度AD合并心血管风险",
    "中度AD特殊部位",
]


def _knowledge(dim_levels: list[tuple[str, str]], adv_levels: dict[str, str]) -> dict:
    dims = []
    for i, name in enumerate(KNOWLEDGE_DIMENSIONS):
        basic, advanced = dim_levels[i] if i < len(dim_levels) else ("未知", "未知")
        dims.append({"name": name, "basic": basic, "advanced": advanced})
    advantages = [{"name": tag, "level": adv_levels.get(tag, "未知")} for tag in ADVANTAGE_TAGS]
    return {"dimensions": dims, "advantages": advantages}


def _ladder(safety: str, control: str) -> list[dict]:
    return [{"dimension": "长期安全", "level": safety}, {"dimension": "维稳", "level": control}]


CUSTOMERS = {
    "liu-min": {
        "id": "liu-min",
        "name": "刘敏主任",
        "hospital": "复旦大学附属儿科医院",
        "title": "皮肤科主任医师",
        "product": "达必妥",
        "tier": "试用者",
        "crm_code": "CY0801",
        "tags": ["目标客户"],
        "gender": "女",
        "department": "皮肤科",
        "role": "主任",
        "grade": "等级-A-VA",
        "last_visit": "2026-06-08",
        "last_feedback": "认可达必妥长期安全性数据，但对稳控效果仍有疑虑，希望补充中度 AD 合并 2 型炎症共病的循证方案。",
        "open_task": "确认 11 月 14 日中国医师协会皮肤科医师分会年会参会意向",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天稳定", "supply_risk": "无"},
        "interaction_excerpt": "6 月 8 日面对面拜访：使用「中度 AD 心血管共病」材料，医生对长期安全性认可、对稳控存疑；已发送年会邀请待确认。",
        "perception_ladder": _ladder("中立", "中立"),
        "knowledge": _knowledge(
            [("认可", "不确定"), ("认可", "不确定"), ("不确定", "未知"), ("不确定", "未知")],
            {"长期安全": "认可", "稳控": "不确定", "区隔JAK": "不确定", "一线": "未知", "DOT": "未知", "速效": "未知", "对因治疗": "未知", "区隔CM310": "未知"},
        ),
        "target_patients": ["中度AD合并共病", "中度AD合并心血管风险", "青少年患者"],
        "material_delivery": {
            "title": "AD治疗新视野：度普利尤单抗的长期治疗模式探索",
            "views": 8,
            "viewed_at": "2026-05-20 10:12:00",
        },
        "last_material": "中度 AD 心血管共病",
        "meeting": "11 月 14 日中国医师协会皮肤科医师分会年会",
        "interactions": [
            {"date": "2026/05/03", "type": "面对面拜访", "detail": "拜访材料：使用者及以上（中度 AD 2 型炎症共病）；医生反馈：对“心血管共病”不认可。"},
            {"date": "2026/05/03", "type": "企业文章推送", "detail": "推送《循证为帆·真实世界新证》；阅读状态：未打开。"},
            {"date": "2026/04/05", "type": "会议参与", "detail": "参加 2026 中国医师协会皮肤科医师分会年会；参会角色：听者。"},
        ],
        "interaction_stats": {"面对面拜访": 3, "资料投递": 1, "参会次数": 1, "HSM": 1, "MEM": 0},
    },
    "song-wen": {
        "id": "song-wen",
        "name": "宋雯医生",
        "hospital": "复旦大学附属儿科医院",
        "title": "皮肤科主治医师",
        "product": "达必妥",
        "tier": "使用者",
        "crm_code": "CY0802",
        "tags": ["目标客户"],
        "gender": "女",
        "department": "皮肤科",
        "role": "主治医师",
        "grade": "等级-B-VA",
        "last_visit": "2026-06-17",
        "last_feedback": "关注青少年及儿童患者的长期治疗模式与生长发育影响，希望获得真实世界研究资料。",
        "open_task": "发送青少年长期治疗真实世界研究并确认科室会时间",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天提升", "supply_risk": "低"},
        "interaction_excerpt": "6 月 17 日拜访：讨论青少年长期维持治疗；科室会资料待发送。",
        "perception_ladder": _ladder("认可且推荐", "认可"),
        "knowledge": _knowledge(
            [("认可且推荐", "认可"), ("认可", "认可"), ("认可", "不确定"), ("认可", "认可")],
            {"长期安全": "认可且推荐", "稳控": "认可", "区隔JAK": "认可", "一线": "认可", "DOT": "不确定", "速效": "未知", "对因治疗": "认可", "区隔CM310": "不确定"},
        ),
        "target_patients": ["青少年患者", "儿童患者", "传统用药可控制不佳"],
        "material_delivery": {
            "title": "AD治疗新视野：度普利尤单抗的长期治疗模式探索",
            "views": 15,
            "viewed_at": "2026-06-10 14:22:11",
        },
        "last_material": "青少年长期治疗模式",
        "meeting": "11 月 14 日中国医师协会皮肤科医师分会年会",
        "interactions": [
            {"date": "2026/06/17", "type": "面对面拜访", "detail": "讨论青少年长期维持治疗；医生反馈积极。"},
            {"date": "2026/05/20", "type": "科室会", "detail": "达必妥真实世界研究科室分享；到场 12 人。"},
        ],
        "interaction_stats": {"面对面拜访": 4, "资料投递": 2, "参会次数": 2, "HSM": 2, "MEM": 1},
    },
    "bian-xiaoyan": {
        "id": "bian-xiaoyan",
        "name": "卞小燕主任",
        "hospital": "复旦大学附属儿科医院",
        "title": "皮肤科副主任医师",
        "product": "达必妥",
        "tier": "待启动",
        "crm_code": "CY0803",
        "tags": ["目标客户"],
        "gender": "女",
        "department": "皮肤科",
        "role": "副主任",
        "grade": "等级-C",
        "last_visit": "2026-06-24",
        "last_feedback": "希望先了解院内目录准入进度与患者教育材料的可用情况。",
        "open_task": "确认首例患者教育支持与院内准入流程",
        "institution": {"formulary": "准入推进中", "coverage_trend": "近 90 天待启动", "supply_risk": "需关注"},
        "interaction_excerpt": "6 月 24 日沟通：关注院内准入节奏与患者教育材料。",
        "perception_ladder": _ladder("中立", "中立"),
        "knowledge": _knowledge(
            [("未知", "未知"), ("不确定", "未知"), ("未知", "未知"), ("未知", "未知")],
            {"长期安全": "不确定", "稳控": "未知", "区隔JAK": "未知", "一线": "未知", "DOT": "未知", "速效": "未知", "对因治疗": "未知", "区隔CM310": "未知"},
        ),
        "target_patients": ["局部控制不佳重度AD", "中度AD特殊部位"],
        "material_delivery": {
            "title": "患者教育与院内准入沟通提纲",
            "views": 2,
            "viewed_at": "2026-06-22 09:01:00",
        },
        "last_material": "患者教育与院内准入",
        "meeting": "11 月 14 日中国医师协会皮肤科医师分会年会",
        "interactions": [
            {"date": "2026/06/24", "type": "面对面拜访", "detail": "沟通院内准入与患者教育材料需求。"},
        ],
        "interaction_stats": {"面对面拜访": 1, "资料投递": 0, "参会次数": 0, "HSM": 0, "MEM": 0},
    },
    "ai-wenjia": {
        "id": "ai-wenjia",
        "name": "艾文佳主任",
        "hospital": "广东省中医院",
        "title": "皮肤科主任医师",
        "product": "达必妥",
        "tier": "使用者",
        "crm_code": "CY0806",
        "tags": ["目标客户", "讲者"],
        "gender": "男",
        "department": "皮肤科",
        "role": "副主任",
        "grade": "等级-A-VA",
        "last_visit": "2026-07-02",
        "last_feedback": "对达必妥长期安全与区隔 JAK 较认可，愿在中度 AD 合并共病患者中继续观察稳控表现，并希望科室会分享真实世界数据。",
        "open_task": "确认 7 月科室会材料清单与讲者议程",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天提升", "supply_risk": "无"},
        "interaction_excerpt": "7 月 2 日拜访：观念阶梯-使用者；关键信息以长期安全/稳控为主；资料《长期治疗模式探索》已阅 12 次。",
        "perception_ladder": _ladder("认可", "认可"),
        "knowledge": _knowledge(
            [("认可", "认可"), ("认可", "不确定"), ("认可", "认可"), ("认可", "不确定")],
            {"一线": "认可", "DOT": "不确定", "速效": "未知", "稳控": "认可", "对因治疗": "认可", "长期安全": "认可且推荐", "区隔JAK": "认可", "区隔CM310": "不确定"},
        ),
        "target_patients": [
            "局部控制不佳重度AD",
            "传统用药可控制不佳",
            "青少年患者",
            "儿童患者",
            "中度AD合并共病",
            "中度AD合并瘙痒失眠",
            "中度AD合并心血管风险",
            "中度AD特殊部位",
        ],
        "material_delivery": {
            "title": "AD治疗新视野：度普利尤单抗的长期治疗模式探索",
            "views": 12,
            "viewed_at": "2025-11-14 12:34:24",
        },
        "last_material": "长期治疗模式探索",
        "meeting": "广东省皮肤病学年会卫星会",
        "interactions": [
            {"date": "2026/07/02", "type": "面对面拜访", "detail": "复核关键信息矩阵；医生确认愿继续观察共病稳控。"},
            {"date": "2026/06/18", "type": "资料投递", "detail": "投递长期治疗模式资料；已打开阅读。"},
            {"date": "2026/05/11", "type": "会议参与", "detail": "HSM 区域学术会；角色：讲者。"},
        ],
        "interaction_stats": {"面对面拜访": 5, "资料投递": 3, "参会次数": 2, "HSM": 2, "MEM": 1},
    },
    "chen-hao": {
        "id": "chen-hao",
        "name": "陈浩主任",
        "hospital": "北京协和医院",
        "title": "皮肤科主任医师",
        "product": "达必妥",
        "tier": "推荐者",
        "crm_code": "CY0810",
        "tags": ["目标客户", "讲者"],
        "gender": "男",
        "department": "皮肤科",
        "role": "主任",
        "grade": "等级-A",
        "last_visit": "2026-06-28",
        "last_feedback": "已在多例中重度 AD 中推荐达必妥，认可长期安全与区隔 JAK，希望拿到更新版血栓风险对比幻灯。",
        "open_task": "发送区隔 JAK 更新幻灯并预约 8 月讲者档期",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天稳定", "supply_risk": "无"},
        "interaction_excerpt": "6 月 28 日：推荐者阶段；双维观念偏高；主动索取区隔 JAK 材料。",
        "perception_ladder": _ladder("认可且推荐", "认可且推荐"),
        "knowledge": _knowledge(
            [("认可且推荐", "认可且推荐"), ("认可且推荐", "认可"), ("认可且推荐", "认可"), ("认可且推荐", "认可")],
            {"一线": "认可且推荐", "DOT": "认可", "速效": "认可", "稳控": "认可且推荐", "对因治疗": "认可", "长期安全": "认可且推荐", "区隔JAK": "认可且推荐", "区隔CM310": "认可"},
        ),
        "target_patients": ["局部控制不佳重度AD", "中度AD合并心血管风险", "传统用药可控制不佳"],
        "material_delivery": {
            "title": "特应性皮炎系统治疗安全性评估：JAK 对比",
            "views": 20,
            "viewed_at": "2026-06-25 16:40:00",
        },
        "last_material": "区隔 JAK 安全性对比",
        "meeting": "中华医学会皮肤性病学年会",
        "interactions": [
            {"date": "2026/06/28", "type": "面对面拜访", "detail": "确认可作区域讲者；索取更新幻灯。"},
            {"date": "2026/06/01", "type": "会议参与", "detail": "MEM 病例讨论会；角色：点评嘉宾。"},
        ],
        "interaction_stats": {"面对面拜访": 6, "资料投递": 4, "参会次数": 3, "HSM": 1, "MEM": 2},
    },
    "zhao-lin": {
        "id": "zhao-lin",
        "name": "赵琳医生",
        "hospital": "四川大学华西医院",
        "title": "皮肤科主治医师",
        "product": "达必妥",
        "tier": "试用者",
        "crm_code": "CY0812",
        "tags": ["目标客户"],
        "gender": "女",
        "department": "皮肤科",
        "role": "主治医师",
        "grade": "等级-B",
        "last_visit": "2026-06-12",
        "last_feedback": "愿意在中度 AD 瘙痒失眠患者中试用，但对稳控持续性仍不确定，需要更多门诊随访案例。",
        "open_task": "补充 2 例门诊随访小结并约下周复诊沟通",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天稳定", "supply_risk": "低"},
        "interaction_excerpt": "6 月 12 日：试用者；稳控维度偏不确定；关注瘙痒失眠人群。",
        "perception_ladder": _ladder("认可", "中立"),
        "knowledge": _knowledge(
            [("认可", "不确定"), ("认可", "不确定"), ("不确定", "未知"), ("不确定", "未知")],
            {"长期安全": "认可", "稳控": "不确定", "速效": "不确定", "一线": "未知", "DOT": "未知", "对因治疗": "不确定", "区隔JAK": "未知", "区隔CM310": "未知"},
        ),
        "target_patients": ["中度AD合并瘙痒失眠", "青少年患者"],
        "material_delivery": {
            "title": "中度 AD 合并瘙痒失眠沟通要点",
            "views": 5,
            "viewed_at": "2026-06-11 11:08:33",
        },
        "last_material": "瘙痒失眠共病沟通",
        "meeting": "西南皮肤病协作组会",
        "interactions": [
            {"date": "2026/06/12", "type": "面对面拜访", "detail": "首例试用患者反馈瘙痒改善，稳控待观察。"},
            {"date": "2026/05/28", "type": "资料投递", "detail": "投递瘙痒失眠要点；已阅读。"},
        ],
        "interaction_stats": {"面对面拜访": 2, "资料投递": 2, "参会次数": 0, "HSM": 0, "MEM": 0},
    },
    "wu-jing": {
        "id": "wu-jing",
        "name": "吴静主任",
        "hospital": "中南大学湘雅医院",
        "title": "皮肤科副主任医师",
        "product": "达必妥",
        "tier": "待启动",
        "crm_code": "CY0815",
        "tags": ["目标客户"],
        "gender": "女",
        "department": "皮肤科",
        "role": "副主任",
        "grade": "等级-C",
        "last_visit": "2026-07-05",
        "last_feedback": "院内目录尚未稳定，暂不启动处方；希望先拿到患者教育折页与准入时间表。",
        "open_task": "同步院内准入节点并寄送患者教育折页",
        "institution": {"formulary": "准入推进中", "coverage_trend": "近 90 天待启动", "supply_risk": "需关注"},
        "interaction_excerpt": "7 月 5 日：待启动；关键信息多维未知；聚焦准入与患教。",
        "perception_ladder": _ladder("中立", "中立"),
        "knowledge": _knowledge(
            [("未知", "未知"), ("未知", "未知"), ("未知", "未知"), ("未知", "未知")],
            {tag: "未知" for tag in ADVANTAGE_TAGS},
        ),
        "target_patients": ["局部控制不佳重度AD"],
        "material_delivery": {
            "title": "患者教育折页（待寄送）",
            "views": 0,
            "viewed_at": "—",
        },
        "last_material": "患者教育与院内准入",
        "meeting": None,
        "interactions": [
            {"date": "2026/07/05", "type": "面对面拜访", "detail": "沟通目录进度；未开放处方。"},
        ],
        "interaction_stats": {"面对面拜访": 1, "资料投递": 0, "参会次数": 0, "HSM": 0, "MEM": 0},
    },
    "li-meng": {
        "id": "li-meng",
        "name": "李萌医生",
        "hospital": "浙江大学医学院附属第二医院",
        "title": "皮肤科主治医师",
        "product": "达必妥",
        "tier": "使用者",
        "crm_code": "CY0818",
        "tags": ["目标客户"],
        "gender": "男",
        "department": "皮肤科",
        "role": "主治医师",
        "grade": "等级-B-VA",
        "last_visit": "2026-06-20",
        "last_feedback": "维稳表现认可，但对长期安全证据更新节奏有疑问，希望对照最新说明书与真实世界随访。",
        "open_task": "带上最新说明书摘要做安全证据对照",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天稳定", "supply_risk": "无"},
        "interaction_excerpt": "6 月 20 日：使用者；维稳认可、长期安全仍有追问。",
        "perception_ladder": _ladder("中立", "认可"),
        "knowledge": _knowledge(
            [("认可", "不确定"), ("认可", "认可"), ("认可", "认可"), ("认可", "不确定")],
            {"稳控": "认可", "长期安全": "不确定", "一线": "认可", "DOT": "认可", "速效": "不确定", "对因治疗": "认可", "区隔JAK": "不确定", "区隔CM310": "未知"},
        ),
        "target_patients": ["中度AD合并共病", "中度AD特殊部位", "青少年患者"],
        "material_delivery": {
            "title": "达必妥长期安全性真实世界研究（2026）",
            "views": 9,
            "viewed_at": "2026-06-19 08:55:02",
        },
        "last_material": "长期安全性真实世界研究",
        "meeting": "华东皮肤科联合病例会",
        "interactions": [
            {"date": "2026/06/20", "type": "面对面拜访", "detail": "对照说明书讨论长期随访终点。"},
            {"date": "2026/06/05", "type": "资料投递", "detail": "投递真实世界研究；已阅读。"},
        ],
        "interaction_stats": {"面对面拜访": 3, "资料投递": 2, "参会次数": 1, "HSM": 1, "MEM": 0},
    },
    "zhou-yan": {
        "id": "zhou-yan",
        "name": "周燕主任",
        "hospital": "华中科技大学同济医学院附属同济医院",
        "title": "皮肤科主任医师",
        "product": "达必妥",
        "tier": "试用者",
        "crm_code": "CY0820",
        "tags": ["目标客户", "讲者"],
        "gender": "女",
        "department": "皮肤科",
        "role": "主任",
        "grade": "等级-A",
        "last_visit": "2026-05-30",
        "last_feedback": "对区隔 JAK 兴趣高，但在心血管风险合并人群仍偏谨慎，希望看更多共病亚组数据。",
        "open_task": "准备共病亚组数据页并预约 15 分钟讲者预沟通",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天提升", "supply_risk": "无"},
        "interaction_excerpt": "5 月 30 日：试用者；区隔 JAK 认可、共病稳控谨慎。",
        "perception_ladder": _ladder("认可", "中立"),
        "knowledge": _knowledge(
            [("认可", "认可"), ("认可", "不确定"), ("认可", "不确定"), ("不确定", "未知")],
            {"区隔JAK": "认可", "长期安全": "认可", "稳控": "不确定", "一线": "不确定", "DOT": "未知", "速效": "未知", "对因治疗": "不确定", "区隔CM310": "未知"},
        ),
        "target_patients": ["中度AD合并心血管风险", "局部控制不佳重度AD"],
        "material_delivery": {
            "title": "达必妥与 JAK 抑制剂安全性对比研究（2026）",
            "views": 11,
            "viewed_at": "2026-05-29 19:20:44",
        },
        "last_material": "JAK 安全性对比",
        "meeting": "中部皮肤病论坛",
        "interactions": [
            {"date": "2026/05/30", "type": "面对面拜访", "detail": "讨论心血管共病亚组；医生要求更多数据。"},
            {"date": "2026/04/18", "type": "会议参与", "detail": "HSM；角色：听者。"},
        ],
        "interaction_stats": {"面对面拜访": 3, "资料投递": 2, "参会次数": 1, "HSM": 1, "MEM": 0},
    },
    "sun-qi": {
        "id": "sun-qi",
        "name": "孙琦医生",
        "hospital": "中山大学附属第一医院",
        "title": "皮肤科主治医师",
        "product": "达必妥",
        "tier": "推荐者",
        "crm_code": "CY0822",
        "tags": ["目标客户"],
        "gender": "男",
        "department": "皮肤科",
        "role": "主治医师",
        "grade": "等级-A-VA",
        "last_visit": "2026-07-01",
        "last_feedback": "已向同科推荐达必妥用于青少年与特殊部位中度 AD，认为长期安全与稳控均达标，可作门诊优选。",
        "open_task": "收集同科推荐案例并准备病例墙",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天提升", "supply_risk": "无"},
        "interaction_excerpt": "7 月 1 日：推荐者；双维偏高；主动推荐青少年与特殊部位人群。",
        "perception_ladder": _ladder("认可且推荐", "认可"),
        "knowledge": _knowledge(
            [("认可且推荐", "认可"), ("认可", "认可"), ("认可且推荐", "认可"), ("认可", "认可")],
            {"长期安全": "认可且推荐", "稳控": "认可", "一线": "认可", "DOT": "认可", "速效": "认可", "对因治疗": "认可", "区隔JAK": "认可", "区隔CM310": "不确定"},
        ),
        "target_patients": ["青少年患者", "中度AD特殊部位", "传统用药可控制不佳"],
        "material_delivery": {
            "title": "青少年与特殊部位 AD 沟通卡",
            "views": 14,
            "viewed_at": "2026-06-30 13:15:00",
        },
        "last_material": "青少年与特殊部位沟通卡",
        "meeting": "粤港澳皮肤科青年论坛",
        "interactions": [
            {"date": "2026/07/01", "type": "面对面拜访", "detail": "确认同科推荐路径；索取病例墙模板。"},
            {"date": "2026/06/15", "type": "资料投递", "detail": "投递青少年沟通卡；阅读完成。"},
            {"date": "2026/05/22", "type": "科室会", "detail": "MEM 病例分享；角色：分享者。"},
        ],
        "interaction_stats": {"面对面拜访": 5, "资料投递": 3, "参会次数": 2, "HSM": 0, "MEM": 2},
    },
}

CUSTOMER = CUSTOMERS["liu-min"]

# 观念阶梯维度：访后抽取与前端滑块共用这套维度定义。
PERCEPTION_DIMENSIONS = ["长期安全", "维稳"]

_LIST_FIELDS = (
    "id", "name", "hospital", "title", "product", "tier", "last_visit", "last_feedback", "open_task",
    "last_material", "meeting", "interactions", "interaction_stats", "perception_ladder", "institution",
    "crm_code", "tags", "gender", "department", "role", "grade", "knowledge", "target_patients", "material_delivery",
)


def get_customer(customer_id: str = "liu-min") -> dict:
    from app.services.crm_context import overlay_customer
    return overlay_customer(CUSTOMERS.get(customer_id, CUSTOMER))


def list_customers() -> list[dict]:
    rows = []
    for customer in CUSTOMERS.values():
        rows.append({field: customer.get(field) for field in _LIST_FIELDS})
    return rows


def knowledge_summary(customer: dict) -> str:
    knowledge = customer.get("knowledge") or {}
    advantages = knowledge.get("advantages") or []
    hot = [f"{item['name']}：{item['level']}" for item in advantages if item.get("level") not in (None, "未知")]
    hot = hot[:4] or ["关键信息待完善"]
    patients = customer.get("target_patients") or []
    patient_text = "、".join(patients[:3]) if patients else "暂无"
    grade = customer.get("grade") or "—"
    return f"客户等级{grade}；观念阶梯-{customer.get('tier')}；关键观念：{'；'.join(hot)}；目标患者侧重：{patient_text}。"


# 已审批循证证据（医学结论唯一来源）。
CITATION = {
    "title": "达必妥与 JAK 抑制剂安全性对比研究（2026）",
    "version": "V3.2 · 2026-04-18",
    "status": "医学与合规审批通过",
    "location": "第 4 章 · 长期安全性与血栓风险对比",
    "excerpt": "在已批准适应症和用药条件下，度普利尤单抗长期随访人群安全性特征稳定；相较 JAK 抑制剂，静脉血栓栓塞事件发生率更低。临床决策仍需结合患者个体情况。",
}


def crm_interaction_source(customer: dict) -> dict:
    excerpt = customer.get("interaction_excerpt") or ""
    hcp = knowledge_summary(customer)
    return {
        "id": f"crm-interactions-{customer['id']}",
        "kind": "crm",
        "title": f"{customer['name']} · CRM 互动记录",
        "version": "同步于 2026-07-09 09:18",
        "status": "CRM 演示数据 · 只读",
        "location": "客户 360° / 互动时间线",
        "excerpt": f"{excerpt} {hcp}".strip(),
    }


def institution_source(customer: dict) -> dict:
    status = customer["institution"]
    return {
        "id": f"institution-access-{customer['id']}",
        "kind": "business",
        "title": f"{customer['hospital']} · 准入与运营看板",
        "version": "快照于 2026-07-08",
        "status": "商业运营演示数据 · 只读",
        "location": "机构准入 / 供应风险",
        "excerpt": f"目录状态{status['formulary']}，{status['coverage_trend']}，供应风险：{status['supply_risk']}。",
    }


CRM_INTERACTION_SOURCE = crm_interaction_source(CUSTOMER)
INSTITUTION_SOURCE = institution_source(CUSTOMER)

# 已审批学术材料（用于材料推荐与手卡）。
MATERIAL_SOURCE = {
    "id": "material-approved-2026-04",
    "kind": "approved-material",
    "title": "达必妥长期安全性真实世界研究（2026）",
    "version": "MAT-V2.1 · 2026-04-22",
    "status": "医学与合规审批通过",
    "location": "资料库 / 长期疾病管理",
    "excerpt": "仅供在已批准适应症范围内的学术沟通使用；请以资料正文和当前批准版本为准。",
}

# 面对面拜访使用的电子手卡（Detail Aids）。演示时长在前端统计后带入访后草稿。
DETAIL_AIDS = [
    {
        "id": "aid-persistent-control",
        "title": "达必妥®优势一：持久控制",
        "subtitle": "中度 AD 2 型炎症共病",
        "points": [
            "长期随访人群疾病活动度持续下降，控制稳定。",
            "覆盖合并代谢/心血管风险人群的长期管理场景。",
        ],
        "tags": ["长期安全", "真实世界"],
        "status": "医学与合规审批通过",
    },
    {
        "id": "aid-safety-vs-jak",
        "title": "达必妥®优势二：安全性对比",
        "subtitle": "与 JAK 抑制剂血栓风险对比",
        "points": [
            "静脉血栓栓塞（肺栓塞/深静脉血栓）事件发生率更低。",
            "适合合并心血管共病患者的长期用药选择。",
        ],
        "tags": ["安全性", "循证"],
        "status": "医学与合规审批通过",
    },
    {
        "id": "aid-no-screening",
        "title": "无需筛查，即刻起始",
        "subtitle": "用药便利性",
        "points": [
            "起始前无需常规实验室筛查，缩短起始路径。",
            "便于门诊快速决策与患者依从。",
        ],
        "tags": ["起始便利"],
        "status": "医学与合规审批通过",
    },
]


def detail_aids_for(product: str = "达必妥") -> list[dict]:
    """返回当前产品可用的已审批手卡列表。"""
    return [dict(aid) for aid in DETAIL_AIDS]


# 访后可分享的已审批推荐文章。
RECOMMEND_ARTICLES = [
    {
        "id": "article-growth",
        "title": "AD 治疗新视野：度普利尤单抗的长期治疗模式探索",
        "tag": "长期治疗模式",
        "note": "基于真实世界数据的长期治疗观察，适合青少年及儿童患者沟通。",
        "status": "医学与合规审批通过",
    },
    {
        "id": "article-safety",
        "title": "特应性皮炎系统治疗安全性评估：JAK 抑制剂相较度普利尤单抗显著增加血栓风险",
        "tag": "安全性对比",
        "note": "用于回应 JAK 抑制剂相关异议，提供血栓风险差异循证。",
        "status": "医学与合规审批通过",
    },
]


def recommend_articles() -> list[dict]:
    return [dict(article) for article in RECOMMEND_ARTICLES]
