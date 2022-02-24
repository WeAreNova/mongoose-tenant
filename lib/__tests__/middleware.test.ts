/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @copyright   Copyright (c) 2022, dvprrsh
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import mongoose, { AnyObject, HydratedDocument, PopulatedDoc, Schema } from "mongoose";
import { BoundModel } from "../types";
import { clearDatabase, connect, createTestModel } from "./utils";

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await clearDatabase();
});

describe("Middleware", () => {
  clearDatabase();

  it("should add tenant on all discriminators of a model", async () => {
    const TestModel = createTestModel(
      { kind: String },
      { schemaOptions: { discriminatorKey: "kind" }, mongoTenant: { tenantIdType: Number } },
    );
    TestModel.discriminator("disc_key", new Schema({ inherit: Boolean }));

    const doc = await TestModel.byTenant(1).create({ inherit: true, kind: "disc_key" });
    expect(doc).toHaveProperty("tenant", 1);
    expect(doc.inherit).toEqual(true);
    expect(doc.kind).toEqual("disc_key");
  });

  it("should inherit properties from Model when using discriminator", async () => {
    const TestModel = createTestModel({ kind: String }, { mongoTenant: { tenantIdType: Number } });

    let DiscriminatorTest = createTestModel({ inherit: Boolean }, { mongoTenant: { tenantIdType: Number } });

    DiscriminatorTest = TestModel.discriminator("DiscriminatorTest", DiscriminatorTest.schema);

    const doc = await DiscriminatorTest.byTenant(1).create({ inherit: true, kind: "test" });
    expect(doc.__t).toEqual("DiscriminatorTest");
    expect(doc).toHaveProperty("tenant", 1);
    expect(doc.inherit).toBeTruthy();
    expect(doc.kind).toEqual("test");
  });

  it("should bind tenant context to Model.count().", async () => {
    const TestModel = createTestModel({}, { mongoTenant: { tenantIdType: Number } });
    await expect(TestModel.byTenant(1).create([{}, {}, {}])).resolves.toHaveLength(3);
    await expect(TestModel.byTenant(1).count()).resolves.toBe(3);
    await expect(TestModel.byTenant(2).count()).resolves.toBe(0);
  });

  it("should avoid tenant context jumping on Model.count().", async () => {
    const TestModel = createTestModel({}, { mongoTenant: { tenantIdType: Number } });
    await expect(TestModel.byTenant(1).create([{}, {}, {}])).resolves.toHaveLength(3);
    await expect(TestModel.byTenant(2).count({ tenant: 1 })).resolves.toBe(0);
    await expect(TestModel.byTenant(1).count({ tenant: 2 })).resolves.toBe(3);
  });

  it("should not affect Model.count() when not in tenant context.", async () => {
    const TestModel = createTestModel({}, { mongoTenant: { tenantIdType: Number } });
    await expect(TestModel.create([{ tenant: 1 }, { tenant: 2 }, { tenant: 3 }])).resolves.toHaveLength(3);
    await expect(TestModel.count()).resolves.toBe(3);
  });

  it("should bind tenant context to Model.find().", async () => {
    const TestModel = createTestModel({});
    await expect(TestModel.byTenant("tenant1").create([{}, {}, {}])).resolves.toHaveLength(3);
    await expect(TestModel.byTenant("tenant1").find({})).resolves.toHaveLength(3);
    await expect(TestModel.byTenant("tenant2").find({})).resolves.toHaveLength(0);
  });

  it("should avoid tenant context jumping on Model.find().", async () => {
    const TestModel = createTestModel({});
    await expect(TestModel.byTenant("tenant1").create([{}, {}, {}])).resolves.toHaveLength(3);
    await expect(TestModel.byTenant("tenant2").find({ tenant: "tenant1" })).resolves.toHaveLength(0);
    await expect(TestModel.byTenant("tenant1").find({ tenant: "tenant2" })).resolves.toHaveLength(3);
  });

  it("should pass down tenant context on Model.find().populate()", async () => {
    const SubDocModel = createTestModel({});
    const ParentModel = createTestModel({
      docs: [{ type: Schema.Types.ObjectId, ref: SubDocModel.modelName }],
    }) as BoundModel<{ docs: PopulatedDoc<HydratedDocument<AnyObject>, mongoose.Types.ObjectId>[] }>;

    const [doc1, doc2] = await SubDocModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }]);
    await expect(ParentModel.create({ tenant: "tenant1", docs: [doc1._id, doc2._id] })).resolves.toBeTruthy();

    const docs = await ParentModel.byTenant("tenant1").find().populate("docs").exec();
    expect(docs).toHaveLength(1);

    const parent = docs[0];
    expect(parent.docs).toHaveLength(1);
    expect(parent.docs[0] as HydratedDocument<AnyObject>).toHaveProperty("tenant", "tenant1");
  });

  it("should not pass down tenant context on Model.find().populate() if referenced model is not tenant based", async () => {
    const SubDocModel = createTestModel({}, { withPlugin: false });
    const ParentModel = createTestModel({
      docs: [{ type: Schema.Types.ObjectId, ref: SubDocModel.modelName }],
    }) as BoundModel<{ docs: PopulatedDoc<HydratedDocument<AnyObject>, mongoose.Types.ObjectId>[] }>;

    const [doc1, doc2] = await SubDocModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }]);
    await expect(ParentModel.create({ tenant: "tenant1", docs: [doc1._id, doc2._id] })).resolves.toBeTruthy();

    const docs = await ParentModel.byTenant("tenant1").find().populate("docs").exec();
    expect(docs).toHaveLength(1);

    const parent = docs[0];
    expect(parent.docs).toHaveLength(2);
    expect((parent.docs[0] as HydratedDocument<AnyObject>).hasTenantContext).toBeUndefined();
    expect((parent.docs[1] as HydratedDocument<AnyObject>).hasTenantContext).toBeUndefined();
  });

  it("should not pass down tenant context on Model.find().populate() if referenced model has different tenant level", async () => {
    const SubDocModel = createTestModel({}, { mongoTenant: { tenantIdKey: "otherTenantId" } });
    const ParentModel = createTestModel({
      docs: [{ type: Schema.Types.ObjectId, ref: SubDocModel.modelName }],
    }) as BoundModel<{ docs: PopulatedDoc<HydratedDocument<AnyObject>, mongoose.Types.ObjectId>[] }>;

    const [doc1, doc2] = await SubDocModel.create([{ otherTenantId: "tenant1" }, { otherTenantId: "tenant2" }]);
    await expect(ParentModel.create({ tenant: "tenant1", docs: [doc1._id, doc2._id] })).resolves.toBeTruthy();

    const docs = await ParentModel.byTenant("tenant1").find().populate("docs").exec();
    expect(docs).toHaveLength(1);

    const parent = docs[0];
    expect(parent.docs).toHaveLength(2);
    expect((parent.docs[0] as HydratedDocument<AnyObject>).hasTenantContext).toBeUndefined();
    expect((parent.docs[1] as HydratedDocument<AnyObject>).hasTenantContext).toBeUndefined();
  });

  it("should bind tenant context to Model.findOne().", async () => {
    const TestModel = createTestModel({});

    await expect(
      TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }, { tenant: "tenant3" }]),
    ).resolves.toHaveLength(3);

    const doc = await TestModel.byTenant("tenant1").findOne().exec();
    expect(doc?.tenant).toBe("tenant1");

    await expect(TestModel.byTenant("tenant4").findOne()).resolves.toBeFalsy();
  });

  it("should avoid tenant context jumping on Model.findOne().", async () => {
    const TestModel = createTestModel({});

    await expect(
      TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }, { tenant: "tenant3" }]),
    ).resolves.toHaveLength(3);
    await expect(TestModel.byTenant("tenant1").findOne({ tenant: "tenant2" })).resolves.toHaveProperty(
      "tenant",
      "tenant1",
    );
    await expect(TestModel.byTenant("tenant4").findOne({ tenant: "tenant1" })).resolves.toBeFalsy();
  });

  it("should bind tenant context to Model.findOneAndRemove().", async () => {
    const TestModel = createTestModel({});

    await expect(
      TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }, { tenant: "tenant3" }]),
    ).resolves.toHaveLength(3);
    await expect(TestModel.byTenant("tenant1").findOneAndRemove()).resolves.toHaveProperty("tenant", "tenant1");
    await expect(TestModel.byTenant("tenant4").findOneAndRemove()).resolves.toBeFalsy();
  });

  it("should bind tenant context to Model.findOneAndUpdate().", async () => {
    const TestModel = createTestModel({ someField: { type: String } });

    await expect(TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }])).resolves.toHaveLength(2);

    const doc = await TestModel.byTenant("tenant1").findOneAndUpdate({}, { someField: "some-value" }).exec();
    expect(doc).toBeTruthy();
    expect(doc).toHaveProperty("tenant", "tenant1");
    expect(doc).toHaveProperty("someField", "some-value");

    await expect(TestModel.byTenant("tenant3").findOneAndUpdate({}, { someField: "some-value" })).resolves.toBeFalsy();
  });

  it("should bind tenant context to Model.save().", async () => {
    const Model = createTestModel({}, { mongoTenant: { tenantIdType: Number } }).byTenant(1);
    const doc = new Model();
    await expect(doc.save()).resolves.toHaveProperty("tenant", 1);
  });

  it("should avoid tenant jumping on Model.save().", async () => {
    const Model = createTestModel({}, { mongoTenant: { tenantIdType: Number } }).byTenant(1);
    const doc = new Model();
    doc.set("tenant", 2);
    await expect(doc.save()).resolves.toHaveProperty("tenant", 1);
  });

  it("should bind custom tenant key context to static Model.create() method.", async () => {
    const Model = createTestModel(
      {},
      { mongoTenant: { tenantIdKey: "customTenantId", tenantIdType: Number } },
    ).byTenant(1);
    await expect(Model.create({})).resolves.toHaveProperty("customTenantId", 1);
  });

  it("should avoid custom tenant key jumping on static Model.create() method.", async () => {
    const Model = createTestModel(
      {},
      { mongoTenant: { tenantIdKey: "customTenantId", tenantIdType: Number } },
    ).byTenant(1);
    await expect(Model.create({ customTenantId: 2 })).resolves.toHaveProperty("customTenantId", 1);
  });

  it("should bind tenant context to static Model.create() method.", async () => {
    const Model = createTestModel({}, { mongoTenant: { tenantIdType: Number } }).byTenant(1);
    await expect(Model.create({})).resolves.toHaveProperty("tenant", 1);
  });

  it("should avoid tenant jumping on static Model.create() method.", async () => {
    const Model = createTestModel({}, { mongoTenant: { tenantIdType: Number } }).byTenant(1);
    await expect(Model.create({ tenant: 2 })).resolves.toHaveProperty("tenant", 1);
  });

  it("should bind tenant context to documents created by Model.insertMany() method.", async () => {
    const Model = createTestModel({}, { mongoTenant: { tenantIdType: Number } }).byTenant(1);
    const docs = await Model.insertMany([{}, {}]);
    docs.forEach((doc) => {
      expect(doc).toHaveProperty("hasTenantContext", true);
      expect(doc).toHaveProperty("tenant", 1);
    });
  });

  it("should bind tenant context to documents created by Model.insertMany() method.", async () => {
    const Model = createTestModel({}, { mongoTenant: { tenantIdType: Number } }).byTenant(1);
    const docs = await Model.insertMany([{ tenant: 2 }, { tenant: -3 }, { tenant: "2" }]);
    docs.forEach((doc) => {
      expect(doc).toHaveProperty("hasTenantContext", true);
      expect(doc).toHaveProperty("tenant", 1);
    });
  });

  it("should bind tenant context to a single document created by Model.insertMany() method.", async () => {
    const Model = createTestModel({}, { mongoTenant: { tenantIdType: Number } }).byTenant(1);
    const docs = await Model.insertMany({ tenant: 2 });
    docs.forEach((doc) => {
      expect(doc).toHaveProperty("hasTenantContext", true);
      expect(doc).toHaveProperty("tenant", 1);
    });
  });

  it("Model.insertMany() method should fail properly.", async () => {
    const Model = createTestModel({}, { mongoTenant: { tenantIdType: Number } }).byTenant(1);
    await expect(Model.insertMany([{ field: "A" }, { _id: "A" }])).rejects.toThrow();
  });

  it("Model.insertMany() method should work without tenant context.", async () => {
    const Model = createTestModel({}, { mongoTenant: { tenantIdType: Number } });
    const docs = await Model.insertMany([{ tenant: 1 }, { tenant: 2 }]);
    expect(docs).toHaveLength(2);
    expect(docs[0]).toHaveProperty("tenant", 1);
    expect(docs[1]).toHaveProperty("tenant", 2);
    docs.forEach((doc) => expect(doc).toBeInstanceOf(Model));
  });

  it("should bind tenant context to Model.findOneAndUpdate().", async () => {
    const TestModel = createTestModel({ someField: String });

    await expect(TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }])).resolves.toHaveLength(2);
    await expect(
      TestModel.byTenant("tenant1").findOneAndUpdate({}, { someField: "some-value" }),
    ).resolves.toHaveProperty("tenant", "tenant1");

    const docs = await TestModel.byTenant("tenant1").find({}).exec();
    docs.forEach((doc) => expect(doc).toHaveProperty("someField", "some-value"));
  });

  it("should avoid overwriting tenant context on Model.findOneAndUpdate().", async () => {
    const TestModel = createTestModel({ someField: String });

    await expect(TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }])).resolves.toHaveLength(2);
    await expect(
      TestModel.byTenant("tenant1").findOneAndUpdate(
        {},
        { tenant: "tenant2", someField: "some-value", $set: { tenant: "tenant2" } },
      ),
    ).resolves.toHaveProperty("tenant", "tenant1");

    const docs = await TestModel.byTenant("tenant1").find({}).exec();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toHaveProperty("someField", "some-value");
  });

  it("should preserve tenant context on Model.findOneAndUpdate() with truthy overwrite option.", async () => {
    const TestModel = createTestModel({ someField: String });

    await expect(TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }])).resolves.toHaveLength(2);
    await expect(
      TestModel.byTenant("tenant1").findOneAndUpdate(
        {},
        { $set: { tenant: "tenant2", someField: "some-value" } },
        { overwrite: true },
      ),
    ).resolves.toHaveProperty("tenant", "tenant1");

    const docs = await TestModel.byTenant("tenant1").find({}).exec();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toHaveProperty("someField", "some-value");
  });

  it("should not affect Model.findOneAndUpdate() when not in tenant context.", async () => {
    const TestModel = createTestModel({ someField: String });

    await expect(
      TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2", someField: "some-value" }]),
    ).resolves.toHaveLength(2);
    await expect(
      TestModel.findOneAndUpdate({ tenant: "tenant1" }, { tenant: "tenant2", someField: "some-value" }),
    ).resolves.toHaveProperty("tenant", "tenant2");
    const docs = await TestModel.find({}).exec();
    expect(docs).toHaveLength(2);
    expect(docs[0]).toHaveProperty("someField", "some-value");
    expect(docs[0]).toHaveProperty("tenant", "tenant2");
    expect(docs[1]).toHaveProperty("someField", "some-value");
    expect(docs[1]).toHaveProperty("tenant", "tenant2");
  });

  it("should bind tenant context to Model.updateMany().", async () => {
    const TestModel = createTestModel({ someField: String });

    await expect(TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }])).resolves.toHaveLength(2);
    await expect(TestModel.byTenant("tenant1").updateMany({}, { someField: "some-value" }, {})).resolves.toHaveProperty(
      "modifiedCount",
      1,
    );

    const docs = await TestModel.byTenant("tenant1").find({}).exec();
    docs.forEach((doc) => expect(doc).toHaveProperty("someField", "some-value"));
  });

  it("should avoid overwriting tenant context on Model.updateMany().", async () => {
    const TestModel = createTestModel({ someField: String });

    await expect(TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2" }])).resolves.toHaveLength(2);
    await expect(
      TestModel.byTenant("tenant1").updateMany(
        {},
        {
          tenant: "tenant2",
          someField: "some-value",
          $set: { tenant: "tenant2" },
        },
      ),
    ).resolves.toBeTruthy();

    const docs = await TestModel.byTenant("tenant1").find({}).exec();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toHaveProperty("someField", "some-value");
  });

  it("should not affect Model.updateMany() when not in tenant context.", async () => {
    const TestModel = createTestModel({ someField: String });

    await expect(
      TestModel.create([{ tenant: "tenant1" }, { tenant: "tenant2", someField: "some-value" }]),
    ).resolves.toHaveLength(2);
    await expect(
      TestModel.updateMany({ tenant: "tenant1" }, { tenant: "tenant2", someField: "some-value" }),
    ).resolves.toBeTruthy();

    const docs = await TestModel.find({}).exec();
    expect(docs).toHaveLength(2);
    expect(docs[0]).toHaveProperty("someField", "some-value");
    expect(docs[0]).toHaveProperty("tenant", "tenant2");
    expect(docs[1]).toHaveProperty("someField", "some-value");
    expect(docs[1]).toHaveProperty("tenant", "tenant2");
  });
});
