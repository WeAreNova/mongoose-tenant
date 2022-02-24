/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @copyright   Copyright (c) 2022, dvprrsh
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { Schema } from "mongoose";
import { MongooseTenant } from "..";

describe("Plugin Options", () => {
  it("should be enabled by default.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}));
    expect(mongoTenant.isEnabled() === true).toBeTruthy();
  });

  it("should be capable of being disabled.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}), {
      enabled: false,
    });
    expect(mongoTenant.isEnabled() === false).toBeTruthy();
  });

  it("should have a default tenant id key of `tenant`.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}));
    expect(mongoTenant.getTenantIdKey()).toEqual("tenant");
  });

  it("should be capable of setting a custom tenant id key.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}), {
      tenantIdKey: "tenant_id",
    });
    expect(mongoTenant.getTenantIdKey()).toEqual("tenant_id");
  });

  it("should have a default tenant id field type of `String`.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}));
    expect(mongoTenant.getTenantIdType()).toEqual(String);
  });

  it("should be capable of setting a custom tenant id field type.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}), {
      tenantIdType: Number,
    });
    expect(mongoTenant.getTenantIdType()).toEqual(Number);
  });

  it("should have a default accessor method name of `byTenant`.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}));
    expect(mongoTenant.getAccessorMethod()).toEqual("byTenant");
  });

  it("should be capable of setting a custom accessor method name.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}), {
      accessorMethod: "tenancy",
    });
    expect(mongoTenant.getAccessorMethod()).toEqual("tenancy");
  });

  it("should not require tenant id field by default.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}));
    expect(mongoTenant.isTenantIdRequired()).toBe(false);
  });

  it("should be possible to set tenant id field required.", async () => {
    const mongoTenant = new MongooseTenant(new Schema({}), {
      requireTenantId: true,
    });
    expect(mongoTenant.isTenantIdRequired()).toBe(true);
  });
});
