# Hello Time Tool (Vite)

Tool mau tra ve thoi gian hien tai theo timezone.

## Cai dat va build

```bash
npm install
npm run build
```

## Dong goi file phan phoi

```bash
npm run pack:tgz
```

## Goi ham

```ts
import { helloTimeTool } from "./dist/hello-time-tool.mjs";

const result = helloTimeTool({ timezone: "Asia/Ho_Chi_Minh", locale: "vi-VN" });
console.log(result);
```
