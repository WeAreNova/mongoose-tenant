/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { assert } from "chai";
import { clearDatabase, createTestModel } from "./_utils";

describe("MongoTenant", function () {
  describe("requireTenantId", function () {
    clearDatabase();

    it("should allow a nullable tenant id by default.", function (next) {
      const TestModel = createTestModel({});

      TestModel.byTenant(null).create({}, function (err, doc) {
        assert(!err, "Expected creation of 1 test entity to work.");
        assert(!doc.getTenant());
        next();
      });
    });

    it("should allow an undefined tenant id by default.", function (next) {
      const TestModel = createTestModel({});

      TestModel.byTenant(undefined).create({}, function (err, doc) {
        assert(!err, "Expected creation of 1 test entity to work.");
        assert(!doc.getTenant());
        next();
      });
    });

    it("should not allow a nullable tenant id when tenant id is required.", function (next) {
      const TestModel = createTestModel(
        {},
        {
          mongoTenant: {
            requireTenantId: true,
          },
        },
      );

      TestModel.byTenant(null).create({}, function (err) {
        assert(err, "Expected creation of 1 test entity to fail.");
        next();
      });
    });

    it("should not allow an undefined tenant id when tenant id is required.", function (next) {
      const TestModel = createTestModel(
        {},
        {
          mongoTenant: {
            requireTenantId: true,
          },
        },
      );

      TestModel.byTenant(undefined).create({}, function (err) {
        assert(err, "Expected creation of 1 test entity no fail.");
        next();
      });
    });
  });
});
