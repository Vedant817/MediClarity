import test from "node:test";
import assert from "node:assert/strict";
import { API_LIMITS, formatUsd, PRODUCT_CATALOG } from "../src/config/product.ts";

test("commercial display values and enforced limits share one catalog", () => {
  assert.equal(PRODUCT_CATALOG.free.maxReportsPerMonth, 3);
  assert.equal(formatUsd(PRODUCT_CATALOG.pro.monthlyPriceCents), "$19");
  assert.equal(formatUsd(PRODUCT_CATALOG.lab.monthlyPriceCents), "$99");
  assert.equal(formatUsd(PRODUCT_CATALOG.lab.usagePriceCents), "$0.05");
});

test("Lab API operational limits are explicit product policy", () => {
  assert.equal(API_LIMITS.requestsPerMinute, 10);
  assert.equal(API_LIMITS.defaultMonthlyQuota, 2_000);
  assert.equal(API_LIMITS.maxActiveKeysPerAccount, 5);
});
