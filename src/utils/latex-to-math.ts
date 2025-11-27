import {
  Math as MathComponent,
  MathRun,
  MathFraction,
  MathSuperScript,
  MathSubScript,
  MathRadical,
  MathRoundBrackets,
  MathSquareBrackets,
} from "docx";

// 将 LaTeX 转换为 docx Math 组件
export function latexToMath(latex: string): MathComponent {
  const children = parseLatexToMathComponents(latex);
  return new MathComponent({ children });
}

// 解析 LaTeX 字符串为 MathComponent 数组
function parseLatexToMathComponents(latex: string): any[] {
  const components: any[] = [];
  let i = 0;

  while (i < latex.length) {
    // 处理命令（以 \ 开头）
    if (latex[i] === "\\") {
      const result = parseCommand(latex, i);
      if (result) {
        components.push(result.component);
        i = result.nextIndex;
        continue;
      }
    }

    // 处理上标 ^
    if (latex[i] === "^") {
      const lastComponent = components.pop();
      const result = parseScript(latex, i + 1);
      if (lastComponent && result) {
        components.push(
          new MathSuperScript({
            children: [lastComponent],
            superScript: result.components,
          })
        );
        i = result.nextIndex;
        continue;
      }
    }

    // 处理下标 _
    if (latex[i] === "_") {
      const lastComponent = components.pop();
      const result = parseScript(latex, i + 1);
      if (lastComponent && result) {
        components.push(
          new MathSubScript({
            children: [lastComponent],
            subScript: result.components,
          })
        );
        i = result.nextIndex;
        continue;
      }
    }

    // 处理括号
    if (latex[i] === "(") {
      const result = parseBrackets(latex, i, "(", ")");
      if (result) {
        components.push(
          new MathRoundBrackets({
            children: result.components,
          })
        );
        i = result.nextIndex;
        continue;
      }
    }

    if (latex[i] === "[") {
      const result = parseBrackets(latex, i, "[", "]");
      if (result) {
        components.push(
          new MathSquareBrackets({
            children: result.components,
          })
        );
        i = result.nextIndex;
        continue;
      }
    }

    // 普通字符
    let text = "";
    while (
      i < latex.length &&
      latex[i] !== "\\" &&
      latex[i] !== "^" &&
      latex[i] !== "_" &&
      latex[i] !== "{" &&
      latex[i] !== "}" &&
      latex[i] !== "(" &&
      latex[i] !== ")" &&
      latex[i] !== "[" &&
      latex[i] !== "]"
    ) {
      text += latex[i];
      i++;
    }

    if (text) {
      components.push(new MathRun(text.trim()));
    } else {
      i++; // 跳过无法识别的字符
    }
  }

  return components;
}

// 解析命令（如 \frac, \sqrt 等）
function parseCommand(
  latex: string,
  startIndex: number
): { component: any; nextIndex: number } | null {
  let i = startIndex + 1; // 跳过 \
  let commandName = "";

  // 提取命令名
  while (i < latex.length) {
    const char = latex[i];
    if (!char || !/[a-zA-Z]/.test(char)) break;
    commandName += char;
    i++;
  }

  // 跳过空格
  while (i < latex.length && latex[i] === " ") {
    i++;
  }

  switch (commandName) {
    case "frac": {
      // \frac{numerator}{denominator}
      const numeratorResult = parseBlock(latex, i);
      if (!numeratorResult) return null;

      const denominatorResult = parseBlock(latex, numeratorResult.nextIndex);
      if (!denominatorResult) return null;

      return {
        component: new MathFraction({
          numerator: numeratorResult.components,
          denominator: denominatorResult.components,
        }),
        nextIndex: denominatorResult.nextIndex,
      };
    }

    case "sqrt": {
      // \sqrt{content} 或 \sqrt[n]{content}
      // 检查是否有可选参数 [n]
      let degree: any[] | undefined;
      if (i < latex.length && latex[i] === "[") {
        const degreeResult = parseBrackets(latex, i, "[", "]");
        if (degreeResult) {
          degree = degreeResult.components;
          i = degreeResult.nextIndex;
        }
      }

      const contentResult = parseBlock(latex, i);
      if (!contentResult) return null;

      return {
        component: new MathRadical({
          children: contentResult.components,
          degree: degree,
        }),
        nextIndex: contentResult.nextIndex,
      };
    }

    case "binom": {
      // \binom{n}{k} - 二项式系数，显示为分数形式
      const nResult = parseBlock(latex, i);
      if (!nResult) return null;

      const kResult = parseBlock(latex, nResult.nextIndex);
      if (!kResult) return null;

      return {
        component: new MathRoundBrackets({
          children: [
            new MathFraction({
              numerator: nResult.components,
              denominator: kResult.components,
            }),
          ],
        }),
        nextIndex: kResult.nextIndex,
      };
    }

    case "vec":
    case "overrightarrow": {
      // \vec{a} 或 \overrightarrow{AB} - 向量箭头
      const contentResult = parseBlock(latex, i);
      if (!contentResult) return null;

      // 简化处理：在内容后添加箭头符号
      return {
        component: new MathRun(
          contentResult.components.map((c: any) => c.root?.[0]?.root?.[0]?.root || "").join("") + "⃗"
        ),
        nextIndex: contentResult.nextIndex,
      };
    }

    case "mathbb": {
      // \mathbb{R} - 黑板粗体（用于数集）
      const contentResult = parseBlock(latex, i);
      if (!contentResult) return null;

      // 尝试转换为双线字母
      const blackboardMap: Record<string, string> = {
        N: "ℕ",
        Z: "ℤ",
        Q: "ℚ",
        R: "ℝ",
        C: "ℂ",
      };

      const content = contentResult.components[0];
      const text = content?.root?.[0]?.root?.[0]?.root || "";
      
      return {
        component: new MathRun(blackboardMap[text] || text),
        nextIndex: contentResult.nextIndex,
      };
    }

    case "begin": {
      // \begin{pmatrix} ... \end{pmatrix} - 矩阵
      // 简化处理：跳过 begin/end，提取内容
      // 跳过 {pmatrix}
      const envResult = parseBlock(latex, i);
      if (!envResult) return null;

      // 找到对应的 \end{pmatrix}
      let endIndex = envResult.nextIndex;
      const endPattern = "\\end{pmatrix}";
      const endPos = latex.indexOf(endPattern, endIndex);
      
      if (endPos === -1) {
        // 没找到结束标记，返回原样
        return {
          component: new MathRun("\\begin{pmatrix}"),
          nextIndex: envResult.nextIndex,
        };
      }

      const matrixContent = latex.substring(envResult.nextIndex, endPos);
      // 简化处理：将矩阵内容放在方括号中
      return {
        component: new MathSquareBrackets({
          children: [new MathRun(matrixContent.replace(/\\\\/g, " ; ").replace(/&/g, " "))],
        }),
        nextIndex: endPos + endPattern.length,
      };
    }

    case "sum":
    case "prod":
    case "int":
    case "iint":
    case "iiint":
    case "oint":
    case "lim":
    case "sin":
    case "cos":
    case "tan":
    case "cot":
    case "sec":
    case "csc":
    case "arcsin":
    case "arccos":
    case "arctan":
    case "sinh":
    case "cosh":
    case "tanh":
    case "log":
    case "ln":
    case "lg":
    case "exp":
    case "max":
    case "min":
      // 数学函数
      return {
        component: new MathRun(commandName),
        nextIndex: i,
      };

    case "left":
    case "right":
      // 跳过 \left 和 \right，直接处理后面的括号
      if (i < latex.length) {
        i++; // 跳过括号字符
      }
      return null;

    case "alpha":
    case "beta":
    case "gamma":
    case "delta":
    case "epsilon":
    case "varepsilon":
    case "zeta":
    case "eta":
    case "theta":
    case "vartheta":
    case "iota":
    case "kappa":
    case "lambda":
    case "mu":
    case "nu":
    case "xi":
    case "pi":
    case "varpi":
    case "rho":
    case "varrho":
    case "sigma":
    case "varsigma":
    case "tau":
    case "upsilon":
    case "phi":
    case "varphi":
    case "chi":
    case "psi":
    case "omega":
      // 希腊字母 - 使用 Unicode
      const greekMap: Record<string, string> = {
        alpha: "α",
        beta: "β",
        gamma: "γ",
        delta: "δ",
        epsilon: "ε",
        varepsilon: "ε",
        zeta: "ζ",
        eta: "η",
        theta: "θ",
        vartheta: "ϑ",
        iota: "ι",
        kappa: "κ",
        lambda: "λ",
        mu: "μ",
        nu: "ν",
        xi: "ξ",
        pi: "π",
        varpi: "ϖ",
        rho: "ρ",
        varrho: "ϱ",
        sigma: "σ",
        varsigma: "ς",
        tau: "τ",
        upsilon: "υ",
        phi: "φ",
        varphi: "φ",
        chi: "χ",
        psi: "ψ",
        omega: "ω",
      };
      return {
        component: new MathRun(greekMap[commandName] || commandName),
        nextIndex: i,
      };

    case "times":
      return { component: new MathRun("×"), nextIndex: i };
    case "div":
      return { component: new MathRun("÷"), nextIndex: i };
    case "pm":
      return { component: new MathRun("±"), nextIndex: i };
    case "mp":
      return { component: new MathRun("∓"), nextIndex: i };
    case "neq":
      return { component: new MathRun("≠"), nextIndex: i };
    case "leq":
      return { component: new MathRun("≤"), nextIndex: i };
    case "geq":
      return { component: new MathRun("≥"), nextIndex: i };
    case "ll":
      return { component: new MathRun("≪"), nextIndex: i };
    case "gg":
      return { component: new MathRun("≫"), nextIndex: i };
    case "approx":
      return { component: new MathRun("≈"), nextIndex: i };
    case "equiv":
      return { component: new MathRun("≡"), nextIndex: i };
    case "sim":
      return { component: new MathRun("∼"), nextIndex: i };
    case "simeq":
      return { component: new MathRun("≃"), nextIndex: i };
    case "cong":
      return { component: new MathRun("≅"), nextIndex: i };
    case "propto":
      return { component: new MathRun("∝"), nextIndex: i };
    case "infty":
      return { component: new MathRun("∞"), nextIndex: i };
    case "cdot":
      return { component: new MathRun("·"), nextIndex: i };
    case "ast":
      return { component: new MathRun("*"), nextIndex: i };
    case "star":
      return { component: new MathRun("⋆"), nextIndex: i };
    case "circ":
      return { component: new MathRun("∘"), nextIndex: i };
    case "bullet":
      return { component: new MathRun("•"), nextIndex: i };
    case "oplus":
      return { component: new MathRun("⊕"), nextIndex: i };
    case "ominus":
      return { component: new MathRun("⊖"), nextIndex: i };
    case "otimes":
      return { component: new MathRun("⊗"), nextIndex: i };
    case "oslash":
      return { component: new MathRun("⊘"), nextIndex: i };
    case "coprod":
      return { component: new MathRun("∐"), nextIndex: i };
    case "bigcup":
      return { component: new MathRun("⋃"), nextIndex: i };
    case "bigcap":
      return { component: new MathRun("⋂"), nextIndex: i };
    case "in":
      return { component: new MathRun("∈"), nextIndex: i };
    case "notin":
      return { component: new MathRun("∉"), nextIndex: i };
    case "ni":
      return { component: new MathRun("∋"), nextIndex: i };
    case "subset":
      return { component: new MathRun("⊂"), nextIndex: i };
    case "subseteq":
      return { component: new MathRun("⊆"), nextIndex: i };
    case "supset":
      return { component: new MathRun("⊃"), nextIndex: i };
    case "supseteq":
      return { component: new MathRun("⊇"), nextIndex: i };
    case "cup":
      return { component: new MathRun("∪"), nextIndex: i };
    case "cap":
      return { component: new MathRun("∩"), nextIndex: i };
    case "setminus":
      return { component: new MathRun("∖"), nextIndex: i };
    case "emptyset":
      return { component: new MathRun("∅"), nextIndex: i };
    case "partial":
      return { component: new MathRun("∂"), nextIndex: i };
    case "nabla":
      return { component: new MathRun("∇"), nextIndex: i };
    case "forall":
      return { component: new MathRun("∀"), nextIndex: i };
    case "exists":
      return { component: new MathRun("∃"), nextIndex: i };
    case "nexists":
      return { component: new MathRun("∄"), nextIndex: i };
    case "neg":
      return { component: new MathRun("¬"), nextIndex: i };
    case "land":
      return { component: new MathRun("∧"), nextIndex: i };
    case "lor":
      return { component: new MathRun("∨"), nextIndex: i };
    case "to":
    case "rightarrow":
      return { component: new MathRun("→"), nextIndex: i };
    case "leftarrow":
      return { component: new MathRun("←"), nextIndex: i };
    case "leftrightarrow":
      return { component: new MathRun("↔"), nextIndex: i };
    case "Rightarrow":
    case "implies":
      return { component: new MathRun("⇒"), nextIndex: i };
    case "Leftarrow":
      return { component: new MathRun("⇐"), nextIndex: i };
    case "Leftrightarrow":
    case "iff":
      return { component: new MathRun("⇔"), nextIndex: i };
    case "perp":
      return { component: new MathRun("⊥"), nextIndex: i };
    case "parallel":
      return { component: new MathRun("∥"), nextIndex: i };
    case "angle":
      return { component: new MathRun("∠"), nextIndex: i };
    case "triangle":
      return { component: new MathRun("△"), nextIndex: i };
    case "ldots":
      return { component: new MathRun("…"), nextIndex: i };
    case "cdots":
      return { component: new MathRun("⋯"), nextIndex: i };
    case "vdots":
      return { component: new MathRun("⋮"), nextIndex: i };
    case "ddots":
      return { component: new MathRun("⋱"), nextIndex: i };
    case "langle":
      return { component: new MathRun("⟨"), nextIndex: i };
    case "rangle":
      return { component: new MathRun("⟩"), nextIndex: i };
    case "lceil":
      return { component: new MathRun("⌈"), nextIndex: i };
    case "rceil":
      return { component: new MathRun("⌉"), nextIndex: i };
    case "lfloor":
      return { component: new MathRun("⌊"), nextIndex: i };
    case "rfloor":
      return { component: new MathRun("⌋"), nextIndex: i };

    default:
      // 未知命令，返回原样
      return {
        component: new MathRun("\\" + commandName),
        nextIndex: i,
      };
  }
}

// 解析花括号包裹的块 {...}
function parseBlock(
  latex: string,
  startIndex: number
): { components: any[]; nextIndex: number } | null {
  let i = startIndex;

  // 跳过空格
  while (i < latex.length && latex[i] === " ") {
    i++;
  }

  if (i >= latex.length || latex[i] !== "{") {
    return null;
  }

  i++; // 跳过 {
  let braceCount = 1;
  let content = "";

  while (i < latex.length && braceCount > 0) {
    if (latex[i] === "{") {
      braceCount++;
    } else if (latex[i] === "}") {
      braceCount--;
      if (braceCount === 0) break;
    }
    content += latex[i];
    i++;
  }

  i++; // 跳过 }

  return {
    components: parseLatexToMathComponents(content),
    nextIndex: i,
  };
}

// 解析上标或下标（可能是单个字符或花括号块）
function parseScript(
  latex: string,
  startIndex: number
): { components: any[]; nextIndex: number } | null {
  let i = startIndex;

  // 跳过空格
  while (i < latex.length && latex[i] === " ") {
    i++;
  }

  if (i >= latex.length) return null;

  // 如果是花括号，解析整个块
  if (latex[i] === "{") {
    return parseBlock(latex, i);
  }

  // 否则只取一个字符
  const char = latex[i];
  if (!char) return null;
  
  return {
    components: [new MathRun(char)],
    nextIndex: i + 1,
  };
}

// 解析括号内容
function parseBrackets(
  latex: string,
  startIndex: number,
  openBracket: string,
  closeBracket: string
): { components: any[]; nextIndex: number } | null {
  let i = startIndex;

  if (i >= latex.length || latex[i] !== openBracket) {
    return null;
  }

  i++; // 跳过开括号
  let bracketCount = 1;
  let content = "";

  while (i < latex.length && bracketCount > 0) {
    if (latex[i] === openBracket) {
      bracketCount++;
    } else if (latex[i] === closeBracket) {
      bracketCount--;
      if (bracketCount === 0) break;
    }
    content += latex[i];
    i++;
  }

  i++; // 跳过闭括号

  return {
    components: parseLatexToMathComponents(content),
    nextIndex: i,
  };
}
