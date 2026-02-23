export interface CloudinaryApi {
  config: (opts: {
    cloud_name: string;
    api_key: string;
    api_secret: string;
  }) => void;
  utils: {
    api_sign_request: (
      params: Record<string, unknown>,
      secret: string,
    ) => string;
  };
}
