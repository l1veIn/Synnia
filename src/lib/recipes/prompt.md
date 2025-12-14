# Synnia Recipe 配方编写指南

本文档指导 AI 或开发者如何为 Synnia 创建配方（Recipe）。

---

## 配方结构

每个配方是一个 `manifest.yaml` 文件，包含以下部分：

```yaml
# 基本信息（必填）
id: category.recipe-name       # 唯一ID，格式：分类.名称
name: Recipe Name              # 显示名称
description: What it does      # 简短描述
category: Category             # 分类：AI, Text, Math, Agent, Utility 等
icon: IconName                 # Lucide 图标名称

# 继承（可选）
mixin:
  - parent.recipe              # 继承其他配方的字段

# 输入字段（必填）
inputSchema:
  - key: fieldName             # 字段标识符
    label: Field Label         # 显示名称
    type: string|number|boolean|select
    widget: text|textarea|number|slider|switch|select|none
    required: true|false
    default: defaultValue
    placeholder: "提示文字"
    hidden: true               # 隐藏字段（用于覆盖 mixin）
    connection:
      input: true              # 左侧输入连接点
      output: true             # 右侧输出连接点

# 输出描述（可选）
outputSchema:
  type: json|text|image|void
  description: Output description

# 执行器配置（必填）
executor:
  type: template|expression|http|llm-agent|custom
  # ... 执行器特定配置
```

---

## 执行器类型

### 1. template - 字符串模板
```yaml
executor:
  type: template
  template: "{{text1}}{{separator}}{{text2}}"
  outputKey: result
```

### 2. expression - JavaScript 表达式
```yaml
executor:
  type: expression
  expression: "a + b * 2"
  outputKey: result
```

### 3. http - HTTP 请求
```yaml
executor:
  type: http
  url: "https://api.example.com/{{endpoint}}"
  method: POST
  headers:
    Authorization: "Bearer {{token}}"
  body: '{"query": "{{query}}"}'
  responseType: json
  outputKey: response
```

### 4. llm-agent - LLM 调用
```yaml
executor:
  type: llm-agent
  systemPrompt: |
    你是一个专业的助手...
  userPromptTemplate: |
    请根据以下信息生成：
    - 输入1: {{input1}}
    - 输入2: {{input2}}
  parseAs: json|text
  temperature: 0.7
  maxTokens: 2048
  # 自动创建输出节点
  createNodes: true
  nodeConfig:
    type: json
    titleTemplate: "#{{index}}: {{name}}"
    collapsed: true
```

---

## 模板语法

使用 `{{variableName}}` 引用输入字段的值：

```yaml
template: "Hello, {{userName}}! You have {{count}} messages."
```

---

## Mixin 继承

使用 `mixin` 继承其他配方的字段：

```yaml
mixin:
  - llm.call   # 继承 LLM 配置字段（temperature, maxTokens 等）

inputSchema:
  # 覆盖继承的字段
  - key: temperature
    default: 0.9        # 修改默认值
  
  - key: prompt
    hidden: true        # 隐藏字段
```

---

## 最佳实践

1. **ID 命名**：使用 `分类.功能` 格式，如 `text.concat`, `agent.naming-master`
2. **字段设计**：
   - 必填字段设置 `required: true`
   - 提供合理的 `default` 和 `placeholder`
   - 需要连接的字段设置 `connection`
3. **LLM 提示词**：
   - 明确指定输出格式（JSON、文本等）
   - 使用分点说明任务要求
   - 如需 JSON 输出，强调"只返回 JSON，不要其他文字"
4. **测试**：修改后重启应用验证配方是否正常加载

---

## 示例：创建新配方

### 文本摘要配方
```yaml
id: text.summarize
name: 文本摘要
description: 使用 AI 生成文本摘要
category: Text
icon: FileText

mixin:
  - llm.call

inputSchema:
  - key: text
    label: 原文
    type: string
    widget: textarea
    required: true
    connection:
      input: true

  - key: length
    label: 摘要长度
    type: select
    widget: select
    default: medium
    options:
      - short
      - medium
      - long

  - key: prompt
    hidden: true

  - key: result
    label: 摘要
    type: string
    widget: none
    connection:
      output: true

executor:
  type: llm-agent
  systemPrompt: |
    你是一个专业的文本摘要助手。
    根据用户指定的长度生成摘要：
    - short: 1-2句话
    - medium: 3-5句话
    - long: 一段完整的摘要
  userPromptTemplate: |
    请为以下文本生成{{length}}长度的摘要：

    {{text}}
  parseAs: text
```
