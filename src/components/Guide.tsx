import { useEffect } from 'react';
import { create } from 'zustand';

/** How to use the studio: opened from 说明 in the top bar (or the masthead on phones). */
export const useGuide = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }));

const SECTIONS: Array<{ title: string; en: string; items: Array<[string, string]> }> = [
  {
    title: '选一台机器', en: 'Pick a machine',
    items: [
      ['目录', '右上角“目录”打开全部机器一览，点卡片进入。'],
      ['分组', '左栏上方按“基础机构 / 日常器物 / 动力传动 / 大型装备”分组；手机上是一排可以左右滑的机器名。'],
      ['搜索', '搜索框可以查任何机器、任何层级里的零件，如“刹车盘”“活塞环”，回车直接跳过去并对准它。'],
    ],
  },
  {
    title: '看它怎么工作', en: 'How it works',
    items: [
      ['讲解步骤', '左栏的 01、02、03……是讲解步骤，点一步，画面就切到对应的状态（剖开、转动、选中关键零件）。'],
      ['运转', '“运转 / 暂停”让机器动起来或停住。'],
      ['专属控件', '有些机器有自己的按钮：变速箱换档、直升机飞行状态、747 的停机 / 起飞 / 巡航 / 着陆……旁边有一句话说明在看什么。'],
    ],
  },
  {
    title: '拆开', en: 'Take it apart',
    items: [
      ['拆解滑杆', '从 0% 拖到 100%，零件按真实的拆卸顺序一个个散开，螺栓沿自己的轴线退出。'],
      ['逐步拆解', '滑杆下的 ‹ › 一次拆一个零件，并写出这一步拆的是什么。'],
      ['局部展开', '选中零件后点“局部展开”，只拆它和它周围的零件。'],
      ['逐级深入', '零件名后带 ▸ 的本身是一个组件：选中后点“拆开此组件”进去继续拆；标题上方的路径可以一级级返回。“全部展开”把所有子组件拉到旁边一起拆开。'],
    ],
  },
  {
    title: '看里面', en: 'Look inside',
    items: [
      ['剖视', '打开“剖视”，机器沿中线被切开，切口是浅色的剖面。下面会多出“剖切”滑块：往左只切掉表面一层，往右越切越深，50% 正好是中线。'],
      ['标注', '“标注”显示 / 隐藏零件编号；鼠标移到编号上会显示零件名。'],
    ],
  },
  {
    title: '零件', en: 'Parts',
    items: [
      ['选中', '点画面里的零件，或右下角零件明细里的一行，弹出说明卡：名称、作用、材料和一段说明。'],
      ['隐藏 / 只看它', '说明卡里可以把零件藏起来，或只显示它一个；明细表里灰掉的行点一下就显示回来。'],
      ['对准与大小', '“对准”把镜头转过去对着它；“大小”放大缩小这个零件看细节。'],
      ['挪动', '打开“挪动”后按住零件拖到别处。'],
    ],
  },
  {
    title: '视图', en: 'Views',
    items: [
      ['透视', '默认的线稿立体图，拖动旋转、滚轮缩放。'],
      ['三视图', '按国标第一角画法排出主视、俯视、左视和轴测图；“虚线”显示看不见的轮廓，“投影”在悬停时画出长对正、高平齐、宽相等。'],
      ['主视 / 俯视', '正对着看的单个视图。'],
    ],
  },
  {
    title: '复位、配色与导出', en: 'Reset, theme, export',
    items: [
      ['复位', '合拢所有零件，撤销挪动、缩放和隐藏，回到第一步，停在当前视图。'],
      ['蓝图', '在纸面线稿和工程蓝图（深蓝底、浅色线条）之间切换，会记住你的选择。'],
      ['导出', '图版 PNG（带编号、明细表、标题栏的 A4 爆炸图）、拆装动画（WebM 视频）、零件数据（JSON）。'],
    ],
  },
  {
    title: '分享', en: 'Share',
    items: [
      ['链接', '地址栏会跟着当前组件和选中的零件变化，例如 #b747/wheel/rotors，复制发给别人就能打开同一个画面。'],
    ],
  },
];

const KEYS: Array<[string, string]> = [
  ['/', '搜索零件'],
  ['← →', '上一步 / 下一步拆解'],
  ['F', '镜头对准选中的零件'],
  ['Esc', '取消选择，关闭弹窗'],
  ['拖动', '旋转（手机：单指）'],
  ['滚轮', '缩放（手机：双指）'],
];

export function Guide() {
  const { open, set } = useGuide();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') set(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, set]);
  if (!open) return null;
  return (
    <div className="catalogue guide" role="dialog" aria-label="使用说明" onClick={() => set(false)}>
      <div className="catalogue-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="catalogue-head">
          <div>
            <p className="catalogue-kicker">GUIDE · 使用说明</p>
            <h2>怎么用格物</h2>
          </div>
          <button type="button" className="catalogue-close" onClick={() => set(false)} aria-label="关闭">×</button>
        </header>
        <p className="guide-lead">每台机器都可以转着看、剖开看、一步步拆开看，还能一级级拆进它的子组件。下面按使用顺序说明。</p>
        <div className="guide-grid">
          {SECTIONS.map((s, i) => (
            <section key={s.title} className="guide-section">
              <h3><span className="guide-num">{String(i + 1).padStart(2, '0')}</span>{s.title}<span className="guide-en">{s.en}</span></h3>
              <dl>
                {s.items.map(([term, text]) => (
                  <div key={term} className="guide-item"><dt>{term}</dt><dd>{text}</dd></div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <section className="guide-keys">
          <h3>快捷键与手势</h3>
          <ul>
            {KEYS.map(([k, what]) => <li key={k}><kbd>{k}</kbd>{what}</li>)}
          </ul>
        </section>
        <p className="catalogue-foot">Esc 或点空白处关闭 · 随时可以从右上角“说明”回到这里</p>
      </div>
    </div>
  );
}
