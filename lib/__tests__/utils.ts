/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/craftup/node-mongo-tenant/blob/master/LICENSE MIT
 */

import mongoose, { Model, Schema, SchemaDefinition, SchemaOptions } from "mongoose";
import mongoTenantPlugin from "../";
import type { BoundModel, MongooseTenantOptions } from "../types";

mongoose.set("returnOriginal", false);

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
  options = { withPlugin: true as T, ...options };

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

export async function connect() {
  await mongoose.connect(process.env.MONGO_URL!);
}

export async function clearDatabase() {
  for (const collection in mongoose.connection.collections) {
    await mongoose.connection.dropCollection(collection);
  }
  await mongoose.disconnect();
}
