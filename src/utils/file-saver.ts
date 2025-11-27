// 手动实现 saveAs 函数，用于下载文件
export function saveAs(data: Blob | string, filename: string): void {
  // 创建 Blob 对象
  let blob: Blob;
  
  if (data instanceof Blob) {
    blob = data;
  } else if (typeof data === "string") {
    blob = new Blob([data], { type: "text/plain;charset=utf-8" });
  } else {
    throw new Error("Unsupported data type for saveAs");
  }

  // 创建临时 URL
  const url = URL.createObjectURL(blob);

  // 创建隐藏的 <a> 元素
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  // 添加到 DOM，触发点击，然后移除
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 释放 URL 对象
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}
