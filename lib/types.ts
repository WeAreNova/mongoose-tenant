import type { Model } from "mongoose";

export interface MongoTenantOptions {
  /**
   * Whether the mongo tenant plugin is enabled.
   * @default true
   */
  enabled?: boolean;
  /**
   * The name of the tenant id field.
   * @default "tenantId"
   */
  tenantIdKey?: string;
  /**
   * The type of the tenant id field.
   * @default String
   */
  tenantIdType?: unknown;
  /**
   * The name of the tenant id getter method.
   * @default "getTenantId"
   */
  tenantIdGetter?: string;
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

export declare class BoundModel extends Model {
  static get hasTenantContext(): true;
}
