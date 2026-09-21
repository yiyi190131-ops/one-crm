import type { Customer } from "@/lib/types";

/** 与 backend/app/services/demo_data.py 对齐，供后端未醒时首屏立刻可选医生。 */
export const DEMO_CUSTOMERS: Customer[] = [
  {
    "id": "liu-min",
    "name": "刘敏主任",
    "hospital": "复旦大学附属儿科医院",
    "title": "皮肤科主任医师",
    "product": "达必妥",
    "tier": "试用者",
    "last_visit": "2026-06-08",
    "last_feedback": "认可达必妥长期安全性数据，但对稳控效果仍有疑虑，希望补充中度 AD 合并 2 型炎症共病的循证方案。",
    "open_task": "确认 11 月 14 日中国医师协会皮肤科医师分会年会参会意向",
    "last_material": "中度 AD 心血管共病",
    "meeting": "11 月 14 日中国医师协会皮肤科医师分会年会",
    "interactions": [
      {
        "date": "2026/05/03",
        "type": "面对面拜访",
        "detail": "拜访材料：使用者及以上（中度 AD 2 型炎症共病）；医生反馈：对“心血管共病”不认可。"
      },
      {
        "date": "2026/05/03",
        "type": "企业文章推送",
        "detail": "推送《循证为帆·真实世界新证》；阅读状态：未打开。"
      },
      {
        "date": "2026/04/05",
        "type": "会议参与",
        "detail": "参加 2026 中国医师协会皮肤科医师分会年会；参会角色：听者。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 3,
      "资料投递": 1,
      "参会次数": 1,
      "HSM": 1,
      "MEM": 0
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "中立"
      },
      {
        "dimension": "维稳",
        "level": "中立"
      }
    ],
    "institution": {
      "formulary": "正常",
      "coverage_trend": "近 90 天稳定",
      "supply_risk": "无"
    },
    "crm_code": "CY0801",
    "tags": [
      "目标客户"
    ],
    "gender": "女",
    "department": "皮肤科",
    "role": "主任",
    "grade": "等级-A-VA",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "认可",
          "advanced": "不确定"
        },
        {
          "name": "疾病负担",
          "basic": "认可",
          "advanced": "不确定"
        },
        {
          "name": "治疗目标",
          "basic": "不确定",
          "advanced": "未知"
        },
        {
          "name": "治疗策略",
          "basic": "不确定",
          "advanced": "未知"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "未知"
        },
        {
          "name": "DOT",
          "level": "未知"
        },
        {
          "name": "速效",
          "level": "未知"
        },
        {
          "name": "稳控",
          "level": "不确定"
        },
        {
          "name": "对因治疗",
          "level": "未知"
        },
        {
          "name": "长期安全",
          "level": "认可"
        },
        {
          "name": "区隔JAK",
          "level": "不确定"
        },
        {
          "name": "区隔CM310",
          "level": "未知"
        }
      ]
    },
    "target_patients": [
      "中度AD合并共病",
      "中度AD合并心血管风险",
      "青少年患者"
    ],
    "material_delivery": {
      "title": "AD治疗新视野：度普利尤单抗的长期治疗模式探索",
      "views": 8,
      "viewed_at": "2026-05-20 10:12:00"
    }
  },
  {
    "id": "song-wen",
    "name": "宋雯医生",
    "hospital": "复旦大学附属儿科医院",
    "title": "皮肤科主治医师",
    "product": "达必妥",
    "tier": "使用者",
    "last_visit": "2026-06-17",
    "last_feedback": "关注青少年及儿童患者的长期治疗模式与生长发育影响，希望获得真实世界研究资料。",
    "open_task": "发送青少年长期治疗真实世界研究并确认科室会时间",
    "last_material": "青少年长期治疗模式",
    "meeting": "11 月 14 日中国医师协会皮肤科医师分会年会",
    "interactions": [
      {
        "date": "2026/06/17",
        "type": "面对面拜访",
        "detail": "讨论青少年长期维持治疗；医生反馈积极。"
      },
      {
        "date": "2026/05/20",
        "type": "科室会",
        "detail": "达必妥真实世界研究科室分享；到场 12 人。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 4,
      "资料投递": 2,
      "参会次数": 2,
      "HSM": 2,
      "MEM": 1
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "认可且推荐"
      },
      {
        "dimension": "维稳",
        "level": "认可"
      }
    ],
    "institution": {
      "formulary": "正常",
      "coverage_trend": "近 90 天提升",
      "supply_risk": "低"
    },
    "crm_code": "CY0802",
    "tags": [
      "目标客户"
    ],
    "gender": "女",
    "department": "皮肤科",
    "role": "主治医师",
    "grade": "等级-B-VA",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "认可且推荐",
          "advanced": "认可"
        },
        {
          "name": "疾病负担",
          "basic": "认可",
          "advanced": "认可"
        },
        {
          "name": "治疗目标",
          "basic": "认可",
          "advanced": "不确定"
        },
        {
          "name": "治疗策略",
          "basic": "认可",
          "advanced": "认可"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "认可"
        },
        {
          "name": "DOT",
          "level": "不确定"
        },
        {
          "name": "速效",
          "level": "未知"
        },
        {
          "name": "稳控",
          "level": "认可"
        },
        {
          "name": "对因治疗",
          "level": "认可"
        },
        {
          "name": "长期安全",
          "level": "认可且推荐"
        },
        {
          "name": "区隔JAK",
          "level": "认可"
        },
        {
          "name": "区隔CM310",
          "level": "不确定"
        }
      ]
    },
    "target_patients": [
      "青少年患者",
      "儿童患者",
      "传统用药可控制不佳"
    ],
    "material_delivery": {
      "title": "AD治疗新视野：度普利尤单抗的长期治疗模式探索",
      "views": 15,
      "viewed_at": "2026-06-10 14:22:11"
    }
  },
  {
    "id": "bian-xiaoyan",
    "name": "卞小燕主任",
    "hospital": "复旦大学附属儿科医院",
    "title": "皮肤科副主任医师",
    "product": "达必妥",
    "tier": "待启动",
    "last_visit": "2026-06-24",
    "last_feedback": "希望先了解院内目录准入进度与患者教育材料的可用情况。",
    "open_task": "确认首例患者教育支持与院内准入流程",
    "last_material": "患者教育与院内准入",
    "meeting": "11 月 14 日中国医师协会皮肤科医师分会年会",
    "interactions": [
      {
        "date": "2026/06/24",
        "type": "面对面拜访",
        "detail": "沟通院内准入与患者教育材料需求。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 1,
      "资料投递": 0,
      "参会次数": 0,
      "HSM": 0,
      "MEM": 0
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "中立"
      },
      {
        "dimension": "维稳",
        "level": "中立"
      }
    ],
    "institution": {
      "formulary": "准入推进中",
      "coverage_trend": "近 90 天待启动",
      "supply_risk": "需关注"
    },
    "crm_code": "CY0803",
    "tags": [
      "目标客户"
    ],
    "gender": "女",
    "department": "皮肤科",
    "role": "副主任",
    "grade": "等级-C",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "未知",
          "advanced": "未知"
        },
        {
          "name": "疾病负担",
          "basic": "不确定",
          "advanced": "未知"
        },
        {
          "name": "治疗目标",
          "basic": "未知",
          "advanced": "未知"
        },
        {
          "name": "治疗策略",
          "basic": "未知",
          "advanced": "未知"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "未知"
        },
        {
          "name": "DOT",
          "level": "未知"
        },
        {
          "name": "速效",
          "level": "未知"
        },
        {
          "name": "稳控",
          "level": "未知"
        },
        {
          "name": "对因治疗",
          "level": "未知"
        },
        {
          "name": "长期安全",
          "level": "不确定"
        },
        {
          "name": "区隔JAK",
          "level": "未知"
        },
        {
          "name": "区隔CM310",
          "level": "未知"
        }
      ]
    },
    "target_patients": [
      "局部控制不佳重度AD",
      "中度AD特殊部位"
    ],
    "material_delivery": {
      "title": "患者教育与院内准入沟通提纲",
      "views": 2,
      "viewed_at": "2026-06-22 09:01:00"
    }
  },
  {
    "id": "ai-wenjia",
    "name": "艾文佳主任",
    "hospital": "广东省中医院",
    "title": "皮肤科主任医师",
    "product": "达必妥",
    "tier": "使用者",
    "last_visit": "2026-07-02",
    "last_feedback": "对达必妥长期安全与区隔 JAK 较认可，愿在中度 AD 合并共病患者中继续观察稳控表现，并希望科室会分享真实世界数据。",
    "open_task": "确认 7 月科室会材料清单与讲者议程",
    "last_material": "长期治疗模式探索",
    "meeting": "广东省皮肤病学年会卫星会",
    "interactions": [
      {
        "date": "2026/07/02",
        "type": "面对面拜访",
        "detail": "复核关键信息矩阵；医生确认愿继续观察共病稳控。"
      },
      {
        "date": "2026/06/18",
        "type": "资料投递",
        "detail": "投递长期治疗模式资料；已打开阅读。"
      },
      {
        "date": "2026/05/11",
        "type": "会议参与",
        "detail": "HSM 区域学术会；角色：讲者。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 5,
      "资料投递": 3,
      "参会次数": 2,
      "HSM": 2,
      "MEM": 1
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "认可"
      },
      {
        "dimension": "维稳",
        "level": "认可"
      }
    ],
    "institution": {
      "formulary": "正常",
      "coverage_trend": "近 90 天提升",
      "supply_risk": "无"
    },
    "crm_code": "CY0806",
    "tags": [
      "目标客户",
      "讲者"
    ],
    "gender": "男",
    "department": "皮肤科",
    "role": "副主任",
    "grade": "等级-A-VA",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "认可",
          "advanced": "认可"
        },
        {
          "name": "疾病负担",
          "basic": "认可",
          "advanced": "不确定"
        },
        {
          "name": "治疗目标",
          "basic": "认可",
          "advanced": "认可"
        },
        {
          "name": "治疗策略",
          "basic": "认可",
          "advanced": "不确定"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "认可"
        },
        {
          "name": "DOT",
          "level": "不确定"
        },
        {
          "name": "速效",
          "level": "未知"
        },
        {
          "name": "稳控",
          "level": "认可"
        },
        {
          "name": "对因治疗",
          "level": "认可"
        },
        {
          "name": "长期安全",
          "level": "认可且推荐"
        },
        {
          "name": "区隔JAK",
          "level": "认可"
        },
        {
          "name": "区隔CM310",
          "level": "不确定"
        }
      ]
    },
    "target_patients": [
      "局部控制不佳重度AD",
      "传统用药可控制不佳",
      "青少年患者",
      "儿童患者",
      "中度AD合并共病",
      "中度AD合并瘙痒失眠",
      "中度AD合并心血管风险",
      "中度AD特殊部位"
    ],
    "material_delivery": {
      "title": "AD治疗新视野：度普利尤单抗的长期治疗模式探索",
      "views": 12,
      "viewed_at": "2025-11-14 12:34:24"
    }
  },
  {
    "id": "chen-hao",
    "name": "陈浩主任",
    "hospital": "北京协和医院",
    "title": "皮肤科主任医师",
    "product": "达必妥",
    "tier": "推荐者",
    "last_visit": "2026-06-28",
    "last_feedback": "已在多例中重度 AD 中推荐达必妥，认可长期安全与区隔 JAK，希望拿到更新版血栓风险对比幻灯。",
    "open_task": "发送区隔 JAK 更新幻灯并预约 8 月讲者档期",
    "last_material": "区隔 JAK 安全性对比",
    "meeting": "中华医学会皮肤性病学年会",
    "interactions": [
      {
        "date": "2026/06/28",
        "type": "面对面拜访",
        "detail": "确认可作区域讲者；索取更新幻灯。"
      },
      {
        "date": "2026/06/01",
        "type": "会议参与",
        "detail": "MEM 病例讨论会；角色：点评嘉宾。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 6,
      "资料投递": 4,
      "参会次数": 3,
      "HSM": 1,
      "MEM": 2
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "认可且推荐"
      },
      {
        "dimension": "维稳",
        "level": "认可且推荐"
      }
    ],
    "institution": {
      "formulary": "正常",
      "coverage_trend": "近 90 天稳定",
      "supply_risk": "无"
    },
    "crm_code": "CY0810",
    "tags": [
      "目标客户",
      "讲者"
    ],
    "gender": "男",
    "department": "皮肤科",
    "role": "主任",
    "grade": "等级-A",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "认可且推荐",
          "advanced": "认可且推荐"
        },
        {
          "name": "疾病负担",
          "basic": "认可且推荐",
          "advanced": "认可"
        },
        {
          "name": "治疗目标",
          "basic": "认可且推荐",
          "advanced": "认可"
        },
        {
          "name": "治疗策略",
          "basic": "认可且推荐",
          "advanced": "认可"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "认可且推荐"
        },
        {
          "name": "DOT",
          "level": "认可"
        },
        {
          "name": "速效",
          "level": "认可"
        },
        {
          "name": "稳控",
          "level": "认可且推荐"
        },
        {
          "name": "对因治疗",
          "level": "认可"
        },
        {
          "name": "长期安全",
          "level": "认可且推荐"
        },
        {
          "name": "区隔JAK",
          "level": "认可且推荐"
        },
        {
          "name": "区隔CM310",
          "level": "认可"
        }
      ]
    },
    "target_patients": [
      "局部控制不佳重度AD",
      "中度AD合并心血管风险",
      "传统用药可控制不佳"
    ],
    "material_delivery": {
      "title": "特应性皮炎系统治疗安全性评估：JAK 对比",
      "views": 20,
      "viewed_at": "2026-06-25 16:40:00"
    }
  },
  {
    "id": "zhao-lin",
    "name": "赵琳医生",
    "hospital": "四川大学华西医院",
    "title": "皮肤科主治医师",
    "product": "达必妥",
    "tier": "试用者",
    "last_visit": "2026-06-12",
    "last_feedback": "愿意在中度 AD 瘙痒失眠患者中试用，但对稳控持续性仍不确定，需要更多门诊随访案例。",
    "open_task": "补充 2 例门诊随访小结并约下周复诊沟通",
    "last_material": "瘙痒失眠共病沟通",
    "meeting": "西南皮肤病协作组会",
    "interactions": [
      {
        "date": "2026/06/12",
        "type": "面对面拜访",
        "detail": "首例试用患者反馈瘙痒改善，稳控待观察。"
      },
      {
        "date": "2026/05/28",
        "type": "资料投递",
        "detail": "投递瘙痒失眠要点；已阅读。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 2,
      "资料投递": 2,
      "参会次数": 0,
      "HSM": 0,
      "MEM": 0
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "认可"
      },
      {
        "dimension": "维稳",
        "level": "中立"
      }
    ],
    "institution": {
      "formulary": "正常",
      "coverage_trend": "近 90 天稳定",
      "supply_risk": "低"
    },
    "crm_code": "CY0812",
    "tags": [
      "目标客户"
    ],
    "gender": "女",
    "department": "皮肤科",
    "role": "主治医师",
    "grade": "等级-B",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "认可",
          "advanced": "不确定"
        },
        {
          "name": "疾病负担",
          "basic": "认可",
          "advanced": "不确定"
        },
        {
          "name": "治疗目标",
          "basic": "不确定",
          "advanced": "未知"
        },
        {
          "name": "治疗策略",
          "basic": "不确定",
          "advanced": "未知"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "未知"
        },
        {
          "name": "DOT",
          "level": "未知"
        },
        {
          "name": "速效",
          "level": "不确定"
        },
        {
          "name": "稳控",
          "level": "不确定"
        },
        {
          "name": "对因治疗",
          "level": "不确定"
        },
        {
          "name": "长期安全",
          "level": "认可"
        },
        {
          "name": "区隔JAK",
          "level": "未知"
        },
        {
          "name": "区隔CM310",
          "level": "未知"
        }
      ]
    },
    "target_patients": [
      "中度AD合并瘙痒失眠",
      "青少年患者"
    ],
    "material_delivery": {
      "title": "中度 AD 合并瘙痒失眠沟通要点",
      "views": 5,
      "viewed_at": "2026-06-11 11:08:33"
    }
  },
  {
    "id": "wu-jing",
    "name": "吴静主任",
    "hospital": "中南大学湘雅医院",
    "title": "皮肤科副主任医师",
    "product": "达必妥",
    "tier": "待启动",
    "last_visit": "2026-07-05",
    "last_feedback": "院内目录尚未稳定，暂不启动处方；希望先拿到患者教育折页与准入时间表。",
    "open_task": "同步院内准入节点并寄送患者教育折页",
    "last_material": "患者教育与院内准入",
    "interactions": [
      {
        "date": "2026/07/05",
        "type": "面对面拜访",
        "detail": "沟通目录进度；未开放处方。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 1,
      "资料投递": 0,
      "参会次数": 0,
      "HSM": 0,
      "MEM": 0
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "中立"
      },
      {
        "dimension": "维稳",
        "level": "中立"
      }
    ],
    "institution": {
      "formulary": "准入推进中",
      "coverage_trend": "近 90 天待启动",
      "supply_risk": "需关注"
    },
    "crm_code": "CY0815",
    "tags": [
      "目标客户"
    ],
    "gender": "女",
    "department": "皮肤科",
    "role": "副主任",
    "grade": "等级-C",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "未知",
          "advanced": "未知"
        },
        {
          "name": "疾病负担",
          "basic": "未知",
          "advanced": "未知"
        },
        {
          "name": "治疗目标",
          "basic": "未知",
          "advanced": "未知"
        },
        {
          "name": "治疗策略",
          "basic": "未知",
          "advanced": "未知"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "未知"
        },
        {
          "name": "DOT",
          "level": "未知"
        },
        {
          "name": "速效",
          "level": "未知"
        },
        {
          "name": "稳控",
          "level": "未知"
        },
        {
          "name": "对因治疗",
          "level": "未知"
        },
        {
          "name": "长期安全",
          "level": "未知"
        },
        {
          "name": "区隔JAK",
          "level": "未知"
        },
        {
          "name": "区隔CM310",
          "level": "未知"
        }
      ]
    },
    "target_patients": [
      "局部控制不佳重度AD"
    ],
    "material_delivery": {
      "title": "患者教育折页（待寄送）",
      "views": 0,
      "viewed_at": "—"
    }
  },
  {
    "id": "li-meng",
    "name": "李萌医生",
    "hospital": "浙江大学医学院附属第二医院",
    "title": "皮肤科主治医师",
    "product": "达必妥",
    "tier": "使用者",
    "last_visit": "2026-06-20",
    "last_feedback": "维稳表现认可，但对长期安全证据更新节奏有疑问，希望对照最新说明书与真实世界随访。",
    "open_task": "带上最新说明书摘要做安全证据对照",
    "last_material": "长期安全性真实世界研究",
    "meeting": "华东皮肤科联合病例会",
    "interactions": [
      {
        "date": "2026/06/20",
        "type": "面对面拜访",
        "detail": "对照说明书讨论长期随访终点。"
      },
      {
        "date": "2026/06/05",
        "type": "资料投递",
        "detail": "投递真实世界研究；已阅读。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 3,
      "资料投递": 2,
      "参会次数": 1,
      "HSM": 1,
      "MEM": 0
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "中立"
      },
      {
        "dimension": "维稳",
        "level": "认可"
      }
    ],
    "institution": {
      "formulary": "正常",
      "coverage_trend": "近 90 天稳定",
      "supply_risk": "无"
    },
    "crm_code": "CY0818",
    "tags": [
      "目标客户"
    ],
    "gender": "男",
    "department": "皮肤科",
    "role": "主治医师",
    "grade": "等级-B-VA",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "认可",
          "advanced": "不确定"
        },
        {
          "name": "疾病负担",
          "basic": "认可",
          "advanced": "认可"
        },
        {
          "name": "治疗目标",
          "basic": "认可",
          "advanced": "认可"
        },
        {
          "name": "治疗策略",
          "basic": "认可",
          "advanced": "不确定"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "认可"
        },
        {
          "name": "DOT",
          "level": "认可"
        },
        {
          "name": "速效",
          "level": "不确定"
        },
        {
          "name": "稳控",
          "level": "认可"
        },
        {
          "name": "对因治疗",
          "level": "认可"
        },
        {
          "name": "长期安全",
          "level": "不确定"
        },
        {
          "name": "区隔JAK",
          "level": "不确定"
        },
        {
          "name": "区隔CM310",
          "level": "未知"
        }
      ]
    },
    "target_patients": [
      "中度AD合并共病",
      "中度AD特殊部位",
      "青少年患者"
    ],
    "material_delivery": {
      "title": "达必妥长期安全性真实世界研究（2026）",
      "views": 9,
      "viewed_at": "2026-06-19 08:55:02"
    }
  },
  {
    "id": "zhou-yan",
    "name": "周燕主任",
    "hospital": "华中科技大学同济医学院附属同济医院",
    "title": "皮肤科主任医师",
    "product": "达必妥",
    "tier": "试用者",
    "last_visit": "2026-05-30",
    "last_feedback": "对区隔 JAK 兴趣高，但在心血管风险合并人群仍偏谨慎，希望看更多共病亚组数据。",
    "open_task": "准备共病亚组数据页并预约 15 分钟讲者预沟通",
    "last_material": "JAK 安全性对比",
    "meeting": "中部皮肤病论坛",
    "interactions": [
      {
        "date": "2026/05/30",
        "type": "面对面拜访",
        "detail": "讨论心血管共病亚组；医生要求更多数据。"
      },
      {
        "date": "2026/04/18",
        "type": "会议参与",
        "detail": "HSM；角色：听者。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 3,
      "资料投递": 2,
      "参会次数": 1,
      "HSM": 1,
      "MEM": 0
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "认可"
      },
      {
        "dimension": "维稳",
        "level": "中立"
      }
    ],
    "institution": {
      "formulary": "正常",
      "coverage_trend": "近 90 天提升",
      "supply_risk": "无"
    },
    "crm_code": "CY0820",
    "tags": [
      "目标客户",
      "讲者"
    ],
    "gender": "女",
    "department": "皮肤科",
    "role": "主任",
    "grade": "等级-A",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "认可",
          "advanced": "认可"
        },
        {
          "name": "疾病负担",
          "basic": "认可",
          "advanced": "不确定"
        },
        {
          "name": "治疗目标",
          "basic": "认可",
          "advanced": "不确定"
        },
        {
          "name": "治疗策略",
          "basic": "不确定",
          "advanced": "未知"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "不确定"
        },
        {
          "name": "DOT",
          "level": "未知"
        },
        {
          "name": "速效",
          "level": "未知"
        },
        {
          "name": "稳控",
          "level": "不确定"
        },
        {
          "name": "对因治疗",
          "level": "不确定"
        },
        {
          "name": "长期安全",
          "level": "认可"
        },
        {
          "name": "区隔JAK",
          "level": "认可"
        },
        {
          "name": "区隔CM310",
          "level": "未知"
        }
      ]
    },
    "target_patients": [
      "中度AD合并心血管风险",
      "局部控制不佳重度AD"
    ],
    "material_delivery": {
      "title": "达必妥与 JAK 抑制剂安全性对比研究（2026）",
      "views": 11,
      "viewed_at": "2026-05-29 19:20:44"
    }
  },
  {
    "id": "sun-qi",
    "name": "孙琦医生",
    "hospital": "中山大学附属第一医院",
    "title": "皮肤科主治医师",
    "product": "达必妥",
    "tier": "推荐者",
    "last_visit": "2026-07-01",
    "last_feedback": "已向同科推荐达必妥用于青少年与特殊部位中度 AD，认为长期安全与稳控均达标，可作门诊优选。",
    "open_task": "收集同科推荐案例并准备病例墙",
    "last_material": "青少年与特殊部位沟通卡",
    "meeting": "粤港澳皮肤科青年论坛",
    "interactions": [
      {
        "date": "2026/07/01",
        "type": "面对面拜访",
        "detail": "确认同科推荐路径；索取病例墙模板。"
      },
      {
        "date": "2026/06/15",
        "type": "资料投递",
        "detail": "投递青少年沟通卡；阅读完成。"
      },
      {
        "date": "2026/05/22",
        "type": "科室会",
        "detail": "MEM 病例分享；角色：分享者。"
      }
    ],
    "interaction_stats": {
      "面对面拜访": 5,
      "资料投递": 3,
      "参会次数": 2,
      "HSM": 0,
      "MEM": 2
    },
    "perception_ladder": [
      {
        "dimension": "长期安全",
        "level": "认可且推荐"
      },
      {
        "dimension": "维稳",
        "level": "认可"
      }
    ],
    "institution": {
      "formulary": "正常",
      "coverage_trend": "近 90 天提升",
      "supply_risk": "无"
    },
    "crm_code": "CY0822",
    "tags": [
      "目标客户"
    ],
    "gender": "男",
    "department": "皮肤科",
    "role": "主治医师",
    "grade": "等级-A-VA",
    "knowledge": {
      "dimensions": [
        {
          "name": "发病机制",
          "basic": "认可且推荐",
          "advanced": "认可"
        },
        {
          "name": "疾病负担",
          "basic": "认可",
          "advanced": "认可"
        },
        {
          "name": "治疗目标",
          "basic": "认可且推荐",
          "advanced": "认可"
        },
        {
          "name": "治疗策略",
          "basic": "认可",
          "advanced": "认可"
        }
      ],
      "advantages": [
        {
          "name": "一线",
          "level": "认可"
        },
        {
          "name": "DOT",
          "level": "认可"
        },
        {
          "name": "速效",
          "level": "认可"
        },
        {
          "name": "稳控",
          "level": "认可"
        },
        {
          "name": "对因治疗",
          "level": "认可"
        },
        {
          "name": "长期安全",
          "level": "认可且推荐"
        },
        {
          "name": "区隔JAK",
          "level": "认可"
        },
        {
          "name": "区隔CM310",
          "level": "不确定"
        }
      ]
    },
    "target_patients": [
      "青少年患者",
      "中度AD特殊部位",
      "传统用药可控制不佳"
    ],
    "material_delivery": {
      "title": "青少年与特殊部位 AD 沟通卡",
      "views": 14,
      "viewed_at": "2026-06-30 13:15:00"
    }
  }
];
