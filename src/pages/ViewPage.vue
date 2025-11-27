<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import store, {
  TagType,
  filterQuestionsByTags,
  removeQuestion,
  exportData,
  replaceAll,
  mergeData,
} from "../store";
import type { Question } from "../store";
import { Modal, notification } from "ant-design-vue";
import { parseLatex } from "../utils/latex";
import { saveAs } from "../utils/file-saver";

const router = useRouter();
const importInput = ref<HTMLInputElement | null>(null);

const tags = computed(() => store.state.tags);

// 下拉框容器设置函数
const getPopupContainer = (trigger: HTMLElement) => trigger.parentElement || document.body;

// 筛选相关
const enabledTags = ref<string[]>([]);
const selectors = ref<Record<string, any>>({});

// 当启用的标签变化时，更新 selectors
function onTagSelectionChange(ids: string[]) {
  enabledTags.value = ids;

  // 添加新标签的默认值
  for (const tid of ids) {
    const t = tags.value.find((x: any) => x.id === tid);
    if (!t) continue;
    if (!(tid in selectors.value)) {
      switch (t.type) {
        case TagType.text:
          selectors.value[tid] = "";
          break;
        case TagType.number:
          selectors.value[tid] = [0, 0];
          break;
        case TagType.boolean:
          selectors.value[tid] = null;
          break;
        case TagType.select:
          selectors.value[tid] = null;
          break;
        case TagType.multiSelect:
          selectors.value[tid] = [];
          break;
        default:
          selectors.value[tid] = "";
      }
    }
  }

  // 移除取消选择的标签
  for (const sid of Object.keys(selectors.value)) {
    if (!ids.includes(sid)) {
      delete selectors.value[sid];
    }
  }
}

// 筛选题目
const filteredQuestions = computed(() => {
  const pool = filterQuestionsByTags(selectors.value);
  return pool;
});


function handleEdit(question: Question) {
  router.push(`/entry?id=${question.id}`);
}

function handleDelete(question: Question) {
  Modal.confirm({
    title: "确认删除",
    content: `确定要删除题目"${question.title}"吗？此操作不可恢复。`,
    okText: "删除",
    okType: "danger",
    cancelText: "取消",
    onOk: () => {
      removeQuestion(question.id);
      notification.success({
        message: "删除成功",
        description: `题目"${question.title}"已删除`,
      });
    },
  });
}

function getTagValue(question: Question, tagId: string): string {
  const tag = tags.value.find((t: any) => t.id === tagId);
  if (!tag) return "";

  const value = question.tags[tagId].value;

  if (tag.type === TagType.boolean) {
    return value ? "是" : "否";
  } else if (tag.type === TagType.multiSelect && Array.isArray(value)) {
    return value.join(", ");
  } else if (value !== null && value !== undefined) {
    return String(value);
  }

  return "";
}

function exportAll() {
  const data = exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  saveAs(blob, "exercises_export.json");
  notification.success({
    message: "导出成功",
    description: "已下载 exercises_export.json",
  });
}

function triggerImport() {
  importInput.value?.click();
}

function onImport(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || !input.files.length) return;
  const f = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== "object")
        throw new Error("Invalid JSON");
      Modal.confirm({
        title: "导入数据",
        content:
          "是否覆盖现有题库？选择「确定」覆盖，选择「取消」则以合并方式导入（不会覆盖相同 id）。",
        onOk() {
          replaceAll(parsed);
          notification.success({
            message: "导入成功",
            description: "已覆盖现有题库",
          });
        },
        onCancel() {
          mergeData(parsed);
          notification.success({
            message: "导入成功",
            description: "已合并导入题库",
          });
        },
      });
    } catch (err: any) {
      notification.error({ message: "导入失败", description: err.message });
    }
  };
  reader.readAsText(f as Blob);
  input.value = "";
}
</script>

<template>
  <div class="view-page">
    <div class="header-section">
      <h2>查看题目</h2>
      <a-space>
        <a-button type="primary" @click="exportAll">导出题库</a-button>
        <a-button @click="triggerImport">导入题库</a-button>
        <input
          ref="importInput"
          type="file"
          accept=".json"
          style="display: none"
          @change="onImport"
        />
      </a-space>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <a-card title="标签筛选" size="small">
        <div class="filter-controls">
          <div class="filter-row">
            <label>选择标签：</label>
            <a-select
              v-model:value="enabledTags"
              mode="multiple"
              placeholder="选择要筛选的标签（可选多个）"
              style="flex: 1"
              :options="tags.map((t: any) => ({ label: t.name, value: t.id }))"
              :get-popup-container="getPopupContainer"
              @change="onTagSelectionChange"
            />
          </div>

          <!-- 根据启用的标签显示筛选控件 -->
          <template v-for="tagId in enabledTags" :key="tagId">
            <div
              class="filter-row"
              v-if="tags.find((t: any) => t.id === tagId)"
            >
              <label>{{ tags.find((t: any) => t.id === tagId)!.name }}：</label>
              <template
                v-if="tags.find((t: any) => t.id === tagId)!.type === TagType.text"
              >
                <a-input
                  v-model:value="selectors[tagId]"
                  placeholder="输入关键词"
                  style="flex: 1"
                />
              </template>
              <template
                v-else-if="tags.find((t: any) => t.id === tagId)!.type === TagType.number"
              >
                <a-input
                  v-model:value="selectors[tagId][0]"
                  placeholder="最小值"
                  type="number"
                  style="flex: 1"
                />
                <span style="margin: 0 8px">至</span>
                <a-input
                  v-model:value="selectors[tagId][1]"
                  placeholder="最大值"
                  type="number"
                  style="flex: 1"
                />
              </template>
              <template
                v-else-if="tags.find((t: any) => t.id === tagId)!.type === TagType.boolean"
              >
                <a-select
                  v-model:value="selectors[tagId]"
                  placeholder="选择"
                  style="flex: 1"
                  :options="[
                    { label: '全部', value: null },
                    { label: '是', value: true },
                    { label: '否', value: false },
                  ]"
                  :get-popup-container="getPopupContainer"
                />
              </template>
              <template
                v-else-if="tags.find((t: any) => t.id === tagId)!.type === TagType.select"
              >
                <a-select
                  v-model:value="selectors[tagId]"
                  placeholder="选择"
                  style="flex: 1"
                  :options="[
                    { label: '全部', value: null },
                    ...tags.find((t: any) => t.id === tagId)!.options.map((o: string) => ({ label: o, value: o }))
                  ]"
                  :get-popup-container="getPopupContainer"
                />
              </template>
              <template
                v-else-if="tags.find((t: any) => t.id === tagId)!.type === TagType.multiSelect"
              >
                <a-select
                  v-model:value="selectors[tagId]"
                  mode="multiple"
                  placeholder="选择（满足任一即可）"
                  style="flex: 1"
                  :options="tags.find((t: any) => t.id === tagId)!.options.map((o: string) => ({ label: o, value: o }))"
                  :get-popup-container="getPopupContainer"
                />
              </template>
            </div>
          </template>
        </div>
      </a-card>
    </div>

    <!-- 题目列表 -->
    <div class="questions-section">
      <a-card>
        <template #title>
          <span>题目列表（共 {{ filteredQuestions.length }} 题）</span>
        </template>

        <div v-if="filteredQuestions.length === 0" class="empty-state">
          <a-empty description="暂无题目">
            <a-button type="primary" @click="router.push('/entry')"
              >去录入题目</a-button
            >
          </a-empty>
        </div>

        <div v-else class="questions-list">
          <a-card
            v-for="(question, index) in filteredQuestions"
            :key="question.id"
            class="question-card"
            size="small"
          >
            <template #title>
              <span class="question-number">题目 {{ index + 1 }}</span>
              <a-tag color="blue">{{ question.title }}</a-tag>
            </template>

            <template #extra>
              <a-space>
                <a-button
                  type="link"
                  size="small"
                  @click="handleEdit(question)"
                >
                  编辑
                </a-button>
                <a-button
                  type="link"
                  danger
                  size="small"
                  @click="handleDelete(question)"
                >
                  删除
                </a-button>
              </a-space>
            </template>

            <!-- 题目内容 -->
            <div class="question-content">
              <div class="content-label">题目内容：</div>
              <div
                class="content-text"
                v-html="parseLatex(question.content)"
              ></div>
            </div>

            <!-- 图片 -->
            <div
              v-if="question.images && question.images.length > 0"
              class="question-images"
            >
              <div class="content-label">图片：</div>
              <div class="images-grid">
                <img
                  v-for="(img, idx) in question.images"
                  :key="idx"
                  :src="img"
                  :alt="`图片 ${idx + 1}`"
                  class="question-image"
                />
              </div>
            </div>

            <!-- 答案 -->
            <div class="question-answers">
              <div class="content-label">答案：</div>
              <div class="answers-list">
                <div
                  v-for="(answer, idx) in question.answers"
                  :key="idx"
                  class="answer-item"
                >
                  <span class="answer-index">{{ idx + 1 }}.</span>
                  <span class="answer-text" v-html="parseLatex(answer)"></span>
                </div>
              </div>
            </div>

            <!-- 标签信息 -->
            <div class="question-tags">
              <div class="content-label">标签信息：</div>
              <div class="tags-list">
                <a-tag
                  v-for="tag in tags.filter((t: any) => question.tags[t.id] !== undefined && question.tags[t.id] !== null && question.tags[t.id] !== '')"
                  :key="tag.id"
                  :color="tag.color"
                >
                  {{ tag.name }}: {{ getTagValue(question, tag.id) }}
                </a-tag>
              </div>
            </div>
          </a-card>
        </div>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.view-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
}

h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.filter-section {
  margin-bottom: 24px;
}

.filter-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-row label {
  min-width: 100px;
  font-weight: 500;
}

.questions-section {
  flex: 1;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-card {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  transition: all 0.3s;
}

.question-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.question-number {
  font-weight: 600;
  margin-right: 8px;
}

.question-content,
.question-images,
.question-answers,
.question-tags {
  margin-bottom: 16px;
}

.question-content:last-child,
.question-images:last-child,
.question-answers:last-child,
.question-tags:last-child {
  margin-bottom: 0;
}

.content-label {
  font-weight: 600;
  margin-bottom: 8px;
  color: #666;
}

.content-text {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
  line-height: 1.8;
}

.images-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.question-image {
  max-width: 200px;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  cursor: pointer;
  transition: transform 0.2s;
}

.question-image:hover {
  transform: scale(1.05);
}

.answers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.answer-item {
  display: flex;
  align-items: flex-start;
  padding: 8px 12px;
  background: #f0f8ff;
  border-radius: 4px;
  border-left: 3px solid #1890ff;
}

.answer-index {
  font-weight: 600;
  margin-right: 8px;
  color: #1890ff;
  min-width: 24px;
}

.answer-text {
  flex: 1;
  line-height: 1.6;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
