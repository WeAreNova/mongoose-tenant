/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { assert } from "chai";
import mongoTenant from "lib";
import { Schema } from "mongoose";

describe("MongoTenant", function () {
  describe("#Plugin", function () {
    it("should have correct mongoose plugin signature.", function () {
      assert(typeof mongoTenant === "function", "Expected mongo-tenant to be a function.");
    });

    it("should register as mongoose schema plugin.", function () {
      const testSchema = new Schema({});

      assert.doesNotThrow(() => {
        testSchema.plugin(mongoTenant);
      });
    });
  });
});
