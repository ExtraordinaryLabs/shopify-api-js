# @shopify/graphql-client

## 0.9.0

### Minor Changes

- 2b9e06f6: Add the raw network response object to `ResponseErrors`
- 194ddcf2: Update api version validation error, generic error messages and client types

### Patch Changes

- 218f4521: Use the new GraphQL API clients in shopify-api to use all of the latest features, including automatic types for query / mutation return object and variables.

  For more information and examples, see the [migration guide to v9](https://github.com/Shopify/shopify-api-js/blob/main/packages/shopify-api/docs/migrating-to-v9.md#using-the-new-clients).

- 49952d66: Fix `ResponseWithType` to correctly type the `json` return value
- 82ee942e: Update `ResponseWithType` type to extend from the `Response` type

## 0.8.0

### Minor Changes

- ca89ef06: Added the ability to automatically type GraphQL queries to the Storefront API when the files created by @shopify/api-codegen-preset are loaded for the app.
- ef053fa5: Added the ability to automatically type GraphQL queries when the files created by @shopify/api-codegen-preset are loaded for the app.
- 49d5966e: Rename `customHeaders` to `headers` in Api Client utils and types for readibility

## 0.7.0

### Minor Changes

- b830e575: Add API client utility factories for generating the `getHeaders()` and `getGQLClientParams()` functions

## 0.6.0

### Minor Changes

- afe74c1d: Updated types, functions and parameter names to consistently use `Api` and renamed the `ResponseErrors.error` field to `ResponseErrors.errors`. Also updated the client's `request()` to return both the `errors` and `data` if the API response returns partial data and error info.

## 0.5.1

### Patch Changes

- e28c2663: Fixed "validateDomainAndGetStoreUrl()" to always return a secure (i.e. "https") store URL

## 0.5.0

### Minor Changes

- 326520ce: Consolidated and standardized the common API client domain and validation utility functions.

## 0.4.0

### Minor Changes

- a491295a: Add common API client specific utilities and types to the package.

## 0.3.0

### Minor Changes

- bb634937: Added a new `logging` functionality to the client. This feature enables client consumers to log `request/response` and `retry attempt` info if a logger function is provided at initialization. Also, the `retry` error messages were updated for clarity.

## 0.2.0

### Minor Changes

- efc66ead: Added a new `retries` feature to the `graphql-client`. This feature allows client consumers to set the number of HTTP request retries when the API request is abandoned or the API server returns a `429` or `503` response.
- 77be46bb: Added a new `graphql-client` package. This client is a generic GQL client that provides basic functionalities to interact with Shopify's GraphQL APIs.
