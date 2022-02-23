/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
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

    for (const index of Model.schema.indexes() as unknown as Array<[def: IndexDefinition, options: IndexOptions]>) {
      if (index[1] && index[1].name) {
        indexesFound[index[1].name] = true;

        switch (index[1].name) {
          case "index1":
            expect("tenantId" in index[0]).toBeTruthy();
            expect("field1" in index[0]).toBeTruthy();
            break;
          case "index2":
            expect(!("tenantId" in index[0])).toBeTruthy();
            expect("field2" in index[0]).toBeTruthy();
            break;
          case "index3":
            expect("tenantId" in index[0]).toBeTruthy();
            expect("field1" in index[0]).toBeTruthy();
            expect("field2" in index[0]).toBeTruthy();
            break;
        }
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

    for (const index of Model.schema.indexes() as unknown as Array<[def: IndexDefinition, options: IndexOptions]>) {
      if ("field1" in index[0]) {
        indexesFound.field1 = true;
        expect("tenantId" in index[0]).toBeTruthy();
        expect(!("field2" in index[0])).toBeTruthy();
      }

      if ("field2" in index[0]) {
        indexesFound.field2 = true;
        expect(!("tenantId" in index[0])).toBeTruthy();
        expect(!("field1" in index[0])).toBeTruthy();
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

    for (const index of Model.schema.indexes() as unknown as Array<[def: IndexDefinition, options: IndexOptions]>) {
      if ("field1" in index[0]) {
        indexesFound.field1 = true;
        expect("sparse" in index[1]).toBeTruthy();
        expect("tenantId" in index[0]).toBeTruthy();
        expect(!("field2" in index[0])).toBeTruthy();
      }

      if ("field2" in index[0]) {
        indexesFound.field2 = true;
        expect(!("tenantId" in index[0])).toBeTruthy();
        expect(!("field1" in index[0])).toBeTruthy();
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

    for (const index of Model.schema.indexes() as unknown as Array<[def: IndexDefinition, options: IndexOptions]>) {
      if ("field1" in index[0]) {
        indexesFound.field1 = true;
        expect("partialFilterExpression" in index[1]).toBeTruthy();
        expect("tenantId" in index[0]).toBeTruthy();
        expect(!("field2" in index[0])).toBeTruthy();
      }

      if ("field2" in index[0]) {
        indexesFound.field2 = true;
        expect(!("tenantId" in index[0])).toBeTruthy();
        expect(!("field1" in index[0])).toBeTruthy();
      }
    }

    expect(indexesFound.field1).toBeTruthy();
    expect(indexesFound.field2).toBeTruthy();
  });
});
