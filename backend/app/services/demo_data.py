"""达必妥（度普利尤单抗）演示域数据。

所有客户、观念阶梯、手卡、证据与推荐文章都在这里集中定义，供只读工具取用。
业务主线：复旦大学附属儿科医院皮肤科，围绕中重度特应性皮炎（AD）的达必妥拜访。
"""

# 观念阶梯等级（由低到高），用于访前展示与访后抽取校验。
LADDER_LEVELS = ["中立", "认可", "认可且推荐"]

# 客户阶段（整体观念阶梯）。
CUSTOMER_STAGES = ["待启动", "试用者", "使用者", "推荐者"]


CUSTOMERS = {
    "liu-min": {
        "id": "liu-min", "name": "刘敏主任", "hospital": "复旦大学附属儿科医院", "title": "皮肤科主任医师", "product": "达必妥", "tier": "试用者",
        "last_visit": "2026-06-08", "last_feedback": "认可达必妥长期安全性数据，但对稳控效果仍有疑虑，希望补充中度 AD 合并 2 型炎症共病的循证方案。",
        "open_task": "确认 11 月 14 日中国医师协会皮肤科医师分会年会参会意向",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天稳定", "supply_risk": "无"},
        "interaction_excerpt": "6 月 8 日面对面拜访：使用「中度 AD 心血管共病」材料，医生对长期安全性认可、对稳控存疑；已发送年会邀请待确认。",
        "perception_ladder": [
            {"dimension": "长期安全", "level": "中立"},
            {"dimension": "维稳", "level": "中立"},
        ],
        "last_material": "中度 AD 心血管共病",
        "meeting": "11 月 14 日中国医师协会皮肤科医师分会年会",
        "interactions": [
            {"date": "2026/05/03", "type": "面对面拜访", "detail": "拜访材料：使用者及以上（中度 AD 2 型炎症共病）；医生反馈：对“心血管共病”不认可。"},
            {"date": "2026/05/03", "type": "企业文章推送", "detail": "推送《循证为帆·真实世界新证》；阅读状态：未打开。"},
            {"date": "2026/04/05", "type": "会议参与", "detail": "参加 2026 中国医师协会皮肤科医师分会年会；参会角色：听者。"},
        ],
        "interaction_stats": {"面对面拜访": 3, "资料投递": 1, "参会次数": 1},
    },
    "song-wen": {
        "id": "song-wen", "name": "宋雯医生", "hospital": "复旦大学附属儿科医院", "title": "皮肤科主治医师", "product": "达必妥", "tier": "使用者",
        "last_visit": "2026-06-17", "last_feedback": "关注青少年及儿童患者的长期治疗模式与生长发育影响，希望获得真实世界研究资料。",
        "open_task": "发送青少年长期治疗真实世界研究并确认科室会时间",
        "institution": {"formulary": "正常", "coverage_trend": "近 90 天提升", "supply_risk": "低"},
        "interaction_excerpt": "6 月 17 日拜访：讨论青少年长期维持治疗；科室会资料待发送。",
        "perception_ladder": [
            {"dimension": "长期安全", "level": "认可且推荐"},
            {"dimension": "维稳", "level": "认可"},
        ],
        "last_material": "青少年长期治疗模式",
        "meeting": "11 月 14 日中国医师协会皮肤科医师分会年会",
        "interactions": [
            {"date": "2026/06/17", "type": "面对面拜访", "detail": "讨论青少年长期维持治疗；医生反馈积极。"},
            {"date": "2026/05/20", "type": "科室会", "detail": "达必妥真实世界研究科室分享；到场 12 人。"},
        ],
        "interaction_stats": {"面对面拜访": 4, "资料投递": 2, "参会次数": 2},
    },
    "bian-xiaoyan": {
        "id": "bian-xiaoyan", "name": "卞小燕主任", "hospital": "复旦大学附属儿科医院", "title": "皮肤科副主任医师", "product": "达必妥", "tier": "待启动",
        "last_visit": "2026-06-24", "last_feedback": "希望先了解院内目录准入进度与患者教育材料的可用情况。",
        "open_task": "确认首例患者教育支持与院内准入流程",
        "institution": {"formulary": "准入推进中", "coverage_trend": "近 90 天待启动", "supply_risk": "需关注"},
        "interaction_excerpt": "6 月 24 日沟通：关注院内准入节奏与患者教育材料。",
        "perception_ladder": [
            {"dimension": "长期安全", "level": "中立"},
            {"dimension": "维稳", "level": "中立"},
        ],
        "last_material": "患者教育与院内准入",
        "meeting": "11 月 14 日中国医师协会皮肤科医师分会年会",
        "interactions": [
            {"date": "2026/06/24", "type": "面对面拜访", "detail": "沟通院内准入与患者教育材料需求。"},
        ],
        "interaction_stats": {"面对面拜访": 1, "资料投递": 0, "参会次数": 0},
    },
}

CUSTOMER = CUSTOMERS["liu-min"]

# 观念阶梯维度：访后抽取与前端滑块共用这套维度定义。
PERCEPTION_DIMENSIONS = ["长期安全", "维稳"]


def get_customer(customer_id: str = "liu-min") -> dict:
    from app.services.crm_context import overlay_customer
    return overlay_customer(CUSTOMERS.get(customer_id, CUSTOMER))


def list_customers() -> list[dict]:
    fields = (
        "id", "name", "hospital", "title", "product", "tier", "last_visit", "last_feedback", "open_task",
        "last_material", "meeting", "interactions", "interaction_stats", "perception_ladder", "institution",
    )
    return [{field: customer[field] for field in fields} for customer in CUSTOMERS.values()]


# 已审批循证证据（医学结论唯一来源）。
CITATION = {
    "title": "达必妥与 JAK 抑制剂安全性对比研究（2026）",
    "version": "V3.2 · 2026-04-18",
    "status": "医学与合规审批通过",
    "location": "第 4 章 · 长期安全性与血栓风险对比",
    "excerpt": "在已批准适应症和用药条件下，度普利尤单抗长期随访人群安全性特征稳定；相较 JAK 抑制剂，静脉血栓栓塞事件发生率更低。临床决策仍需结合患者个体情况。",
}


def crm_interaction_source(customer: dict) -> dict:
    return {
        "id": f"crm-interactions-{customer['id']}", "kind": "crm", "title": f"{customer['name']} · CRM 互动记录",
        "version": "同步于 2026-07-09 09:18", "status": "CRM 演示数据 · 只读", "location": "客户 360° / 互动时间线", "excerpt": customer["interaction_excerpt"],
    }


def institution_source(customer: dict) -> dict:
    status = customer["institution"]
    return {
        "id": f"institution-access-{customer['id']}", "kind": "business", "title": f"{customer['hospital']} · 准入与运营看板",
        "version": "快照于 2026-07-08", "status": "商业运营演示数据 · 只读", "location": "机构准入 / 供应风险",
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
