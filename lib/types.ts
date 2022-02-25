/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AnyObject, HydratedDocument, Model, ObjectId, Schema } from "mongoose";

export interface MongooseTenantOptions {
  /**
   * Whether the mongo tenant plugin is enabled.
   * @default true
   */
  enabled?: boolean;
  /**
   * The name of the tenantId field.
   * @default "tenant"
   */
  tenantIdKey?: string;
  /**
   * The type of the tenant id field.
   * @default String
   */
  tenantIdType?: unknown;
  /**
   * Whether tenant id field should be required.
   * @default false
   */
  requireTenantId?: boolean;
}

export declare class ScopedFields<T> {
  public getTenant(): T[keyof T];
  public byTenant(tenantId: unknown): this;
  public readonly hasTenantContext: true;
}

export type ScopedDocument<
  T,
  TMethodsAndOverrides = Record<string, never>,
  TVirtuals = Record<string, never>,
> = HydratedDocument<T, TMethodsAndOverrides & ScopedFields<T>, TVirtuals>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ScopedModel<
  T,
  TQueryHelpers = Record<string, never>,
  TMethodsAndOverrides = Record<string, never>,
  TVirtuals = Record<string, never>,
> extends Omit<Model<T, TQueryHelpers, TMethodsAndOverrides & ScopedFields<T>, TVirtuals>, keyof ScopedFields<T>>,
    ScopedFields<T> {
  new (doc?: T, fields?: any | null, options?: boolean | AnyObject): ScopedDocument<
    T,
    TMethodsAndOverrides & Pick<ScopedFields<T>, "getTenant">,
    TVirtuals
  >;

  /** Adds a discriminator type. */
  discriminator<D>(name: string | number, schema: Schema, value?: string | number | ObjectId): ScopedModel<D>;
  discriminator<NewT, U>(name: string | number, schema: Schema<NewT, U>, value?: string | number | ObjectId): U;
}
