/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { assert } from "chai";
import { Callback } from "mongoose";
import { clearDatabase, createTestModel } from "./_utils";

describe("MongoTenant", function () {
  describe("#Integration", function () {
    clearDatabase();

    it("should inject default accessor method.", function () {
      const Model = createTestModel({});
      assert(typeof Model.byTenant === "function", "Expected default accessor method to be statically available.");
    });

    it("should expose its tenant binding.", function () {
      const Model = createTestModel({});
      const ModelBoundToTenant = Model.byTenant(1);

      assert(
        ModelBoundToTenant.hasTenantContext === true,
        "Expected static flag `hasTenantContext` on models bound to a certain tenant.",
      );
      assert(
        new ModelBoundToTenant().hasTenantContext === true,
        "Expected property `hasTenantContext` on model instances bound to a certain tenant.",
      );
      assert(typeof Model.hasTenantContext === "undefined", "Expected the mongoose model to be untouched.");
      assert(typeof new Model().hasTenantContext === "undefined", "Expected the mongoose model to be untouched.");
    });

    it("should bind the model to the proper tenant.", function () {
      const Model = createTestModel({});
      const modelA = Model.byTenant(1);
      const modelB = Model.byTenant(2);

      assert.equal(modelA.getTenant(), 1, "Expected the tenantId of tenant specific model to be `1`.");
      assert.equal(new modelA().getTenant(), 1, "Expected the tenantId of tenant specific model to be `1`.");
      assert.equal(modelB.getTenant(), 2, "Expected the tenantId of tenant specific model to be `2`.");
      assert.equal(new modelB().getTenant(), 2, "Expected the tenantId of tenant specific model to be `2`.");
    });

    it("should create tenant specific models only once and cache previous compilations.", function () {
      const Model = createTestModel({});
      assert.equal(
        Model.byTenant(1),
        Model.byTenant(1),
        "Expected multiple calls to tenant specific model accessor to deliver same model compilation.",
      );
    });

    it("should bind Model.remove() to correct tenant context.", function (done) {
      const TestModel = createTestModel({});

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err1) => {
        assert(!err1, "Expected creation of 2 test entities to work.");

        TestModel.byTenant("tenant1").remove({}, (err2) => {
          assert(!err2, "Expected Model.remove() to work.");

          TestModel.find({}, (err3, entities) => {
            assert(!err3, "Expected Model.find() to work.");
            assert.equal(entities.length, 1, "Expected to find only one entity.");
            assert.equal(entities[0].tenantId, "tenant2", "Expected tenant2 scope on entity.");
            done();
          });
        });
      });
    });

    it("should bind Model.aggregate(obj[], func) to correct tenant context.", function (done) {
      const TestModel = createTestModel({ num: Number });

      TestModel.create(
        [
          { tenantId: "tenant1", num: 10 },
          { tenantId: "tenant1", num: 12 },
          { tenantId: "tenant2", num: 20 },
        ],
        (err1) => {
          assert(!err1, "Expected creation of 3 test entities to work.");

          TestModel.byTenant("tenant1").aggregate(
            [
              {
                $group: {
                  _id: "$tenantId",
                  sum: { $sum: "$num" },
                },
              },
            ],
            ((err2, results) => {
              assert(!err2, "Expected Model.aggregate() to work.");
              assert.equal(results.length, 1, "Expected model aggregation to return exactly one result.");
              assert.equal(results[0].sum, 22, "Expected the sum up `num` field for `tenant1` to be 22.");
              assert.equal(results[0]._id, "tenant1", "Expected the tenant id of aggregated data ser to be `tenant1`.");

              done();
            }) as Callback<{ _id: string; sum: number }[]>,
          );
        },
      );
    });

    it("should not be able to delete across tenants", (done) => {
      const TestModel = createTestModel({
        test: {
          type: String,
          required: true,
          trim: true,
        },
      });

      const ModelClassT1 = TestModel.byTenant("tenant1");
      const ModelClassT2 = TestModel.byTenant("tenant2");

      const t1Instance = new ModelClassT1({ test: "t1Instance" });
      const t2Instance = new ModelClassT2({ test: "t2Instance" });

      t1Instance.save((err1) => {
        assert(!err1, "save t1 instance should work");
        t2Instance.save((err2) => {
          assert(!err2, "save t2 instance should work");
          ModelClassT2.deleteOne({ _id: t1Instance._id }, (err3) => {
            assert(!err3, "error should not occur"); // I guess it's fine that no error occurs. that is just mongo behaviour
            // however the document should not be deleted, since ModelClassT2 should have no access to elements of tenant1
            ModelClassT1.findById(t1Instance._id, {}, {}, (_err4, modelInst) => {
              assert(
                modelInst,
                "modelInstance should still be available, since it should not be able to delete across tenants",
              );
              done();
            });
          });
        });
      });
    });

    it("should bind Model.deleteOne(conditions, cb) to correct tenant context.", function (done) {
      const TestModel = createTestModel({});

      TestModel.create([{ tenantId: "tenant1" }, { tenantId: "tenant2" }], (err) => {
        assert(!err, "Expected creation of 2 test entities to work.");

        TestModel.byTenant("tenant1").deleteOne({ tenantId: "tenant2" }, (deletionError) => {
          assert(!deletionError, "Expected Model.deleteMany() to work");

          TestModel.find({}, (lookupErr, entities) => {
            assert(!lookupErr, "Expected Model.find() to work.");
            assert.equal(entities.length, 1, "Expected to find only one entity.");
            assert.equal(entities[0].tenantId, "tenant2", "Expected tenant2 scope on entity.");

            done();
          });
        });
      });
    });

    it("should bind Model.deleteMany(conditions, options, cb) to correct tenant context.", function (done) {
      const TestModel = createTestModel({ num: Number });

      TestModel.create(
        [
          { tenantId: "tenant1", num: 1 },
          { tenantId: "tenant1", num: 1 },
          { tenantId: "tenant2", num: 1 },
        ],
        (err) => {
          assert(!err, "Expected creation of 3 test entities to work.");

          TestModel.byTenant("tenant1").deleteMany({ num: 1 }, (deletionError) => {
            assert(!deletionError, "Expected Model.deleteMany() to work");

            TestModel.find({}, (lookupErr, entities) => {
              assert(!lookupErr, "Expected Model.find() to work.");
              assert.equal(entities.length, 1, "Expected to find only one entity.");
              assert.equal(entities[0].tenantId, "tenant2", "Expected tenant2 scope on entity.");

              done();
            });
          });
        },
      );
    });
  });
});
