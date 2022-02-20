import { BoundModelFields } from "./types";
declare module "mongoose" {
  // eslint-disable-next-line @typescript-eslint/ban-types
  interface Model<T, TQueryHelpers = {}, TMethodsAndOverrides = {}, TVirtuals = {}>
    extends Partial<BoundModelFields<T>> {
    mongoTenant?: any;
  }

  interface IndexOptions {
    /**
     * For mongoose-tenant, disables compound unique key with the tenant field for this index
     */
    preserveUniqueKey?: boolean;
  }
}
