/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { assert } from "chai";
import { MongooseTenant } from "lib";
import { Schema } from "mongoose";

describe("MongoTenant", function () {
  describe("#Configuration", function () {
    it("plugin should be enabled by default.", function () {
      const mongoTenant = new MongooseTenant(new Schema());

      assert(mongoTenant.isEnabled() === true, "Expected mongoTenant plugin to be enabled by default.");
    });

    it("plugin should be capable of being disabled.", function () {
      const mongoTenant = new MongooseTenant(new Schema(), {
        enabled: false,
      });

      assert(mongoTenant.isEnabled() === false, "Expected mongoTenant plugin to be disabled.");
    });

    it("should have a default tenant id key of `tenantId`.", function () {
      const mongoTenant = new MongooseTenant(new Schema());

      assert.equal(mongoTenant.getTenantIdKey(), "tenantId", "Expected tenant id key to be `tenantId`.");
    });

    it("should be capable of setting a custom tenant id key.", function () {
      const mongoTenant = new MongooseTenant(new Schema(), {
        tenantIdKey: "tenant_id",
      });

      assert.equal(mongoTenant.getTenantIdKey(), "tenant_id", "Expected tenant id key to be `tenant_id`.");
    });

    it("should have a default tenant id field type of `String`.", function () {
      const mongoTenant = new MongooseTenant(new Schema());

      assert.equal(mongoTenant.getTenantIdType(), String, "Expected tenant id field type to be `String`.");
    });

    it("should be capable of setting a custom tenant id field type.", function () {
      const mongoTenant = new MongooseTenant(new Schema(), {
        tenantIdType: Number,
      });

      assert.equal(mongoTenant.getTenantIdType(), Number, "Expected tenant id field type to be `Number`.");
    });

    it("should have a default accessor method name of `byTenant`.", function () {
      const mongoTenant = new MongooseTenant(new Schema());

      assert.equal(mongoTenant.getAccessorMethod(), "byTenant", "Expected accessor method name to be `byTenant`.");
    });

    it("should be capable of setting a custom accessor method name.", function () {
      const mongoTenant = new MongooseTenant(new Schema(), {
        accessorMethod: "tenancy",
      });

      assert.equal(mongoTenant.getAccessorMethod(), "tenancy", "Expected accessor method name to be `tenancy`.");
    });

    it("should not require tenant id field by default.", function () {
      const mongoTenant = new MongooseTenant(new Schema());

      assert.isFalse(mongoTenant.isTenantIdRequired(), "Expected tenant id field to allow null values.");
    });

    it("should be possible to set tenant id field required.", function () {
      const mongoTenant = new MongooseTenant(new Schema(), {
        requireTenantId: true,
      });

      assert.isTrue(mongoTenant.isTenantIdRequired(), "Expected tenant id field to be required (not nullable).");
    });
  });
});
