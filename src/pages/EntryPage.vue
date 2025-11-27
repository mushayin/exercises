<script setup lang="ts">
import { ref, reactive, computed, watch, onBeforeMount, nextTick } from "vue";
import { useRoute } from "vue-router";
import store, {
  addQuestion,
  updateQuestion,
  TagType,
} from "../store";
import type { Question } from "../store";
import { notification } from "ant-design-vue";
import LaTeXEditor from "../components/LaTeXEditor.vue";
import { generateUUID } from "../utils/uuid";
import { compressImage } from "../utils/image";
import { parseLatex } from "../utils/latex";

const route = useRoute();
const editingId = ref<string | null>(null);

const form = reactive({
  title: "",
  content: "",
  answers: [""],
  tags: {} as Record<string, any>,
  images: [] as string[],
});
const errors = reactive({
  title: false,
  content: false,
  answers: false,
  tags: {} as Record<string, boolean>,
});

const answerRefs = ref<Array<any>>([]);
const lastFocusedAnswerIndex = ref<number | null>(null);
const lastAnswerCursorPos = ref<{ start: number; end: number } | null>(null);
const contentRef = ref<any>(null);
const contentFocused = ref(false);
const contentCursorPos = ref<{ start: number; end: number }>({
  start: 0,
  end: 0,
});
const latexVisible = ref(false);

// 下拉框容器设置函数
const getPopupContainer = (trigger: HTMLElement) => trigger.parentElement || document.body;
// const model = defineModel()

function addAnswer() {
  form.answers.push("");
  answerRefs.value.push(null);
}
function removeAnswer(i: number) {
  form.answers.splice(i, 1);
  answerRefs.value.splice(i, 1);
  if (lastFocusedAnswerIndex.value === i) lastFocusedAnswerIndex.value = null;
}

async function onImage(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;
  for (const f of Array.from(input.files)) {
    const blob = await compressImage(f);
    const url = URL.createObjectURL(blob);
    form.images.push(url);
  }
}

const tags = computed(() => store.state.tags);
const optionalOptions = computed(() =>
  tags.value.map((t) => ({
    label: t.name,
    value: t.id,
    disabled: t.required,
  }))
);

const enabledTags = ref(
  tags.value.filter((t: any) => t.required).map((t: any) => t.id)
);

function onTagChanged(ids: string[]) {
  for (let id of ids) {
    const t = store.state.tags.find((x: any) => x.id === id);
    if (!t) continue;
  }
}

function makeSetAnswerRef(i: number) {
  return (el: HTMLTextAreaElement | null) => {
    answerRefs.value[i] = el;
  };
}
function setFocusedAnswer(i: number) {
  contentFocused.value = false;
  lastFocusedAnswerIndex.value = i;

  const textarea = answerRefs.value[i]!.$el || answerRefs.value[i]!;
  if (textarea) {
    nextTick(() => {
      lastAnswerCursorPos.value = {
        start: textarea.selectionStart ?? 0,
        end: textarea.selectionEnd ?? 0,
      };
    });
  }
}
function onContentFocus() {
  contentFocused.value = true;
  lastFocusedAnswerIndex.value = null;

  const textarea = contentRef.value.$el || contentRef.value;
  if (textarea) {
    nextTick(() => {
      contentCursorPos.value = {
        start: textarea.selectionStart ?? 0,
        end: textarea.selectionEnd ?? 0,
      };
    });
  }
}

function handleInsert(val: string) {
  // priority: 有光标位置的答案 -> 有光标位置的题干 -> warn
  const ai = lastFocusedAnswerIndex.value;

  // 优先检查答案输入框
  if (
    ai !== null &&
    ai >= 0 &&
    ai < form.answers.length &&
    answerRefs.value[ai] &&
    lastAnswerCursorPos.value
  ) {
    const el = answerRefs.value[ai]!.$el || answerRefs.value[ai]!.value;
    const { start: startPos, end: endPos } = lastAnswerCursorPos.value;
    const ans = form.answers[ai] || "";
    const before = ans.slice(0, startPos);
    const after = ans.slice(endPos);
    form.answers[ai] = before + val + after;
    const newPos = startPos + val.length;
    lastAnswerCursorPos.value = { start: newPos, end: newPos };
    nextTick(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
    return;
  }

  // 检查题干输入框（不再要求contentFocused为true）
  if (contentRef.value && contentCursorPos.value) {
    const el = contentRef.value.$el || contentRef.value;
    const { start: startPos, end: endPos } = contentCursorPos.value;
    const before = form.content.slice(0, startPos);
    const after = form.content.slice(endPos);
    form.content = before + val + after;
    const newPos = startPos + val.length;
    contentCursorPos.value = { start: newPos, end: newPos };
    nextTick(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
    return;
  }

  notification.warning({
    message: "请先在题干或某个答案中聚焦光标，再插入公式",
  });
}

function ensureRequiredTags() {
  for (const t of store.state.tags) {
    form.tags[t.id] = {};

    switch (t.type) {
      case TagType.text:
        form.tags[t.id].value = "";
        break;
      case TagType.number:
        form.tags[t.id].value = 0;
        break;
      case TagType.boolean:
        form.tags[t.id].value = false;
        break;
      case TagType.select:
        form.tags[t.id].value = null;
        break;
      case TagType.multiSelect:
        form.tags[t.id].value = [];
        break;
    }
  }
}

watch(
  () => store.state.tags.slice(),
  () => ensureRequiredTags()
);

onBeforeMount(() => {
  ensureRequiredTags();

  // 检查是否是编辑模式
  const id = route.query.id as string | undefined;
  if (id) {
    const question = store.state.questions.find((q: any) => q.id === id);
    if (question) {
      editingId.value = id;
      form.title = question.title;
      form.content = question.content;
      form.answers = [...question.answers];
      form.tags = { ...question.tags };
      form.images = question.images ? [...question.images] : [];

      // 确保 answerRefs 数组长度匹配
      answerRefs.value = Array(form.answers.length).fill(null);
    } else {
      notification.warning({
        message: "题目未找到",
        description: "未找到指定的题目，将创建新题目",
      });
    }
  }
});

function hasTagValue(t: any) {
  const v = form.tags[t.id];
  if (t.type === "boolean") return v === true || v === false;
  if (t.type === "number")
    return v !== "" && v !== null && v !== undefined && !isNaN(Number(v));
  if (t.type === "enum") {
    if (t.single) return v !== "" && v !== null && v !== undefined;
    return Array.isArray(v) && v.length > 0;
  }
  return String(v || "").trim() !== "";
}

const previewHtml = computed(() => parseLatex(form.content));

function validate() {
  errors.title = !form.title || !form.title.trim();
  errors.content = !form.content || !form.content.trim();
  errors.answers = !(form.answers && form.answers.some((a) => a && a.trim()));
  errors.tags = {};
  for (const t of store.state.tags) {
    if (t.required) {
      const ok = hasTagValue(t);
      errors.tags[t.id] = !ok;
    }
  }
  return (
    !errors.title &&
    !errors.content &&
    !errors.answers &&
    Object.values(errors.tags).every((v) => v === false)
  );
}

function save() {
  if (!validate()) {
    setTimeout(() => {
      const first = document.querySelector(".invalid") as HTMLElement | null;
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    notification.error({
      message: "验证失败",
      description:
        "请输入所有必填项（标题、题干、至少一个答案，以及标为必选的标签）",
    });
    return;
  }

  if (editingId.value) {
    // 更新现有题目
    updateQuestion(editingId.value, {
      title: form.title,
      content: form.content,
      answers: form.answers.filter((a) => a.trim()),
      tags: form.tags,
      images: form.images,
    });
    notification.success({
      message: "更新成功",
      description: "题目已更新",
    });
  } else {
    // 新增题目
    const q: Question = {
      id: generateUUID(),
      title: form.title,
      content: form.content,
      answers: form.answers.filter((a) => a.trim()),
      tags: form.tags,
      images: form.images,
    };
    addQuestion(q);
    notification.success({
      message: "保存成功",
      description: "题目已保存到题库",
    });
  }

  // 清空表单
  form.title = "";
  form.content = "";
  form.answers = [""];
  form.images = [];
  form.tags = {};
  editingId.value = null;
  ensureRequiredTags();
}
</script>

<template>
  <LaTeXEditor v-model:visible="latexVisible" @insert="handleInsert" />
  <a-space direction="vertical" style="width: 100%">
    <a-page-header
      :title="editingId ? '编辑题目' : '录入题目'"
      style="padding: 0"
    >
      <template #extra>
        <a-space>
          <a-button @click="latexVisible = true" type="primary">
            <template #icon><span>∫</span></template>
            插入公式
          </a-button>
        </a-space>
      </template>
    </a-page-header>

    <a-card title="基本信息" :bordered="false">
      <a-form layout="vertical">
        <a-form-item
          label="题目标题"
          :validate-status="errors.title ? 'error' : ''"
          :help="errors.title ? '标题为必填' : ''"
        >
          <a-input v-model:value="form.title" placeholder="请输入题目标题" />
        </a-form-item>

        <a-form-item
          label="题干内容"
          :validate-status="errors.content ? 'error' : ''"
          :help="errors.content ? '题干为必填' : ''"
        >
          <a-textarea
            ref="contentRef"
            v-model:value="form.content"
            placeholder="请输入题干，支持 LaTeX 公式（使用 $ 或 $$ 包裹）"
            :rows="6"
            @keyup="onContentFocus"
            @select="onContentFocus"
            @click="onContentFocus"
          />
        </a-form-item>

        <a-form-item label="预览">
          <a-card size="small" :body-style="{ padding: '12px' }">
            <div class="content-preview" v-html="previewHtml"></div>
          </a-card>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card title="答案选项" :bordered="false">
      <a-space direction="vertical" style="width: 100%">
        <a-card
          v-for="(_, i) in form.answers"
          :key="i"
          size="small"
          :title="`答案 ${i + 1}`"
        >
          <template #extra>
            <a-button
              size="small"
              danger
              type="text"
              @click.prevent="removeAnswer(i)"
            >
              删除
            </a-button>
          </template>

          <a-space direction="vertical" style="width: 100%">
            <a-textarea
              :ref="makeSetAnswerRef(i)"
              v-model:value="form.answers[i]"
              @keyup="() => setFocusedAnswer(i)"
              @select="() => setFocusedAnswer(i)"
              @click="() => setFocusedAnswer(i)"
              placeholder="请输入答案内容，支持 LaTeX 公式"
              :rows="3"
              :status="
                errors.answers && !form.answers.some((a) => a && a.trim())
                  ? 'error'
                  : ''
              "
            />
            <a-card size="small" title="预览" :body-style="{ padding: '8px' }">
              <div
                class="answer-preview"
                v-html="parseLatex(form.answers[i] || '')"
              ></div>
            </a-card>
          </a-space>
        </a-card>

        <div v-if="errors.answers" style="color: #ff4d4f">至少输入一条答案</div>

        <a-button type="dashed" block @click.prevent="addAnswer">
          <template #icon><span style="font-size: 16px">+</span></template>
          添加答案
        </a-button>
      </a-space>
    </a-card>

    <a-card title="标签" :bordered="false">
      <a-form layout="vertical">
        <a-form-item label="选择标签">
          <a-select
            v-model:value="enabledTags"
            mode="multiple"
            placeholder="请选择适用的标签"
            style="width: 100%"
            :options="optionalOptions"
            :get-popup-container="getPopupContainer"
            @change="onTagChanged"
          />
        </a-form-item>

        <a-row :gutter="[16, 16]">
          <a-col
            :span="24"
            v-for="t of tags"
            :key="t.id"
            v-show="enabledTags.includes(t.id)"
          >
            <a-form-item
              :label-col="{ span: 24 }"
              :validate-status="errors.tags[t.id] ? 'error' : ''"
              :help="errors.tags[t.id] ? '此项为必填' : ''"
            >
              <template #label>
                <a-space>
                  <a-tag :color="t.color">{{ t.name }}</a-tag>
                  <a-badge v-if="t.required" status="error" text="必填" />
                </a-space>
              </template>

              <div>
                <a-input
                  v-if="t.type === TagType.text"
                  v-model:value="form.tags[t.id].value"
                  placeholder="请输入内容"
                />
                <a-input-number
                  v-else-if="t.type === TagType.number"
                  v-model:value="form.tags[t.id].value"
                  placeholder="请输入数字"
                  style="width: 100%"
                />
                <a-switch
                  v-else-if="t.type === TagType.boolean"
                  v-model:checked="form.tags[t.id].value"
                />
                <a-select
                  v-else-if="t.type === TagType.select"
                  v-model:value="form.tags[t.id].value"
                  placeholder="请选择"
                  :options="t.options?.map((value) => ({ value }))"
                  :get-popup-container="getPopupContainer"
                  style="width: 100%"
                />
                <a-select
                  v-else-if="t.type === TagType.multiSelect"
                  v-model:value="form.tags[t.id].value"
                  mode="multiple"
                  placeholder="请选择多个"
                  :options="t.options?.map((value) => ({ value }))"
                  :get-popup-container="getPopupContainer"
                  style="width: 100%"
                />
              </div>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-card title="附加图片" :bordered="false">
      <a-upload
        :before-upload="() => false"
        @change="onImage"
        accept="image/*"
        :show-upload-list="false"
        multiple
      >
        <a-button>
          <template #icon><span>📷</span></template>
          选择图片
        </a-button>
      </a-upload>

      <a-row
        :gutter="[16, 16]"
        style="margin-top: 16px"
        v-if="form.images.length"
      >
        <a-col :span="6" v-for="(u, i) in form.images" :key="i">
          <a-card size="small" :body-style="{ padding: '8px' }">
            <img :src="u" style="width: 100%; border-radius: 4px" />
          </a-card>
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false">
      <a-space>
        <a-button type="primary" @click="save">
          <template #icon><span>💾</span></template>
          {{ editingId ? "更新题目" : "保存题目" }}
        </a-button>
      </a-space>
    </a-card>
  </a-space>
</template>

<style scoped>
/* KaTeX display tweaks to ensure block math centers and inline math flows */
.content-preview :deep(.katex-display),
.answer-preview :deep(.katex-display) {
  display: block;
  margin: 8px auto;
  text-align: center;
}
.content-preview :deep(.katex),
.answer-preview :deep(.katex) {
  font-size: 1rem;
}
</style>
