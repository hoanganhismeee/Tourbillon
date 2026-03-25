// In-memory chat session model — no DB table needed.
// Sessions are stored in a ConcurrentDictionary singleton and expire after 24h of inactivity.
namespace backend.Models;

public class ChatMessage
{
    public string Role { get; set; } = "";    // "user" | "assistant"
    public string Content { get; set; } = "";
}

public class ChatSession
{
    public string SessionId { get; set; } = "";
    public List<ChatMessage> History { get; set; } = [];
    public DateTime LastActivity { get; set; } = DateTime.UtcNow;
}
