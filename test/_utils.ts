/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost/mongo-tenant-test";
import mongoTenantPlugin from "lib";
import type { BoundModel, MongooseTenantOptions } from "lib/types";
import mochaMongoose from "mocha-mongoose";
import mongoose, { Model, Schema, SchemaDefinition, SchemaOptions } from "mongoose";

let testModelUnifier = 0;

export function createTestModel<T extends boolean = true>(
  schemaDefinition: SchemaDefinition,
  options?: {
    applyOnSchema?(schema: Schema): void;
    withPlugin?: T;
    mongoTenant?: MongooseTenantOptions;
    schemaOptions?: SchemaOptions;
  },
) {
  options = {
    withPlugin: true as T,
    ...options,
  };

  const schema = new Schema(schemaDefinition, options.schemaOptions);

  if (typeof options.applyOnSchema === "function") {
    options.applyOnSchema(schema);
  }

  if (options.withPlugin) {
    schema.plugin(mongoTenantPlugin, options.mongoTenant);
  }

  return mongoose.model(`mongoTenantTestModel${++testModelUnifier}`, schema) as T extends true
    ? BoundModel<unknown>
    : Model<unknown>;
}

export function clearDatabase() {
  mochaMongoose(MONGO_URI);

  beforeEach(function (done) {
    if (mongoose.connection.db) return done();
    mongoose.connect(MONGO_URI, done);
  });
}
