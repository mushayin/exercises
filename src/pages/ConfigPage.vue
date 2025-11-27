<script setup lang="ts">
import { reactive, ref, computed } from "vue";
import store, {
  type Tag,
  TagName,
  TagType,
  addTag as addTagToStore,
  removeTag as removeTagFromStore,
} from "../store";
import { Modal, notification } from "ant-design-vue";
import { generateUUID } from "../utils/uuid";

const tagOptions = [
  {
    value: TagType.text,
    label: TagName[TagType.text],
  },
  {
    value: TagType.number,
    label: TagName[TagType.number],
  },
  {
    value: TagType.boolean,
    label: TagName[TagType.boolean],
  },
  {
    value: TagType.select,
    label: TagName[TagType.select],
  },
  {
    value: TagType.multiSelect,
    label: TagName[TagType.multiSelect],
  },
];

// add form for new tag
const form = reactive({
  name: "",
  color: "#09233e",
  required: false,
  type: TagType.text,
  options: [] as string[],
});

// 下拉框容器设置函数
function getPopupContainer(trigger: HTMLElement) {
  return trigger.parentElement || document.body;
}

function addTag() {
  const t: Tag = {
    id: generateUUID(),
    name: form.name || "未命名",
    color: form.color,
    required: form.required,
    type: form.type,
    options: form.options.filter((v) => v.trim().length),
  };
  addTagToStore(t);
  form.name = "";
  form.options = [];
}

// function copyTag(t: Tag) {
//   try {
//     window.navigator.clipboard.writeText(JSON.stringify(t));
//     notification.success({
//       message: "已复制",
//       description: "标签 JSON 已复制到剪贴板",
//     });
//   } catch (e) {
//     notification.error({ message: "复制失败" });
//   }
// }

function deleteTag(id: string) {
  Modal.confirm({
    title: "确认删除",
    content: "确认删除该标签？此操作不可撤销。",
    cancelText: "取消",
    okText: "删除",
    okType: "danger",
    onOk() {
      removeTagFromStore(id);
      notification.success({ message: "已删除" });
    },
  });
}

// edit modal state
const editVisible = ref(false);
const editForm = reactive({
  id: "",
  name: "",
  color: "",
  required: false,
  type: TagType.text,
  options: [] as string[],
});

// control which tags are displayed: default only required
const showType = ref(TagType.none);
const displayedTags = computed(() =>
  store.state.tags.filter((t) => !showType.value || t.type === showType.value)
);

function startEdit(t: Tag) {
  debugger;
  editForm.id = t.id;
  editForm.name = t.name;
  editForm.color = t.color;
  editForm.required = t.required;
  editForm.type = t.type;
  editForm.options = [...t.options];
  editVisible.value = true;
}

function saveEdit() {
  const updated: Partial<Tag> = {
    name: editForm.name,
    color: editForm.color,
    required: editForm.required,
    type: editForm.type,
    options: editForm.options.filter((v) => v.trim().length),
  };
  // update via store's updateTag
  try {
    // import updateTag dynamically from store default
    (async () => {
      const s = await import("../store");
      s.updateTag(editForm.id, updated);
      notification.success({ message: "保存成功" });
      editVisible.value = false;
    })();
  } catch (e) {
    notification.error({ message: "保存失败" });
  }
}

// import/export controls moved to 录入题目 页面
</script>

<template>
  <a-space direction="vertical" style="width: 100%">
    <div>
      <a-typography-title :level="2">标签配置</a-typography-title>
      <a-card title="新建标签" :bordered="false">
        <a-space direction="vertical" style="width: 100%">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-input v-model:value="form.name" placeholder="标签名" />
            </a-col>
            <a-col :span="4">
              <a-input type="color" v-model:value="form.color" />
            </a-col>
            <a-col :span="4">
              <a-checkbox v-model:checked="form.required"> 必选 </a-checkbox>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="8">
              <a-select
                v-model:value="form.type"
                :options="tagOptions"
                :get-popup-container="getPopupContainer"
                style="width: 100%"
              />
            </a-col>
            <a-col :span="12">
              <a-select
                v-if="
                  form.type === TagType.select ||
                  form.type === TagType.multiSelect
                "
                v-model:value="form.options"
                mode="tags"
                placeholder="输入选项后按回车添加"
                :get-popup-container="getPopupContainer"
                style="width: 100%"
              />
            </a-col>
          </a-row>

          <a-row>
            <a-col>
              <a-button type="primary" @click="addTag"> 添加标签 </a-button>
            </a-col>
          </a-row>
        </a-space>
      </a-card>
    </div>

    <a-divider />

    <div>
      <a-typography-title :level="3">已有标签</a-typography-title>
      <a-row :gutter="[16, 16]">
        <a-col
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
          v-for="t in displayedTags"
          :key="t.id"
        >
          <a-card :bordered="true" hoverable>
            <template #title>
              <a-space>
                <a-tag :color="t.color">{{ t.name }}</a-tag>
                <a-typography-text style="font-size: 12px">
                  {{ TagName[t.type] }}
                </a-typography-text>
              </a-space>
            </template>
            <template #extra>
              <a-badge v-if="t.required" status="error" text="必选" />
            </template>

            <a-space direction="vertical" style="width: 100%">
              <a-typography-paragraph
                v-if="t.options && t.options.length"
                style="margin: 0"
              >
                <a-typography-text>选项: </a-typography-text>
                {{ t.options.join(", ") }}
              </a-typography-paragraph>

              <a-space style="width: 100%; justify-content: flex-end">
                <a-button size="small" @click="() => startEdit(t)"
                  >编辑</a-button
                >
                <a-button size="small" danger @click="() => deleteTag(t.id)">
                  删除
                </a-button>
              </a-space>
            </a-space>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </a-space>

  <a-modal
    v-model:open="editVisible"
    title="编辑标签"
    ok-text="保存"
    cancel-text="取消"
    @ok="saveEdit"
    :width="600"
  >
    <a-form layout="vertical">
      <a-form-item label="标签名">
        <a-input v-model:value="editForm.name" placeholder="请输入标签名" />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="颜色">
            <a-input
              type="color"
              v-model:value="editForm.color"
              style="height: 40px; cursor: pointer"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="类型">
            <a-select
              v-model:value="editForm.type"
              :options="tagOptions"
              :get-popup-container="getPopupContainer"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="" style="margin-top: 30px">
            <a-checkbox v-model:checked="editForm.required"> 必选 </a-checkbox>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item
        v-if="
          editForm.type === TagType.select ||
          editForm.type === TagType.multiSelect
        "
        label="选项"
      >
        <a-select
          v-model:value="editForm.options"
          mode="tags"
          placeholder="输入选项后按回车添加"
          :get-popup-container="getPopupContainer"
          style="width: 100%"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
/* 所有样式已通过 Ant Design 组件实现 */
</style>
