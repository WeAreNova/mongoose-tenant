/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @copyright   Copyright (c) 2022, dvprrsh
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { Schema } from "mongoose";
import mongoTenant from "..";
import { clearDatabase, connect } from "./utils";

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await clearDatabase();
});

describe("Plugin", () => {
  it("should have correct mongoose plugin signature.", async () => {
    expect(typeof mongoTenant).toBe("function");
  });

  it("should register as mongoose schema plugin.", async () => {
    const testSchema = new Schema({});
    expect(() => testSchema.plugin(mongoTenant)).not.toThrow();
  });
});
