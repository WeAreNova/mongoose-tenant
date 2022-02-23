/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
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

describe("MongoTenant", () => {
  describe("#Plugin", () => {
    it("should have correct mongoose plugin signature.", () => {
      expect(typeof mongoTenant === "function").toBeTruthy();
    });

    it("should register as mongoose schema plugin.", () => {
      const testSchema = new Schema({});

      expect(() => {
        testSchema.plugin(mongoTenant);
      }).not.toThrow();
    });
  });
});
