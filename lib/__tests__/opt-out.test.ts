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
  describe("#Opt-Out", () => {
    it("accessor method should deliver default mongoose model when mongoTenant is disabled.", () => {
      const Model = createTestModel(
        {},
        {
          mongoTenant: {
            enabled: false,
          },
        },
      );

      expect(typeof Model.byTenant === "function").toBeTruthy();
      expect(typeof Model.byTenant(1).getTenant === "undefined").toBeTruthy();
    });
  });
});
