# Synnia Recipe 配方编写指南

本文档指导 AI 或开发者如何为 Synnia 创建配方（Recipe）。

---

## 配方结构

每个配方是一个 YAML 文件，存放在 `src/lib/recipes/builtin/` 目录下：

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
    type: string|number|boolean|select|object
    widget: text|textarea|number|slider|switch|select|node-input|none
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

### 4. llm-agent - LLM 调用（最常用）
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
  
  # 自动创建产物节点
  createNodes: true
  nodeConfig:
    type: selector|table|json|auto
    titleTemplate: "命名方案 ({{count}}项)"
    collapsed: false
    selectorMode: single|multi      # type=selector 时生效
    schema:                         # 显式定义 schema（可选）
      - key: name
        label: 名称
        type: string
```

---

## 节点创建配置 (nodeConfig)

`llm-agent` 执行器支持自动创建产物节点。根据 `type` 不同，创建方式也不同：

### type: selector - 创建一个选择器节点
所有 LLM 返回的数组项变成选择器选项：

```yaml
nodeConfig:
  type: selector
  selectorMode: single       # 单选
  titleTemplate: "命名方案 ({{count}}项)"
  collapsed: false
  schema:
    - key: name
      label: 名称
      type: string
    - key: description
      label: 描述
      type: string
```

### type: table - 创建一个表格节点
所有数组项变成表格行：

```yaml
nodeConfig:
  type: table
  titleTemplate: "结果表格 ({{count}}行)"
  collapsed: false
  schema:
    - key: item
      label: 项目
      type: string
    - key: value
      label: 数值
      type: number
```

### type: json - 创建多个 JSON 节点（默认）
每个数组项创建一个独立的 JSON 节点，自动 Docking：

```yaml
nodeConfig:
  type: json
  titleTemplate: "#{{index}}: {{name}}"
  collapsed: true
```

### type: auto - 自动推断
等同于 `json`，从数据结构自动推断 schema。

---

## Schema 配置

显式定义 schema 可以获得更好的字段标签和类型控制：

```yaml
schema:
  - key: name           # 字段 key（必须与数据匹配）
    label: 名称          # 显示标签
    type: string        # 类型：string, number, boolean, select
  - key: score
    label: 评分
    type: number
  - key: selected
    label: 已选中
    type: boolean
```

如果省略 `schema` 或设为 `auto`，系统会从 LLM 返回的数据自动推断。

---

## 模板语法

使用 `{{variableName}}` 引用输入字段的值：

```yaml
template: "Hello, {{userName}}! You have {{count}} messages."
```

**特殊变量：**
- `{{index}}` - 当前项索引（从1开始）
- `{{count}}` - 数组总数

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

## Output Edge (产物边)

配方执行完成后，会自动：
1. 创建产物节点（根据 `nodeConfig` 配置）
2. 在配方节点和产物节点之间创建 **Output Edge**（紫色虚线）
3. 产物节点顶部显示紫色 **input** 端口

删除 Output Edge 时会提示是否同时删除产物节点。

---

## 最佳实践

1. **ID 命名**：使用 `分类.功能` 格式，如 `text.concat`, `agent.naming-master`
2. **选择节点类型**：
   - 需要用户选择 → `selector`
   - 需要展示表格数据 → `table`
   - 需要逐个展开查看 → `json`
3. **显式 Schema**：
   - 有明确数据结构时使用显式 schema
   - 可以提供更友好的字段标签
4. **LLM 提示词**：
   - 明确指定输出格式（JSON、文本等）
   - 使用分点说明任务要求
   - 如需 JSON 输出，强调"只返回 JSON 数组，不要其他文字"
5. **测试**：修改后热重载验证配方是否正常加载

---

## 完整示例：命名大师

```yaml
id: agent.naming-master-zh
name: 命名大师
description: 使用"相关度光谱"策略，为品牌生成9个虚拟IP角色名称
category: Agent
icon: Wand2

mixin:
  - llm.call

inputSchema:
  - key: productType
    label: 产品类型
    type: string
    widget: text
    required: true
    placeholder: "例如：天气App、电商平台、健身应用..."
    connection:
      input: true

  - key: targetAudience
    label: 目标用户
    type: string
    widget: text
    placeholder: "例如：年轻白领、Z世代游戏玩家..."
    connection:
      input: true

  - key: prompt
    hidden: true

  - key: temperature
    label: 创意程度
    default: 0.9

executor:
  type: llm-agent
  systemPrompt: |
    你是一位世界顶级的虚拟IP架构师...
    
    【输出规范】
    - name：角色名字
    - tagline：口头禅
    - rationale：理由
    - style：风格
    
    只返回 JSON 数组。
  userPromptTemplate: |
    请为以下产品生成9个虚拟IP角色名称：
    产品类型：{{productType}}
    目标用户：{{targetAudience}}
  parseAs: json
  createNodes: true
  nodeConfig:
    type: selector
    selectorMode: single
    titleTemplate: "命名方案 ({{count}}项)"
    collapsed: false
    schema:
      - key: name
        label: 名称
        type: string
      - key: tagline
        label: 口号
        type: string
      - key: rationale
        label: 理由
        type: string
      - key: style
        label: 风格
        type: string
```
