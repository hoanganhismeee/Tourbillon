// Tests for the positive watch-vocabulary check that decides whether a query can skip the
// off-topic classifier. A word missing here sends a genuine watch query to a model that can refuse it.
using backend.Services;

namespace backend.Tests.Services;

public class WatchDomainSignalTests
{
    [Theory]
    [InlineData("I want to see the mechanism from the front")]
    [InlineData("a mechanical one for my father")]
    [InlineData("skeleton dial")]
    [InlineData("an openworked piece")]
    [InlineData("something with a nice movement")]
    public void Words_that_only_describe_a_watch_count_as_a_watch_query(string query)
    {
        Assert.True(WatchFinderService.HasWatchDomainSignal(query));
    }

    [Theory]
    [InlineData("what's the weather in London")]
    [InlineData("recommend a restaurant near me")]
    [InlineData("how do I fix my bike chain")]
    public void Unrelated_messages_still_go_to_the_classifier(string query)
    {
        Assert.False(WatchFinderService.HasWatchDomainSignal(query));
    }
}
