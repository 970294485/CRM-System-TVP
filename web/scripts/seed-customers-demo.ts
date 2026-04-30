/**
 * 只寫入兩筆客戶示範資料（需 DATABASE_URL）。已存在同名客戶則跳過。
 * web/: npm run db:seed:customers-demo
 */
import { config } from "dotenv";
import { resolve } from "path";

import { ensureDemoCustomers } from "./ensure-demo-customers";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

ensureDemoCustomers()
  .then(() => console.log("Customers demo seed done."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
