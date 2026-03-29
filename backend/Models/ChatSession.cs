// Chat session model — no DB table needed.
// Sessions are stored in Redis hashes (key: chat:session:{id}) with a 1-hour TTL.
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
