import { reactive } from "vue";

export enum TagType {
  none = 0,
  text,
  number,
  boolean,
  select,
  multiSelect,
}

export const TagName = {
  [TagType.none]: "无",
  [TagType.text]: "文本",
  [TagType.number]: "数字",
  [TagType.boolean]: "判断",
  [TagType.select]: "单选",
  [TagType.multiSelect]: "多选",
};

export interface Tag {
  id: string;
  name: string;
  color: string;
  required: boolean;
  type: TagType;
  options: string[];
}

export interface Question {
  id: string;
  title: string;
  content: string;
  answers: string[];
  tags: Record<string, any>;
  images?: string[];
}

const state = reactive({
  tags: [] as Tag[],
  questions: [] as Question[],
});

const DB_NAME = "exercises_db";
const DB_VERSION = 1;
const STORE_TAGS = "tags";
const STORE_QUESTIONS = "questions";

let db: IDBDatabase | null = null;

// 初始化 IndexedDB
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open IndexedDB", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // 创建 tags 对象存储
      if (!database.objectStoreNames.contains(STORE_TAGS)) {
        database.createObjectStore(STORE_TAGS, { keyPath: "id" });
      }

      // 创建 questions 对象存储
      if (!database.objectStoreNames.contains(STORE_QUESTIONS)) {
        database.createObjectStore(STORE_QUESTIONS, { keyPath: "id" });
      }
    };
  });
}

// 从 IndexedDB 加载数据
async function loadFromStorage() {
  try {
    const database = await initDB();

    // 加载 tags
    const tagsTransaction = database.transaction(STORE_TAGS, "readonly");
    const tagsStore = tagsTransaction.objectStore(STORE_TAGS);
    const tagsRequest = tagsStore.getAll();

    tagsRequest.onsuccess = () => {
      const tags = tagsRequest.result;
      if (Array.isArray(tags) && tags.length > 0) {
        state.tags.splice(0, state.tags.length, ...tags);
      }
    };

    // 加载 questions
    const questionsTransaction = database.transaction(
      STORE_QUESTIONS,
      "readonly"
    );
    const questionsStore = questionsTransaction.objectStore(STORE_QUESTIONS);
    const questionsRequest = questionsStore.getAll();

    questionsRequest.onsuccess = () => {
      const questions = questionsRequest.result;
      if (Array.isArray(questions) && questions.length > 0) {
        state.questions.splice(0, state.questions.length, ...questions);
      }
    };
  } catch (e) {
    console.warn("Failed to load from IndexedDB", e);
  }
}


// 持久化数据到 IndexedDB
async function persist() {
  try {
    const database = await initDB();

    // 保存 tags - 转换为纯对象避免 Proxy 克隆问题
    const tagsTransaction = database.transaction(STORE_TAGS, "readwrite");
    const tagsStore = tagsTransaction.objectStore(STORE_TAGS);

    // 清空现有数据
    await new Promise<void>((resolve, reject) => {
      const clearRequest = tagsStore.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    // 添加新数据 - 使用 JSON 序列化/反序列化来创建纯对象
    for (const tag of state.tags) {
      const plainTag = JSON.parse(JSON.stringify(tag));
      tagsStore.add(plainTag);
    }

    // 保存 questions
    const questionsTransaction = database.transaction(
      STORE_QUESTIONS,
      "readwrite"
    );
    const questionsStore = questionsTransaction.objectStore(STORE_QUESTIONS);

    // 清空现有数据
    await new Promise<void>((resolve, reject) => {
      const clearRequest = questionsStore.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    // 添加新数据 - 使用 JSON 序列化/反序列化来创建纯对象
    for (const question of state.questions) {
      const plainQuestion = JSON.parse(JSON.stringify(question));
      questionsStore.add(plainQuestion);
    }
  } catch (e) {
    console.warn("Failed to persist to IndexedDB", e);
  }
}

loadFromStorage();

function addTag(t: Tag) {
  state.tags.push(t);
  persist();
}
function updateTag(id: string, patch: Partial<Tag>) {
  const t = state.tags.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
  persist();
}
function removeTag(id: string) {
  state.tags = state.tags.filter((x) => x.id !== id);
  persist();
}
function addQuestion(q: Question) {
  state.questions.push(q);
  persist();
}
function updateQuestion(id: string, patch: Partial<Question>) {
  const q = state.questions.find((x) => x.id === id);
  if (q) Object.assign(q, patch);
  persist();
}
function removeQuestion(id: string) {
  state.questions = state.questions.filter((x) => x.id !== id);
  persist();
}

function exportData() {
  return { tags: state.tags.slice(), questions: state.questions.slice() };
}

function replaceAll(data: { tags?: Tag[]; questions?: Question[] }) {
  if (Array.isArray(data.tags))
    state.tags.splice(0, state.tags.length, ...data.tags);
  if (Array.isArray(data.questions))
    state.questions.splice(0, state.questions.length, ...data.questions);
  persist();
}

function mergeData(data: { tags?: Tag[]; questions?: Question[] }) {
  if (Array.isArray(data.tags)) {
    for (const t of data.tags) {
      if (!state.tags.some((x) => x.id === t.id)) state.tags.push(t);
    }
  }
  if (Array.isArray(data.questions)) {
    for (const q of data.questions) {
      if (!state.questions.some((x) => x.id === q.id)) state.questions.push(q);
    }
  }
  persist();
}

function filterQuestionsByTags(selectors: Record<string, any>): Question[] {
  let pool = state.questions.slice();

  pool = pool.filter((q) => {
    for (const tagId in selectors) {
      const sValue = selectors[tagId];
      if (
        sValue == null ||
        sValue === "" ||
        (Array.isArray(sValue) && sValue.length === 0)
      ) {
        continue;
      }

      if (q.tags[tagId] == null) {
        return false;
      }

      const qValue = q.tags[tagId].value;
      if (qValue == null) {
        return false;
      }

      const tag = state.tags.find((t) => t.id === tagId);
      if (!tag) continue;

      if (tag.type === TagType.text) {
        if (!qValue.includes(sValue)) {
          return false;
        }
      } else if (tag.type === TagType.select || tag.type === TagType.boolean) {
        if (qValue != sValue) {
          return false;
        }
      } else if (tag.type === TagType.multiSelect) {
        if (
          !Array.isArray(qValue) ||
          !Array.isArray(sValue) ||
          qValue.every((qv) => !sValue.includes(qv))
        ) {
          return false;
        }
      } else if (tag.type === TagType.number) {
        let min = -Infinity;
        let max = Infinity;
        if (Array.isArray(sValue)) {
          min = Number(sValue[0]);
          max = Number(sValue[1]);
        }

        if (min === max && min === 0) {
          continue;
        }

        if (min > qValue || qValue > max) {
          return false;
        }
      }
    }

    return true;
  });

  return pool;
}

export {
  state,
  addTag,
  updateTag,
  removeTag,
  addQuestion,
  updateQuestion,
  removeQuestion,
  exportData,
  replaceAll,
  mergeData,
  filterQuestionsByTags,
};

export default {
  state,
  addTag,
  updateTag,
  removeTag,
  addQuestion,
  updateQuestion,
  removeQuestion,
  exportData,
  replaceAll,
  mergeData,
};
