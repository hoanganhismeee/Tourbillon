// Runnable entry points for the concierge harness.
// These are review tools, not assertions: they print the concierge's real reply, routing
// path, cards, and chips so wording can be judged by eye. Skipped unless CONCIERGE_HARNESS=1,
// so CI never depends on a running ai-service. See Harness/README.md for usage.
using Xunit.Abstractions;

namespace backend.Tests.Harness;

// Gates a harness test behind CONCIERGE_HARNESS=1 — these need a live ai-service and are
// slow enough (real LLM calls) that they must stay out of the default `dotnet test` run.
public sealed class ConciergeHarnessFactAttribute : FactAttribute
{
    public ConciergeHarnessFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("CONCIERGE_HARNESS") != "1")
            Skip = "Set CONCIERGE_HARNESS=1 to run (needs ai-service reachable). See Harness/README.md.";
    }
}

public sealed class ConciergePromptTests
{
    private readonly ITestOutputHelper _output;

    public ConciergePromptTests(ITestOutputHelper output) => _output = output;

    // Default sweep — one prompt per intent family, each on a fresh session.
    // Override with CONCIERGE_PROMPTS ("a || b || c") to sweep your own list.
    private static readonly string[] DefaultSuite =
    [
        "hey there",
        "how do I center a div in CSS",
        "show me Patek Philippe",
        "a blue dial sports watch under 45k",
        "compare the Nautilus and the Royal Oak",
        "tell me about Vacheron Constantin",
        "what is the history of A. Lange & Söhne",
        "I'm a 26 year old woman starting a law career, what should I wear to the office",
        "VC or ALS, which should I choose",
        "something dressier",
    ];

    // Single prompt, set via CONCIERGE_PROMPT. The fastest loop for iterating on wording:
    //   CONCIERGE_HARNESS=1 CONCIERGE_PROMPT="your prompt" dotnet test \
    //     --filter "FullyQualifiedName~SinglePrompt" -l "console;verbosity=detailed"
    [ConciergeHarnessFact]
    public async Task SinglePrompt()
    {
        var prompt = Environment.GetEnvironmentVariable("CONCIERGE_PROMPT")
            ?? "a blue dial sports watch under 45k";

        using var harness = new ConciergeHarness();
        var turn = await harness.SendAsync(prompt);
        _output.WriteLine(turn.Format());
    }

    // Sweeps a list of unrelated prompts, resetting the session between each so no
    // context carries over. Use to check a prompt change did not regress other intents.
    [ConciergeHarnessFact]
    public async Task PromptSuite()
    {
        var prompts = SplitEnv("CONCIERGE_PROMPTS") ?? DefaultSuite;

        using var harness = new ConciergeHarness();
        foreach (var prompt in prompts)
        {
            harness.ResetSession();
            var turn = await harness.SendAsync(prompt);
            _output.WriteLine(turn.Format());
        }
    }

    // Multi-turn on one session — for reviewing context carry-over, brand rejection
    // persistence, and follow-up handling. Override with CONCIERGE_CONVERSATION.
    [ConciergeHarnessFact]
    public async Task Conversation()
    {
        var prompts = SplitEnv("CONCIERGE_CONVERSATION") ??
        [
            "I want a dress watch under 50k",
            "I don't like Patek",
            "something in rose gold",
            "compare the first two",
            "which would you pick",
        ];

        using var harness = new ConciergeHarness();
        foreach (var turn in await harness.ConverseAsync(prompts))
            _output.WriteLine(turn.Format());
    }

    private static string[]? SplitEnv(string name)
    {
        var raw = Environment.GetEnvironmentVariable(name);
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        return raw.Split("||", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }
}
