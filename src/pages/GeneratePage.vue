<script setup lang="ts">
import { ref, computed } from "vue";
import { watch } from "vue";
import store, { filterQuestionsByTags, TagType } from "../store";
import { notification } from "ant-design-vue";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { saveAs } from "../utils/file-saver";
import { parseLatex } from "../utils/latex";
import { latexToMath } from "../utils/latex-to-math";

const groups = ref([
  {
    name: "",
    selectors: {} as Record<string, any>,
    count: 1,
    results: [] as any[],
  },
]);
const showAnswers = ref(false);
const showTags = ref(true);

// 下拉框容器设置函数
const getPopupContainer = (trigger: HTMLElement) =>
  trigger.parentElement || document.body;

const tags = computed(() => store.state.tags);

const optionalOptions = computed(() =>
  tags.value.map((t: any) => ({
    label: t.name,
    value: t.id,
    disabled: t.required,
  }))
);

const enabledTags = ref(
  tags.value.filter((t: any) => t.required).map((t: any) => t.id)
);

watch(
  () => tags.value.slice(),
  () => {
    for (const t of tags.value) {
      if (t.required && !enabledTags.value.includes(t.id))
        enabledTags.value.push(t.id);
    }
  }
);

function onTagSelectionChange(ids: string[]) {
  for (const t of tags.value) {
    if (t.required && !ids.includes(t.id)) ids.push(t.id);
  }
  enabledTags.value = ids;
}

// when enabled tags change, sync selectors for all groups
watch(
  () => enabledTags.value.slice(),
  () => {
    for (const g of groups.value) ensureSelectorsForGroup(g);
  }
);

// initialize selectors for any existing groups
for (const g of groups.value) ensureSelectorsForGroup(g);

function addGroup() {
  const g = { name: "", selectors: {}, count: 1, results: [] } as any;
  ensureSelectorsForGroup(g);
  groups.value.push(g);
}
function removeGroup(i: number) {
  groups.value.splice(i, 1);
}

function ensureSelectorsForGroup(group: any) {
  if (!group.selectors) group.selectors = {};
  // add defaults for enabled tags
  for (const tid of enabledTags.value) {
    const t = tags.value.find((x: any) => x.id === tid);
    if (!t) continue;
    if (!(tid in group.selectors)) {
      switch (t.type) {
        case TagType.text:
          group.selectors[tid] = "";
          break;
        case TagType.number:
          group.selectors[tid] = [0, 0];
          break;
        case TagType.boolean:
          group.selectors[tid] = null;
          break;
        case TagType.select:
          group.selectors[tid] = null;
          break;
        case TagType.multiSelect:
          group.selectors[tid] = [];
          break;
        default:
          group.selectors[tid] = "";
      }
    }
  }
  // remove selectors for disabled tags
  for (const sid of Object.keys(group.selectors)) {
    if (!enabledTags.value.includes(sid)) delete group.selectors[sid];
  }
}

function generate() {
  const usedQuestionIds = new Set<string>();

  for (const g of groups.value) {
    const pool = filterQuestionsByTags(g.selectors);
    // 过滤掉已经使用过的题目（跨组去重）
    const availablePool = pool.filter((q: any) => !usedQuestionIds.has(q.id));

    if (availablePool.length < g.count) {
      notification.warning({
        message: "题库数量不足",
        description: `组 "${g.name || "未命名"}" 可匹配题目仅 ${
          availablePool.length
        } 道，需要 ${g.count} 道，请放宽筛选条件或增加题目。`,
      });
    }

    // 随机选择题目
    const selected = shuffle(availablePool).slice(0, g.count);

    // 将选中的题目ID加入已使用集合
    selected.forEach((q: any) => usedQuestionIds.add(q.id));

    // 如果数量不足，用空白题目补充
    const emptyCount = g.count - selected.length;
    const emptyQuestions = Array(emptyCount)
      .fill(null)
      .map((_, idx) => ({
        id: `empty-${Date.now()}-${idx}`,
        title: "[空白题目]",
        content:
          "<p style='color: #999;'>题库数量不足，请添加更多题目或调整筛选条件</p>",
        answers: [],
        tags: {},
      }));

    g.results = [...selected, ...emptyQuestions];
  }
}

function replaceQuestion(groupIndex: number, resultIndex: number) {
  const g = groups.value[groupIndex];
  if (!g) return;

  // 获取所有已使用的题目ID(包括其他组的)
  const usedIds = new Set<string>();
  groups.value.forEach((group) => {
    group.results.forEach((r: any) => {
      if (r && r.id) usedIds.add(r.id);
    });
  });

  // 从匹配池中排除所有已使用的题目
  const pool = filterQuestionsByTags(g.selectors).filter(
    (q) => !usedIds.has(q.id)
  );

  if (!pool.length) {
    notification.warning({
      message: "题库数量不足",
      description: "没有更多可替换的题目，请放宽筛选条件或增加题目。",
    });
    return;
  }

  const choice =
    pool[globalThis.Math.floor(globalThis.Math.random() * pool.length)];
  g.results.splice(resultIndex, 1, choice);
}

function shuffle(arr: any[]) {
  return arr.slice().sort(() => globalThis.Math.random() - 0.5);
}

// 移除 HTML 标签，但保留 LaTeX 公式
function stripHtmlKeepLatex(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// 将带有 LaTeX 的文本转换为段落数组
function createParagraphsWithLatex(text: string, spacing?: any): Paragraph[] {
  if (!text) return [];

  const paragraphs: Paragraph[] = [];
  let lastIndex = 0;

  // 匹配行内公式 $...$ 和块级公式 $$...$$
  const regex = /\$\$([^\$]+)\$\$|\$([^\$]+)\$/g;
  let match;
  const children: any[] = [];

  while ((match = regex.exec(text)) !== null) {
    // 收集公式前的普通文本
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index);
      if (textBefore) {
        children.push(new TextRun(textBefore));
      }
    }

    // 提取 LaTeX 公式，转换为 Word 原生数学格式
    const latex = match[1] || match[2];
    if (latex) {
      try {
        const mathComponent = latexToMath(latex.trim());
        children.push(mathComponent);
      } catch (e) {
        // 如果转换失败，回退到文本显示
        console.error("LaTeX 转换失败:", latex, e);
        children.push(
          new TextRun({
            text: ` ${latex.trim()} `,
            italics: true,
            font: "Cambria Math",
            size: 22,
          })
        );
      }
    }

    lastIndex = regex.lastIndex;
  }

  // 添加剩余的普通文本
  if (lastIndex < text.length) {
    const textAfter = text.substring(lastIndex);
    if (textAfter) {
      children.push(new TextRun(textAfter));
    }
  }

  // 如果有内容，创建段落
  if (children.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: children,
        spacing: spacing || { after: 100 },
        alignment: AlignmentType.LEFT,
      })
    );
  } else {
    paragraphs.push(
      new Paragraph({
        text: text,
        spacing: spacing || { after: 100 },
        alignment: AlignmentType.LEFT,
      })
    );
  }

  return paragraphs;
}

// 导出为 Word 文档
async function exportToWord() {
  // 将阿拉伯数字转换为中文数字
  const numberToChinese = (num: number): string => {
    const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    if (num <= 10) return chineseNumbers[num] || '零';
    if (num < 20) return '十' + (chineseNumbers[num - 10] || '');
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return (chineseNumbers[tens] || '') + '十' + (ones > 0 ? (chineseNumbers[ones] || '') : '');
  };

  // 检查是否有生成的题目
  const hasResults = groups.value.some(
    (g) => g.results && g.results.length > 0
  );
  if (!hasResults) {
    notification.warning({
      message: "没有可导出的内容",
      description: "请先生成试题后再导出",
    });
    return;
  }

  try {
    const sections: any[] = [];

    // 标题 - 使用黑色
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "试题",
            bold: true,
            size: 32,
            color: "000000",
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    // 遍历每个组
    let groupNumber = 0; // 用于组编号
    for (const g of groups.value) {
      if (!g.results || g.results.length === 0) continue;

      groupNumber++; // 递增组编号
      const chineseNumber = numberToChinese(groupNumber);

      // 组标题 - 使用中文数字和黑色
      if (g.name) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${chineseNumber}、${g.name}`,
                bold: true,
                size: 28,
                color: "000000",
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );
      } else {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${chineseNumber}、未命名组`,
                bold: true,
                size: 28,
                color: "000000",
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );
      }

      // 遍历该组的每道题目
      for (const [qIndex, q] of g.results.entries()) {
        const questionNumber = qIndex + 1;

        // 题目标题
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${questionNumber}. ${q.title}`,
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );

        // 标签信息 - 输出到题目标题下面一行，只输出非空值
        if (showTags.value && q.tags && Object.keys(q.tags).length > 0) {
          const tagTexts: string[] = [];
          for (const [tagId, tagValue] of Object.entries(q.tags)) {
            const tag = tags.value.find((t: any) => t.id === String(tagId));
            if (tag) {
              let value = "";
              if (tag.type === TagType.boolean) {
                value = (tagValue as any).value ? "是" : "否";
              } else if (Array.isArray((tagValue as any).value)) {
                const arr = (tagValue as any).value;
                if (arr.length > 0) {
                  value = arr.join(", ");
                }
              } else {
                const val = (tagValue as any).value;
                if (val !== null && val !== undefined && val !== "") {
                  value = String(val);
                }
              }
              // 只添加非空值
              if (value) {
                tagTexts.push(`${tag.name}: ${value}`);
              }
            }
          }
          if (tagTexts.length > 0) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[${tagTexts.join(" | ")}]`,
                    italics: true,
                    color: "666666",
                    size: 20,
                  }),
                ],
                spacing: { after: 100 },
              })
            );
          }
        }

        // 题目内容（去除 HTML 标签，保留并标记 LaTeX 公式）
        const content = stripHtmlKeepLatex(q.content);
        if (content && content !== "[空白题目]") {
          const contentParagraphs = createParagraphsWithLatex(content, {
            after: 100,
          });
          sections.push(...contentParagraphs);
        }

        // 答案（如果启用显示答案）
        if (showAnswers.value && q.answers && q.answers.length > 0) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "答案: ",
                  bold: true,
                }),
                new TextRun({
                  text: q.answers.join(", "),
                  color: "2E7D32",
                }),
              ],
              spacing: { after: 200 },
            })
          );
        } else {
          sections.push(
            new Paragraph({
              text: "",
              spacing: { after: 100 },
            })
          );
        }
      }
    }

    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections,
        },
      ],
    });

    // 生成并下载
    const blob = await Packer.toBlob(doc);
    const fileName = `试题_${new Date().toISOString().slice(0, 10)}.docx`;
    saveAs(blob, fileName);

    notification.success({
      message: "导出成功",
      description: `已导出为 ${fileName}`,
    });
  } catch (error) {
    console.error("Export to Word failed:", error);
    notification.error({
      message: "导出失败",
      description: "导出 Word 文档时发生错误",
    });
  }
}
</script>

<template>
  <a-space direction="vertical" :size="24" style="width: 100%">
    <a-page-header
      title="生成试题"
      sub-title="根据标签条件匹配并生成试题"
      style="padding: 0"
    />

    <a-space direction="vertical" :size="16" style="width: 100%">
      <a-card
        v-for="(g, i) in groups"
        :key="i"
        :title="`组 ${i + 1}: ${g.name || '未命名'}`"
        :bordered="false"
      >
        <template #extra>
          <a-button size="small" danger @click="removeGroup(i)"
            >删除组</a-button
          >
        </template>

        <a-form layout="vertical">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="组名">
                <a-input
                  v-model:value="g.name"
                  placeholder="请输入组名（可选）"
                />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="生成数量">
                <a-input-number
                  v-model:value="g.count"
                  :min="1"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="选择要显示的标签">
            <a-select
              v-model:value="enabledTags"
              mode="multiple"
              :options="optionalOptions"
              :get-popup-container="getPopupContainer"
              style="width: 100%"
              @change="onTagSelectionChange"
            />
          </a-form-item>

          <a-row :gutter="[16, 16]">
            <template v-for="t in tags" :key="t.id">
              <a-col :span="12" v-if="enabledTags.includes(t.id)">
                <a-form-item :label="t.name">
                  <a-input
                    v-if="t.type === TagType.text"
                    v-model:value="g.selectors[t.id]"
                    placeholder="模糊匹配"
                  />
                  <div
                    v-else-if="t.type === TagType.number"
                    style="display: flex; gap: 8px"
                  >
                    <a-input-number
                      v-model:value="g.selectors[t.id][0]"
                      placeholder="最小"
                      style="width: 50%"
                    />
                    <a-input-number
                      v-model:value="g.selectors[t.id][1]"
                      placeholder="最大"
                      style="width: 50%"
                    />
                  </div>
                  <a-select
                    v-else-if="t.type === TagType.boolean"
                    v-model:value="g.selectors[t.id]"
                    :options="[
                      { label: '是', value: true },
                      { label: '否', value: false },
                    ]"
                    placeholder="请选择"
                    :get-popup-container="getPopupContainer"
                    style="width: 100%"
                  />
                  <a-select
                    v-else-if="t.type === TagType.select"
                    v-model:value="g.selectors[t.id]"
                    :options="t.options?.map((o) => ({ label: o, value: o }))"
                    placeholder="请选择"
                    :get-popup-container="getPopupContainer"
                    style="width: 100%"
                  />
                  <a-select
                    v-else-if="t.type === TagType.multiSelect"
                    v-model:value="g.selectors[t.id]"
                    mode="multiple"
                    :options="t.options?.map((o) => ({ label: o, value: o }))"
                    placeholder="请选择多个"
                    :get-popup-container="getPopupContainer"
                    style="width: 100%"
                  />
                  <a-input
                    v-else
                    v-model:value="g.selectors[t.id]"
                    placeholder="精确匹配"
                  />
                </a-form-item>
              </a-col>
            </template>
          </a-row>
        </a-form>
      </a-card>
    </a-space>

    <a-card :bordered="false">
      <a-space>
        <a-button type="dashed" @click="addGroup">
          <template #icon><span style="font-size: 16px">+</span></template>
          添加组
        </a-button>
        <a-divider type="vertical" />
        <a-space>
          <span>显示答案:</span>
          <a-switch v-model:checked="showAnswers" />
        </a-space>
        <a-space>
          <span>显示标签:</span>
          <a-switch v-model:checked="showTags" />
        </a-space>
        <a-button type="primary" @click="generate">
          <template #icon><span>⚡</span></template>
          生成试题
        </a-button>
        <a-divider type="vertical" />
        <a-button @click="exportToWord">
          <template #icon><span>📄</span></template>
          导出 Word
        </a-button>
      </a-space>
    </a-card>

    <a-divider />

    <a-space direction="vertical" :size="16" style="width: 100%">
      <a-card
        v-for="(g, i) in groups"
        :key="'r' + i"
        :title="g.name || `组 ${i + 1}`"
        :bordered="false"
      >
        <a-empty
          v-if="!g.results || !g.results.length"
          description="请点击上方“生成试题”按钮"
        />

        <a-list v-else :data-source="g.results" item-layout="vertical">
          <template #renderItem="{ item: q, index: idx }">
            <a-list-item>
              <template #extra>
                <a-button size="small" @click.prevent="replaceQuestion(i, idx)">
                  替换
                </a-button>
              </template>

              <a-list-item-meta>
                <template #title>
                  <a-space>
                    <a-badge
                      :count="idx + 1"
                      :number-style="{ backgroundColor: '#1890ff' }"
                    />
                    <span>{{ q.title }}</span>
                  </a-space>
                </template>
                <template #description>
                  <div
                    v-html="parseLatex(q.content)"
                    style="margin-top: 8px"
                  ></div>
                  <div
                    v-if="showTags && q.tags && Object.keys(q.tags).length > 0"
                    style="margin-top: 12px"
                  >
                    <a-space wrap>
                      <template
                        v-for="(tagValue, tagId) in q.tags"
                        :key="tagId"
                      >
                        <template
                          v-if="tags.find((t) => t.id === String(tagId))"
                        >
                          <a-tag
                            :color="tags.find(t => t.id === String(tagId))!.color || 'default'"
                          >
                            {{
                              tags.find((t) => t.id === String(tagId))!.name
                            }}:
                            <template
                              v-if="tags.find(t => t.id === String(tagId))!.type === TagType.boolean"
                            >
                              {{ tagValue.value ? "是" : "否" }}
                            </template>
                            <template v-else-if="Array.isArray(tagValue.value)">
                              {{ tagValue.value.join(", ") }}
                            </template>
                            <template v-else>
                              {{ tagValue.value }}
                            </template>
                          </a-tag>
                        </template>
                      </template>
                    </a-space>
                  </div>
                  <a-divider v-if="showAnswers" style="margin: 12px 0" />
                  <div v-if="showAnswers">
                    <a-typography-text strong>答案: </a-typography-text>
                    <a-space>
                      <a-tag
                        v-for="(a, ai) in q.answers"
                        :key="ai"
                        color="green"
                      >
                        {{ a }}
                      </a-tag>
                    </a-space>
                  </div>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </a-card>
    </a-space>
  </a-space>
</template>

<style scoped></style>
