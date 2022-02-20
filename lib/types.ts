/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AnyObject, Model } from "mongoose";

export interface MongoTenantOptions {
  /**
   * Whether the mongo tenant plugin is enabled.
   * @default true
   */
  enabled?: boolean;
  /**
   * The name of the tenant id field.
   * @default "tenant"
   */
  tenantIdKey?: string;
  /**
   * The type of the tenant id field.
   * @default String
   */
  tenantIdType?: unknown;
  /**
   * The name of the tenant bound model getter method.
   * @default "byTenant"
   */
  accessorMethod?: string;
  /**
   * Whether tenant id field should be required.
   * @default false
   */
  requireTenantId?: boolean;
}

export interface BoundModelFields<T> {
  getTenant(): T[keyof T];
  readonly hasTenantContext: true;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BoundModel<
  T,
  TQueryHelpers = Record<string, never>,
  TMethodsAndOverrides = Record<string, never>,
  TVirtuals = Record<string, never>,
> extends Omit<Model<T, TQueryHelpers, TMethodsAndOverrides, TVirtuals>, keyof BoundModelFields<T>>,
    BoundModelFields<T> {
  new (doc?: T, fields?: any | null, options?: boolean | AnyObject): T;
}
