/* eslint-disable @typescript-eslint/no-this-alias */
/**
 * mongo-tenant - Multi-tenancy for mongoose on document level.
 *
 * @copyright   Copyright (c) 2016-2017, craftup
 * @license     https://github.com/WeAreNova/mongoose-tenant/blob/main/LICENSE MIT
 */

import type mongodb from "mongodb";
import type {
  Connection,
  FilterQuery,
  IndexDefinition,
  IndexOptions,
  Model,
  PipelineStage,
  Query,
  Schema,
} from "mongoose";
import type { MongoTenantOptions } from "./types";

/**
 * MongoTenant is a class aimed for use in mongoose schema plugin scope.
 * It adds support for multi-tenancy on document level (adding a tenant reference field and include this in unique indexes).
 * Furthermore it provides an API for tenant bound models.
 */
class MongoTenant<S extends Schema, O extends MongoTenantOptions> {
  public schema: S;
  private options: Required<MongoTenantOptions>;
  private _modelCache: Record<string, Record<string, ReturnType<typeof this.createTenantAwareModel>>>;

  /**
   * Create a new mongo tenant from a given schema.
   *
   * @param options - the configuration options.
   */
  constructor(schema: S, options: O = {} as O) {
    const modelCache = {};
    this._modelCache = modelCache;
    this.schema = schema;
    this.options = {
      enabled: true,
      tenantIdKey: "tenantId",
      tenantIdType: String,
      tenantIdGetter: "getTenantId",
      accessorMethod: "byTenant",
      requireTenantId: false,
      ...options,
    };
  }

  /**
   * Apply the mongo tenant plugin to the given schema.
   *
   */
  apply(): void {
    this.extendSchema().compoundIndexes().injectApi().installMiddleWare();
  }

  /**
   * Returns the boolean flag whether the mongo tenant is enabled.
   *
   * @returns {boolean}
   */
  isEnabled(): typeof this.options["enabled"] {
    return this.options.enabled;
  }

  /**
   * Return the name of the tenant id field. Defaults to **tenantId**.
   *
   * @returns {string}
   */
  getTenantIdKey(): typeof this.options["tenantIdKey"] {
    return this.options.tenantIdKey;
  }

  /**
   * Return the type of the tenant id field. Defaults to **String**.
   *
   * @returns {unknown}
   */
  getTenantIdType(): typeof this.options["tenantIdType"] {
    return this.options.tenantIdType;
  }

  /**
   * Return the method name for accessing tenant-bound models.
   *
   * @returns {string}
   */
  getAccessorMethod(): typeof this.options["accessorMethod"] {
    return this.options.accessorMethod;
  }

  /**
   * Return the name of the tenant id getter method.
   *
   * @returns {string}
   */
  getTenantIdGetter(): typeof this.options["tenantIdGetter"] {
    return this.options.tenantIdGetter;
  }

  /**
   * Check if tenant id is a required field.
   *
   * @return {boolean}
   */
  isTenantIdRequired(): typeof this.options["requireTenantId"] {
    return this.options.requireTenantId;
  }

  /**
   * Checks if instance is compatible to other plugin instance
   *
   * For population of referenced models it's necessary to detect if the tenant
   * plugin installed in these models is compatible to the plugin of the host
   * model. If they are compatible they are one the same "level".
   *
   * @param {MongoTenant} plugin
   */
  isCompatibleTo<T extends MongoTenant<any, any>>(plugin?: T): boolean {
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
    if (this.isEnabled()) {
      const tenantField = {
        [this.getTenantIdKey()]: {
          index: true,
          type: this.getTenantIdType(),
          required: this.isTenantIdRequired(),
        },
      };
      this.schema.add(tenantField);
    }
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
      // extend uniqueness of indexes by tenant id field
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
      // skip if perserveUniqueKey of an unique field is set to true
      if (path.options.unique !== true || path.options.preserveUniqueKey === true) return;

      // delete the old index
      path._index = null;

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
   *
   * @returns {MongoTenant}
   */
  injectApi(): this {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.schema.statics[this.getAccessorMethod()] = function (tenantId: unknown) {
      const Model = this.base.model(this.modelName);
      if (!self.isEnabled()) return Model;
      const strTenantId = String(tenantId);
      const modelCache = self._modelCache[this.modelName] || (self._modelCache[this.modelName] = {});

      // lookup tenant-bound model in cache
      if (!modelCache[strTenantId]) {
        // Cache the tenant bound model class.
        modelCache[strTenantId] = self.createTenantAwareModel(Model, tenantId);
      }

      return modelCache[strTenantId];
    };
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
  createTenantAwareModel(BaseModel: Model<any>, tenantId: unknown) {
    const tenantIdGetter = this.getTenantIdGetter();
    const tenantIdKey = this.getTenantIdKey();

    const db = this.createTenantAwareDb(BaseModel.db, tenantId);

    class MongoTenantModel extends BaseModel implements Model<any> {
      static get hasTenantContext() {
        return true;
      }
      private static _getTenantId() {
        return tenantId;
      }
      public static [tenantIdGetter]() {
        return tenantId;
      }

      static aggregate(...args: [pipeline: PipelineStage[], callback: mongodb.Callback]) {
        const [pipeline] = args;
        if (!pipeline) return super.aggregate.apply(this, args);

        const tId = this._getTenantId();
        if ((pipeline[0] as PipelineStage.Match).$match) {
          (pipeline[0] as PipelineStage.Match).$match[tenantIdKey] = tId;
        } else {
          pipeline.unshift({ $match: { [tenantIdKey]: tId } });
        }

        return super.aggregate.apply(this, args);
      }

      static deleteOne(...args: [filter: FilterQuery<any>]) {
        const [filter] = args;
        filter[tenantIdKey] = this._getTenantId();
        return super.deleteOne(...args);
      }

      static deleteMany(...args: [filter: FilterQuery<any>]) {
        const [filter] = args;
        filter[tenantIdKey] = this._getTenantId();
        return super.deleteMany(...args);
      }

      static remove(...args: [filter: FilterQuery<any>, callback?: mongodb.Callback]) {
        let [filter] = args;
        if (args.length === 1 && typeof filter === "function") {
          args[1] = filter;
          filter = {};
        }
        filter[tenantIdKey] = this._getTenantId();
        return super.remove(args);
      }

      static insertMany(docs: any | any[], callback?: mongodb.Callback) {
        const self = this;
        const tId = this._getTenantId();

        // Model.inserMany supports a single document as parameter
        if (!Array.isArray(docs)) {
          docs[tenantIdKey] = tId;
        } else {
          docs.forEach(function (doc, key) {
            doc[tenantIdKey] = tId;
          });
        }

        // ensure the returned docs are instanced of the bound multi tenant model
        return super.insertMany(docs, (err, docs) => {
          if (err) {
            return callback && callback(err);
          }

          callback &&
            callback(
              null,
              docs.map((doc) => new self(doc)),
            );
        });
      }

      static get db() {
        return db;
      }
    }

    // inherit all static properties from the mongoose base model
    for (let staticProperty of Object.getOwnPropertyNames(BaseModel)) {
      if (MongoTenantModel.hasOwnProperty(staticProperty) || ["arguments", "caller"].indexOf(staticProperty) !== -1) {
        continue;
      }

      let descriptor = Object.getOwnPropertyDescriptor(BaseModel, staticProperty);
      Object.defineProperty(MongoTenantModel, staticProperty, descriptor);
    }

    // create tenant models for discriminators if they exist
    if (BaseModel.discriminators) {
      MongoTenantModel.discriminators = {};

      for (let key in BaseModel.discriminators) {
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
   * @returns {Connection}
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
   *
   * @returns {MongoTenant}
   */
  installMiddleWare(): this {
    const self = this;
    const tenantIdGetter = this.getTenantIdGetter();
    const tenantIdKey = this.getTenantIdKey();

    function preFindOrCount(this: Query<unknown, unknown>, next: () => void) {
      if (this.model.hasTenantContext) {
        this._conditions[tenantIdKey] = this.model[tenantIdGetter]();
      }
      next();
    }
    this.schema.pre("count", preFindOrCount);
    this.schema.pre("find", preFindOrCount);
    this.schema.pre("countDocuments", preFindOrCount);
    this.schema.pre("findOne", preFindOrCount);
    this.schema.pre("findOneAndRemove", preFindOrCount);

    function preUpdate(this: Query<unknown, unknown>, next: () => void) {
      if (this.model.hasTenantContext) {
        self._guardUpdateQuery(this);
      }
      next();
    }
    this.schema.pre("findOneAndUpdate", preUpdate);
    this.schema.pre("update", preUpdate);
    this.schema.pre("updateMany", preUpdate);

    this.schema.pre("save", function preSave(next) {
      if (this.constructor.hasTenantContext) {
        this[tenantIdKey] = this.constructor[tenantIdGetter]();
      }
      next();
    });

    return this;
  }

  /**
   * Avoid breaking tenant context from update operations.
   *
   * @param {mongoose.Query} query
   * @private
   */
  private _guardUpdateQuery(query: Query<unknown, unknown>) {
    const tenantIdGetter = this.getTenantIdGetter();
    const tenantIdKey = this.getTenantIdKey();
    const tenantId = query.model[tenantIdGetter]();

    query._conditions[tenantIdKey] = tenantId;

    const update = query.getUpdate()!;
    if (Array.isArray(update)) return;
    // avoid jumping tenant context when overwriting a model.
    if ((update.$set && tenantIdKey in update.$set) || query.getOptions().overwrite) {
      query.set(tenantIdKey, tenantId);
    }

    // avoid jumping tenant context from $set operations
    if (query.get(tenantIdKey) !== tenantId) {
      query.set(tenantIdKey, tenantId);
    }
  }
}

/**
 * The mongo tenant mongoose plugin.
 *
 * @param {mongoose.Schema} schema
 * @param {Object} options
 */
function mongoTenantPlugin(schema: Schema, options: MongoTenantOptions) {
  const mongoTenant = new MongoTenant(schema, options);
  mongoTenant.apply();
}

mongoTenantPlugin.MongoTenant = MongoTenant;

export default mongoTenantPlugin;
