namespace backend.Settings;

/// Configuration POCO for storage provider settings.
/// Bound from appsettings.json "AWS" and "Storage" sections.
/// Supports Cloudinary (default) or S3-compatible storage providers.
public class StorageSettings
{
    public string Provider         { get; set; } = "Cloudinary";
    public string Region           { get; set; } = "";
    public string BucketName       { get; set; } = "";
    public string CloudFrontDomain { get; set; } = "";
    public string AccessKeyId      { get; set; } = "";
    public string SecretAccessKey  { get; set; } = "";
}
