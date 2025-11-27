<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

// 根据当前路由计算选中的菜单项
const selectedKeys = computed(() => {
  const path = route.path;
  if (path.startsWith("/config")) return ["config"];
  if (path.startsWith("/entry")) return ["entry"];
  if (path.startsWith("/view")) return ["view"];
  if (path.startsWith("/generate")) return ["generate"];
  return [];
});
</script>

<template>
  <a-layout class="app-layout">
    <a-layout-header class="app-header">
      <div class="header-wrapper">
        <div class="logo">试题录入器</div>
        <a-menu 
          theme="dark" 
          mode="horizontal" 
          class="header-menu"
          :selected-keys="selectedKeys"
        >
          <a-menu-item key="config">
            <router-link to="/config">配置</router-link>
          </a-menu-item>
          <a-menu-item key="entry">
            <router-link to="/entry">录入题目</router-link>
          </a-menu-item>
          <a-menu-item key="view">
            <router-link to="/view">查看题目</router-link>
          </a-menu-item>
          <a-menu-item key="generate">
            <router-link to="/generate">生成试题</router-link>
          </a-menu-item>
        </a-menu>
      </div>
    </a-layout-header>
    <a-layout-content class="app-content">
      <div class="content-wrapper">
        <router-view />
      </div>
    </a-layout-content>
  </a-layout>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 50px;
  flex-shrink: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-wrapper {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  max-width: 1200px;
  padding: 0 24px;
}

.logo {
  color: #fff;
  font-weight: 600;
  font-size: 18px;
  white-space: nowrap;
}

.header-menu {
  flex: 1;
  border: none;
}

.header-menu :deep(a) {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
}

.header-menu :deep(a:hover) {
  color: #fff;
}

.app-content {
  flex: 1;
  padding: 24px 50px;
  background: #f0f2f5;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02);
}
</style>
