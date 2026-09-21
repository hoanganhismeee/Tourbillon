namespace backend.Services;

/// Redis keys shared between the concierge and whatever else has to move them. The response cache is
/// versioned rather than deleted: bumping the version retires every cached answer at once, and the
/// keys behind it expire on their own.
public static class ChatCacheKeys
{
    public const string ResponseVersion = "chat:resp:ver";
}
