# Node Output Configuration Reference

> **Auto-generated** by `pnpm gen:node-docs`

This document describes how to configure `nodeConfig` in recipe YAML files.

---

## Quick Reference

| Type | Alias | Description |
|------|-------|-------------|
| Selector | `selector` | Select items from a list |
| Table | `table` | Editable data table |
| Gallery | `gallery` | Image gallery with preview |
| JSON | `json` | Custom JSON data with schema |
| Text | `text` | Text content |
| Image | `image` | Import image from file |

---

## Node Types

### Selector (`type: selector`)

**Category:** Asset  
**Description:** Select items from a list

#### Content Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| mode | `enum` |  | `multi` | Selection mode |
| showSearch | `boolean` |  | `true` | Show search input |
| optionSchema | [`FieldDefinition[]`](#fielddefinition) |  | - | Schema for option fields |
| options | `object[]` | ✓ | - | List of selectable options |
| selected | `string[]` |  | `[]` | IDs of selected options |

---

### Table (`type: table`)

**Category:** Asset  
**Description:** Editable data table

#### Content Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| columns | [`TableColumn[]`](#tablecolumn) | ✓ | - | Column definitions |
| rows | `object[]` | ✓ | - | Table row data |
| showRowNumbers | `boolean` |  | `true` | Show row numbers |
| allowAddRow | `boolean` |  | `true` | Allow adding rows |
| allowDeleteRow | `boolean` |  | `true` | Allow deleting rows |

---

### Gallery (`type: gallery`)

**Category:** Asset  
**Description:** Image gallery with preview

#### Content Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| viewMode | `enum` |  | `grid` | View mode |
| columnsPerRow | `number` |  | `4` | Columns per row in grid view |
| allowStar | `boolean` |  | `true` | Allow starring images |
| allowDelete | `boolean` |  | `true` | Allow deleting images |
| images | [`GalleryImage[]`](#galleryimage) | ✓ | - | Gallery images |

---

### JSON (`type: json`)

**Category:** Asset  
**Description:** Custom JSON data with schema

#### Content Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| schema | [`FieldDefinition[]`](#fielddefinition) |  | - | Field schema |
| values | `object` | ✓ | - | Form values |

---

### Text (`type: text`)

**Category:** Asset  
**Description:** Text content

#### Content Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| content | `string` | ✓ | - | Text content |

---

### Image (`type: image`)

**Category:** Asset  
**Description:** Import image from file

#### Content Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| content | `string` | ✓ | - | Image URL or path |

---

## Type Definitions

The following types are auto-parsed from TypeScript source files.

### FieldDefinition

> Source: `types/assets.ts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` |  | Internal ID for UI key stability |
| key | `string` | ✓ | The actual variable name |
| label | `string` |  | Human readable label |
| type | `FieldType` | ✓ | - |
| widget | `WidgetType` |  | - |
| rules | `FieldRule` |  | - |
| connection | `FieldConnection` |  | - |
| defaultValue | `any` |  | - |
| disabled | `boolean` |  | Whether the field is read-only |
| hidden | `boolean` |  | Whether to hide in Inspector (for mixin overrides) |
| options | `object` |  | Widget-specific options (e.g. category for model-configurator) |

### TableColumn

> Source: `components/workflow/nodes/TableNode/index.tsx`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| key | `string` | ✓ | - |
| label | `string` | ✓ | - |
| type | `'string' | 'number' | 'boolean'` | ✓ | - |
| width | `number` |  | - |

### GalleryImage

> Source: `components/workflow/nodes/GalleryNode/index.tsx`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | ✓ | - |
| src | `string` | ✓ | - |
| starred | `boolean` | ✓ | - |
| caption | `string` |  | - |
| mediaAssetId | `string` |  | Reference to source asset in library |

### QueueTask

> Source: `components/workflow/nodes/QueueNode/index.tsx`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | ✓ | - |
| name | `string` | ✓ | - |
| status | `TaskStatus` | ✓ | - |
| result | `any` |  | - |
| error | `string` |  | - |
| duration | `number` |  | - |

---

## nodeConfig Usage

```yaml
output:
  createNodes: true
  nodeConfig:
    type: json | table | gallery | selector | text | image
    schema: auto | FieldDef[]
    titleTemplate: string
    collapsed: boolean
```

### Title Template Variables
- `{{count}}` - Number of items (for table/gallery/selector)
- `{{index}}` - 1-based index (for json type)
- `{{fieldName}}` - Value from data field

### Example

```yaml
nodeConfig:
  type: selector
  titleTemplate: "Options ({{count}})"
  collapsed: false
```
