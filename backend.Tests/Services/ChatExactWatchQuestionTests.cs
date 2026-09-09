// Tests for the structural check that separates naming a watch from asking about it.
// Naming one gets the deterministic card blurb, which is fast and costs nothing; asking a
// question about it has to reach the model, which has the watch's specs in context. Before
// this split, every message that named a watch got the same fixed sentence back.
using backend.Services;

namespace backend.Tests.Services;

public class ChatExactWatchQuestionTests
{
    private const string Reference = "5527TI/G2/TW0";
    private const string Brand = "Breguet";
    private const string Collection = "Marine";

    private static bool Asks(string query) =>
        ChatService.AsksBeyondNamingWatch(query, Reference, Brand, Collection);

    // -- Lookups: the blurb is the right answer, no model call ------------------

    [Theory]
    [InlineData("5527TI/G2/TW0")]
    [InlineData("the 5527TI/G2/TW0")]
    [InlineData("show me the Breguet Marine 5527TI/G2/TW0")]
    [InlineData("Breguet Marine 5527TI/G2/TW0 watch")]
    [InlineData("find reference 5527TI/G2/TW0")]
    public void BareLookupsDoNotAskAnything(string query)
    {
        Assert.False(Asks(query));
    }

    [Fact]
    public void EmptyQueryIsNotAQuestion()
    {
        Assert.False(ChatService.AsksBeyondNamingWatch("", Reference, Brand, Collection));
        Assert.False(ChatService.AsksBeyondNamingWatch(null, Reference, Brand, Collection));
    }

    // A single leftover token is more often a fragment than a request.
    [Fact]
    public void OneStrayTokenIsStillALookup()
    {
        Assert.False(Asks("5527TI/G2/TW0 specs"));
    }

    // -- Questions: these need the model ---------------------------------------

    [Theory]
    [InlineData("What is the case of the 5527TI/G2/TW0 made of?")]
    [InlineData("How water resistant is the 5527TI/G2/TW0?")]
    [InlineData("What is the power reserve of the 5527TI/G2/TW0?")]
    [InlineData("Is the 5527TI/G2/TW0 automatic or manual?")]
    [InlineData("Would the 5527TI/G2/TW0 suit an office job?")]
    [InlineData("How does the 5527TI/G2/TW0 compare with a diver?")]
    public void SpecAndAdviceQuestionsAskSomething(string query)
    {
        Assert.True(Asks(query));
    }

    // The brand and collection names are part of naming the watch, so repeating them does
    // not turn a lookup into a question.
    [Fact]
    public void RepeatingBrandAndCollectionIsNotAQuestion()
    {
        Assert.False(Asks("Breguet Marine 5527TI/G2/TW0"));
    }

    // Diacritics and punctuation in a reference must not leak through as stray tokens.
    [Fact]
    public void PunctuationInTheReferenceIsNotCountedAsAQuestion()
    {
        Assert.False(ChatService.AsksBeyondNamingWatch(
            "A. Lange & Söhne Lange 1 191.032", "191.032", "A. Lange & Söhne", "Lange 1"));
    }
}
