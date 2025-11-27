import { notification } from "ant-design-vue";
import katex from "katex";

// 解析 LaTeX 公式为 HTML（用于编辑器预览）
// 支持混合文本：普通文字 + $公式$ 或纯 LaTeX 代码
export function parseLatex(text: string): string {
  if (!text) return "";

  try {
    // 检查是否包含 $ 符号，如果包含则处理混合文本
    if (text.includes("$")) {
      return text.replace(/\$(.+?)\$/g, (_, formula) => {
        return katex.renderToString(formula.trim(), {
          throwOnError: false,
          displayMode: false,
          output: "mathml",
        });
      });
    } else {
      // 纯 LaTeX 代码，直接渲染
      return katex.renderToString(text, {
        throwOnError: false,
        displayMode: false,
        output: "mathml",
      });
    }
  } catch (e: any) {
    notification.error({
      message: "LaTeX 解析错误",
      description: e.message,
    });

    return text;
  }
}
