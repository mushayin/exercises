
const str = '0123456789abcdef';

export function generateUUID() {
  // 使用 crypto API 生成 UUID  
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    // 备用方案：使用 Math.random 生成伪随机 UUID
    let uuid = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += "-";
      } else {
        const randomIndex = Math.floor(Math.random() * 16);
        uuid += str[randomIndex];
      }
    }
    return uuid;
  }
}