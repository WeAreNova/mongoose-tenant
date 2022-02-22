/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { assert } from "chai";
import { BoundModel } from "lib/types";
import mongoose, { AnyObject, HydratedDocument, PopulatedDoc, Schema } from "mongoose";
import { clearDatabase, createTestModel } from "./_utils";

describe("MongoTenant", function () {
  describe("#Middleware", function () {
    clearDatabase();

    it("should add tenant on all discriminators of a model", function (done) {
      const TestModel = createTestModel(
        { kind: String },
        {
          schemaOptions: { discriminatorKey: "kind" },
        },
      );

      TestModel.discriminator("disc_key", new Schema({ inherit: Boolean }));

      TestModel.byTenant(1).create({ inherit: true, kind: "disc_key" }, (err, doc) => {
        assert.equal(doc.tenantId, 1);
        assert.equal(doc.inherit, true, "does not inherit");
        assert.equal(doc.kind, "disc_key");
        done();
      });
    });

    it("should inherit properties from Model when using discriminator", function (done) {
      const TestModel = createTestModel({ kind: String });

      let DiscriminatorTest = createTestModel({ inherit: Boolean });

      DiscriminatorTest = TestModel.discriminator("DiscriminatorTest", DiscriminatorTest.schema);

      DiscriminatorTest.byTenant(1).create({ inherit: true, kind: "test" }, (err, doc) => {
        assert.equal(doc.__t, "DiscriminatorTest");
        assert.equal(doc.tenantId, 1);
        assert(doc.inherit);
        assert.equal(doc.kind, "test");
        done();
      });
    });

    it("should bind tenant context to Model.count().", function (done) {
      const TestModel = createTestModel({});

      TestModel.byTenant(1).create([{}, {}, {}], (err) => {
        assert(!err, "Expected creation of 3 test entities to work.");

        TestModel.byTenant(1).count((err2, count) => {
          assert(!err2, "Expected entity counting to work.");
          assert.equal(count, 3, "Expected 3 entries for tenant `1`.");

          TestModel.byTenant(2).count((err3, count2) => {
            assert(!err3, "Expected entity counting to work.");
            assert.equal(count2, 0, "Expected 0 entries for tenant `2`.");

            done();
          });
        });
      });
    });

    it("should avoid tenant context jumping on Model.count().", function (done) {
      const TestModel = createTestModel({});

      TestModel.byTenant(1).create([{}, {}, {}], (err) => {
        assert(!err, "Expected creation of 3 test entities to work.");

        TestModel.byTenant(2).count({ tenantId: 1 }, (err2, count) => {
          assert(!err2, "Expected entity counting to work.");
          assert.equal(count, 0, "Expected 0 entries for tenant `2`.");

          TestModel.byTenant(1).count({ tenantId: 2 }, (err3, count2) => {
            assert(!err3, "Expected entity counting to work.");
            assert.equal(count2, 3, "Expected 3 entries for tenant `1`.");

            done();
          });
        });
      });
    });

    it("should not affect Model.count() when not in tenant context.", function (done) {
      const TestModel = createTestModel({});

      TestModel.create([{ tenantId: 1 }, { tenantId: 2 }, { tenantId: 3 }], (err) => {
        assert(!err, "Expected creation of 3 test entities to work.");

        TestModel.count((err2, count) => {
          assert(!err2, "Expected entity counting to work.");
          assert.equal(count, 3, "Expected 3 entries for all tenants.");

          done();
        });
      });
    });

    it("should bind tenant context to Model.find().", function (done) {
      const TestModel = createTestModel({});

      TestModel.byTenant("tenant1").create([{}, {}, {}], (err) => {
        assert(!err, "Expected creation of 3 test entities to work.");

        TestModel.byTenant("tenant1").find({}, (err2, entities) => {
          assert(!err2, "Expected entity search to work.");
          assert.equal(entities.length, 3, "Expected to find 3 entities for `tenant1`.");

          TestModel.byTenant("tenant2").find({}, (err3, entities2) => {
            assert(!err3, "Expected entity search to work.");
            assert.equal(entities2.length, 0, "Expected to find no entities for `tenant2`.");

            done();
          });
        });
      });
    });

    it("should avoid tenant context jumping on Model.find().", function (done) {
      const TestModel = createTestModel({});

      TestModel.byTenant("tenant1").create([{}, {}, {}], (err) => {
        assert(!err, "Expected creation of 3 test entities to work.");

        TestModel.byTenant("tenant2").find({ tenantId: "tenant1" }, (err2, entities) => {
          assert(!err2, "Expected entity search to work.");
          assert.equal(entities.length, 0, "Expected to find 0 entities for `tenant2`.");

          TestModel.byTenant("tenant1").find({ tenantId: "tenant2" }, (err3, entities2) => {
            assert(!err3, "Expected entity search to work.");
            assert.equal(entities2.length, 3, "Expected to find 3 entities for `tenant1`.");

            done();
          });
        });
      });
    });

    it("should pass down tenant context on Model.find().populate()", function (done) {
      const SubDocModel = createTestModel({});
      const ParentModel = createTestModel({
        docs: [{ type: Schema.Types.ObjectId, ref: SubDocModel.modelName }],
      }) as BoundModel<{ docs: PopulatedDoc<HydratedDocument<AnyObject>, mongoose.Types.ObjectId>[] }>;

      SubDocModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err, [doc1, doc2]) => {
        assert(!err, "Expected creation of 2 sub doc test entities to work.");

        ParentModel.create({ tenantId: "tenant1", docs: [doc1._id, doc2._id] }, (err2) => {
          assert(!err2, "Expected creation of 1 parent test entity to work.");

          ParentModel.byTenant("tenant1")
            .find()
            .populate("docs")
            .exec((err3, matches) => {
              assert(!err3, "Expected entity search by `Model.find` to work.");
              assert.equal(matches.length, 1, "Expected to find exactly 1 parent entity.");

              const parent = matches[0];
              assert.equal(parent.docs.length, 1, "Expected exactly 1 sub doc in found parent entity.");
              assert.equal(
                (parent.docs[0] as HydratedDocument<AnyObject>).tenantId,
                "tenant1",
                "Expected sub doc of found parent entity to be of same tenant.",
              );

              done();
            });
        });
      });
    });

    it("should not pass down tenant context on Model.find().populate() if referenced model is not tenant based", function (done) {
      const SubDocModel = createTestModel({}, { withPlugin: false });
      const ParentModel = createTestModel({
        docs: [{ type: Schema.Types.ObjectId, ref: SubDocModel.modelName }],
      }) as BoundModel<{ docs: PopulatedDoc<HydratedDocument<AnyObject>, mongoose.Types.ObjectId>[] }>;

      SubDocModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err, [doc1, doc2]) => {
        assert(!err, "Expected creation of 2 sub doc test entities to work.");

        ParentModel.create({ tenantId: "tenant1", docs: [doc1._id, doc2._id] }, (err2) => {
          assert(!err2, "Expected creation of 1 parent test entity to work.");

          ParentModel.byTenant("tenant1")
            .find()
            .populate("docs")
            .exec((err3, matches) => {
              assert(!err3, "Expected entity search by `Model.find` to work.");
              assert.equal(matches.length, 1, "Expected to find exactly 1 parent entity.");

              const parent = matches[0];
              assert.equal(parent.docs.length, 2, "Expected exactly 2 docs in found parent entity.");
              assert.equal(
                (parent.docs[0] as HydratedDocument<AnyObject>).hasTenantContext,
                void 0,
                "Expected first sub doc to not have a tenant context.",
              );
              assert.equal(
                (parent.docs[1] as HydratedDocument<AnyObject>).hasTenantContext,
                void 0,
                "Expected second sub doc to not have a tenant context.",
              );
              done();
            });
        });
      });
    });

    it("should not pass down tenant context on Model.find().populate() if referenced model has different tenant level", function (done) {
      const SubDocModel = createTestModel(
        {},
        {
          mongoTenant: { tenantIdKey: "otherTenantId" },
        },
      );
      const ParentModel = createTestModel({
        docs: [{ type: Schema.Types.ObjectId, ref: SubDocModel.modelName }],
      }) as BoundModel<{ docs: PopulatedDoc<HydratedDocument<AnyObject>, mongoose.Types.ObjectId>[] }>;

      SubDocModel.create([{ otherTenantId: "tenant1" }, { otherTenantId: "tenant2" }], (err, [doc1, doc2]) => {
        assert(!err, "Expected creation of 2 sub doc test entities to work.");

        ParentModel.create({ tenantId: "tenant1", docs: [doc1._id, doc2._id] }, (err2) => {
          assert(!err2, "Expected creation of 1 parent test entity to work.");

          ParentModel.byTenant("tenant1")
            .find()
            .populate("docs")
            .exec((err3, matches) => {
              assert(!err3, "Expected entity search by `Model.find` to work.");
              assert.equal(matches.length, 1, "Expected to find exactly 1 parent entity.");

              const parent = matches[0];
              assert.equal(parent.docs.length, 2, "Expected exactly 2 docs in found parent entity.");
              assert.equal(
                (parent.docs[0] as HydratedDocument<AnyObject>).hasTenantContext,
                void 0,
                "Expected first sub doc to not have a tenant context.",
              );
              assert.equal(
                (parent.docs[1] as HydratedDocument<AnyObject>).hasTenantContext,
                void 0,
                "Expected second sub doc to not have a tenant context.",
              );
              done();
            });
        });
      });
    });

    it("should bind tenant context to Model.findOne().", function (done) {
      const TestModel = createTestModel({});

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }, { tenantId: "tenant3" }], (err) => {
        assert(!err, "Expected creation of 3 test entities to work.");

        TestModel.byTenant("tenant1").findOne({}, {}, {}, (err2, model) => {
          assert(!err2, "Expected entity search by `Model.findOne` to work.");
          assert.equal(model?.tenantId, "tenant1", "Expected the found entity to be bound to the correct tenant.");

          TestModel.byTenant("tenant4").findOne({}, {}, {}, (err3, model2) => {
            assert(!err3, "Expected entity search by `Model.findOne` to work.");
            assert(!model2, "Expected the found no entity in the context of `tenant4`.");
            done();
          });
        });
      });
    });

    it("should avoid tenant context jumping on Model.findOne().", function (done) {
      const TestModel = createTestModel({});

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }, { tenantId: "tenant3" }], (err) => {
        assert(!err, "Expected creation of 3 test entities to work.");

        TestModel.byTenant("tenant1").findOne({ tenantId: "tenant2" }, {}, {}, (err2, model) => {
          assert(!err2, "Expected entity search by `Model.findOne` to work.");
          assert.equal(model?.tenantId, "tenant1", "Expected the found entity to be bound to the correct tenant.");

          TestModel.byTenant("tenant4").findOne({ tenantId: "tenant1" }, {}, {}, (err3, model2) => {
            assert(!err3, "Expected entity search by `Model.findOne` to work.");
            assert(!model2, "Expected to find no entity in the context of `tenant4`.");

            done();
          });
        });
      });
    });

    it("should bind tenant context to Model.findOneAndRemove().", function (done) {
      const TestModel = createTestModel({});

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }, { tenantId: "tenant3" }], (err) => {
        assert(!err, "Expected creation of 3 test entities to work.");

        TestModel.byTenant("tenant1").findOneAndRemove({}, {}, (err2, model) => {
          assert(!err2, "Expected method `Model.findOneAndRemove` to work.");
          assert.equal(model?.tenantId, "tenant1", "Expected the removed entity to be bound to the correct tenant.");

          TestModel.byTenant("tenant4").findOneAndRemove({}, {}, (err3, model2) => {
            assert(!err3, "Expected method `Model.findOneAndRemove` to work.");
            assert(!model2, "Expected to removed no entity in the context of `tenant4`.");
            done();
          });
        });
      });
    });

    it("should bind tenant context to Model.findOneAndUpdate().", function (done) {
      const TestModel = createTestModel({ someField: String });

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err) => {
        assert(!err, "Expected creation of 2 test entities to work.");

        TestModel.byTenant("tenant1").findOneAndUpdate(
          {},
          { someField: "some-value" },
          { new: true },
          (err2, entity) => {
            assert(!err2, "Expected Model.findOneAndUpdate to work.");
            assert.equal(
              (entity as AnyObject)?.tenantId,
              "tenant1",
              "Expected the found entity to be bound to the correct tenant.",
            );
            assert.equal(
              (entity as AnyObject)?.someField,
              "some-value",
              "Expected the updated entity to have someField set to some-value",
            );

            TestModel.byTenant("tenant3").findOneAndUpdate({}, { someField: "some-value" }, {}, (err3, entity2) => {
              assert(!err3, "Expected Model.findOneAndUpdate to work.");
              assert(!entity2, "Expected to not update any entity for tenant4.");
              done();
            });
          },
        );
      });
    });

    it("should bind tenant context to Model.save().", function (done) {
      const Model = createTestModel({}).byTenant(1),
        model = new Model();

      model.save((err, obj) => {
        assert(!err, "Expected model persistance to work");
        assert.equal(obj.tenantId, 1, "Expected tenantId to be automatically set to `1`.");

        done();
      });
    });

    it("should avoid tenant jumping on Model.save().", function (done) {
      const Model = createTestModel({}).byTenant(1),
        model = new Model();

      model.set("tenantId", 2);

      model.save((err, obj) => {
        assert(!err, "Expected model persistance to work");
        assert.equal(obj.tenantId, 1, "Expected tenantId to be automatically set to `1`.");

        done();
      });
    });

    it("should bind custom tenant key context to static Model.create() method.", function (done) {
      const Model = createTestModel(
        {},
        {
          mongoTenant: { tenantIdKey: "customTenantId" },
        },
      ).byTenant(1);

      Model.create({}, (err, obj) => {
        assert(!err, "Expected model persistance to work");
        assert.equal(obj.customTenantId, 1, "Expected customTenantId to be automatically set to `1`.");

        done();
      });
    });

    it("should avoid custom tenant key jumping on static Model.create() method.", function (done) {
      const Model = createTestModel(
        {},
        {
          mongoTenant: { tenantIdKey: "customTenantId" },
        },
      ).byTenant(1);

      Model.create({ customTenantId: 2 }, (err, obj) => {
        assert(!err, "Expected model persistance to work");
        assert.equal(obj.customTenantId, 1, "Expected customTenantId to be automatically set to `1`.");

        done();
      });
    });

    it("should bind tenant context to static Model.create() method.", function (done) {
      const Model = createTestModel({}).byTenant(1);

      Model.create({}, (err, obj) => {
        assert(!err, "Expected model persistance to work");
        assert.equal(obj.tenantId, 1, "Expected tenantId to be automatically set to `1`.");

        done();
      });
    });

    it("should avoid tenant jumping on static Model.create() method.", function (done) {
      const Model = createTestModel({}).byTenant(1);

      Model.create({ tenantId: 2 }, (err, obj) => {
        assert(!err, "Expected model persistance to work");
        assert.equal(obj.tenantId, 1, "Expected tenantId to be automatically set to `1`.");

        done();
      });
    });

    it("should bind tenant context to documents created by Model.insertMany() method.", function (done) {
      const Model = createTestModel({}).byTenant(1);

      Model.insertMany([{}, {}], {}, (err, docs) => {
        assert(!err, "Expected insertMany to work");

        (docs as HydratedDocument<AnyObject>[]).forEach(function (obj) {
          assert.ok(obj.hasTenantContext);
          assert.equal(obj.tenantId, 1, "Expected tenantId to be automatically set to `1`.");
        });

        done();
      });
    });

    it("should bind tenant context to documents created by Model.insertMany() method.", function (done) {
      const Model = createTestModel({}).byTenant(1);

      Model.insertMany([{ tenantId: 2 }, { tenantId: -3 }, { tenantId: "2" }], {}, (err, docs) => {
        assert(!err, "Expected insertMany to work");

        (docs as HydratedDocument<AnyObject>[]).forEach(function (obj) {
          assert.ok(obj.hasTenantContext);
          assert.equal(obj.tenantId, 1, "Expected tenantId to be automatically set to `1`.");
        });

        done();
      });
    });

    it("should bind tenant context to a single document created by Model.insertMany() method.", function (done) {
      const Model = createTestModel({}).byTenant(1);

      Model.insertMany({ tenantId: 2 }, {}, (err, docs) => {
        assert(!err, "Expected insertMany to work");

        (docs as HydratedDocument<AnyObject>[]).forEach(function (obj) {
          assert.ok(obj.hasTenantContext);
          assert.equal(obj.tenantId, 1, "Expected tenantId to be automatically set to `1`.");
        });

        done();
      });
    });

    it("Model.insertMany() method should fail properly.", function (done) {
      const Model = createTestModel({}).byTenant(1);

      Model.insertMany([{ field: "A" }, { _id: "A" }], {}, (err, docs) => {
        assert(err, "Expected insertMany to fail");
        assert(!docs, "Expected docs to be undefined on failed insertMany calls.");

        done();
      });
    });

    it("Model.insertMany() method should work without tenant context.", function (done) {
      const Model = createTestModel({});

      Model.insertMany([{ tenantId: 1 }, { tenantId: 2 }], {}, (err, res) => {
        const docs = res as HydratedDocument<AnyObject>[];
        assert(!err, "Expected insertMany to work");
        assert(docs.length === 2, "Expected 2 docs to be inserted.");
        assert.equal(docs[0].tenantId, 1, "Expected the first document to have a tenantId property of `1`.");
        assert.equal(docs[1].tenantId, 2, "Expected the first document to have a tenantId property of `2`.");

        docs.forEach(function (doc) {
          assert(doc instanceof Model, "Expected inserted documents to be proper instances of the model.");
        });

        done();
      });
    });

    it("should bind tenant context to Model.update().", function (done) {
      const TestModel = createTestModel({ someField: String });

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err) => {
        assert(!err, "Expected creation of 2 test entities to work.");

        TestModel.byTenant("tenant1").updateOne({}, { someField: "some-value" }, {}, (err2) => {
          assert(!err2, "Expected model update to work.");

          TestModel.byTenant("tenant1").find({}, (err3, entities) => {
            assert(!err3, "Expected entity search by Model.find to work.");

            for (const entity of entities) {
              assert.equal(entity.someField, "some-value", "Expected updated value of someField to be `some-value`.");
            }

            done();
          });
        });
      });
    });

    it("should avoid overwriting tenant context on Model.update().", function (done) {
      const TestModel = createTestModel({ someField: String });

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err) => {
        assert(!err, "Expected creation of 2 test entities to work.");

        TestModel.byTenant("tenant1").updateOne(
          {},
          {
            tenantId: "tenant2",
            someField: "some-value",
            $set: { tenantId: "tenant2" },
          },
          {},
          (err2) => {
            assert(!err2, "Expected model update to work.");

            TestModel.byTenant("tenant1").find({}, (err3, entities) => {
              assert(!err3, "Expected entity search by Model.find to work.");
              assert.equal(entities.length, 1, "Expected to find exactly 1 entity.");
              assert.equal(
                entities[0].someField,
                "some-value",
                "Expected updated value of someField to be `some-value`.",
              );

              done();
            });
          },
        );
      });
    });

    it("should preserve tenant context on Model.update() with truthy overwrite option.", function (done) {
      const TestModel = createTestModel({ someField: String });

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err) => {
        assert(!err, "Expected creation of 2 test entities to work.");

        TestModel.byTenant("tenant1").updateOne(
          {},
          { tenantId: "tenant2", someField: "some-value" },
          { overwrite: true },
          (err2) => {
            assert(!err2, "Expected model update to work.");

            TestModel.byTenant("tenant1").find({}, (err3, entities) => {
              assert(!err3, "Expected entity search by Model.find to work.");
              assert.equal(entities.length, 1, "Expected to find exactly 1 entity.");
              assert.equal(
                entities[0].someField,
                "some-value",
                "Expected updated value of someField to be `some-value`.",
              );

              done();
            });
          },
        );
      });
    });

    it("should not affect Model.update() when not in tenant context.", function (done) {
      const TestModel = createTestModel({ someField: String });

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2", someField: "some-value" }], (err) => {
        assert(!err, "Expected creation of 2 test entities to work.");

        TestModel.updateOne({ tenantId: "tenant1" }, { tenantId: "tenant2", someField: "some-value" }, {}, (err2) => {
          assert(!err2, "Expected model update to work.");

          TestModel.find({}, (err3, entities) => {
            assert(!err3, "Expected entity search by Model.find to work.");
            assert.equal(entities.length, 2, "Expected to find exactly 2 entity.");
            assert.equal(
              entities[0].someField,
              "some-value",
              "Expected updated value of someField to be `some-value`.",
            );
            assert.equal(entities[0].tenantId, "tenant2", "Expected updated tenantId to be `tenant2`.");
            assert.equal(
              entities[1].someField,
              "some-value",
              "Expected updated value of someField to be `some-value`.",
            );
            assert.equal(entities[1].tenantId, "tenant2", "Expected updated tenantId to be `tenant2`.");

            done();
          });
        });
      });
    });

    it("should bind tenant context to Model.updateMany().", function (done) {
      const TestModel = createTestModel({ someField: String });

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err) => {
        assert(!err, "Expected creation of 2 test entities to work.");

        TestModel.byTenant("tenant1").updateMany({}, { someField: "some-value" }, {}, (err2) => {
          assert(!err2, "Expected model updateMany to work.");

          TestModel.byTenant("tenant1").find({}, (err3, entities) => {
            assert(!err3, "Expected entity search by Model.find to work.");

            for (const entity of entities) {
              assert.equal(entity.someField, "some-value", "Expected updated value of someField to be `some-value`.");
            }

            done();
          });
        });
      });
    });

    it("should avoid overwriting tenant context on Model.updateMany().", function (done) {
      const TestModel = createTestModel({ someField: String });

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err) => {
        assert(!err, "Expected creation of 2 test entities to work.");

        TestModel.byTenant("tenant1").updateMany(
          {},
          {
            tenantId: "tenant2",
            someField: "some-value",
            $set: { tenantId: "tenant2" },
          },
          {},
          (err2) => {
            assert(!err2, "Expected model updateMany to work.");

            TestModel.byTenant("tenant1").find({}, (err3, entities) => {
              assert(!err3, "Expected entity search by Model.find to work.");
              assert.equal(entities.length, 1, "Expected to find exactly 1 entity.");
              assert.equal(
                entities[0].someField,
                "some-value",
                "Expected updated value of someField to be `some-value`.",
              );

              done();
            });
          },
        );
      });
    });

    it("should not affect Model.updateMany() when not in tenant context.", function (done) {
      const TestModel = createTestModel({ someField: String });

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2", someField: "some-value" }], (err) => {
        assert(!err, "Expected creation of 2 test entities to work.");

        TestModel.updateMany({ tenantId: "tenant1" }, { tenantId: "tenant2", someField: "some-value" }, {}, (err2) => {
          assert(!err2, "Expected model updateMany to work.");

          TestModel.find({}, (err3, entities) => {
            assert(!err3, "Expected entity search by Model.find to work.");
            assert.equal(entities.length, 2, "Expected to find exactly 2 entity.");
            assert.equal(
              entities[0].someField,
              "some-value",
              "Expected updated value of someField to be `some-value`.",
            );
            assert.equal(entities[0].tenantId, "tenant2", "Expected updated tenantId to be `tenant2`.");
            assert.equal(
              entities[1].someField,
              "some-value",
              "Expected updated value of someField to be `some-value`.",
            );
            assert.equal(entities[1].tenantId, "tenant2", "Expected updated tenantId to be `tenant2`.");

            done();
          });
        });
      });
    });
  });
});
