# Cloud Read Model V1

`CloudReadModelExporter` 当前导出版本化 JSON，用于未来手机或网页只读查询。

顶层字段：

- `schemaVersion`: 当前固定为 `1`。
- `exportedAt`: 导出时间。
- `customers`: 客户档案与平台身份。
- `orders`: 订单、明细、收款、进度和截止日期。
- `files`: 文件元数据，不包含文件内容。
- `sourceFactories`: 源头厂家资料。
- `sourceFactoryQuotes`: 厂家报价、材质、工艺、成本和运费。

V1 不实现上传、认证或双向同步。
