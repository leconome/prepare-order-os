declare module "@ovhcloud/node-ovh" {
  interface OvhParams {
    endpoint?: string;
    appKey?: string;
    appSecret?: string;
    consumerKey?: string;
    timeout?: number;
  }

  class Ovh {
    constructor(params: OvhParams);
    requestPromised(
      httpMethod: string,
      path: string,
      // biome-ignore lint/suspicious/noExplicitAny: OVH API params are dynamic
      params?: any,
      // biome-ignore lint/suspicious/noExplicitAny: OVH API response is dynamic
    ): Promise<any>;
  }

  export = Ovh;
}
