# 卡片组件清单 — OpenMemory UI

> **源项目：** `~/Documents/mcp/openmemory/ui`
> **生成时间：** 2026-04-14
> **核实状态：** ✅ 全部对照源码核对（第 3 轮验证）
> **框架：** Next.js 15 (App Router) + React 19 + Redux Toolkit + Tailwind CSS
> **UI 基础层：** shadcn/ui (Radix UI)

---

## 一、组件目录结构

```
ui/
├── components/
│   ├── ui/
│   │   ├── card.tsx                          ← 【基础组件】shadcn/ui Card（6 个子导出）
│   │   ├── hover-card.tsx                   ← 【基础组件】shadcn/ui HoverCard（悬停气泡）
│   │   └── skeleton.tsx                     ← 【基础组件】shadcn/ui Skeleton（原子骨架）
│   └── shared/
│       ├── categories.tsx                    ← 【子组件】分类标签（被 MemoryCard 引用）
│       └── source-app.tsx                    ← 【子组件】来源应用配置（SourceApp + Icon + constants）
│
├── app/
│   └── apps/
│       ├── components/
│       │   ├── AppCard.tsx                  ← 【业务卡片】应用概览卡
│       │   └── AppGrid.tsx                  ← 【容器】AppCard 网格列表（3 态渲染）
│       └── [appId]/
│           └── components/
│               ├── AppDetailCard.tsx         ← 【业务卡片】应用详情侧边卡
│               └── MemoryCard.tsx             ← 【业务卡片】记忆条目卡
│
└── skeleton/                                 ← 【骨架屏目录】
    ├── AppFiltersSkeleton.tsx               ← 【骨架屏】过滤器栏骨架
    ├── AppCardSkeleton.tsx                  ← 【骨架屏】AppCard 加载态
    ├── AppDetailCardSkeleton.tsx             ← 【骨架屏】AppDetailCard 加载态
    ├── MemoryCardSkeleton.tsx               ← 【骨架屏】MemoryCard 加载态
    ├── MemorySkeleton.tsx                   ← 【骨架屏】Memory 详情页骨架
    └── MemoryTableSkeleton.tsx              ← 【骨架屏】Memory 表格骨架（5 行占位）
```

---

## 二、基础组件

### 2.1 `card.tsx` — shadcn/ui Base Card

**文件路径：** `ui/components/ui/card.tsx`
**设计模式：** 所有子组件使用 `React.forwardRef`，支持 ref 转发与 `className` 覆盖（使用 `cn()` merge）

| 导出名 | HTML 元素 | Props 类型 | 默认 Tailwind 类名 |
|--------|-----------|------------|---------------------|
| `Card` | `<div>` | `React.HTMLAttributes<HTMLDivElement>` | `rounded-lg border bg-card text-card-foreground shadow-sm` |
| `CardHeader` | `<div>` | `React.HTMLAttributes<HTMLDivElement>` | `flex flex-col space-y-1.5 p-6` |
| `CardTitle` | `<h3>` | `React.HTMLAttributes<HTMLHeadingElement>` | `text-2xl font-semibold leading-none tracking-tight` |
| `CardDescription` | `<p>` | `React.HTMLAttributes<HTMLParagraphElement>` | `text-sm text-muted-foreground` |
| `CardContent` | `<div>` | `React.HTMLAttributes<HTMLDivElement>` | `p-6 pt-0` |
| `CardFooter` | `<div>` | `React.HTMLAttributes<HTMLDivElement>` | `flex items-center p-6 pt-0` |

> ⚠️ **已知不一致：** `CardTitle` forwardRef 泛型写成 `HTMLParagraphElement` 但渲染 `<h3>`，不影响功能。

---

### 2.2 `hover-card.tsx` — shadcn/ui HoverCard

**文件路径：** `ui/components/ui/hover-card.tsx`

| 导出名 | 类型 | 说明 |
|--------|------|------|
| `HoverCard` | `HoverCardPrimitive.Root` | 根容器（Radix UI） |
| `HoverCardTrigger` | `HoverCardPrimitive.Trigger` | 触发元素 |
| `HoverCardContent` | `forwardRef` | 弹出内容，`w-64 rounded-md border bg-popover shadow-md`，带进出动画 |

> 当前业务代码中未被卡片组件直接引用，可供后续扩展使用。

---

### 2.3 `skeleton.tsx` — shadcn/ui 原子骨架

**文件路径：** `ui/components/ui/skeleton.tsx`

```typescript
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  );
}
```

> `MemorySkeleton`（见 §5.5）内部使用此组件。其余骨架屏均为纯 `<div>` + Tailwind `animate-pulse`。

---

## 三、容器组件

### 3.1 `AppGrid` — 应用网格容器（三态切换）

**文件路径：** `ui/app/apps/components/AppGrid.tsx`
**渲染方式：** `"use client"` + `export function AppGrid`（命名导出）
**状态来源：** Redux (`state.apps.apps`, `state.apps.filters`) + `useAppsApi` hook

#### 内部逻辑

```typescript
// Redux: state.apps.apps, state.apps.filters (含 searchQuery, isActive, sortBy, sortDirection)
// Hook: useAppsApi → fetchApps()（filters 变化时触发）
// useEffect 监听 filters 变化，每次变化重新 fetchApps()
```

#### 三态渲染（源码精确）

| 态 | 触发条件 | 渲染内容 |
|----|----------|----------|
| **加载态** | `isLoading === true`（`useAppsApi` 返回） | 3 × `AppCardSkeleton` |
| **空态** | `apps.length === 0`（加载完成后） | `div.text-center.text-zinc-500.py-8` + "No apps found matching your filters" |
| **数据态** | `apps.length > 0` | `apps.map(app => <AppCard key={app.id} app={app} />)` |

```
加载态:
div.grid.grid-cols-1.md:grid-cols-2.lg:grid-cols-3.gap-4
  AppCardSkeleton key=0
  AppCardSkeleton key=1
  AppCardSkeleton key=2

空态:
div.text-center.text-zinc-500.py-8 → "No apps found matching your filters"

数据态:
div.grid.grid-cols-1.md:grid-cols-2.lg:grid-cols-3.gap-4
  AppCard key={app.id} app={app}  × apps.length
```

> ⚠️ 初次挂载 `isLoading=true` 显示 skeleton；filters 变化期间也显示 skeleton（`useEffect` 监听）。

---

## 四、业务卡片组件

### 4.1 `AppCard` — 应用概览卡

**文件路径：** `ui/app/apps/components/AppCard.tsx`
**渲染方式：** `export function AppCard`（命名导出）
**基础组件：** 使用 shadcn/ui `Card` / `CardHeader` / `CardContent` / `CardFooter`

#### Props 接口

```typescript
interface AppCardProps {
  app: App;
}

// App 来自 @/store/appsSlice
export interface App {
  id: string;
  name: string;
  total_memories_created: number;
  total_memories_accessed: number;
  is_active?: boolean;   // 可选，控制 Active/Inactive 徽章
}
```

#### 渲染树结构

```
<Card className="bg-zinc-900 text-white border-zinc-800">
├── <CardHeader className="pb-2">
│   └── div.flex.items-center.gap-1
│       ├── div.rounded-full.w-6.h-6.bg-[#2a2a2a].overflow-hidden  (AppIcon 圆形容器)
│       │   ├── [has iconImage] → <Image src={iconImage} width=28 height=28 />
│       │   └── [no  iconImage] → {appConfig.icon} (React element)
│       └── <h2 className="text-xl font-semibold">{appConfig.name}</h2>
│
├── <CardContent className="pb-4 my-1">
│   └── div.grid.grid-cols-2.gap-4
│       ├── div → "Memories Created" / {total_memories_created.toLocaleString()}
│       └── div → "Memories Accessed" / {total_memories_accessed.toLocaleString()}
│
└── <CardFooter className="border-t border-zinc-800 px-6 py-2 flex justify-between">
    ├── div.状态徽章
    │   ├── [is_active=true]  → bg-green-800 text-white
    │   └── [is_active=false|undefined] → bg-red-500/20 text-red-400
    │       + 圆点 + "Active" / "Inactive"
    └── div.cursor-pointer.border.border-zinc-700.bg-zinc-950
        → router.push(`/apps/${app.id}`) → "View Details <ArrowRight />"
```

#### 变体 / 状态矩阵

| 状态 | 触发条件 | 徽章样式 | 徽章文字 |
|------|----------|----------|----------|
| **Active** | `is_active === true` | `bg-green-800 text-white` | Active |
| **Inactive** | `is_active === false \|\| undefined` | `bg-red-500/20 text-red-400` | Inactive |

> 无内部 Loading 态，由父组件 `AppGrid` 通过 `AppCardSkeleton` 控制加载状态。

---

### 4.2 `AppDetailCard` — 应用详情侧边卡

**文件路径：** `ui/app/apps/[appId]/components/AppDetailCard.tsx`
**渲染方式：** `export default AppDetailCard`（默认导出）
**基础组件：** 纯 `<div>` 手写，未使用 shadcn Card

#### Props 接口（内联类型）

```typescript
const AppDetailCard = ({
  appId,
  selectedApp,
}: {
  appId: string;
  selectedApp: any;   // ⚠️ 实际运行时结构如下：
}) => { ... }

// selectedApp 运行时结构（来自 Redux state.apps.selectedApp）：
{
  details: {
    is_active: boolean;
    total_memories_created: number;
    total_memories_accessed: number;
    first_accessed: string | null;
    last_accessed: string | null;
  }
}
```

#### 内部状态

```typescript
const [isLoading, setIsLoading] = useState(false);  // 控制按钮加载态
```

#### 渲染树结构

```
<div>
└── div.bg-zinc-900.w-[320px].border.border-zinc-800.rounded-xl.mb-6
    ├── div.bg-zinc-800.rounded-t-xl.p-3  (Header)
    │   ├── flex.items-center.gap-2
    │   │   ├── div.w-6.h-6.rounded-full.bg-zinc-700.overflow-hidden
    │   │   │   ├── [has iconImage] → <Image width=40 height=40 />
    │   │   │   └── [no iconImage]  → <BiEdit className="w-4 h-4 text-zinc-400" />
    │   │   └── <h2>{appConfig.name}</h2>
    │
    └── div.space-y-4.p-3  (Content)
        ├── "Access Status" → p.text-emerald-500 | text-red-500
        ├── "Total Memories Created" → {n} Memories
        ├── "Total Memories Accessed" → {n} Memories
        ├── "First Accessed"  → toLocaleDateString(...) | "Never"
        ├── "Last Accessed"   → toLocaleDateString(...) | "Never"
        ├── <hr className="border-zinc-800">
        └── <Button disabled={isLoading} onClick={handlePauseAccess}>
            ├── [isLoading=true]     → <Loader2 className="animate-spin" />
            ├── [isLoading=false, active]    → <PauseIcon /> + "Pause Access"
            └── [isLoading=false, inactive]  → <PlayIcon />  + "Unpause Access"
```

#### 变体 / 状态矩阵

| 状态 | 触发条件 | Access Status 颜色 | 按钮文字 | 按钮图标 |
|------|----------|---------------------|----------|----------|
| **Active** | `details.is_active === true` | `text-emerald-500` | Pause Access | `<PauseIcon>` |
| **Inactive** | `details.is_active === false` | `text-red-500` | Unpause Access | `<PlayIcon>` |
| **Loading** | `isLoading === true` | 不变 | (同上) | `<Loader2 animate-spin>` + 按钮 `disabled` |
| **日期空** | `first/last_accessed === null` | — | — | 显示 "Never" |

#### 副作用逻辑

```typescript
// handlePauseAccess（await async）：
// 1. setIsLoading(true)
// 2. await updateAppDetails(appId, { is_active: !details.is_active })
// 3. dispatch(setAppDetails({ appId, isActive: !details.is_active }))
// 4. setIsLoading(false)  [finally 块保证]
```

---

### 4.3 `MemoryCard` — 记忆条目卡

**文件路径：** `ui/app/apps/[appId]/components/MemoryCard.tsx`
**渲染方式：** `export function MemoryCard`（命名导出）
**基础组件：** 纯 `<div>` 手写，未使用 shadcn Card

#### Props 接口

```typescript
interface MemoryCardProps {
  id: string;
  content: string;               // 记忆正文
  created_at: string;           // ISO 时间戳（追加 "Z" 处理时区）
  metadata?: Record<string, any>; // 可选，非空时渲染 JSON 块
  categories?: string[];         // 可选，空数组/undefined 不渲染标签
  access_count?: number;         // 可选，存在时显示访问次数
  app_name: string;              // 来源应用名，空时显示 View Details
  state: string;                 // "active" | "paused" | "archived"
}
```

#### 渲染树结构

```
div.rounded-lg.border.border-zinc-800.bg-zinc-900.overflow-hidden
└── div.p-4
    ├── div.border-l-2.border-primary.pl-4.mb-4  (正文区)
    │   └── <p>
    │       ├── [state === "active"]    → text-white
    │       └── [state !== "active"]    → text-zinc-400
    │
    ├── [metadata && Object.keys(metadata).length > 0]  (Metadata 区，条件渲染)
    │   └── div.mb-4
    │       ├── <p className="text-xs text-zinc-500 uppercase">METADATA</p>
    │       └── div.bg-zinc-800.rounded.p-3
    │           └── <pre>{JSON.stringify(metadata, null, 2)}</pre>
    │
    ├── div.mb-2  (Categories 区)
    │   └── <Categories categories={categories} isPaused={state !== "active"} />
    │       ← 空/undefined → Categories 返回 null
    │
    └── div.flex.justify-between.items-center  (Footer 区)
        ├── LEFT: span.text-zinc-400.text-sm
        │   ├── [access_count 存在（truthy）] → "Accessed {n} times"
        │   ├── [access_count 不存在]         → toLocaleDateString(created_at + "Z")
        │   └── [state !== "active"]          → Badge: border-yellow-600 text-yellow-600 "Paused"|"Archived"
        │
        └── RIGHT:
            ├── [!app_name（falsy）] → <Link href="/memory/{id}"> "View Details <ArrowRight>" </Link>
            └── [app_name（非空）]    → div.bg-zinc-700.px-3.py-1.rounded-lg
                                        "Created by:" + <Image iconImage/> + {name}
```

#### 变体 / 状态矩阵（完整组合）

| 维度 | 值 | 可见变化 |
|------|----|----------|
| **state** | `"active"` | 正文 `text-white`，无状态徽章 |
| **state** | `"paused"` | 正文 `text-zinc-400`，黄色 "Paused" 徽章 |
| **state** | `"archived"` | 正文 `text-zinc-400`，黄色 "Archived" 徽章 |
| **metadata** | 存在且非空对象 | 渲染 JSON 展示块 |
| **metadata** | 不存在 / 空对象 `{}` | 整块不渲染 |
| **categories** | 非空数组 | 彩色（active）或灰色（paused/archived）标签 |
| **categories** | 空 / undefined | `Categories` 返回 `null`，不渲染 |
| **access_count** | truthy（> 0） | 显示 "Accessed N times" |
| **access_count** | falsy（`0` 视为不存在） | 显示 `created_at` 格式化日期时间 |
| **app_name** | 非空字符串 | 右侧 "Created by:" + 图标 + 应用名 |
| **app_name** | `""`（空字符串为 falsy） | 右侧 "View Details →" 链接 |

> 总组合数：3(state) × 2(metadata) × 2(categories) × 2(access_count) × 2(app_name) = **24 种**

---

## 五、骨架屏组件（加载态）

> **共性：** 全部使用 `bg-zinc-800` 基色 + `animate-pulse`，无异步逻辑，纯静态 JSX（`MemorySkeleton` 使用 `Skeleton` 组件例外）。

### 5.1 `AppFiltersSkeleton` — 过滤器栏骨架

**文件路径：** `ui/skeleton/AppFiltersSkeleton.tsx`
**渲染方式：** `export function AppFiltersSkeleton`（命名导出，无 props）

```
div.flex.items-center.gap-2
├── div.relative.flex-1
│   └── div.h-9.w-[500px].bg-zinc-800.rounded.animate-pulse   (搜索框占位)
├── div.h-9.w-[130px].bg-zinc-800.rounded.animate-pulse      (按钮1占位)
└── div.h-9.w-[150px].bg-zinc-800.rounded.animate-pulse      (按钮2占位)
```

### 5.2 `AppCardSkeleton`

**文件路径：** `ui/skeleton/AppCardSkeleton.tsx`
**渲染方式：** `export function AppCardSkeleton`（命名导出，无 props）
**基础组件：** 使用 shadcn Card（与 AppCard 结构镜像）

```
<Card className="bg-zinc-900 text-white border-zinc-800">
├── <CardHeader>
│   └── div.flex.items-center.gap-1
│       ├── div.rounded-full.w-6.h-6.bg-zinc-800.animate-pulse        (头像占位)
│       └── div.h-7.w-32.bg-zinc-800.rounded.animate-pulse             (标题占位)
├── <CardContent>
│   └── div.grid.grid-cols-2.gap-4
│       ├── [label h-4.w-24] + [value h-7.w-32]  animate-pulse
│       └── [label h-4.w-24] + [value h-7.w-32]  animate-pulse
└── <CardFooter>
    ├── div.h-6.w-16.bg-zinc-800.rounded-lg.animate-pulse  (徽章占位)
    └── div.h-8.w-28.bg-zinc-800.rounded-lg.animate-pulse  (按钮占位)
```

### 5.3 `AppDetailCardSkeleton`

**文件路径：** `ui/skeleton/AppDetailCardSkeleton.tsx`
**渲染方式：** `export function AppDetailCardSkeleton`（命名导出，无 props）
**基础组件：** 纯 `<div>`（与 AppDetailCard 结构镜像，固定 `w-[320px]`）

```
div.bg-zinc-900.w-[320px].border-zinc-800.rounded-xl.mb-6
├── div.bg-zinc-800.rounded-t-xl.p-3  (Header)
│   ├── div.w-6.h-6.rounded-full.bg-zinc-700.animate-pulse  (图标占位)
│   └── div.h-5.w-24.animate-pulse                          (标题占位)
└── div.space-y-4.p-3  (Content)
    ├── label(h-4.w-20) + value(h-5.w-24)   ← Access Status
    ├── label(h-4.w-32) + value(h-5.w-28)   ← Total Memories Created
    ├── label(h-4.w-32) + value(h-5.w-28)   ← Total Memories Accessed
    ├── label(h-4.w-24) + value(h-5.w-36)   ← First Accessed
    ├── label(h-4.w-24) + value(h-5.w-36)   ← Last Accessed
    ├── <hr className="border-zinc-800">
    └── div.h-8.w-[170px].bg-zinc-800.rounded.animate-pulse  (按钮占位)
```

### 5.4 `MemoryCardSkeleton`

**文件路径：** `ui/skeleton/MemoryCardSkeleton.tsx`
**渲染方式：** `export function MemoryCardSkeleton`（命名导出，无 props）
**基础组件：** 纯 `<div>`（与 MemoryCard 结构镜像）

```
div.rounded-lg.border.border-zinc-800.bg-zinc-900.overflow-hidden
└── div.p-4
    ├── div.border-l-2.border-primary.pl-4.mb-4  (正文占位)
    │   ├── div.h-4.w-3/4.animate-pulse
    │   └── div.h-4.w-1/2.animate-pulse
    ├── div.mb-4  (Metadata 占位)
    │   ├── div.h-4.w-24.animate-pulse
    │   └── div.bg-zinc-800.p-3
    │       └── div.h-20.bg-zinc-700.animate-pulse
    ├── div.mb-2  (Categories 占位)
    │   ├── div.h-6.w-20.rounded-full.bg-zinc-800.animate-pulse
    │   └── div.h-6.w-24.rounded-full.bg-zinc-800.animate-pulse
    └── div.flex.justify-between.items-center  (Footer 占位)
        ├── div.h-4.w-32.animate-pulse  (时间占位)
        └── div.bg-zinc-800.px-3.py-1.rounded-lg
            ├── div.h-4.w-20.animate-pulse   ("Created by" 占位)
            ├── div.w-6.h-6.rounded-full.bg-zinc-700.animate-pulse  (图标占位)
            └── div.h-4.w-24.animate-pulse   (名称占位)
```

> ⚠️ Footer 始终渲染 "app_name 存在" 的分支（带图标占位），与 `MemoryCard` 真实数据不一定匹配。

### 5.5 `MemorySkeleton` — Memory 详情页骨架

**文件路径：** `ui/skeleton/MemorySkeleton.tsx`
**渲染方式：** `export function MemorySkeleton`（命名导出，无 props）
**基础组件：** 使用 `@/components/ui/skeleton` 的 `Skeleton` 组件

```
div.container.mx-auto.py-8.px-4
└── div.rounded-lg.border.border-zinc-800.bg-zinc-900.overflow-hidden
    └── div.p-6
        ├── div.flex.justify-between.items-center.mb-6
        │   ├── Skeleton.h-8.w-48.bg-zinc-800              (标题占位)
        │   └── div.flex.gap-2
        │       ├── Skeleton.h-8.w-24.bg-zinc-800 ×2       (按钮占位)
        ├── div.border-l-2.border-zinc-800.pl-4.mb-6        (引用正文)
        │   └── Skeleton.h-6.w-full.bg-zinc-800
        └── div.mt-6.pt-6.border-t.border-zinc-800         (底部元信息)
            └── Skeleton.h-4.w-48.bg-zinc-800
```

### 5.6 `MemoryTableSkeleton` — Memory 表格骨架

**文件路径：** `ui/skeleton/MemoryTableSkeleton.tsx`
**渲染方式：** `export function MemoryTableSkeleton`（命名导出，无 props）
**基础组件：** shadcn `Table` 系列 + `react-icons/hi2` / `pi` / `go` / `ci` + `lucide-react`
**内部常量：** `loadingRows = Array(5).fill(null)`（固定 5 行占位）

```
div.rounded-md.border
└── Table
    ├── TableHeader
    │   └── TableRow.bg-zinc-800.hover:bg-zinc-800
    │       ├── TableHead[w-50px]              → 灰色方块占位
    │       ├── TableHead                      → HiMiniRectangleStack + "Memory"
    │       ├── TableHead                      → PiSwatches + "Categories"
    │       ├── TableHead[w-140px]             → GoPackage + "Source App"
    │       ├── TableHead[w-140px]             → CiCalendar + "Created On"
    │       └── TableHead[text-right]          → MoreHorizontal
    └── TableBody
        └── TableRow ×5 (animate-pulse, key=index)
            ├── TableCell → div.h-4.w-4.rounded.bg-zinc-800
            ├── TableCell → div.h-4.w-3/4.bg-zinc-800.rounded
            ├── TableCell → div.flex.gap-1 > [h-5.w-16.rounded-full ×2]
            ├── TableCell[w-140px] → div.h-6.w-24.mx-auto.bg-zinc-800.rounded
            ├── TableCell[w-140px] → div.h-4.w-20.mx-auto.bg-zinc-800.rounded
            └── TableCell → div.h-8.w-8.bg-zinc-800.rounded.mx-auto
```

---

## 六、子组件

### 6.1 `Categories` — 分类标签组件

**文件路径：** `ui/components/shared/categories.tsx`
**渲染方式：** `export default Categories`（默认导出）

#### Props 接口

```typescript
const Categories = ({
  categories,
  isPaused = false,
  concat = false,
}: {
  categories: Category[];   // type Category = string
  isPaused?: boolean;       // true → 所有标签灰化
  concat?: boolean;         // true → 折叠为 "第一个 + +N" Popover 模式
}) => { ... }
```

#### 颜色映射逻辑（`getColor` 函数，关键词 `includes` 匹配）

| 关键词 | Tailwind 颜色 |
|--------|--------------|
| health, fitness | `text-emerald-400 bg-emerald-500/10 border-emerald-500/20` |
| education, school | `text-indigo-400 bg-indigo-500/10 border-indigo-500/20` |
| business, career, work, finance | `text-amber-400 bg-amber-500/10 border-amber-500/20` |
| design, art, creative | `text-pink-400 bg-pink-500/10 border-pink-500/20` |
| tech, code, programming | `text-purple-400 bg-purple-500/10 border-purple-500/20` |
| interest, preference | `text-rose-400 bg-rose-500/10 border-rose-500/20` |
| travel, trip, location, place | `text-sky-400 bg-sky-500/10 border-sky-500/20` |
| personal, life | `text-yellow-400 bg-yellow-500/10 border-yellow-500/20` |
| *其他* | `text-blue-400 bg-blue-500/10 border-blue-500/20` |

#### 变体矩阵

| concat | isPaused | 渲染行为 |
|--------|----------|----------|
| `false` (default) | `false` | 所有标签平铺，彩色样式 |
| `false` | `true` | 所有标签平铺，统一灰色 `text-zinc-500 bg-zinc-800/40` |
| `true` | `false` | 显示 categories[0] 彩色 + "+N" 触发器 → hover Popover |
| `true` | `true` | 显示 categories[0] 灰色 + "+N" 灰色触发器 → hover Popover |

> - `categories` 为空/undefined → 组件直接返回 `null`
> - Popover 触发器：`onMouseEnter` / `onMouseLeave`（hover 触发，非点击）

---

### 6.2 `source-app.tsx` — 来源应用配置

**文件路径：** `ui/components/shared/source-app.tsx`
**导出：** `SourceApp`（默认）、`Icon`（命名）、`constants`（命名）

#### 支持的应用（`constants` 对象）

| key | name | iconImage |
|-----|------|-----------|
| `claude` | Claude | `/images/claude.webp` |
| `openmemory` | OpenMemory | `/images/open-memory.svg` |
| `cursor` | Cursor | `/images/cursor.png` |
| `cline` | Cline | `/images/cline.png` |
| `roocline` | Roo Cline | `/images/roocline.png` |
| `windsurf` | Windsurf | `/images/windsurf.png` |
| `witsy` | Witsy | `/images/witsy.png` |
| `enconvo` | Enconvo | `/images/enconvo.png` |
| `default` | Default | `/images/default.png`（icon: `<BiEdit>`） |

#### `Icon` 组件（命名导出）

```typescript
// Icon Props
{ source: string }

// 逻辑：
// - constants[source]?.iconImage 存在 → <Image> 渲染图标
// - constants[source]?.iconImage 不存在 → <BiEdit> 回退
// 容器类名: w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden -mr-1
```

#### `SourceApp` 组件（默认导出，当前业务未用于卡片）

```typescript
// SourceApp Props
{ source: string }

// 逻辑：已知 source → icon + name；未知 source → <BiEdit> + source 文字
```

---

## 七、变体类型总表

| 组件 | 变体 / 状态 | 独立分支数 | 组合数 |
|------|------------|-----------|--------|
| `AppCard` | Active / Inactive | 2 | 2 |
| `AppDetailCard` | Active / Inactive / Loading + 日期空值 | 3 + 4 日期组合 | ~6 |
| `MemoryCard` | state(3) × metadata(2) × categories(2) × access_count(2) × app_name(2) | — | **24** |
| `Categories` | concat(2) × isPaused(2) + 空列表 | — | 5 |
| `AppGrid` | 加载态 / 空态 / 数据态（三选一互斥） | 3 | 1 |
| `AppFiltersSkeleton` | 静态单一骨架 | 1 | 1 |
| `AppCardSkeleton` | 静态单一骨架 | 1 | 1 |
| `AppDetailCardSkeleton` | 静态单一骨架 | 1 | 1 |
| `MemoryCardSkeleton` | 静态单一骨架（固定 app_name 分支） | 1 | 1 |
| `MemorySkeleton` | 静态单一骨架（使用 Skeleton 组件） | 1 | 1 |
| `MemoryTableSkeleton` | 静态单一骨架（固定 5 行占位） | 1 | 1 |

---

## 八、样式系统

| 维度 | 值 |
|------|----|
| 主题 | 深色模式（`zinc-900` 背景，`zinc-800` 边框） |
| 圆角 | `rounded-lg`（Card / MemoryCard），`rounded-xl`（AppDetailCard） |
| 主色调 | Tailwind `zinc-*` 色系 |
| 强调色 | Active: `emerald-500` / `green-800`；Error: `red-500`；Warning: `yellow-600` |
| 图标库 | `lucide-react`（主）+ `react-icons/bi`（BiEdit）+ `react-icons/hi2/pi/go/ci`（表头标签） |
| 动画 | `animate-pulse`（骨架屏），`animate-spin`（Loader2 加载按钮），`backdrop-blur-sm`（标签） |
| 固定尺寸 | AppDetailCard / AppDetailCardSkeleton 固定 `w-[320px]`；AppFiltersSkeleton 搜索框 `w-[500px]` |

---

## 九、组件调用关系图

```
AppGrid (apps/components)
├── [isLoading=true] → AppCardSkeleton × 3
├── [apps.length=0]  → "No apps found..." 空态
└── [apps.length>0]  → AppCard × apps.length
    └── constants (source-app.tsx) → Icon

apps/[appId]/page.tsx
├── [isLoading]   → AppDetailCardSkeleton
│                → MemoryCardSkeleton × N
│                → MemoryTableSkeleton
│                → AppFiltersSkeleton
├── AppDetailCard (loaded)
│   └── constants (source-app.tsx) → Icon
│   └── useAppsApi (hooks)
│   └── Redux: setAppDetails
└── MemoryCard (loaded)
    └── Categories (shared)
        └── Popover (ui)
    └── constants (source-app.tsx) → Icon
```

---

## 十、测试清单（供 QA 使用）

### AppCard 测试点

- [ ] `is_active=true` → 绿色 Active 徽章（`bg-green-800 text-white`）
- [ ] `is_active=false` → 红色 Inactive 徽章（`bg-red-500/20 text-red-400`）
- [ ] `is_active=undefined` → 触发 Inactive 分支（与 false 相同）
- [ ] `app.name="claude"` → 显示 Claude 图标（`<Image>`，宽高 28）
- [ ] `app.name="UNKNOWN"` → 回退 default 配置（`constants.default`）
- [ ] `app.name` 无 iconImage → 显示 `{appConfig.icon}` React 元素
- [ ] 图标容器 `div.rounded-full.w-6.h-6.bg-[#2a2a2a].overflow-hidden`
- [ ] 点击 "View Details" → `router.push("/apps/{app.id}")`
- [ ] `total_memories_created` 大数字 → `toLocaleString()` 正确格式化

### AppDetailCard 测试点

- [ ] `is_active=true` → `text-emerald-500` "Active"，按钮 "Pause Access" + PauseIcon
- [ ] `is_active=false` → `text-red-500` "Inactive"，按钮 "Unpause Access" + PlayIcon
- [ ] 点击按钮 → `isLoading=true` → 按钮 `disabled` + Loader2 旋转
- [ ] API 成功 → `isLoading=false` + Redux `setAppDetails` dispatch
- [ ] API 失败 → `console.error`，`isLoading=false`（finally 保证），UI 无崩溃
- [ ] `first_accessed=null` → 显示 "Never"
- [ ] `last_accessed=null` → 显示 "Never"
- [ ] `first_accessed="2024-01-15T10:00:00"` → 格式化为 "Jan 15, 2024, 10:00 AM"
- [ ] `app_name` 已知 → 渲染 `<Image>` 图标
- [ ] `app_name` 未知 → 渲染 `<BiEdit>` 兜底图标
- [ ] 固定宽度 `w-[320px]`，`rounded-xl`

### MemoryCard 测试点

- [ ] `state="active"` → 正文 `text-white`，无状态徽章
- [ ] `state="paused"` → 正文 `text-zinc-400`，黄色 "Paused" 徽章
- [ ] `state="archived"` → 正文 `text-zinc-400`，黄色 "Archived" 徽章
- [ ] `metadata={key: "val"}` → 渲染 JSON 块（`<pre>` 格式）
- [ ] `metadata={}` → `Object.keys(metadata).length === 0` → 不渲染 metadata 区
- [ ] `metadata=undefined` → 不渲染 metadata 区
- [ ] `categories=["health","tech"]` + `state="active"` → 彩色标签
- [ ] `categories=["health"]` + `state="paused"` → 灰色标签（`isPaused=true`）
- [ ] `categories=[]` → `Categories` 返回 `null`，不渲染
- [ ] `categories=undefined` → 同上
- [ ] `access_count=5` → "Accessed 5 times"
- [ ] `access_count=0` → falsy，显示 `created_at` 日期（⚠️ `0` 被视为无 access_count）
- [ ] `access_count=undefined` → 显示 `created_at` 日期
- [ ] `app_name="claude"` → 右侧 "Created by: Claude" + 图标，隐藏 View Details
- [ ] `app_name=""` → 显示 "View Details →" 链接（空字符串为 falsy）
- [ ] `created_at="2024-01-15T10:00:00"` → 追加 "Z" 后时区处理正确

### AppGrid 测试点

- [ ] 初次挂载 + filters 变化期间 → 显示 3 个 `AppCardSkeleton`
- [ ] `isLoading=false` + `apps.length=0` → 显示 "No apps found matching your filters"
- [ ] `isLoading=false` + `apps.length>0` → 正确渲染 app 网格列表
- [ ] `filters` 变化（searchQuery/isActive/sortBy/sortDirection）→ 触发 `fetchApps()`

### Categories 测试点

- [ ] `concat=false, isPaused=false` → 所有标签平铺，颜色按类别映射
- [ ] `concat=false, isPaused=true` → 所有标签灰色 `text-zinc-500 bg-zinc-800/40`
- [ ] `concat=true` + 单个标签 → 只显示第一个，无 "+N" 触发器
- [ ] `concat=true` + 多标签 → 第一个彩色 + "+N"，hover 显示 Popover
- [ ] `categories=[]` → 返回 `null`，不渲染任何内容
- [ ] `categories=["unknown_cat"]` → 蓝色（默认颜色兜底）
- [ ] `categories=["health education"]` → 匹配 "health" 关键词 → emerald 色

### 骨架屏测试点

- [ ] `AppFiltersSkeleton` 搜索框宽度 `w-[500px]`，3 个 div 块，无 props
- [ ] `AppCardSkeleton` 结构与 AppCard 一致（Header/Content/Footer 三区），无 props
- [ ] `AppDetailCardSkeleton` 固定宽度 `w-[320px]`，5 个字段占位 + 按钮占位，无 props
- [ ] `MemoryCardSkeleton` Footer 始终渲染 app_name 有值分支（带图标占位），无 props
- [ ] `MemorySkeleton` 使用 `Skeleton` 组件（非纯 div），渲染标题 + 引用块 + 元信息
- [ ] `MemoryTableSkeleton` 表头 6 列各有图标 + 文字标签，固定 5 行占位，无 props
- [ ] 所有骨架屏无异步逻辑，渲染无报错，`animate-pulse` 动画可见
