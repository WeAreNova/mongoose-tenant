/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { clearDatabase, connect, createTestModel } from "./utils";

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await clearDatabase();
});

describe("MongoTenant", () => {
  describe("requireTenantId", () => {
    clearDatabase();

    it("should allow a nullable tenant id by default.", (next) => {
      const TestModel = createTestModel({});

      TestModel.byTenant(null).create({}, function (err, doc) {
        expect(!err).toBeTruthy();
        expect(!doc.getTenant()).toBeTruthy();
        next();
      });
    });

    it("should allow an undefined tenant id by default.", (next) => {
      const TestModel = createTestModel({});

      TestModel.byTenant(undefined).create({}, function (err, doc) {
        expect(!err).toBeTruthy();
        expect(!doc.getTenant()).toBeTruthy();
        next();
      });
    });

    it("should not allow a nullable tenant id when tenant id is required.", (next) => {
      const TestModel = createTestModel(
        {},
        {
          mongoTenant: {
            requireTenantId: true,
          },
        },
      );

      TestModel.byTenant(null).create({}, function (err) {
        expect(err).toBeTruthy();
        next();
      });
    });

    it("should not allow an undefined tenant id when tenant id is required.", (next) => {
      const TestModel = createTestModel(
        {},
        {
          mongoTenant: {
            requireTenantId: true,
          },
        },
      );

      TestModel.byTenant(undefined).create({}, function (err) {
        expect(err).toBeTruthy();
        next();
      });
    });
  });
});
