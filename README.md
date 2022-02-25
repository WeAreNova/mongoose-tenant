<p align="center">
  <a href="https://github.com/WeAreNova"><img src="https://github.com/WeAreNova/mui-data-table/raw/main/docs/assets/favicon.png" height="90px"></a>
</p>
<h1 align="center">
  Mongoose Tenant
</h1>

<div align="center">

A document-based multi-tenancy plugin for [Mongoose v6](https://github.com/Automattic/mongoose).

[![npm (scoped)](https://img.shields.io/npm/v/@wearenova/mongoose-tenant?logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@wearenova/mongoose-tenant) [![npm](https://img.shields.io/npm/dm/@wearenova/mongoose-tenant?logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@wearenova/mongoose-tenant) ![GitHub](https://img.shields.io/github/license/WeAreNova/mongoose-tenant?style=for-the-badge) [![GitHub Workflow Status](https://img.shields.io/github/workflow/status/WeAreNova/mongoose-tenant/Build%20and%20Publish?logo=github&style=for-the-badge)](https://github.com/WeAreNova/mongoose-tenant)

</div>

**Prelude**

There are 3 ways of implementing multi-tenancy in mongoDB:

- document-level (cheap and easy to administer but only secured by app logic)
- collection-level (not recommended, due to breaking mongoDB concepts)
- database-level (very flexible and secure but expensive)

**Contents**

- [About](#about)
- [Installation](#installation)
- [Usage](#usage)
  - [Indexes](#indexes)
  - [Scoped Models & Populate](#scoped-models--populate)
  - [Configuration](#configuration)

### About

Originally forked from [Mongoose Tenant](https://github.com/craftup/node-mongo-tenant), this version of the plugin has been heavily refactored and is built with TypeScript for Mongoose v6. It is also intended to be maintained for the foreseeable future.

Mongoose Tenant is a highly configurable plugin solving multi-tenancy problems on a document level.

It creates a tenant-reference field while also taking care of unique indexes. Furthermore, a model scoped to a tenant can be created with ease. These "scoped models" limit access solely to documents of the specified tenant.

### Installation

```shell
// with npm
npm install --save @wearenova/mongoose-tenant

// with yarn
$ yarn add @wearenova/Mongoose Tenant
```

### Usage

Register the plugin on the relevant mongoose schema.

```ts
import mongoose from "mongoose";
import mongooseTenant from "Mongoose Tenant";

const MySchema = new mongoose.Schema({});
MySchema.plugin(mongooseTenant);

const MyModel = mongoose.model("MyModel", MySchema);
```

Retrieve the scoped model with the static `byTenant` method. This will return a new model subclass that has guards in place to prevent access to documents from other tenants.

```ts
const MyScopedModel = MyModel.byTenant("some-tenant-id");

new MyScopedModel().getTenant() === "some-tenant-id"; // true

// silently ignore other tenant scope
new MyScopedModel({
  tenantId: "some-other-tenant-id",
}).getTenant() === "some-tenant-id"; // true
```

You can check for tenant context of a model class or instance by checking the `hasTenantContext` property. If this is `truthy` you may want to retrieve the tenant, this can be done via the `getTenant()` method.

```ts

// When Mongoose Tenant is enabled on a schema, all scoped models
// and there instances provide the `hasTenantContext` flag
if (SomeModelClassOrInstance.hasTenantContext) {
  const tenantId = SomeModelClassOrInstance.getTenant();
  ...
}
```

#### Indexes

The Mongoose Tenant takes care of the tenant-reference field, so that you will be able to use your existing schema definitions and just plugin the Mongoose Tenant without changing a single line of the schema definition.

But under the hood the Mongoose Tenant creates an indexed field _(tenant by default)_ and includes this in all defined unique indexes. So, by default, all unique fields (and compound indexes) are unique for a single tenant id.

You may have use-cases where you want to maintain global uniqueness. To skip the automatic unique key extension of the plugin, for a specific index, you can set the `preserveUniqueKey` config option to `true`.

```ts
const MySchema = new mongoose.Schema({
  someField: {
    unique: true,
    preserveUniqueKey: true,
  },
  anotherField: String,
  yetAnotherField: String,
});

MySchema.index(
  {
    anotherField: 1,
    yetAnotherField: 1,
  },
  {
    unique: true,
    preserveUniqueKey: true,
  },
);
```

#### Scoped Models & Populate

Once a scoped model is created it will try to keep the context for other models created via it. Whenever it detects that a subsequent models tenant configuration is compatible to its own, it will return that model scoped to the same tenant context.

```ts
const AuthorSchema = new mongoose.Schema({});
AuthorSchema.plugin(mongooseTenant);
const AuthorModel = mongoose.model("author", AuthorSchema);

const BookSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "author" },
});
BookSchema.plugin(mongooseTenant);
const BookModel = mongoose.model("book", BookSchema);

const ScopedBookModel = BookModel.byTenant("some-tenant-id");
ScopedBookModel.model("author"); // return author model scoped to "some-tenant-id"
ScopedBookModel.db.model("author"); // return author model scoped to "some-tenant-id"
```

#### Configuration

Mongoose Tenant works out of the box. All config options are optional. But, you have the ability to adjust the behaviour and api of the plugin to fit your needs.

```ts
const config = {
  /**
   * Whether the Mongoose Tenant plugin MAGIC is enabled. Default: true
   */
  enabled: false,

  /**
   * The name of the tenant id field. Default: tenant
   */
  tenantIdKey: "customer",

  /**
   * The type of the tenant id field. Default: String
   */
  tenantIdType: Number,

  /**
   * Enforce tenantId field to be set. Default: false
   */
  requireTenantId: true,
};

SomeSchema.plugin(mongooseTenant, config);
```
