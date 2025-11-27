import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import './style.css'
// import 'katex/dist/katex.min.css'
import App from './App.vue'

import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css';

import ConfigPage from './pages/ConfigPage.vue'
import EntryPage from './pages/EntryPage.vue'
import GeneratePage from './pages/GeneratePage.vue'
import ViewPage from './pages/ViewPage.vue'

const routes = [
	{ path: '/', redirect: '/entry' },
	{ path: '/config', component: ConfigPage },
	{ path: '/entry', component: EntryPage },
	{ path: '/generate', component: GeneratePage },
	{ path: '/view', component: ViewPage }
]

const router = createRouter({ history: createWebHashHistory(), routes })

createApp(App).use(router).use(Antd).mount('#app')
