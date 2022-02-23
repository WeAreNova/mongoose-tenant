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

describe("Integration", () => {
  it("should inject default accessor method.", async () => {
    const Model = createTestModel({});
    expect(typeof Model.byTenant === "function").toBeTruthy();
  });

  it("should expose its tenant binding.", async () => {
    const Model = createTestModel({});
    const ModelBoundToTenant = Model.byTenant(1);

    expect(ModelBoundToTenant.hasTenantContext === true).toBeTruthy();
    expect(new ModelBoundToTenant().hasTenantContext === true).toBeTruthy();
    expect(typeof Model.hasTenantContext === "undefined").toBeTruthy();
    expect(typeof new Model().hasTenantContext === "undefined").toBeTruthy();
  });

  it("should bind the model to the proper tenant.", async () => {
    const Model = createTestModel({});
    const modelA = Model.byTenant(1);
    const modelB = Model.byTenant(2);

    expect(modelA.getTenant()).toEqual(1);
    expect(new modelA().getTenant()).toEqual(1);
    expect(modelB.getTenant()).toEqual(2);
    expect(new modelB().getTenant()).toEqual(2);
  });

  it("should create tenant specific models only once and cache previous compilations.", async () => {
    const Model = createTestModel({});
    expect(Model.byTenant(1)).toEqual(Model.byTenant(1));
  });

  it("should bind Model.remove() to correct tenant context.", async () => {
    const TestModel = createTestModel({});

    await expect(TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }])).resolves.toHaveLength(2);
    await expect(TestModel.byTenant("tenant1").remove({})).resolves.toBeTruthy();

    const docs = await TestModel.find({}).exec();
    expect(docs.length).toEqual(1);
    expect(docs[0].tenantId).toEqual("tenant2");
  });

  it("should bind Model.aggregate(obj[], func) to correct tenant context.", async () => {
    const TestModel = createTestModel({ num: Number });

    await expect(
      TestModel.create([
        { tenantId: "tenant1", num: 10 },
        { tenantId: "tenant1", num: 12 },
        { tenantId: "tenant2", num: 20 },
      ]),
    ).resolves.toHaveLength(3);

    const res = await TestModel.byTenant("tenant1")
      .aggregate([
        {
          $group: {
            _id: "$tenantId",
            sum: { $sum: "$num" },
          },
        },
      ])
      .exec();
    expect(res).toHaveLength(1);
    expect(res[0].sum).toEqual(22);
    expect(res[0]._id).toEqual("tenant1");
  });

  it("should not be able to delete across tenants", async () => {
    const TestModel = createTestModel({ test: { type: String, required: true, trim: true } });

    const ModelClassT1 = TestModel.byTenant("tenant1");
    const ModelClassT2 = TestModel.byTenant("tenant2");

    const t1Instance = new ModelClassT1({ test: "t1Instance" });
    const t2Instance = new ModelClassT2({ test: "t2Instance" });

    await expect(t1Instance.save()).resolves.toBeTruthy();
    await expect(t2Instance.save()).resolves.toBeTruthy();

    await expect(ModelClassT2.deleteOne({ _id: t1Instance._id })).resolves.toBeFalsy();
    await expect(ModelClassT1.findById(t1Instance._id)).resolves.toBeTruthy();
  });

  it("should bind Model.deleteOne(conditions, cb) to correct tenant context.", async () => {
    const TestModel = createTestModel({});

    await expect(TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }])).resolves.toHaveLength(2);
    await expect(TestModel.byTenant("tenant1").deleteOne({ tenantId: "tenant2" })).resolves.toBeFalsy();

    const docs = await TestModel.find({}).exec();
    expect(docs.length).toEqual(1);
    expect(docs[0].tenantId).toEqual("tenant2");
  });

  it("should bind Model.deleteMany(conditions, options, cb) to correct tenant context.", async () => {
    const TestModel = createTestModel({ num: Number });

    await expect(
      TestModel.create([
        { tenantId: "tenant1", num: 1 },
        { tenantId: "tenant1", num: 1 },
        { tenantId: "tenant2", num: 1 },
      ]),
    ).resolves.toHaveLength(3);

    await expect(TestModel.byTenant("tenant1").deleteMany({ num: 1 })).resolves.toHaveLength(2);

    const docs = await TestModel.find({}).exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].tenantId).toEqual("tenant2");
  });
});
