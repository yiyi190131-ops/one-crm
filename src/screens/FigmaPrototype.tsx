"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";

const A = "/figma/proto/";
const FEEDBACK =
  "嗯，今天跟刘医生的拜访结束了，整体聊得还不错。首先关于产品的关键信息反馈，刘医生对达必妥的长期安全性这块儿还是比较认可的，觉得这方面数据比较充分。不过他提到对稳控效果还存在一些疑虑，可能需要更多的临床证据。";
const FOLLOWUP =
  "他还特别问了一个问题，就是他最近接诊了几个青少年患者，想了解一下我们产品在这个年龄段的适用情况。对了，他还问我能不能用在银屑病患者上。他这有位一直来随访的患者叫陈国庆，是住在静安区延平路123号的一位退休老干部。最后关于下次拜访，刘医生说下周四下午有时间。";

type Screen = "pre" | "records" | "recommend" | "hospital" | "aid" | "post";
type PostStage = "idle" | "parsing1" | "ladder" | "follow" | "parsing2" | "todo" | "confirm" | "done";

export function FigmaPrototype() {
  const [screen, setScreen] = useState<Screen>("pre");
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [postStage, setPostStage] = useState<PostStage>("idle");
  const [todo, setTodo] = useState<"adopt" | "ignore" | null>(null);
  const [shared, setShared] = useState(false);
  const [aidNote, setAidNote] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" });
  }, [screen, postStage, todo, shared]);

  function goPre() {
    setScreen("pre");
    setPostStage("idle");
    setTodo(null);
    setShared(false);
    setAidNote(null);
    setInput("");
  }

  function sendPre(text = input) {
    const q = text.trim();
    if (!q) return;
    setInput("");
    if (q.includes("互动")) setScreen("records");
    else if (q.includes("材料") || q.includes("JAK") || q.includes("推送")) setScreen("recommend");
    else setScreen("hospital");
  }

  function sendPost(text = input) {
    const q = text.trim();
    if (!q && postStage !== "idle" && postStage !== "follow") return;
    setInput("");
    setListening(false);
    if (postStage === "idle") setPostStage("parsing1");
    else if (postStage === "follow") setPostStage("parsing2");
    window.setTimeout(() => {
      setPostStage((s) => (s === "parsing1" ? "ladder" : s === "parsing2" ? "todo" : s));
    }, 700);
  }

  function voice() {
    if (listening) {
      setListening(false);
      return;
    }
    setListening(true);
    const sample = screen === "post" && (postStage === "follow" || postStage === "todo") ? FOLLOWUP : FEEDBACK;
    window.setTimeout(() => {
      setListening(false);
      setInput(sample);
    }, 900);
  }

  const concierge = screen === "post";
  const showSubmit = screen === "post" && postStage !== "done";
  const scrollClass =
    screen === "aid" ? "proto-scroll aid" : screen === "post" && postStage === "done" ? "proto-scroll done" : "proto-scroll";

  return (
    <div className="proto-page">
      <section className="proto-phone">
        {screen !== "aid" && (
          <header className="proto-top">
            {concierge ? (
              <img className="logo" src={`${A}concierge.svg`} alt="Concierge" />
            ) : (
              <h1>OneCRM</h1>
            )}
          </header>
        )}

        <div className={scrollClass} ref={scrollRef}>
          {screen === "pre" && <PreBrief onAsk={sendPre} onStart={() => setScreen("aid")} />}
          {screen === "records" && <Records />}
          {screen === "recommend" && <Recommend shared={shared} onShare={() => setShared(true)} />}
          {screen === "hospital" && <Hospital />}
          {screen === "aid" && (
            <Aid
              note={aidNote}
              onBack={goPre}
              onShare={() => setAidNote("已生成合规分享草稿，请在企业微信中确认发送。")}
              onRemote={() => setAidNote("远程拜访链接已生成（演示）。")}
              onSubmit={() => {
                setScreen("post");
                setPostStage("idle");
              }}
            />
          )}
          {screen === "post" && (
            <Post
              stage={postStage}
              todo={todo}
              onConfirmLadder={() => setPostStage("follow")}
              onTodo={setTodo}
              onConfirm={() => setPostStage("done")}
              onCancel={() => setPostStage("todo")}
            />
          )}
        </div>

        {screen !== "aid" && postStage !== "done" && (
          <Composer
            value={input}
            listening={listening}
            showSubmit={showSubmit}
            onChange={setInput}
            onVoice={voice}
            onSend={() => (screen === "post" ? sendPost() : sendPre())}
            onSubmitVisit={() => setPostStage("confirm")}
          />
        )}
        {screen === "post" && postStage === "done" && (
          <>
            <button className="proto-btn lg" style={{ position: "absolute", left: 16, bottom: 16 }} onClick={goPre}>
              返回首页
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function PreBrief({ onAsk, onStart }: { onAsk: (q: string) => void; onStart: () => void }) {
  return (
    <>
      <p className="proto-copy">👋 欢迎使用访前助手！</p>
      <ul className="proto-list proto-copy">
        <li>
          当前内容围绕<b>达必妥</b>展开。该医生还负责赛益宁，如需查看相关内容可以告诉我。
        </li>
      </ul>
      <hr className="proto-rule" />
      <p className="proto-copy">📌 上次拜访（6月8日）</p>
      <ul className="proto-list proto-copy">
        <li>使用材料：中度AD心血管共病</li>
        <li>拜访反馈：对“心血管共病”不认可</li>
        <li>
          当前观念阶梯<b>：试用者</b>
        </li>
      </ul>
      <p className="proto-copy" style={{ marginTop: 12 }}>
        🎯 <b>本次拜访重点：</b>
      </p>
      <ul className="proto-list proto-copy">
        <li>
          上次拜访中，<b>医生想了解达必妥在中度AD心血管共病患者中的治疗方案</b>，请查阅相关资料
          <a>：「达必妥与JAK抑制剂安全性对比研究（2026）」</a>
        </li>
        <li>
          11月14日中国医师协会皮肤科医师分会年会即将召开，<b>可询问医生是否有意向参会</b>，提前做好会议跟进安排。
        </li>
      </ul>
      <hr className="proto-rule" />
      <p className="proto-copy">💡 该医生学术需求较高，近期拜访效果较好，建议交流疾病信息。</p>
      <div className="proto-quote">
        <i />
        <span>“主任，最近有份关于中度AD合并2型炎症共病的学术资料，跟您快速介绍下里面的临床数据和治疗思路。”</span>
      </div>
      <article className="proto-card">
        <div className="proto-material">
          <img src={`${A}ad-cover.png`} alt="" />
          <section>
            <p>中度AD 2型炎症共病</p>
            <div className="proto-tags">
              <span>标签1</span>
              <span>标签2</span>
            </div>
          </section>
        </div>
        <button className="proto-btn" onClick={onStart}>
          开启面对面拜访
        </button>
      </article>
      <div className="proto-chips">
        <button className="proto-chip" onClick={() => onAsk("该医生最近有哪些互动记录？")}>
          该医生最近有哪些互动记录？
          <img src={`${A}arrow.svg`} alt="" />
        </button>
        <button className="proto-chip" onClick={() => onAsk("有其他合适的拜访材料吗？")}>
          有其他合适的拜访材料吗？
          <img src={`${A}arrow.svg`} alt="" />
        </button>
        <button className="proto-chip" onClick={() => onAsk("该医生所在机构的进药状态/安全运营如何？")}>
          该医生所在机构的进药状态/安全运营如何？
          <img src={`${A}arrow.svg`} alt="" />
        </button>
      </div>
    </>
  );
}

function Records() {
  return (
    <>
      <div className="proto-user">该医生最近有哪些互动记录？</div>
      <div className="proto-status-line">
        <img src={`${A}parsed.svg`} alt="" />
        解析已完成
      </div>
      <p className="proto-copy">
        👤 当前观念阶梯：<b>试用者</b>（近3个月保持不变）
      </p>
      <p className="proto-copy" style={{ marginTop: 12 }}>
        📈 近1个月互动概览
      </p>
      <div className="proto-table">
        <div className="head">
          <span>互动类型</span>
          <span>互动次数</span>
        </div>
        <div>
          <span>面对面拜访</span>
          <span>3</span>
        </div>
        <div>
          <span>资料投递</span>
          <span>1</span>
        </div>
        <div>
          <span>参会次数</span>
          <span>1</span>
        </div>
      </div>
      <p className="proto-copy" style={{ marginTop: 16 }}>
        📋 详细互动记录
      </p>
      <div className="proto-timeline">
        <div className="proto-event">
          <b>2026/05/03 | 面对面拜访</b>
          <div className="box">
            <p>
              <em>拜访材料：</em>使用者及以上（中度AD 2型炎症共病）
            </p>
            <p>
              <em>医生反馈：</em>对“心血管共病”不认可
            </p>
          </div>
        </div>
        <div className="proto-event">
          <b>2026/05/03 | 企业文章推送</b>
          <div className="box">
            <p>
              <em>推送文章：</em>循证为帆，共启新春 | 小菲e学2025年度回顾
            </p>
            <p>
              <em>阅读状态：</em>未打开
            </p>
          </div>
        </div>
        <div className="proto-event">
          <b>2026/04/05 | 会议参与</b>
          <div className="box">
            <p>
              <em>参加会议：</em>2026中国医师协会皮肤科医师分会年会
            </p>
            <p>
              <em>参会角色：</em>听者
            </p>
          </div>
        </div>
      </div>
      <p className="proto-copy" style={{ marginTop: 16 }}>
        💡 跟进建议
      </p>
      <ul className="proto-list proto-copy">
        <li>该医生线上内容打开率低，企微文章推送效果不佳，建议以面对面拜访为主要沟通方式。</li>
      </ul>
    </>
  );
}

function Recommend({ shared, onShare }: { shared: boolean; onShare: () => void }) {
  return (
    <>
      <div className="proto-user">
        医生对JAK抑制剂使用比较赞同，我应该推送什么内容给他？
      </div>
      <div className="proto-status-line">
        <img src={`${A}parsed.svg`} alt="" />
        解析已完成
      </div>
      <p className="proto-copy">💡 推荐分享以下文章，帮助医生全面了解两类药物的安全性差异：</p>
      <div className="proto-quote">
        <i />
        <span>
          “李主任，JAK抑制剂的疗效确实有目共睹，这一点我们完全认可。不过最新安全性研究显示，JAK抑制剂的血栓风险明显高于达必妥，特别是肺栓塞和深静脉血栓。对于心血管共病患者，这个风险差异值得重点考虑。”
        </span>
      </div>
      <article className="proto-card article">
        <div className="proto-material">
          <img src={`${A}ad-cover.png`} alt="" />
          <p>特皮新视野 | 特应性皮炎系统治疗的安全性评估：JAK抑制剂相较于度普利尤单抗显著增加肺栓塞和深静脉血栓风险</p>
        </div>
        <button className="proto-btn" onClick={onShare}>
          {shared ? "已生成分享草稿" : "去分享"}
        </button>
      </article>
      {shared && <p className="proto-note">已生成合规分享草稿，请在企业微信中确认发送。</p>}
      <div className="proto-user" style={{ marginTop: 16 }}>
        李主任下周二在医院有门诊吗？
      </div>
      <div className="proto-status-line">
        <img src={`${A}parsed.svg`} alt="" />
        解析已完成
      </div>
      <p className="proto-copy">这个问题暂时超出了我的能力范围，但我已经记录下来，我们会持续优化。</p>
      <p className="proto-copy">目前，我可以帮您：</p>
      <p className="proto-copy">🔍 医生信息查询</p>
      <p className="proto-copy">📝 拜访历史回顾</p>
      <p className="proto-copy">🎯 智能拜访建议</p>
      <p className="proto-copy">🏥 进院状态查询</p>
    </>
  );
}

function Hospital() {
  return (
    <>
      <div className="proto-user">该医生所在机构的进药状态/安全运营如何？</div>
      <div className="proto-status-line">
        <img src={`${A}parsed.svg`} alt="" />
        解析已完成
      </div>
      <p className="proto-copy">🏥 瑞金医院皮肤科 · 达必妥进院状态</p>
      <ul className="proto-list proto-copy">
        <li>
          当前进药状态：<b>已进院，可正常开具</b>
        </li>
        <li>安全运营：近 90 日无超适应症预警，拜访材料均来自已审批版本。</li>
      </ul>
      <p className="proto-copy" style={{ marginTop: 12 }}>
        💡 建议在本次拜访中确认科室库存与会诊协同，不讨论未批准适应症。
      </p>
    </>
  );
}

function Aid({
  note,
  onBack,
  onShare,
  onRemote,
  onSubmit,
}: {
  note: string | null;
  onBack: () => void;
  onShare: () => void;
  onRemote: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="proto-aid-head">
        <button aria-label="返回" onClick={onBack}>
          <img src={`${A}aid-back.svg`} alt="" />
        </button>
        <div className="pill">
          <img src={`${A}aid-icon.png`} alt="" />
          拜访材料
        </div>
      </div>
      <div className="proto-aid-body">
        <h2>达必妥®优势一：持久控制</h2>
        <img className="chart" src={`${A}dbt-1.png`} alt="EAS-75 / EASI-90 应答曲线" />
        <img className="chart" src={`${A}dbt-2.png`} alt="对照研究柱状图" />
        {note && <p className="proto-note">{note}</p>}
      </div>
      <nav className="proto-aid-bar">
        <button onClick={onShare}>
          <img src={`${A}share.svg`} alt="" />
          分享
        </button>
        <button onClick={onRemote}>
          <img src={`${A}remote.svg`} alt="" />
          远程拜访
        </button>
        <button onClick={onSubmit}>
          <img src={`${A}check.svg`} alt="" />
          提交
        </button>
      </nav>
    </>
  );
}

function Post({
  stage,
  todo,
  onConfirmLadder,
  onTodo,
  onConfirm,
  onCancel,
}: {
  stage: PostStage;
  todo: "adopt" | "ignore" | null;
  onConfirmLadder: () => void;
  onTodo: (v: "adopt" | "ignore") => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <p className="proto-copy">
        拜访记录已为您准备就绪：
        <br />
        日期：2026-04-07
        <br />
        客户：宋雯
        <br />
        产品：达必妥
        <br />
        材料1：无需筛查,即刻起始
        <br />
        展示时长：136秒
      </p>
      <p className="proto-copy">
        我想了解一下，这次您和医生讨论达必妥时，他对于产品有什么反馈，<b>观念阶梯是否有变化</b>
        ？（比如长期安全、维稳等）
      </p>
      {stage !== "idle" && (
        <div className="proto-user" style={{ marginTop: 16, maxWidth: 335, marginLeft: 0, marginRight: "auto" }}>
          {FEEDBACK}
        </div>
      )}
      {(stage === "parsing1" || stage === "ladder" || after(stage, "ladder")) && (
        <div className="proto-status-line">
          <img src={`${A}parsed.svg`} alt="" />
          {stage === "parsing1" ? "正在解析拜访细节..." : "解析已完成"}
        </div>
      )}
      {after(stage, "ladder") && (
        <article className="proto-km">
          <p>收到！感谢您的反馈 👍 根据您的记录，我将整理并更新本次拜访所收集到的关键信息对于医生洞察进行更新：</p>
          <p className="proto-km-row">
            <img src={`${A}km-icon.svg`} alt="" width={16} height={16} style={{ verticalAlign: "middle", marginRight: 4 }} />
            <span>关键信息1：</span>长期安全
          </p>
          <FaceRow active="认可" />
          <p className="proto-km-row">
            <img src={`${A}km-icon.svg`} alt="" width={16} height={16} style={{ verticalAlign: "middle", marginRight: 4 }} />
            <span>关键信息2：</span>维稳
          </p>
          <FaceRow active="中立" />
          {stage === "ladder" ? (
            <button className="proto-btn" onClick={onConfirmLadder}>
              确认并提交
            </button>
          ) : (
            <p className="proto-note">已提交</p>
          )}
        </article>
      )}
      {after(stage, "follow") && (
        <p className="proto-copy" style={{ marginTop: 16 }}>
          非常感谢您提供的信息！在您的拜访过程中，刘医生是否提及了下次拜访时间或者任何感兴趣的产品资料？
        </p>
      )}
      {after(stage, "parsing2") && (
        <div className="proto-user proto-privacy" style={{ maxWidth: 335 }}>
          他还特别问了一个问题，就是他最近接诊了几个青少年患者……对了，他还问我能不能用在<mark>银屑病</mark>
          患者上。他这有位一直来随访的患者叫<mark>陈国庆</mark>，是住在<mark>静安区延平路123号</mark>
          的一位退休老干部。最后关于下次拜访，刘医生说下周四下午有时间。
        </div>
      )}
      {stage === "parsing2" && (
        <div className="proto-status-line">
          <img src={`${A}parsed.svg`} alt="" />
          正在解析拜访细节...
        </div>
      )}
      {after(stage, "todo") && (
        <>
          <div className="proto-status-line">
            <img src={`${A}parsed.svg`} alt="" />
            解析已完成。检测到您的输入涉及潜在病人隐私风险，相关表述已标记高亮，系统将忽略该信息。
          </div>
          <article className="proto-todo">
            <p>已识别到了潜在的后续拜访计划。系统将为您记录在“待办任务”中，并在对应的日程中展示。您可以选择采纳或忽略该建议。</p>
            <div className="row">
              <span>拜访日期</span>下周四下午
            </div>
            <div className="row">
              <span>拜访材料</span>发病机制 / 真实世界研究
            </div>
            {todo ? (
              <p className="proto-note">
                {todo === "adopt"
                  ? "您的建议已被采纳，系统将在对应的日程中展示“待办任务”。请留意 首页-待办任务。"
                  : "已为您忽略此建议。"}
              </p>
            ) : (
              <div className="actions">
                <button onClick={() => onTodo("ignore")}>忽略</button>
                <button className="primary" onClick={() => onTodo("adopt")}>
                  采纳
                </button>
              </div>
            )}
          </article>
          {todo && (
            <>
              <p className="proto-copy" style={{ marginTop: 16 }}>
                已根据您提到的刘医生所关心的“发病机制”相关内容，为您安排了以下相关推荐文章
              </p>
              <article className="proto-card article">
                <div className="proto-material">
                  <img src={`${A}ad-cover.png`} alt="" />
                  <p>特皮新视野 | 真实世界新证：度普利尤单抗有助于改善AD患儿生长发育</p>
                </div>
                <button className="proto-btn">去分享</button>
              </article>
            </>
          )}
        </>
      )}
      {stage === "confirm" && (
        <div className="proto-confirm">
          <p>信息提交后将结束本次拜访，确认现在要提交吗？</p>
          <div className="actions">
            <button onClick={onCancel}>再想想</button>
            <button className="primary" onClick={onConfirm}>
              提交
            </button>
          </div>
        </div>
      )}
      {stage === "done" && (
        <>
          <div className="proto-user" style={{ width: 88, padding: 16 }}>
            提交拜访
          </div>
          <div className="proto-confirm">
            <p>信息提交后将结束本次拜访，确认现在要提交吗？</p>
            <button className="proto-btn" disabled>
              已提交
            </button>
          </div>
          <p className="proto-copy" style={{ marginTop: 16 }}>
            本次拜访相关信息已被记录，拜访进度预期将于明天准时更新。
          </p>
        </>
      )}
    </>
  );
}

function FaceRow({ active }: { active: "中立" | "认可" | "认可且推荐" }) {
  return (
    <div className="proto-faces">
      {(["中立", "认可", "认可且推荐"] as const).map((label, i) => (
        <span key={label} className={`proto-face${active === label ? " on" : ""}`}>
          <b>{["😞", "😐", "😄"][i]}</b>
          {label}
        </span>
      ))}
    </div>
  );
}

function Composer({
  value,
  listening,
  showSubmit,
  onChange,
  onVoice,
  onSend,
  onSubmitVisit,
}: {
  value: string;
  listening: boolean;
  showSubmit: boolean;
  onChange: (v: string) => void;
  onVoice: () => void;
  onSend: () => void;
  onSubmitVisit: () => void;
}) {
  return (
    <footer className={`proto-composer${showSubmit ? " has-submit" : ""}`}>
      {showSubmit && (
        <button className="submit" onClick={onSubmitVisit}>
          <img src={`${A}check.svg`} alt="" />
          提交拜访
        </button>
      )}
      <div className={`proto-input${listening ? " listening" : ""}`}>
        <textarea
          aria-label="发消息"
          value={value}
          placeholder={listening ? "正在听写…" : "发消息给拜访助手"}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (value.trim()) onSend();
            }
          }}
        />
        <button className={`mic${listening ? " on" : ""}`} aria-label={listening ? "结束语音录入" : "语音录入"} onClick={onVoice}>
          <img src={`${A}mic.svg`} alt="" />
        </button>
        <button className="send" aria-label="发送" disabled={!value.trim()} onClick={onSend}>
          <img src={`${A}arrow.svg`} alt="" />
        </button>
      </div>
      <p className="proto-foot">{listening ? "正在听写，再次点击麦克风结束" : "AI生成内容仅供参考"}</p>
    </footer>
  );
}

function after(stage: PostStage, target: PostStage) {
  const order: PostStage[] = ["idle", "parsing1", "ladder", "follow", "parsing2", "todo", "confirm", "done"];
  return order.indexOf(stage) >= order.indexOf(target);
}
