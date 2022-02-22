/* eslint-disable @typescript-eslint/no-this-alias */
/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/WeAreNova/mongoose-tenant/blob/main/LICENSE MIT
 */

import type mongodb from "mongodb";
import type {
  Aggregate,
  AnyKeys,
  AnyObject,
  Callback,
  Connection,
  HydratedDocument,
  IndexDefinition,
  IndexOptions,
  InsertManyOptions,
  InsertManyResult,
  Model,
  MongooseDocumentMiddleware,
  MongooseQueryMiddleware,
  PipelineStage,
  Schema,
} from "mongoose";
import type { BoundModel, MongooseTenantOptions } from "./types";

function createBoundModel<
  TBase extends new (...args: any[]) => Model<T, TQueryHelpers, TMethodsAndOverrides, TVirtuals>,
  T = any,
  TQueryHelpers = Record<string, never>,
  TMethodsAndOverrides = Record<string, never>,
  TVirtuals = Record<string, never>,
>(BaseModel: TBase, tenantId: unknown, tenantIdKey: string, db: Connection) {
  return class extends BaseModel {
    public db = db;
    public readonly hasTenantContext = true as const;
    // @ts-expect-error - getTenant is optional on a base model but required on a bound model
    public getTenant() {
      return tenantId as T[keyof T];
    }

    aggregate<R>(
      // eslint-disable-next-line @typescript-eslint/ban-types
      ...args: [pipeline?: PipelineStage[], options?: mongodb.AggregateOptions | Function, callback?: Callback<R[]>]
    ): Aggregate<R[]> {
      const [pipeline] = args;
      const tId = this.getTenant();

      if (!pipeline) {
        args[0] = [{ $match: { [tenantIdKey]: tId } }];
      } else if ((pipeline[0] as PipelineStage.Match).$match) {
        (pipeline[0] as PipelineStage.Match).$match[tenantIdKey] = tId;
      } else {
        pipeline.unshift({ $match: { [tenantIdKey]: tId } });
      }

      return super.aggregate.apply(this, args as any) as Aggregate<R[]>;
    }

    insertMany(
      docs: AnyKeys<T> | AnyObject | Array<AnyKeys<T> | AnyObject>,
      options?:
        | InsertManyOptions
        | Callback<Array<HydratedDocument<T, TMethodsAndOverrides, TVirtuals>> | InsertManyResult<T>>,
      callback?: Callback<Array<HydratedDocument<T, TMethodsAndOverrides, TVirtuals>> | InsertManyResult<T>>,
    ) {
      const tId = this.getTenant();
      const cb = typeof options === "function" ? options : callback;

      // Model.insertMany supports a single document as parameter
      if (!Array.isArray(docs)) {
        docs[tenantIdKey as keyof typeof docs] = tId;
      } else {
        docs.forEach(function (doc) {
          doc[tenantIdKey as keyof typeof doc] = tId;
        });
      }

      // ensure the returned docs are instanced of the bound multi tenant model
      if (!cb) {
        return super.insertMany(docs, options as InsertManyOptions).then((res) => res.map((doc) => new this(doc)));
      }

      return super.insertMany(docs as any, typeof options === "function" ? undefined : options, (err, res) => {
        if (err) return cb(err, res);
        if (!Array.isArray(res)) return res;
        cb(
          null,
          res.map((doc) => new this(doc)),
        );
      }) as any; // typescript error as insert many expects a promise to be returned
    }
  } as unknown as BoundModel<T, TQueryHelpers, TMethodsAndOverrides, TVirtuals>;
}

/**
 * MongoTenant is a class aimed for use in mongoose schema plugin scope.
 * It adds support for multi-tenancy on document level (adding a tenant reference field and include this in unique indexes).
 * Furthermore it provides an API for tenant bound models.
 */
export class MongooseTenant<S extends Schema, O extends MongooseTenantOptions> {
  public schema: S;
  private options: Required<MongooseTenantOptions>;
  private _modelCache: Record<string, Record<string, BoundModel<unknown>>>;

  /**
   * Create a new mongo tenant from a given schema.
   *
   * @param options - the configuration options.
   */
  constructor(schema: S, options: O = {} as O) {
    this._modelCache = {};
    this.schema = schema;
    this.options = {
      enabled: true,
      tenantIdKey: "tenant",
      tenantIdType: String,
      accessorMethod: "byTenant",
      requireTenantId: false,
      ...options,
    };
  }

  /**
   * Apply the mongo tenant plugin to the given schema.
   */
  apply(): void {
    this.extendSchema().compoundIndexes().injectApi().installMiddleWare();
  }

  /**
   * Returns the boolean flag whether the mongo tenant is enabled.
   */
  isEnabled() {
    return this.options.enabled;
  }

  /**
   * Return the name of the tenant id field. Defaults to **tenantId**.
   */
  getTenantIdKey() {
    return this.options.tenantIdKey;
  }

  /**
   * Return the type of the tenant id field. Defaults to **String**.
   */
  getTenantIdType() {
    return this.options.tenantIdType;
  }

  /**
   * Return the method name for accessing tenant-bound models.
   */
  getAccessorMethod() {
    return this.options.accessorMethod;
  }

  /**
   * Check if tenant id is a required field.
   */
  isTenantIdRequired() {
    return this.options.requireTenantId;
  }

  /**
   * Checks if instance is compatible to other plugin instance
   *
   * For population of referenced models it's necessary to detect if the tenant
   * plugin installed in these models is compatible to the plugin of the host
   * model. If they are compatible they are one the same "level".
   *
   * @param {MongooseTenant} plugin
   */
  isCompatibleTo<T extends MongooseTenant<Schema<unknown>, Record<string, unknown>>>(plugin?: T): boolean {
    return Boolean(
      plugin &&
        typeof plugin.getAccessorMethod === "function" &&
        typeof plugin.getTenantIdKey === "function" &&
        this.getTenantIdKey() === plugin.getTenantIdKey(),
    );
  }

  /**
   * Inject tenantId field into schema definition.
   */
  extendSchema(): this {
    if (!this.isEnabled()) return this;
    this.schema.add({
      [this.getTenantIdKey()]: {
        index: true,
        type: this.getTenantIdType(),
        required: this.isTenantIdRequired(),
      },
    });
    return this;
  }

  /**
   * Consider the tenant id field in all unique indexes (schema- and field level).
   * Take the optional **preserveUniqueKey** option into account for oupting out the default behaviour.
   */
  compoundIndexes(): this {
    if (!this.isEnabled()) return this;
    // apply tenancy awareness to schema level unique indexes
    this.schema.indexes().forEach((idx) => {
      const index = idx as unknown as [def: IndexDefinition, options: IndexOptions];
      // skip if `preserveUniqueKey` of the index is set to true
      if (index[1].unique !== true || index[1].preserveUniqueKey === true) return;

      const tenantAwareIndex: IndexDefinition = { [this.getTenantIdKey()]: 1 };
      for (const indexedField in index[0]) {
        tenantAwareIndex[indexedField] = index[0][indexedField];
      }
      index[0] = tenantAwareIndex;
    });

    // apply tenancy awareness to field level unique indexes
    this.schema.eachPath((key, path) => {
      if (path.options.unique !== true || path.options.preserveUniqueKey === true) return;
      // create a new one that includes the tenant id field
      this.schema.index(
        {
          [this.getTenantIdKey()]: 1,
          [key]: 1,
        },
        { ...path.options, unique: true },
      );
    });

    return this;
  }

  /**
   * Inject the user-space entry point for mongo tenant.
   * This method adds a static Model method to retrieve tenant bound sub-classes.
   */
  injectApi(): this {
    const isEnabled = this.isEnabled();
    const modelCache = this._modelCache;
    const createTenantAwareModel = this.createTenantAwareModel;

    this.schema.static(this.getAccessorMethod(), function (tenantId: unknown) {
      if (!isEnabled) return this;
      if (!modelCache[this.modelName]) modelCache[this.modelName] = {};

      const strTenantId = String(tenantId);
      const cachedModels = modelCache[this.modelName];
      // lookup tenant-bound model in cache
      if (!cachedModels[strTenantId]) {
        // Cache the tenant bound model class.
        cachedModels[strTenantId] = createTenantAwareModel(this, tenantId);
      }

      return cachedModels[strTenantId];
    });

    const self = this;
    Object.assign(this.schema.statics, {
      get mongoTenant() {
        return self;
      },
    });

    return this;
  }

  /**
   * Create a model class that is bound the given tenant.
   * So that all operations on this model prohibit leaving the tenant scope.
   *
   * @param BaseModel
   * @param tenantId
   */
  createTenantAwareModel<T extends Model<any>>(BaseModel: T, tenantId: unknown) {
    const tenantIdKey = this.getTenantIdKey();
    const db = this.createTenantAwareDb(BaseModel.db, tenantId);

    const MongoTenantModel = createBoundModel(BaseModel, tenantId, tenantIdKey, db);

    // inherit all static properties from the mongoose base model
    for (const staticProperty of Object.getOwnPropertyNames(BaseModel)) {
      if (
        Object.prototype.hasOwnProperty.call(MongoTenantModel, staticProperty) ||
        ["arguments", "caller"].indexOf(staticProperty) !== -1
      ) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(BaseModel, staticProperty);
      if (descriptor) Object.defineProperty(MongoTenantModel, staticProperty, descriptor);
    }

    // create tenant models for discriminators if they exist
    if (BaseModel.discriminators) {
      MongoTenantModel.discriminators = {};

      for (const key in BaseModel.discriminators) {
        MongoTenantModel.discriminators[key] = this.createTenantAwareModel(BaseModel.discriminators[key], tenantId);
      }
    }

    return MongoTenantModel;
  }

  /**
   * Create db connection bound to a specific tenant
   *
   * @param {Connection} unawareDb
   * @param {*} tenantId
   */
  createTenantAwareDb(unawareDb: Connection, tenantId: unknown): Connection {
    const self = this;
    const awareDb: Connection = Object.create(unawareDb);
    awareDb.model = (name: string) => {
      const unawareModel = unawareDb.model(name);
      const otherPlugin = unawareModel.mongoTenant;
      if (!self.isCompatibleTo(otherPlugin)) return unawareModel;
      return (unawareModel as any)[otherPlugin!.getAccessorMethod()](tenantId);
    };
    return awareDb;
  }

  /**
   * Install schema middleware to guard the tenant context of models.
   */
  installMiddleWare() {
    const tenantIdKey = this.getTenantIdKey();

    this.schema.pre(
      [
        "count",
        "countDocuments",
        "deleteMany",
        "deleteOne",
        "estimatedDocumentCount",
        "find",
        "findOne",
        "findOneAndDelete",
        "findOneAndRemove",
        "remove",
      ] as MongooseQueryMiddleware[],
      { document: false, query: true },
      async function filterQueryMiddleware() {
        if (this.model.hasTenantContext) {
          this.setQuery({ ...this.getQuery(), [tenantIdKey]: this.model.getTenant!() });
        }
      },
    );

    this.schema.pre(
      ["findOneAndUpdate", "update", "updateMany", "updateOne"] as MongooseQueryMiddleware[],
      { document: false, query: true },
      async function updateQueryMiddleware() {
        if (this.model.hasTenantContext) {
          const tenantId = this.model.getTenant!();
          this.setQuery({ ...this.getQuery(), [tenantIdKey]: tenantId });
          this.set(tenantIdKey, tenantId);
        }
      },
    );

    this.schema.pre(
      ["save", "updateOne"] as MongooseDocumentMiddleware[] as any,
      { document: true, query: false },
      async function documentMiddleware(this: HydratedDocument<unknown>) {
        const model = this.constructor;
        if (model.hasTenantContext) {
          this.set(tenantIdKey, model.getTenant!());
        }
      },
    );

    return this;
  }
}

/**
 * The mongo tenant mongoose plugin.
 *
 * @param {mongoose.Schema} schema
 * @param {Object} options
 */
function mongoTenantPlugin<T extends Schema>(schema: T, options: MongooseTenantOptions) {
  const mongoTenant = new MongooseTenant(schema, options);
  mongoTenant.apply();
}

export default mongoTenantPlugin;
