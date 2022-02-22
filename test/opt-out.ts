/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { assert } from "chai";
import { createTestModel } from "./_utils";

describe("MongoTenant", function () {
  describe("#Opt-Out", function () {
    it("accessor method should deliver default mongoose model when mongoTenant is disabled.", function () {
      const Model = createTestModel(
        {},
        {
          mongoTenant: {
            enabled: false,
          },
        },
      );

      assert(typeof Model.byTenant === "function", "Expected accessor method to be available.");
      assert(
        typeof Model.byTenant(1).getTenant === "undefined",
        "Expected default mongoose model when mongoTenant is disabled.",
      );
    });
  });
});
