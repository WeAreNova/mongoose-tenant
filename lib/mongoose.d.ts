/// <reference types="mongoose" />
/* eslint-disable @typescript-eslint/ban-types */
import { MongooseTenant } from "index";
import { ScopedFields } from "./types";

declare module "mongoose" {
  interface Model<T, TQueryHelpers = {}, TMethodsAndOverrides = {}, TVirtuals = {}> extends Partial<ScopedFields<T>> {
    mongoTenant?: MongooseTenant<Schema<T>, {}>;
  }

  interface IndexOptions {
    /**
     * For mongoose-tenant, disables compound unique key with the tenant field for this index
     */
    preserveUniqueKey?: boolean;
  }

  interface Document<T = any, TQueryHelpers = any, DocType = any> {
    constructor: Model<DocType, TQueryHelpers>;
  }
}
