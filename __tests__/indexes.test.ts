/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @copyright   Copyright (c) 2022, dvprrsh
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import { IndexDefinition, IndexOptions } from "mongoose";
import { clearDatabase, connect, createTestModel } from "./utils";

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await clearDatabase();
});

describe("Indexes", () => {
  it("should consider the tenant id field in schema level unique indexes.", async () => {
    const indexesFound: Record<string, boolean> = {};
    const Model = createTestModel(
      { field1: String, field2: Number },
      {
        applyOnSchema: (schema) => {
          schema.index({ field1: 1 }, { unique: true, name: "index1" });
          schema.index({ field2: 1 }, { name: "index2" });
          schema.index({ field1: 1, field2: 1 }, { unique: true, name: "index3" });
        },
      },
    );

    for (const [def, options] of Model.schema.indexes() as unknown as Array<
      [def: IndexDefinition, options?: IndexOptions]
    >) {
      if (!options?.name) continue;

      indexesFound[options.name] = true;
      switch (options.name) {
        case "index1":
          expect(def).toHaveProperty("tenant");
          expect(def).toHaveProperty("field1");
          break;
        case "index2":
          expect(def).not.toHaveProperty("tenant");
          expect(def).toHaveProperty("field2");
          break;
        case "index3":
          expect(def).toHaveProperty("tenant");
          expect(def).toHaveProperty("field1");
          expect(def).toHaveProperty("field2");
          break;
      }
    }

    expect(indexesFound.index1).toBeTruthy();
    expect(indexesFound.index2).toBeTruthy();
    expect(indexesFound.index3).toBeTruthy();
  });

  it("should consider the tenant id field in field level unique indexes.", async () => {
    const indexesFound: Record<string, boolean> = {};
    const Model = createTestModel({
      field1: {
        type: String,
        unique: true,
      },
      field2: {
        type: Number,
        index: true,
      },
    });

    for (const [def] of Model.schema.indexes() as unknown as Array<[def: IndexDefinition, options: IndexOptions]>) {
      if ("field1" in def) {
        indexesFound.field1 = true;
        expect(def).toHaveProperty("tenant");
        expect(def).not.toHaveProperty("field2");
      }

      if ("field2" in def) {
        indexesFound.field2 = true;
        expect(def).not.toHaveProperty("tenant");
        expect(def).not.toHaveProperty("field1");
      }
    }

    expect(indexesFound.field1).toBeTruthy();
    expect(indexesFound.field2).toBeTruthy();
  });

  it("should consider the sparse property in field level unique indexes.", async () => {
    const indexesFound: Record<string, boolean> = {};
    const Model = createTestModel({
      field1: {
        type: String,
        unique: true,
        sparse: true,
      },
      field2: {
        type: Number,
        index: true,
      },
    });

    for (const [def, options] of Model.schema.indexes() as unknown as Array<
      [def: IndexDefinition, options: IndexOptions]
    >) {
      if ("field1" in def) {
        indexesFound.field1 = true;
        expect(options).toHaveProperty("sparse");
        expect(def).toHaveProperty("tenant");
        expect(def).not.toHaveProperty("field2");
      }

      if ("field2" in def) {
        indexesFound.field2 = true;
        expect(def).not.toHaveProperty("tenant");
        expect(def).not.toHaveProperty("field1");
      }
    }

    expect(indexesFound.field1).toBeTruthy();
    expect(indexesFound.field2).toBeTruthy();
  });

  it("should consider the partialFilterExpression property in field level unique indexes.", async () => {
    const indexesFound: Record<string, boolean> = {};
    const Model = createTestModel({
      field1: {
        type: String,
        unique: true,
        partialFilterExpression: { field2: { $exists: true } },
      },
      field2: {
        type: Number,
        index: true,
      },
    });

    for (const [def, options] of Model.schema.indexes() as unknown as Array<
      [def: IndexDefinition, options: IndexOptions]
    >) {
      if ("field1" in def) {
        indexesFound.field1 = true;
        expect(options).toHaveProperty("partialFilterExpression");
        expect(def).toHaveProperty("tenant");
        expect(def).not.toHaveProperty("field2");
      }

      if ("field2" in def) {
        indexesFound.field2 = true;
        expect(def).not.toHaveProperty("tenant");
        expect(def).not.toHaveProperty("field1");
      }
    }

    expect(indexesFound.field1).toBeTruthy();
    expect(indexesFound.field2).toBeTruthy();
  });
});
