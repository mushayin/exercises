<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { parseLatex } from "../utils/latex";

const props = defineProps({
  visible: { type: Boolean, default: false },
});

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "insert", v: string): void;
}>();

const visible = ref(props.visible);

watch(
  () => props.visible,
  (v) => {
    visible.value = v;
  }
);

const textareaRef = ref<any>(null);
const latexValue = ref("");

// defaults - 常用公式预设
const defaultPresets = [
  {
    key: "quadratic",
    label: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
    tpl: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
    desc: "一元二次方程求根公式",
  },
  {
    key: "pythagoras",
    label: "a^2 + b^2 = c^2",
    tpl: "a^2 + b^2 = c^2",
    desc: "勾股定理",
  },
  {
    key: "circle",
    label: "(x - h)^2 + (y - k)^2 = r^2",
    tpl: "(x - h)^2 + (y - k)^2 = r^2",
    desc: "圆的标准方程",
  },
  {
    key: "derivative",
    label: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
    tpl: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
    desc: "导数定义",
  },
  {
    key: "integral",
    label: "\\int_{a}^{b} f(x) dx = F(b) - F(a)",
    tpl: "\\int_{a}^{b} f(x) dx = F(b) - F(a)",
    desc: "定积分基本定理",
  },
  {
    key: "euler",
    label: "e^{i\\pi} + 1 = 0",
    tpl: "e^{i\\pi} + 1 = 0",
    desc: "欧拉公式",
  },
  {
    key: "binomial",
    label: "(a + b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k",
    tpl: "(a + b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k",
    desc: "二项式定理",
  },
  {
    key: "taylor",
    label: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n",
    tpl: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n",
    desc: "泰勒级数",
  },
  {
    key: "sin_identity",
    label: "\\sin^2(x) + \\cos^2(x) = 1",
    tpl: "\\sin^2(x) + \\cos^2(x) = 1",
    desc: "三角恒等式",
  },
  {
    key: "log_product",
    label: "\\log(ab) = \\log(a) + \\log(b)",
    tpl: "\\log(ab) = \\log(a) + \\log(b)",
    desc: "对数乘法法则",
  },
  {
    key: "matrix",
    label: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
    tpl: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
    desc: "2×2矩阵",
  },
  {
    key: "sum_arithmetic",
    label: "S_n = \\frac{n(a_1 + a_n)}{2}",
    tpl: "S_n = \\frac{n(a_1 + a_n)}{2}",
    desc: "等差数列求和",
  },
  {
    key: "sum_geometric",
    label: "S_n = \\frac{a_1(1-q^n)}{1-q}",
    tpl: "S_n = \\frac{a_1(1-q^n)}{1-q}",
    desc: "等比数列求和",
  },
];

// 符号分组
const defaultSymbolGroups = [
  {
    label: "基础运算",
    items: [
      { label: "\\frac{a}{b}", tpl: "\\frac{}{}", desc: "分数" },
      { label: "\\sqrt{x}", tpl: "\\sqrt{}", desc: "平方根" },
      { label: "\\sqrt[n]{x}", tpl: "\\sqrt[]{}", desc: "n次根" },
      { label: "x^{n}", tpl: "^{}", desc: "上标/幂" },
      { label: "x_{n}", tpl: "_{}", desc: "下标" },
      { label: "x^{a}_{b}", tpl: "^{}_{}", desc: "上下标" },
      { label: "\\log", tpl: "\\log", desc: "对数" },
      { label: "\\ln", tpl: "\\ln", desc: "自然对数" },
      { label: "\\lg", tpl: "\\lg", desc: "常用对数" },
      { label: "\\log_{a}", tpl: "\\log_{}", desc: "底数为a的对数" },
      { label: "e^{x}", tpl: "e^{}", desc: "自然指数" },
      { label: "\\exp", tpl: "\\exp", desc: "指数函数" },
    ],
  },
  {
    label: "三角函数",
    items: [
      { label: "\\sin", tpl: "\\sin", desc: "正弦" },
      { label: "\\cos", tpl: "\\cos", desc: "余弦" },
      { label: "\\tan", tpl: "\\tan", desc: "正切" },
      { label: "\\cot", tpl: "\\cot", desc: "余切" },
      { label: "\\sec", tpl: "\\sec", desc: "正割" },
      { label: "\\csc", tpl: "\\csc", desc: "余割" },
      { label: "\\arcsin", tpl: "\\arcsin", desc: "反正弦" },
      { label: "\\arccos", tpl: "\\arccos", desc: "反余弦" },
      { label: "\\arctan", tpl: "\\arctan", desc: "反正切" },
      { label: "\\sinh", tpl: "\\sinh", desc: "双曲正弦" },
      { label: "\\cosh", tpl: "\\cosh", desc: "双曲余弦" },
      { label: "\\tanh", tpl: "\\tanh", desc: "双曲正切" },
    ],
  },

  {
    label: "微积分",
    items: [
      { label: "\\lim", tpl: "\\lim", desc: "极限" },
      { label: "\\lim_{x \\to a}", tpl: "\\lim_{x \\to }", desc: "极限趋向" },
      {
        label: "\\lim_{x \\to \\infty}",
        tpl: "\\lim_{x \\to \\infty}",
        desc: "极限趋向无穷",
      },
      { label: "f'(x)", tpl: "f'(x)", desc: "导数(一阶)" },
      { label: "f''(x)", tpl: "f''(x)", desc: "导数(二阶)" },
      { label: "\\frac{d}{dx}", tpl: "\\frac{d}{dx}", desc: "导数算子" },
      { label: "\\frac{dy}{dx}", tpl: "\\frac{dy}{dx}", desc: "导数记号" },
      {
        label: "\\frac{\\partial}{\\partial x}",
        tpl: "\\frac{\\partial}{\\partial x}",
        desc: "偏导数",
      },
      { label: "\\int", tpl: "\\int", desc: "不定积分" },
      { label: "\\int_{a}^{b}", tpl: "\\int_{}^{}", desc: "定积分" },
      { label: "\\iint", tpl: "\\iint", desc: "二重积分" },
      { label: "\\iiint", tpl: "\\iiint", desc: "三重积分" },
      { label: "\\oint", tpl: "\\oint", desc: "环路积分" },
      { label: "\\nabla", tpl: "\\nabla", desc: "梯度算子" },
    ],
  },
  {
    label: "集合求和",
    items: [
      { label: "\\sum", tpl: "\\sum", desc: "求和" },
      {
        label: "\\sum_{i=1}^{n}",
        tpl: "\\sum_{i=1}^{n}",
        desc: "求和(带范围)",
      },
      { label: "\\prod", tpl: "\\prod", desc: "连乘" },
      {
        label: "\\prod_{i=1}^{n}",
        tpl: "\\prod_{i=1}^{n}",
        desc: "连乘(带范围)",
      },
      { label: "\\coprod", tpl: "\\coprod", desc: "余积" },
      { label: "\\bigcup", tpl: "\\bigcup", desc: "并集(大)" },
      { label: "\\bigcap", tpl: "\\bigcap", desc: "交集(大)" },
      { label: "\\in", tpl: "\\in", desc: "属于" },
      { label: "\\notin", tpl: "\\notin", desc: "不属于" },
      { label: "\\ni", tpl: "\\ni", desc: "包含(元素)" },
      { label: "\\subset", tpl: "\\subset", desc: "子集" },
      { label: "\\subseteq", tpl: "\\subseteq", desc: "子集或等于" },
      { label: "\\supset", tpl: "\\supset", desc: "超集" },
      { label: "\\supseteq", tpl: "\\supseteq", desc: "超集或等于" },
      { label: "\\cup", tpl: "\\cup", desc: "并集" },
      { label: "\\cap", tpl: "\\cap", desc: "交集" },
      { label: "\\setminus", tpl: "\\setminus", desc: "差集" },
      { label: "\\emptyset", tpl: "\\emptyset", desc: "空集" },
      { label: "\\mathbb{N}", tpl: "\\mathbb{N}", desc: "自然数集" },
      { label: "\\mathbb{Z}", tpl: "\\mathbb{Z}", desc: "整数集" },
      { label: "\\mathbb{Q}", tpl: "\\mathbb{Q}", desc: "有理数集" },
      { label: "\\mathbb{R}", tpl: "\\mathbb{R}", desc: "实数集" },
      { label: "\\mathbb{C}", tpl: "\\mathbb{C}", desc: "复数集" },
    ],
  },
  {
    label: "关系符号",
    items: [
      { label: "=", tpl: "=", desc: "等于" },
      { label: "\\neq", tpl: "\\neq", desc: "不等于" },
      { label: "<", tpl: "<", desc: "小于" },
      { label: ">", tpl: ">", desc: "大于" },
      { label: "\\leq", tpl: "\\leq", desc: "小于等于" },
      { label: "\\geq", tpl: "\\geq", desc: "大于等于" },
      { label: "\\ll", tpl: "\\ll", desc: "远小于" },
      { label: "\\gg", tpl: "\\gg", desc: "远大于" },
      { label: "\\approx", tpl: "\\approx", desc: "约等于" },
      { label: "\\equiv", tpl: "\\equiv", desc: "恒等于" },
      { label: "\\sim", tpl: "\\sim", desc: "相似" },
      { label: "\\simeq", tpl: "\\simeq", desc: "渐近等于" },
      { label: "\\cong", tpl: "\\cong", desc: "全等" },
      { label: "\\propto", tpl: "\\propto", desc: "成比例" },
    ],
  },
  {
    label: "运算符号",
    items: [
      { label: "+", tpl: "+", desc: "加" },
      { label: "-", tpl: "-", desc: "减" },
      { label: "\\times", tpl: "\\times", desc: "乘" },
      { label: "\\div", tpl: "\\div", desc: "除" },
      { label: "\\pm", tpl: "\\pm", desc: "正负" },
      { label: "\\mp", tpl: "\\mp", desc: "负正" },
      { label: "\\cdot", tpl: "\\cdot", desc: "点乘" },
      { label: "\\ast", tpl: "\\ast", desc: "星号" },
      { label: "\\star", tpl: "\\star", desc: "五角星" },
      { label: "\\circ", tpl: "\\circ", desc: "圆圈" },
      { label: "\\bullet", tpl: "\\bullet", desc: "实心圆点" },
      { label: "\\oplus", tpl: "\\oplus", desc: "圈加" },
      { label: "\\ominus", tpl: "\\ominus", desc: "圈减" },
      { label: "\\otimes", tpl: "\\otimes", desc: "圈乘" },
      { label: "\\oslash", tpl: "\\oslash", desc: "圈除" },
    ],
  },
  {
    label: "括号",
    items: [
      { label: "()", tpl: "()", desc: "圆括号" },
      { label: "[]", tpl: "[]", desc: "方括号" },
      { label: "\\{\\}", tpl: "\\{\\}", desc: "花括号" },
      { label: "\\langle \\rangle", tpl: "\\langle \\rangle", desc: "角括号" },
      {
        label: "\\left( \\right)",
        tpl: "\\left( \\right)",
        desc: "自适应圆括号",
      },
      {
        label: "\\left[ \\right]",
        tpl: "\\left[ \\right]",
        desc: "自适应方括号",
      },
      {
        label: "\\left\\{ \\right\\}",
        tpl: "\\left\\{ \\right\\}",
        desc: "自适应花括号",
      },
      { label: "|x|", tpl: "|x|", desc: "绝对值" },
      {
        label: "\\left| \\right|",
        tpl: "\\left| \\right|",
        desc: "自适应绝对值",
      },
      { label: "\\lceil \\rceil", tpl: "\\lceil \\rceil", desc: "上取整" },
      { label: "\\lfloor \\rfloor", tpl: "\\lfloor \\rfloor", desc: "下取整" },
    ],
  },
  {
    label: "希腊字母(小写)",
    items: [
      { label: "\\alpha", tpl: "\\alpha", desc: "α" },
      { label: "\\beta", tpl: "\\beta", desc: "β" },
      { label: "\\gamma", tpl: "\\gamma", desc: "γ" },
      { label: "\\delta", tpl: "\\delta", desc: "δ" },
      { label: "\\epsilon", tpl: "\\epsilon", desc: "ε" },
      { label: "\\varepsilon", tpl: "\\varepsilon", desc: "ε(变体)" },
      { label: "\\zeta", tpl: "\\zeta", desc: "ζ" },
      { label: "\\eta", tpl: "\\eta", desc: "η" },
      { label: "\\theta", tpl: "\\theta", desc: "θ" },
      { label: "\\vartheta", tpl: "\\vartheta", desc: "θ(变体)" },
      { label: "\\iota", tpl: "\\iota", desc: "ι" },
      { label: "\\kappa", tpl: "\\kappa", desc: "κ" },
      { label: "\\lambda", tpl: "\\lambda", desc: "λ" },
      { label: "\\mu", tpl: "\\mu", desc: "μ" },
      { label: "\\nu", tpl: "\\nu", desc: "ν" },
      { label: "\\xi", tpl: "\\xi", desc: "ξ" },
      { label: "\\pi", tpl: "\\pi", desc: "π" },
      { label: "\\varpi", tpl: "\\varpi", desc: "π(变体)" },
      { label: "\\rho", tpl: "\\rho", desc: "ρ" },
      { label: "\\varrho", tpl: "\\varrho", desc: "ρ(变体)" },
      { label: "\\sigma", tpl: "\\sigma", desc: "σ" },
      { label: "\\varsigma", tpl: "\\varsigma", desc: "ς" },
      { label: "\\tau", tpl: "\\tau", desc: "τ" },
      { label: "\\upsilon", tpl: "\\upsilon", desc: "υ" },
      { label: "\\phi", tpl: "\\phi", desc: "φ" },
      { label: "\\varphi", tpl: "\\varphi", desc: "φ(变体)" },
      { label: "\\chi", tpl: "\\chi", desc: "χ" },
      { label: "\\psi", tpl: "\\psi", desc: "ψ" },
      { label: "\\omega", tpl: "\\omega", desc: "ω" },
    ],
  },
  {
    label: "其他符号",
    items: [
      { label: "\\vec{a}", tpl: "\\vec{}", desc: "向量箭头" },
      {
        label: "\\overrightarrow{AB}",
        tpl: "\\overrightarrow{}",
        desc: "向量箭头(长)",
      },
      { label: "\\infty", tpl: "\\infty", desc: "无穷大" },
      { label: "\\partial", tpl: "\\partial", desc: "偏导符号" },
      { label: "!", tpl: "!", desc: "阶乘" },
      { label: "n!", tpl: "!", desc: "n的阶乘" },
      { label: "\\binom{n}{k}", tpl: "\\binom{}{}", desc: "二项式系数" },
      { label: "\\perp", tpl: "\\perp", desc: "垂直" },
      { label: "\\parallel", tpl: "\\parallel", desc: "平行" },
      { label: "\\angle", tpl: "\\angle", desc: "角" },
      { label: "\\triangle", tpl: "\\triangle", desc: "三角形" },
      { label: "\\degree", tpl: "^\\circ", desc: "度数符号" },
      { label: "\\%", tpl: "\\%", desc: "百分号" },
      { label: "\\ldots", tpl: "\\ldots", desc: "省略号(低)" },
      { label: "\\cdots", tpl: "\\cdots", desc: "省略号(中)" },
      { label: "\\vdots", tpl: "\\vdots", desc: "省略号(竖)" },
      { label: "\\ddots", tpl: "\\ddots", desc: "省略号(斜)" },
      { label: "\\forall", tpl: "\\forall", desc: "对于所有" },
      { label: "\\exists", tpl: "\\exists", desc: "存在" },
      { label: "\\nexists", tpl: "\\nexists", desc: "不存在" },
      { label: "\\neg", tpl: "\\neg", desc: "否定" },
      { label: "\\land", tpl: "\\land", desc: "逻辑与" },
      { label: "\\lor", tpl: "\\lor", desc: "逻辑或" },
      { label: "\\implies", tpl: "\\implies", desc: "蕴含" },
      { label: "\\iff", tpl: "\\iff", desc: "当且仅当" },
      { label: "\\to", tpl: "\\to", desc: "映射到" },
      { label: "\\rightarrow", tpl: "\\rightarrow", desc: "右箭头" },
      { label: "\\leftarrow", tpl: "\\leftarrow", desc: "左箭头" },
      { label: "\\leftrightarrow", tpl: "\\leftrightarrow", desc: "双向箭头" },
      { label: "\\Rightarrow", tpl: "\\Rightarrow", desc: "右双箭头" },
      { label: "\\Leftarrow", tpl: "\\Leftarrow", desc: "左双箭头" },
      {
        label: "\\Leftrightarrow",
        tpl: "\\Leftrightarrow",
        desc: "双向双箭头",
      },
    ],
  },
];

const presets = computed(() => defaultPresets);
const symbolGroups = computed(() => defaultSymbolGroups);

function close() {
  visible.value = false;
  emit("update:visible", false);
}

function insertInline() {
  // 向父组件发送消息
  emit("insert", `$${latexValue.value}$`);
  latexValue.value = "";
  close();
}

const previewHtml = computed(() => {
  return parseLatex(latexValue.value);
});

function insertTemplate(t: string) {
  const el = textareaRef.value?.$el || textareaRef.value;
  const textarea =
    el?.tagName === "TEXTAREA" ? el : el?.querySelector("textarea");

  if (textarea) {
    const start = textarea.selectionStart ?? latexValue.value.length;
    const end = textarea.selectionEnd ?? latexValue.value.length;
    const before = latexValue.value.slice(0, start);
    const after = latexValue.value.slice(end);
    latexValue.value = before + t + after;

    // try place cursor inside first {}
    let cursorPos = start + t.length;
    const firstBraceIndex = t.indexOf("{}");
    if (firstBraceIndex >= 0) cursorPos = start + firstBraceIndex + 1;
    else {
      const firstCurly = t.indexOf("{");
      if (firstCurly >= 0) cursorPos = start + firstCurly + 1;
    }

    nextTick(() => {
      textarea.focus();
      try {
        textarea.setSelectionRange(cursorPos, cursorPos);
      } catch (e) {
        /* ignore */
      }
    });
    return;
  }
  latexValue.value += t;
}

// presets watch: removed, now using direct button clicks
</script>

<template>
  <a-modal
    v-model:open="visible"
    title="LaTeX 公式编辑器"
    width="900px"
    :maskClosable="false"
    centered
  >
    <template #footer>
      <a-space>
        <a-button @click="close">取消</a-button>
        <a-button
          type="primary"
          @click="insertInline"
          :disabled="!latexValue.trim()"
          >插入公式</a-button
        >
      </a-space>
    </template>

    <div class="latex-editor-root">
      <a-space direction="vertical" size="large" style="width: 100%">
        <!-- 符号工具栏 -->
        <a-card title="快捷符号" size="small" :body-style="{ padding: '12px' }">
          <a-tabs type="card" size="small">
            <a-tab-pane
              v-for="(g, gi) in symbolGroups"
              :key="gi"
              :tab="g.label"
            >
              <a-space wrap size="small">
                <a-tooltip
                  v-for="(it, ii) in g.items"
                  :key="ii"
                  :title="it.desc"
                >
                  <a-button
                    class="laxtex-symbel"
                    size="small"
                    @click="insertTemplate(it.tpl)"
                  >
                    <span v-html="parseLatex(it.label)"></span>
                  </a-button>
                </a-tooltip>
              </a-space>
            </a-tab-pane>
          </a-tabs>
        </a-card>

        <!-- 预设公式 -->
        <a-card title="常用公式" size="small" :body-style="{ padding: '12px' }">
          <a-space wrap size="small">
            <a-tooltip v-for="p in presets" :key="p.key" :title="p.desc">
              <a-button
                class="laxtex-symbel"
                size="small"
                @click="insertTemplate(p.tpl)"
              >
                <span v-html="parseLatex(p.label)"></span>
              </a-button>
            </a-tooltip>
          </a-space>
        </a-card>

        <!-- 输入区域 -->
        <a-card size="small" :body-style="{ padding: 0 }">
          <template #title>
            <a-space>
              <span>LaTeX 输入</span>
              <a-tag color="blue" v-if="latexValue.length"
                >{{ latexValue.length }} 字符</a-tag
              >
            </a-space>
          </template>
          <a-textarea
            ref="textareaRef"
            v-model:value="latexValue"
            placeholder="输入 LaTeX 代码（不需要包裹 $ 符号）&#10;示例：\frac{1}{2} 或 x^{2} + y^{2} = r^{2}"
            :rows="8"
            :auto-size="{ minRows: 4, maxRows: 15 }"
            style="
              font-family: 'Consolas', 'Monaco', monospace;
              font-size: 14px;
            "
          />
        </a-card>

        <!-- 预览区域 -->
        <a-card
          title="实时预览"
          size="small"
          :body-style="{
            padding: '16px',
            minHeight: '60px',
            background: '#fafafa',
          }"
        >
          <a-empty
            v-if="!previewHtml || !previewHtml.length"
            description="在上方输入 LaTeX 代码，这里将实时显示渲染效果"
          >
          </a-empty>
          <div v-else class="preview-content" v-html="previewHtml"></div>
        </a-card>
      </a-space>
    </div>
  </a-modal>
</template>

<style scoped>
.latex-editor-root {
  padding: 8px 0;
}

.preview-content {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
  padding: 16px;
  background: #ffffff;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.preview-content :deep(.katex) {
  font-size: 1.2em;
}

.preview-content :deep(.katex-display) {
  margin: 12px 0;
}

/* Textarea 样式优化 */
:deep(.ant-input) {
  font-family: "Consolas", "Monaco", "Courier New", monospace !important;
}

/* 标签页样式微调 */
:deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab) {
  background: #fafafa;
  border-color: #f0f0f0;
}

:deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active) {
  background: #fff;
  border-bottom-color: #fff;
}

/* 按钮内公式渲染样式优化 */
:deep(.ant-btn.laxtex-symbel) {
  height: initial;
  padding: 4px 8px;
}
</style>
